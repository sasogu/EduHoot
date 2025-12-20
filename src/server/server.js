const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const crypto = require('crypto');

const { parseCsv, toQuestion } = require('./importCsv');
const { LiveGames } = require('./utils/liveGames');
const { Players } = require('./utils/players');
const {
  normalizeQuestionMeta,
  normalizeCorrectAnswers,
  splitAcceptedAnswers,
  parseLenientNumber
} = require('./questionUtils');

const publicPath = path.join(__dirname, '../public');
const BODY_LIMIT = '1mb';
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const games = new LiveGames();
const players = new Players();
const sessions = new Map();
const soloScoreBuffer = [];
const SOLO_SCORE_BUFFER_DELAY = 150;
const SOLO_SCORE_BUFFER_MAX = 50;
let soloScoreFlushTimer = null;
let soloScoreFlushPromise = null;
let soloScoreFlushResolve = null;
let soloScoreFlushInFlight = false;
const answerRate = new Map(); // clave: hostId:ip -> { count, windowStart }
const ANSWER_RATE_WINDOW_MS = 3000;
const ANSWER_RATE_MAX = 4;

// Log y absorbe errores no controlados para evitar que el proceso caiga
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
io.on('error', (err) => {
  console.error('[socket-io-error]', err);
});
io.engine.on('connection_error', (err) => {
  console.error('[socket-connection-error]', err);
});
const ephemeralQuizzes = new Map();
const GLOBAL_OWNER_ID = 'global-anon-owner';
const GLOBAL_OWNER_EMAIL = 'anon@local';
const GAME_CLEANUP_DELAY = 100 * 1000; // 90 segundos tras GameOver
const GAME_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos de inactividad
const MONGO_MAX_POOL_SIZE = parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 50;

function extractKahootId(raw = '') {
  if (!raw) return '';
  const idMatch = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (idMatch) return idMatch[1];
  const clean = raw.trim();
  if (clean.length === 36) return clean;
  return '';
}

function isEphemeralExpired(quiz) {
  if (!quiz || !quiz.expires) return false;
  const exp = coerceDate(quiz.expires);
  if (!exp) return false;
  return exp.getTime() < Date.now();
}

function normalizeEphemeralQuiz(raw) {
  if (!raw) return null;
  return {
    ...raw,
    createdAt: coerceDate(raw.createdAt, new Date()),
    updatedAt: coerceDate(raw.updatedAt, new Date()),
    expires: coerceDate(raw.expires, null)
  };
}

async function persistEphemeralQuiz(quiz) {
  if (!quiz || !quiz.id) return;
  ephemeralQuizzes.set(quiz.id, quiz);
  try {
    const collection = await getEphemeralCollection();
    await collection.replaceOne({ id: quiz.id }, quiz, { upsert: true });
  } catch (err) {
    console.error('persistEphemeralQuiz error', err);
  }
}

async function deleteEphemeralQuiz(id) {
  if (!id) return;
  ephemeralQuizzes.delete(id);
  try {
    const collection = await getEphemeralCollection();
    await collection.deleteOne({ id });
  } catch (err) {
    console.error('deleteEphemeralQuiz error', err);
  }
}

async function saveEphemeralQuiz(quiz) {
  const id = `local-${crypto.randomBytes(6).toString('hex')}`;
  const visibility = normalizeVisibility(quiz.visibility, 'public');
  const allowClone = normalizeAllowClone(quiz.allowClone, false);
  // Si se usa para invitados, caduca en 24h
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const ownerToken = (quiz.ownerToken || '').toString().trim();
  const sanitized = {
    id,
    name: quiz.name || 'Quiz local',
    questions: normalizeQuestions(quiz.questions || []),
    tags: normalizeTags(quiz.tags || []),
    playsCount: 0,
    playersCount: 0,
    visibility,
    allowClone,
    sourceQuizId: quiz.sourceQuizId,
    createdAt: new Date(),
    updatedAt: new Date(),
    expires
  };
  if (ownerToken) {
    sanitized.ownerToken = ownerToken;
  }
  await persistEphemeralQuiz(sanitized);
  return sanitized;
}

async function getEphemeralQuiz(id) {
  if (!id) return null;
  const cached = ephemeralQuizzes.get(id);
  if (cached) {
    if (isEphemeralExpired(cached)) {
      await deleteEphemeralQuiz(id);
      return null;
    }
    return cached;
  }
  try {
    const collection = await getEphemeralCollection();
    const doc = await collection.findOne({ id });
    if (!doc) return null;
    const normalized = normalizeEphemeralQuiz(doc);
    if (!normalized || isEphemeralExpired(normalized)) {
      await deleteEphemeralQuiz(id);
      return null;
    }
    ephemeralQuizzes.set(id, normalized);
    return normalized;
  } catch (err) {
    console.error('getEphemeralQuiz error', err);
    return null;
  }
}

function isLocalQuizId(id) {
  return typeof id === 'string' && id.startsWith('local-');
}

// MongoDB setup (single shared client to avoid legacy OP_QUERY code path)
// Prefer IPv4 loopback to avoid ::1 connection issues on some setups
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
const DB_NAME = 'kahootDB';
const GAMES_COLLECTION = 'kahootGames';
const USERS_COLLECTION = 'users';
const SOLO_SCORES_COLLECTION = 'soloScores';
const EPHEMERAL_COLLECTION = 'ephemeralQuizzes';
const MONGO_MAX_RETRIES = 5;
const MONGO_RETRY_DELAY_MS = 3000;
const mongoClient = new MongoClient(mongoUrl, {
  serverSelectionTimeoutMS: 3000,
  maxPoolSize: MONGO_MAX_POOL_SIZE
});
let db;
let mongoReadyPromise = null;
let indexesReadyPromise = null;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const bulkUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const uploadRate = new Map(); // clave: ip -> { count, windowStart }

function uploadRateLimiter(req, res, next) {
  const windowMs = 10 * 60 * 1000; // 10 minutos
  const max = 10; // máximo subidas por IP en la ventana
  const now = Date.now();
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const entry = uploadRate.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  uploadRate.set(key, entry);
  if (entry.count > max) {
    return res.status(429).json({ error: 'Límite de subidas alcanzado. Intenta más tarde.' });
  }
  // limpieza ocasional
  if (uploadRate.size > 1000) {
    for (const [k, v] of uploadRate.entries()) {
      if (now - v.windowStart > windowMs) uploadRate.delete(k);
    }
  }
  return next();
}
function logGames(tag) {
  const pins = games.games.map((g) => `${g.pin}(host:${g.hostId})`);
  console.log(`[${tag}] Active games:`, pins.length ? pins.join(', ') : 'none');
}

function logEvent(tag, payload) {
  console.log(`[${tag}]`, payload);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectMongoWithRetry(attempt = 1) {
  try {
    console.log(`Connecting to MongoDB at ${mongoUrl} (attempt ${attempt})`);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    await ensureIndexes(db);
    console.log(`Connected to MongoDB at ${mongoUrl}`);
    mongoReadyPromise = null;
    return db;
  } catch (err) {
    console.error(`MongoDB connection error (attempt ${attempt})`, err && err.message ? err.message : err);
    db = null;
    mongoReadyPromise = null;
    if (attempt >= MONGO_MAX_RETRIES) {
      throw err;
    }
    await wait(MONGO_RETRY_DELAY_MS * attempt);
    return connectMongoWithRetry(attempt + 1);
  }
}

async function getDb() {
  if (db) return db;
  if (mongoReadyPromise) return mongoReadyPromise;
  mongoReadyPromise = connectMongoWithRetry();
  return mongoReadyPromise;
}

async function ensureIndexes(dbInstance) {
  if (indexesReadyPromise) return indexesReadyPromise;
  const games = dbInstance.collection(GAMES_COLLECTION);
  const users = dbInstance.collection(USERS_COLLECTION);
  const soloScores = dbInstance.collection(SOLO_SCORES_COLLECTION);
  const ephemerals = dbInstance.collection(EPHEMERAL_COLLECTION);
  indexesReadyPromise = Promise.all([
    games.createIndex({ id: 1 }, { unique: true, sparse: true }),
    games.createIndex({ visibility: 1 }),
    games.createIndex({ ownerId: 1 }),
    soloScores.createIndex({ quizId: 1, score: -1, createdAt: 1 }),
    users.createIndex({ email: 1 }, { unique: true, sparse: true }),
    users.createIndex({ resetToken: 1 }, { sparse: true }),
    ephemerals.createIndex({ id: 1 }, { unique: true, sparse: true }),
    ephemerals.createIndex({ expires: 1 }, { expireAfterSeconds: 0 })
  ]).catch((err) => {
    console.error('ensureIndexes error', err);
    indexesReadyPromise = null;
  });
  return indexesReadyPromise;
}

async function getGamesCollection() {
  const database = await getDb();
  return database.collection(GAMES_COLLECTION);
}

function ownerTokenFromReq(req) {
  const hdr = req.headers['x-owner-token'];
  if (hdr && typeof hdr === 'string') return hdr.trim();
  return '';
}

async function getUsersCollection() {
  const database = await getDb();
  return database.collection(USERS_COLLECTION);
}

async function getSoloScoresCollection() {
  const database = await getDb();
  return database.collection(SOLO_SCORES_COLLECTION);
}

async function getEphemeralCollection() {
  const database = await getDb();
  return database.collection(EPHEMERAL_COLLECTION);
}

function normalizeSoloName(name) {
  const clean = (name || '').toString().trim();
  if (!clean) return 'Anónimo';
  return clean.slice(0, 40);
}

function normalizePlayerName(name) {
  const chars = (name || '').toString().match(/[0-9a-zA-Z]/g) || [];
  const trimmed = chars.join('').toUpperCase().slice(0, 3);
  return trimmed || '???';
}

function socketIp(socket) {
  const hdr = socket && socket.handshake && socket.handshake.headers && socket.handshake.headers['x-forwarded-for'];
  if (hdr && typeof hdr === 'string' && hdr.length) {
    return hdr.split(',')[0].trim();
  }
  if (socket && socket.handshake && socket.handshake.address) return socket.handshake.address;
  if (socket && socket.conn && socket.conn.remoteAddress) return socket.conn.remoteAddress;
  return 'unknown';
}

function allowAnswer(socket, hostId) {
  const ip = socketIp(socket);
  const key = `${hostId || 'nohost'}:${ip}`;
  const now = Date.now();
  const entry = answerRate.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > ANSWER_RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  answerRate.set(key, entry);
  if (entry.count > ANSWER_RATE_MAX) {
    if (answerRate.size > 2000) {
      for (const [k, v] of answerRate.entries()) {
        if (now - v.windowStart > ANSWER_RATE_WINDOW_MS) answerRate.delete(k);
      }
    }
    return false;
  }
  if (answerRate.size > 2000) {
    for (const [k, v] of answerRate.entries()) {
      if (now - v.windowStart > ANSWER_RATE_WINDOW_MS) answerRate.delete(k);
    }
  }
  return true;
}

async function getTopSoloScores(quizIdKey, limit = 10) {
  const collection = await getSoloScoresCollection();
  const top = await collection
    .find({ quizId: quizIdKey })
    .sort({ score: -1, createdAt: 1 })
    .limit(limit)
    .project({ _id: 0, quizId: 1, quizName: 1, playerName: 1, score: 1, totalQuestions: 1, createdAt: 1 })
    .toArray();
  return top;
}

function scheduleSoloScoreFlush(immediate = false) {
  if (!soloScoreFlushPromise) {
    soloScoreFlushPromise = new Promise((resolve) => {
      soloScoreFlushResolve = resolve;
    });
  }
  if (immediate) {
    if (soloScoreFlushTimer) {
      clearTimeout(soloScoreFlushTimer);
      soloScoreFlushTimer = null;
    }
    setImmediate(runSoloScoreFlush);
    return soloScoreFlushPromise;
  }
  if (!soloScoreFlushTimer) {
    soloScoreFlushTimer = setTimeout(runSoloScoreFlush, SOLO_SCORE_BUFFER_DELAY);
  }
  return soloScoreFlushPromise;
}

async function runSoloScoreFlush() {
  if (soloScoreFlushInFlight) {
    if (!soloScoreFlushTimer) {
      soloScoreFlushTimer = setTimeout(runSoloScoreFlush, SOLO_SCORE_BUFFER_DELAY);
    }
    return;
  }
  soloScoreFlushInFlight = true;
  if (soloScoreFlushTimer) {
    clearTimeout(soloScoreFlushTimer);
    soloScoreFlushTimer = null;
  }
  const docs = soloScoreBuffer.splice(0, soloScoreBuffer.length);
  const resolve = soloScoreFlushResolve;
  soloScoreFlushPromise = null;
  soloScoreFlushResolve = null;
  try {
    if (docs.length > 0) {
      const collection = await getSoloScoresCollection();
      const ops = docs.map((doc) => ({ insertOne: { document: doc } }));
      await collection.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.error('soloScore bulkWrite error', err);
  } finally {
    soloScoreFlushInFlight = false;
    if (resolve) resolve();
  }
}

function enqueueSoloScore(doc) {
  soloScoreBuffer.push(doc);
  const immediate = soloScoreBuffer.length >= SOLO_SCORE_BUFFER_MAX;
  return scheduleSoloScoreFlush(immediate);
}

async function findGameById(gameId) {
  const collection = await getGamesCollection();
  const numId = parseInt(gameId, 10);
  const candidates = [];
  if (!Number.isNaN(numId)) candidates.push(numId);
  candidates.push(String(gameId));
  const query = {
    $or: [
      { id: { $in: candidates } },
      { _id: { $in: candidates } }
    ]
  };
  const [game] = await collection.find(query).limit(1).toArray();
  if (game) return game;
  if (typeof gameId === 'string' && gameId.startsWith('local-')) {
    return await getEphemeralQuiz(gameId);
  }
  return null;
}

async function nextGameId(collection) {
  const doc = await collection.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).next();
  const maxId = doc && doc.id ? doc.id : 0;
  return maxId + 1;
}

function escapeCsvField(value) {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function quizToCsv(quiz) {
  const header = 'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia';
  const lines = (quiz.questions || []).map((q) => {
    const answers = Array.isArray(q.answers) ? q.answers : ['', '', '', ''];
    const type = (q && q.type) ? String(q.type) : 'quiz';
    let correctVals = Array.isArray(q && q.correctAnswers) && q.correctAnswers.length
      ? q.correctAnswers.join(',')
      : (q && q.correct ? q.correct : 1);

    let texto = '';
    let numero = '';
    let tolerancia = '';

    if (type === 'short-answer') {
      const accepted = Array.isArray(q.acceptedAnswers)
        ? q.acceptedAnswers
        : splitAcceptedAnswers(q.texto || q.correctText || q.correcta || q.correct);
      texto = accepted.join('|');
      // Compatibilidad: en correctVals también ponemos las respuestas.
      correctVals = texto;
    }

    if (type === 'numeric') {
      const n = parseLenientNumber(q.numericAnswer ?? q.numero ?? q.correcta ?? q.correct);
      const t = parseLenientNumber(q.tolerance ?? q.tolerancia ?? q.numericTolerance);
      numero = n === null ? '' : String(n);
      tolerancia = t === null ? '0' : String(t);
      correctVals = numero;
    }

    const row = [
      escapeCsvField(type),
      escapeCsvField(q.question || ''),
      escapeCsvField(answers[0] || ''),
      escapeCsvField(answers[1] || ''),
      escapeCsvField(answers[2] || ''),
      escapeCsvField(answers[3] || ''),
      escapeCsvField(q.time || 20),
      escapeCsvField(correctVals),
      escapeCsvField(q.image || ''),
      escapeCsvField(q.video || ''),
      escapeCsvField(texto),
      escapeCsvField(numero),
      escapeCsvField(tolerancia)
    ];
    return row.join(';');
  });
  return [header].concat(lines).join('\n');
}

function escapeHtmlText(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttrValue(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrapCdata(value = '') {
  const str = String(value || '');
  const safe = str.replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

function buildQuestionHtml(question) {
  const parts = [];
  const text = (question.question || '').trim();
  if (text) {
    parts.push(`<p>${escapeHtmlText(text)}</p>`);
  }
  if (question.image) {
    parts.push(`<p><img src="${escapeAttrValue(question.image)}" alt=""/></p>`);
  }
  if (question.video) {
    parts.push(
      `<p><video controls="controls" preload="metadata" src="${escapeAttrValue(
        question.video
      )}"></video></p>`
    );
  }
  return parts.join('');
}

function quizToMoodleXml(quiz) {
  const title = (quiz.name || 'EduHoot quiz').trim() || 'EduHoot quiz';
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<quiz>'];

  function normalizeCorrectAnswersForExport(question, maxAnswerIndex) {
    const limit = Math.max(1, parseInt(maxAnswerIndex, 10) || 4);
    const list = Array.isArray(question && question.correctAnswers) && question.correctAnswers.length
      ? question.correctAnswers.slice()
      : (typeof question?.correct !== 'undefined' ? [question.correct] : []);
    const seen = new Set();
    const out = [];
    list.forEach((v) => {
      let num = parseInt(v, 10);
      if (!Number.isFinite(num)) return;
      num = Math.max(1, Math.min(limit, num));
      if (seen.has(num)) return;
      seen.add(num);
      out.push(num);
    });
    if (!out.length) out.push(1);
    out.sort((a, b) => a - b);
    return out;
  }

  function getNonEmptyAnswersForExport(question, maxCount) {
    const raw = Array.isArray(question && question.answers) ? question.answers.slice(0, maxCount) : [];
    while (raw.length < maxCount) raw.push('');
    const out = [];
    raw.forEach((text, idx) => {
      const clean = (text || '').toString().trim();
      if (!clean) return;
      out.push({ index: idx + 1, text: clean });
    });
    return out;
  }

  function getTfFallbackAnswers() {
    return ['Verdadero', 'Falso'];
  }

  questions.forEach((question, index) => {
    const qType = (question && question.type) ? String(question.type) : 'quiz';
    const nameText = `${title} pregunta ${index + 1}`;
    const html = buildQuestionHtml(question) || `<p>${escapeHtmlText((question && question.question) || '')}</p>`;

    if (qType === 'short-answer') {
      lines.push('  <question type="shortanswer">');
      lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
      lines.push('    <questiontext format="html">');
      lines.push(`      <text>${wrapCdata(html)}</text>`);
      lines.push('    </questiontext>');
      lines.push('    <defaultgrade>1</defaultgrade>');
      lines.push('    <penalty>0.0</penalty>');
      lines.push('    <hidden>0</hidden>');
      // Moodle: 0 = no distinguir mayúsculas/minúsculas.
      lines.push('    <usecase>0</usecase>');

      const accepted = Array.isArray(question.acceptedAnswers)
        ? question.acceptedAnswers
        : splitAcceptedAnswers(question.texto || question.correctText || question.correcta || question.correct);

      const safe = accepted.length ? accepted : [''];
      safe.forEach((ans) => {
        lines.push('    <answer fraction="100" format="html">');
        lines.push(`      <text>${wrapCdata(escapeHtmlText(ans || ''))}</text>`);
        lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
        lines.push('    </answer>');
      });
      lines.push('  </question>');
      return;
    }

    if (qType === 'numeric') {
      lines.push('  <question type="numerical">');
      lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
      lines.push('    <questiontext format="html">');
      lines.push(`      <text>${wrapCdata(html)}</text>`);
      lines.push('    </questiontext>');
      lines.push('    <defaultgrade>1</defaultgrade>');
      lines.push('    <penalty>0.0</penalty>');
      lines.push('    <hidden>0</hidden>');

      const n = parseLenientNumber(question.numericAnswer ?? question.numero ?? question.correcta ?? question.correct);
      const t = parseLenientNumber(question.tolerance ?? question.tolerancia ?? question.numericTolerance);
      const tol = t === null ? 0 : t;
      lines.push('    <answer fraction="100" format="html">');
      lines.push(`      <text>${wrapCdata(escapeHtmlText(n === null ? '' : String(n)))}</text>`);
      lines.push(`      <tolerance>${wrapCdata(escapeHtmlText(String(tol)))}</tolerance>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
      lines.push('  </question>');
      return;
    }

    if (qType === 'true-false') {
      lines.push('  <question type="truefalse">');
      lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
      lines.push('    <questiontext format="html">');
      lines.push(`      <text>${wrapCdata(html)}</text>`);
      lines.push('    </questiontext>');
      lines.push('    <defaultgrade>1</defaultgrade>');
      lines.push('    <penalty>0.0</penalty>');
      lines.push('    <hidden>0</hidden>');

      const tfAnswers = getNonEmptyAnswersForExport(question, 2);
      const tfFallback = getTfFallbackAnswers();
      const trueLabel = (tfAnswers[0] && tfAnswers[0].text) ? tfAnswers[0].text : tfFallback[0];
      const falseLabel = (tfAnswers[1] && tfAnswers[1].text) ? tfAnswers[1].text : tfFallback[1];
      const tfCorrect = normalizeCorrectAnswersForExport(question, 2);
      const correctIsTrue = tfCorrect[0] === 1;

      lines.push(`    <answer fraction="${correctIsTrue ? '100' : '0'}" format="html">`);
      lines.push(`      <text>${wrapCdata(escapeHtmlText(trueLabel))}</text>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
      lines.push(`    <answer fraction="${correctIsTrue ? '0' : '100'}" format="html">`);
      lines.push(`      <text>${wrapCdata(escapeHtmlText(falseLabel))}</text>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
      lines.push('  </question>');
      return;
    }

    // Por defecto: multichoice (single o multiple)
    const isMultiple = qType === 'multiple';
    lines.push('  <question type="multichoice">');
    lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
    lines.push('    <questiontext format="html">');
    lines.push(`      <text>${wrapCdata(html)}</text>`);
    lines.push('    </questiontext>');
    lines.push('    <defaultgrade>1</defaultgrade>');
    lines.push('    <penalty>0.0</penalty>');
    lines.push('    <hidden>0</hidden>');
    lines.push(`    <single>${isMultiple ? 'false' : 'true'}</single>`);
    lines.push('    <shuffleanswers>true</shuffleanswers>');
    lines.push('    <answernumbering>abc</answernumbering>');

    let answerItems = getNonEmptyAnswersForExport(question, 4);
    if (answerItems.length < 2) {
      const fallback = getTfFallbackAnswers();
      answerItems = [
        { index: 1, text: fallback[0] },
        { index: 2, text: fallback[1] }
      ];
    }

    const correctAnswers = normalizeCorrectAnswersForExport(question, 4);
    let correctMap = {};
    correctAnswers.forEach((n) => { correctMap[n] = true; });
    const anyCorrectVisible = answerItems.some((it) => !!correctMap[it.index]);
    if (!anyCorrectVisible) {
      correctMap = {};
      correctMap[answerItems[0].index] = true;
    }

    let correctCount = answerItems.reduce((acc, it) => acc + (correctMap[it.index] ? 1 : 0), 0);
    if (correctCount <= 0) correctCount = 1;
    const perCorrect = isMultiple ? (100 / correctCount) : 100;

    answerItems.forEach((item) => {
      const fraction = correctMap[item.index] ? perCorrect : 0;
      const fractionStr = (Math.round(fraction * 100000) / 100000).toString();
      lines.push(`    <answer fraction="${fractionStr}" format="html">`);
      lines.push(`      <text>${wrapCdata(escapeHtmlText(item.text || ''))}</text>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
    });
    lines.push('  </question>');
  });

  lines.push('</quiz>');
  return lines.join('\n');
}

function normalizeQuestions(list = []) {
  return list
    .map((item) => {
      const answers = Array.isArray(item.answers) ? item.answers : [];
      const safeAnswers = [answers[0] || '', answers[1] || '', answers[2] || '', answers[3] || ''];
      const meta = normalizeQuestionMeta(item);
      const base = {
        question: item.question || '',
        answers: safeAnswers,
        correct: meta.correct,
        correctAnswers: meta.correctAnswers,
        type: meta.type,
        time: Number(item.time) || 20,
        image: item.image || '',
        video: item.video || ''
      };

      if (meta.type === 'short-answer') {
        return {
          ...base,
          acceptedAnswers: Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : []
        };
      }

      if (meta.type === 'numeric') {
        return {
          ...base,
          numericAnswer: meta.numericAnswer,
          tolerance: meta.tolerance
        };
      }

      return base;
    })
    .filter((q) => q.question.trim().length > 0);
}

function normalizeTags(list = []) {
  if (!Array.isArray(list)) return [];
  return list
    .map((t) => (t || '').toString().trim())
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, 40).toLowerCase());
}

function scheduleGameCleanup(hostId, delayMs = GAME_CLEANUP_DELAY) {
  const game = games.getGame(hostId);
  if (!game) return;
  if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
  if (game.gameOver && delayMs > GAME_CLEANUP_DELAY) {
    delayMs = GAME_CLEANUP_DELAY;
  }
  game.cleanupTimer = setTimeout(() => {
    const current = games.getGame(hostId);
    if (!current) return;
    games.removeGame(hostId);
    const playersToRemove = players.getPlayers(hostId);
    for (let i = 0; i < playersToRemove.length; i++) {
      players.removePlayer(playersToRemove[i].playerId);
    }
    io.to(current.pin).emit('hostDisconnect');
  }, delayMs);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.passwordHash || !user.passwordSalt) return false;
  const hash = crypto.pbkdf2Sync(password, user.passwordSalt, 10000, 64, 'sha512').toString('hex');
  return hash === user.passwordHash;
}

function setPasswordFields(password) {
  const { salt, hash } = hashPassword(password);
  return { passwordSalt: salt, passwordHash: hash };
}

function createSession(user) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  sessions.set(sessionId, {
    userId: user._id ? user._id.toString() : user.id,
    role: user.role || 'editor',
    email: user.email,
    nickname: user.nickname || ''
  });
  return sessionId;
}

function parseCookies(header) {
  const list = {};
  if (!header) return list;
  header.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift().trim();
    const value = decodeURIComponent(parts.join('='));
    list[key] = value;
  });
  return list;
}

async function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies.sessionId;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    req.user = { id: session.userId, email: session.email, role: session.role, nickname: session.nickname || '' };
  }
  next();
}

function requireRole(role) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const rolesOrder = { editor: 1, admin: 2 };
    const current = rolesOrder[req.user.role] || 0;
    const needed = rolesOrder[role] || 0;
    if (current < needed) return res.status(403).json({ error: 'Permiso insuficiente' });
    return next();
  };
}

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeVisibility(value, fallback = 'private') {
  const allowed = ['private', 'unlisted', 'public'];
  if (!value) return fallback;
  const val = value.toString().toLowerCase();
  return allowed.includes(val) ? val : fallback;
}

function currentVisibility(quiz) {
  // legacy quizzes without visibility are treated as public
  return normalizeVisibility(quiz && quiz.visibility, 'public');
}

function normalizeAllowClone(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function canManageQuiz(quiz, user) {
  if (!quiz) return false;
  if (user && user.ownerToken && quiz.ownerToken && quiz.ownerToken === user.ownerToken) return true;
  if (user && user.role === 'admin') return true;
  const ownerId = quiz.ownerId || quiz.owner_id || quiz.owner;
  if (!ownerId) {
    // Quizzes heredados sin dueño: permite gestionarlos a usuarios autenticados
    return !!user;
  }
  if (!user) return false;
  return ownerId.toString() === user.id;
}

function canUseQuiz(quiz, user) {
  const visibility = currentVisibility(quiz);
  if (visibility === 'public') return true;
  if (visibility === 'unlisted') return true;
  // Permitir usar (hostear) aunque sea "solo yo"; se controla por visibilidad solo en lectura/gestión.
  return true;
}

function canCloneQuiz(quiz, user) {
  if (!quiz) return false;
  if (quiz.allowClone) {
    return canUseQuiz(quiz, user);
  }
  return canManageQuiz(quiz, user);
}

function selectQuizzesForUser(quizzes, user, opts = {}) {
  const includeUnlistedForAll = opts.includeUnlistedForAll === true;
  return (quizzes || []).filter((quiz) => {
    const visibility = currentVisibility(quiz);
    if (visibility === 'public') return true;
    if (visibility === 'unlisted') {
      if (includeUnlistedForAll) return true;
      return canManageQuiz(quiz, user);
    }
    return canManageQuiz(quiz, user);
  });
}

function shuffleQuestions(originalQuestions = []) {
  const ordered = shuffleArray(originalQuestions);
  return ordered;
}

// Multijugador: preguntas de respuesta libre (se omiten en multijugador).
function isMultiplayerFreeTypeQuestion(q) {
  if (!q) return false;
  const meta = normalizeQuestionMeta(q);
  if (meta.type === 'short-answer' || meta.type === 'numeric') return true;

  // Señales defensivas por si el tipo está corrupto pero vienen campos libres.
  const accepted = q.acceptedAnswers;
  const hasAccepted = Array.isArray(accepted)
    ? accepted.length > 0
    : (typeof accepted === 'string' && accepted.trim().length > 0);

  const hasNumeric =
    (typeof q.numericAnswer === 'number') ||
    (q.numericAnswer !== null && q.numericAnswer !== undefined && typeof q.numericAnswer === 'string' && q.numericAnswer.trim().length > 0) ||
    (q.numero !== null && q.numero !== undefined && String(q.numero).trim().length > 0) ||
    (q.tolerancia !== null && q.tolerancia !== undefined && String(q.tolerancia).trim().length > 0) ||
    (q.tolerance !== null && q.tolerance !== undefined && String(q.tolerance).trim().length > 0);

  return hasAccepted || hasNumeric;
}

function buildQuestions(questions = [], opts = {}) {
  const randomQ = opts.randomQuestions !== false;
  const randomA = opts.randomAnswers !== false;
  const overrideTime = parseInt(opts.timePerQuestion, 10);
  const useOverrideTime = !Number.isNaN(overrideTime) && overrideTime > 0;

  const filtered = Array.isArray(questions) ? questions.filter((q) => !isMultiplayerFreeTypeQuestion(q)) : [];

  const base = randomQ ? shuffleQuestions(filtered) : [...filtered];

  return base.map((q) => {
    const meta = normalizeQuestionMeta(q);
    const type = meta.type || (q.type || 'quiz');

    // Tipos de respuesta libre: no barajar opciones y preservar meta.
    if (type === 'short-answer' || type === 'numeric') {
      return {
        question: q.question,
        answers: Array.isArray(q.answers) ? q.answers.slice(0, 4) : [],
        correct: 1,
        correctAnswers: [1],
        type,
        time: useOverrideTime ? overrideTime : (q.time || 0),
        image: q.image || '',
        video: q.video || '',
        acceptedAnswers: Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : [],
        numericAnswer: typeof meta.numericAnswer === 'number' ? meta.numericAnswer : null,
        tolerance: typeof meta.tolerance === 'number' ? meta.tolerance : 0
      };
    }

    // Para verdadero/falso: trabajamos solo con 2 opciones y evitamos que el shuffle
    // meta strings vacíos en A/B o que el correcto acabe en 3/4.
    const rawAnswers = Array.isArray(q.answers) ? q.answers : [];
    const domainAnswers = type === 'true-false' ? rawAnswers.slice(0, 2) : rawAnswers;
    const indexDomain = domainAnswers.map((_, idx) => idx);

    const answerOrder = randomA ? shuffleArray(indexDomain) : indexDomain;
    const answers = answerOrder.map((idx) => domainAnswers[idx]);

    const originalCorrects = type === 'true-false' ? meta.correctAnswers : normalizeCorrectAnswers(q.correctAnswers || q.correct);
    const shuffledCorrects = [];
    originalCorrects.forEach((orig) => {
      const zeroBased = orig - 1;
      const newIndex = answerOrder.indexOf(zeroBased);
      if (newIndex !== -1) {
        const candidate = newIndex + 1;
        if (!shuffledCorrects.includes(candidate)) {
          shuffledCorrects.push(candidate);
        }
      }
    });
    if (!shuffledCorrects.length) {
      shuffledCorrects.push(1);
    }
    return {
      question: q.question,
      answers,
      correct: shuffledCorrects[0],
      correctAnswers: shuffledCorrects,
      type,
      time: useOverrideTime ? overrideTime : (q.time || 0),
      image: q.image || '',
      video: q.video || ''
    };
  });
}

function getQuestionMeta(question) {
  if (!question) {
    return { correctAnswers: [1], type: 'quiz' };
  }
  const meta = normalizeQuestionMeta(question);
  return {
    correctAnswers: meta.correctAnswers,
    type: meta.type,
    acceptedAnswers: meta.acceptedAnswers,
    numericAnswer: meta.numericAnswer,
    tolerance: meta.tolerance
  };
}

function normalizeFreeText(value) {
  let str = (value || '').toString().trim().toLowerCase();
  if (!str) return '';
  try {
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {}
  str = str.replace(/[^a-z0-9\s]/g, ' ');
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

function isSubmissionCorrect(meta, submission) {
  if (!meta || !Array.isArray(meta.correctAnswers) || !meta.correctAnswers.length) {
    return false;
  }
  if (meta.type === 'short-answer') {
    const raw = submission && typeof submission === 'object' && submission.text !== undefined ? submission.text : submission;
    const normalized = normalizeFreeText(raw);
    if (!normalized) return false;
    const accepted = Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : splitAcceptedAnswers(meta.acceptedAnswers);
    return accepted.some((ans) => normalizeFreeText(ans) === normalized);
  }
  if (meta.type === 'numeric') {
    const raw = submission && typeof submission === 'object' && submission.number !== undefined ? submission.number : submission;
    const num = parseLenientNumber(raw);
    if (num === null) return false;
    const target = typeof meta.numericAnswer === 'number' ? meta.numericAnswer : parseLenientNumber(meta.numericAnswer);
    if (target === null) return false;
    const tol = typeof meta.tolerance === 'number' ? meta.tolerance : (parseLenientNumber(meta.tolerance) || 0);
    return Math.abs(num - target) <= Math.max(0, tol);
  }
  if (meta.type === 'multiple') {
    if (!Array.isArray(submission) || submission.length === 0) {
      return false;
    }
    if (submission.length !== meta.correctAnswers.length) {
      return false;
    }
    const submissionSet = new Set(submission);
    return meta.correctAnswers.every((value) => submissionSet.has(value));
  }
  const normalized = Array.isArray(submission) ? submission[0] : submission;
  return Number(normalized) === meta.correctAnswers[0];
}

function emitQuestionOverPayload(game) {
  if (!game) return;
  const playerData = players.getPlayers(game.hostId);
  const questions = game.gameData.questions || [];
  const current = questions[game.gameData.question - 1];
  const meta = getQuestionMeta(current);
  io.to(game.pin).emit('questionOver', playerData, meta);
}

async function incrementQuizStats(gameId, playersInGame) {
  try {
    const collection = await getGamesCollection();
    const numericId = parseInt(gameId, 10);
    if (Number.isNaN(numericId)) return;
    const playersCount = Math.max(playersInGame || 0, 0);
    await collection.updateOne(
      { id: numericId },
      { $inc: { playsCount: 1, playersCount } }
    );
  } catch (err) {
    console.error('incrementQuizStats error', err);
  }
}

// Body parsers (bump limit to allow quizzes con recursos más pesados)
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.set('Cache-Control', 'no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(publicPath, 'manifest.webmanifest'));
});
app.use(express.static(publicPath, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const lower = (filePath || '').toLowerCase();
    const isHtml = lower.endsWith('.html');

    // HTML: evitar caché para que los cambios se reflejen al recargar.
    if (isHtml) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return;
    }

    // Assets: permitir caché pero forzar revalidación (evita quedarse con JS/CSS antiguos).
    res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));
app.use(sessionMiddleware);

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log('Server started on port ' + PORT);
});

app.get('/api/validate-pin/:pin', (req, res) => {
  const rawPin = (req.params.pin || '').trim();
  if (!rawPin) {
    return res.json({ valid: false });
  }
  const game = games.getGameByPin(rawPin);
  res.json({ valid: !!game });
});

app.post('/api/upload-csv', uploadRateLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Selecciona un archivo CSV para importar.' });
  }

  const quizName =
    (req.body.name && req.body.name.trim()) ||
    path.basename(req.file.originalname, path.extname(req.file.originalname));

  try {
    logEvent('upload-csv:start', {
      filename: req.file.originalname,
      size: req.file.size,
      quizName
    });

    const content = req.file.buffer.toString('utf8');
    const rows = parseCsv(content);
    if (rows.length === 0) {
      logEvent('upload-csv:empty', { filename: req.file.originalname });
      return res.status(400).json({ error: 'No se encontraron preguntas en el CSV.' });
    }

    const questions = rows.map(toQuestion);
    const tags = normalizeTags(req.body.tags ? [].concat(req.body.tags) : []);
    const ownerToken = (req.body.ownerToken || req.headers['x-owner-token'] || '').toString().trim();

    const visibility = normalizeVisibility(req.body.visibility, req.user ? 'private' : 'private');
    const allowClone = normalizeAllowClone(req.body.allowClone);

    if (!req.user) {
      if (visibility === 'public') {
        const collection = await getGamesCollection();
        const newId = await nextGameId(collection);
        const quiz = {
          id: newId,
          name: quizName,
          tags,
          questions,
          ownerToken,
          playsCount: 0,
          playersCount: 0,
          visibility,
          allowClone,
          ownerId: GLOBAL_OWNER_ID,
          ownerEmail: GLOBAL_OWNER_EMAIL,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await collection.insertOne(quiz);
        logEvent('upload-csv:public-anon', { filename: req.file.originalname, newId, count: questions.length });
        return res.json({ id: newId, name: quizName, count: questions.length, local: false });
      } else {
        const saved = await saveEphemeralQuiz({ name: quizName, tags, questions, visibility: 'private', allowClone, ownerToken });
        logEvent('upload-csv:local', { filename: req.file.originalname, id: saved.id, count: questions.length });
        return res.json({ id: saved.id, name: quizName, count: questions.length, local: true });
      }
    }

    const collection = await getGamesCollection();
    const newId = await nextGameId(collection);
    const quiz = {
      id: newId,
      name: quizName,
      tags,
      questions,
      playsCount: 0,
      playersCount: 0,
      visibility,
      allowClone,
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      ownerNickname: req.user.nickname || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await collection.insertOne(quiz);
    logEvent('upload-csv:success', { filename: req.file.originalname, newId, count: questions.length });
    return res.json({ id: newId, name: quizName, count: questions.length, local: false });
  } catch (err) {
    console.error('upload-csv error', err);
    return res.status(500).json({ error: 'No se pudo importar el CSV.' });
  }
});

function coerceDate(value, fallback = null) {
  if (!value) return fallback;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function normalizeQuizId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num) && String(num) === raw) return num;
  return raw;
}

function sanitizeImportedQuiz(raw = {}) {
  const id = normalizeQuizId(raw.id || raw._id);
  if (id === null) return { ok: false, error: 'Falta id' };
  const name = (raw.name || raw.title || '').toString().trim() || 'Quiz importado';
  const tags = normalizeTags(Array.isArray(raw.tags) ? raw.tags : []);
  const questions = normalizeQuestions(Array.isArray(raw.questions) ? raw.questions : []);
  if (!questions.length) return { ok: false, error: 'Sin preguntas' };

  const visibility = normalizeVisibility(raw.visibility, 'private');
  const allowClone = normalizeAllowClone(raw.allowClone, false);
  const createdAt = coerceDate(raw.createdAt, new Date());
  const updatedAt = coerceDate(raw.updatedAt, createdAt);

  const playsCount = Math.max(0, parseInt(raw.playsCount, 10) || 0);
  const playersCount = Math.max(0, parseInt(raw.playersCount, 10) || 0);

  const ownerToken = (raw.ownerToken || '').toString().trim();
  const ownerId = (raw.ownerId || raw.owner_id || raw.owner || GLOBAL_OWNER_ID).toString();
  const ownerEmail = (raw.ownerEmail || GLOBAL_OWNER_EMAIL).toString();
  const ownerNickname = (raw.ownerNickname || '').toString();

  const quiz = {
    id,
    name,
    tags,
    questions,
    playsCount,
    playersCount,
    visibility,
    allowClone,
    ownerId,
    ownerEmail,
    createdAt,
    updatedAt
  };

  if (ownerNickname) quiz.ownerNickname = ownerNickname;
  if (ownerToken) quiz.ownerToken = ownerToken;
  if (raw.sourceQuizId) quiz.sourceQuizId = String(raw.sourceQuizId);
  return { ok: true, quiz };
}

// Admin: export/import masivo de quizzes
app.get('/api/admin/quizzes/export', requireRole('admin'), async (req, res) => {
  try {
    const collection = await getGamesCollection();
    const docs = await collection.find({}).toArray();
    const quizzes = docs.map((doc) => {
      const { _id, ...rest } = doc;
      return rest;
    });

    const payload = {
      format: 'eduhoot-quizzes',
      version: 1,
      exportedAt: new Date().toISOString(),
      count: quizzes.length,
      quizzes
    };
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `eduhoot-quizzes-${stamp}.json`;
    res.type('application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('admin-export-quizzes error', err);
    return res.status(500).json({ error: 'No se pudo exportar.' });
  }
});

app.post('/api/admin/quizzes/import', requireRole('admin'), bulkUpload.single('file'), async (req, res) => {
  const mode = (req.query.mode || 'upsert').toString();
  const replaceAll = mode === 'replace';
  if (replaceAll) {
    const confirm = (req.body && req.body.confirm ? String(req.body.confirm) : '').trim();
    if (confirm !== 'REPLACE_ALL') {
      return res.status(400).json({ error: 'Confirma con confirm=REPLACE_ALL para reemplazar todo.' });
    }
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Selecciona un archivo JSON.' });
  }
  try {
    const content = req.file.buffer.toString('utf8').trim();
    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ error: 'JSON inválido.' });
    }

    const quizzesRaw = Array.isArray(data) ? data : (data && Array.isArray(data.quizzes) ? data.quizzes : null);
    if (!quizzesRaw) {
      return res.status(400).json({ error: 'Formato no reconocido. Se esperaba { quizzes: [...] }.' });
    }

    const sanitized = [];
    const errors = [];
    const seen = new Set();
    quizzesRaw.forEach((q, idx) => {
      const result = sanitizeImportedQuiz(q);
      if (!result.ok) {
        errors.push({ index: idx, error: result.error });
        return;
      }
      const key = String(result.quiz.id);
      if (seen.has(key)) {
        // última gana
        const existingIndex = sanitized.findIndex((x) => String(x.id) === key);
        if (existingIndex !== -1) sanitized[existingIndex] = result.quiz;
        return;
      }
      seen.add(key);
      sanitized.push(result.quiz);
    });

    if (!sanitized.length) {
      return res.status(400).json({ error: 'No hay quizzes válidos para importar.', details: errors.slice(0, 20) });
    }

    const collection = await getGamesCollection();
    let deleted = 0;
    if (replaceAll) {
      const delRes = await collection.deleteMany({});
      deleted = delRes.deletedCount || 0;
      await collection.insertMany(sanitized, { ordered: false });
      return res.json({ ok: true, mode: 'replace', deleted, imported: sanitized.length, invalid: errors.length, errors: errors.slice(0, 20) });
    }

    const ops = sanitized.map((quiz) => ({
      replaceOne: {
        filter: { id: quiz.id },
        replacement: quiz,
        upsert: true
      }
    }));
    const result = await collection.bulkWrite(ops, { ordered: false });
    return res.json({
      ok: true,
      mode: 'upsert',
      processed: sanitized.length,
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
      invalid: errors.length,
      errors: errors.slice(0, 20)
    });
  } catch (err) {
    console.error('admin-import-quizzes error', err);
    return res.status(500).json({ error: 'No se pudo importar.' });
  }
});

async function buildQuizDoc({ name, tags, questions, visibility, allowClone, user, ownerToken }) {
  const collection = await getGamesCollection();
  const newId = await nextGameId(collection);
  const ownerTokenClean = (ownerToken || '').toString().trim();
  const quiz = {
    id: newId,
    name,
    tags,
    questions,
    visibility,
    allowClone,
    playsCount: 0,
    playersCount: 0,
    ownerId: user && user.id ? user.id : GLOBAL_OWNER_ID,
    ownerEmail: user && user.email ? user.email : GLOBAL_OWNER_EMAIL,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  if (!ownerTokenClean) {
    delete quiz.ownerToken;
  } else {
    quiz.ownerToken = ownerTokenClean;
  }
  await collection.insertOne(quiz);
  return { quiz, collection };
}

function mapKahootQuestions(kQuestions = []) {
  return normalizeQuestions(
    (kQuestions || []).map((q) => {
      const answers = Array.isArray(q.choices) ? q.choices : [];
      const textAnswers = answers.map((a) => (a && a.answer) || '').slice(0, 4);
      while (textAnswers.length < 4) textAnswers.push('');
      const correctIdx = Math.max(
        0,
        answers.findIndex((a) => a && a.correct)
      );
      return {
        question: q.question || '',
        answers: textAnswers,
        correct: correctIdx + 1,
        time: Math.round((q.time || 20000) / 1000) || 20,
        image: q.image || '',
        video: (q.video && q.video.full_url) || ''
      };
    })
  );
}

// Importar Kahoot público por URL o ID
app.post('/api/import/kahoot', async (req, res) => {
  const rawUrl = (req.body.url || '').trim();
  const rawId = (req.body.id || '').trim();
  const kahootId = extractKahootId(rawUrl) || extractKahootId(rawId);
  if (!kahootId) return res.status(400).json({ error: 'Falta URL o id de Kahoot.' });
  const visibility = normalizeVisibility(req.body.visibility || 'public');
  const allowClone = normalizeAllowClone(req.body.allowClone);
  const ownerToken = (req.body.ownerToken || req.headers['x-owner-token'] || '').toString().trim();
  try {
    const response = await fetch(`https://create.kahoot.it/rest/kahoots/${kahootId}/card/?includeKahoot=true`);
    if (!response.ok) {
      if (response.status === 404) return res.status(404).json({ error: 'Quiz de Kahoot no encontrado.' });
      return res.status(502).json({ error: `Kahoot respondió ${response.status}.` });
    }
    const data = await response.json();
    const k = data.kahoot || {};
    const name = (k.title || 'Kahoot importado').trim();
    const tags = normalizeTags(
      Array.isArray(k.tags) ? k.tags : (typeof k.tags === 'string' ? k.tags.split(',') : [])
    );
    const questions = mapKahootQuestions(k.questions || []);
    if (!questions.length) return res.status(400).json({ error: 'No se encontraron preguntas en el Kahoot.' });

    // Si no hay usuario y es privado, se guarda en memoria; si es público/unlisted se persiste con owner global
    if (!req.user && visibility === 'private') {
      const saved = await saveEphemeralQuiz({ name, tags, questions, visibility, allowClone, ownerToken, sourceQuizId: kahootId });
      return res.json({ id: saved.id, name, count: questions.length, local: true });
    }

    const { quiz } = await buildQuizDoc({ name, tags, questions, visibility, allowClone, user: req.user, ownerToken });
    return res.json({ id: quiz.id, name, count: questions.length, local: false });
  } catch (err) {
    console.error('import-kahoot error', err);
    return res.status(500).json({ error: 'No se pudo importar desde Kahoot.' });
  }
});

// Get quiz by id
app.get('/api/quizzes/:id', async (req, res) => {
  const quizIdParam = req.params.id;
  try {
    const quiz = await findGameById(quizIdParam);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canUseQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado para ver este quiz.' });
    }

    const mode = (req.query.mode || '').toString();
    const allQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const questions = mode === 'multiplayer'
      ? allQuestions.filter((q) => !isMultiplayerFreeTypeQuestion(q))
      : allQuestions;

    return res.json({
      id: quiz.id,
      name: quiz.name,
      tags: quiz.tags || [],
      playsCount: quiz.playsCount || 0,
      playersCount: quiz.playersCount || 0,
      questions,
      visibility: currentVisibility(quiz),
      allowClone: normalizeAllowClone(quiz.allowClone),
      ownerId: quiz.ownerId,
      ownerEmail: quiz.ownerEmail || '',
      sourceQuizId: quiz.sourceQuizId
    });
  } catch (err) {
    console.error('get-quiz error', err);
    return res.status(500).json({ error: 'No se pudo obtener el quiz.' });
  }
});

// Download quiz as CSV
app.get('/api/quizzes/:id/csv', async (req, res) => {
  const quizIdParam = req.params.id;
  try {
    const quiz = await findGameById(quizIdParam);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canUseQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado para descargar este quiz.' });
    }
    const csv = quizToCsv(quiz);
    const fileName = `${(quiz.name || 'quiz').replace(/[^a-z0-9-_]+/gi, '_')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(csv);
  } catch (err) {
    console.error('get-quiz-csv error', err);
    return res.status(500).json({ error: 'No se pudo generar el CSV.' });
  }
});

app.get('/api/quizzes/:id/moodle-xml', async (req, res) => {
  const quizIdParam = req.params.id;
  try {
    const quiz = await findGameById(quizIdParam);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canUseQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado para descargar este quiz.' });
    }
    const xml = quizToMoodleXml(quiz);
    const fileName = `${(quiz.name || 'quiz').replace(/[^a-z0-9-_]+/gi, '_')}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(xml);
  } catch (err) {
    console.error('get-quiz-moodle-xml error', err);
    return res.status(500).json({ error: 'No se pudo generar el XML de Moodle.' });
  }
});

// Rename quiz
app.patch('/api/quizzes/:id', async (req, res) => {
  const quizIdParam = req.params.id;
  const newName = (req.body.name || '').trim();
  if (!quizIdParam || !newName) {
    return res.status(400).json({ error: 'Faltan id o nombre.' });
  }
  const ownerToken = ownerTokenFromReq(req);
  if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
  try {
    // Permitir renombrar quizzes locales sin sesión
    if (isLocalQuizId(quizIdParam)) {
      const q = await getEphemeralQuiz(quizIdParam);
      if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
      const updated = { ...q, name: newName, updatedAt: new Date() };
      await persistEphemeralQuiz(updated);
      return res.json({ ok: true, id: q.id, name: newName, local: true });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const collection = await getGamesCollection();
    const quiz = await findGameById(quizIdParam);
    if (!quiz || typeof quiz.id === 'string') {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canManageQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    const result = await collection.updateOne({ id: quiz.id }, { $set: { name: newName, updatedAt: new Date() } });
    return res.json({ ok: true, id: quiz.id, name: newName });
  } catch (err) {
    console.error('rename-quiz error', err);
    return res.status(500).json({ error: 'No se pudo renombrar.' });
  }
});

// Update quiz tags (without replacing full quiz)
app.patch('/api/quizzes/:id/tags', async (req, res) => {
  const quizIdParam = req.params.id;
  const rawTags = req.body && req.body.tags !== undefined ? req.body.tags : [];
  const tags = normalizeTags(Array.isArray(rawTags) ? rawTags : String(rawTags || '').split(/[,;]+/));
  if (!quizIdParam) {
    return res.status(400).json({ error: 'Falta id.' });
  }
  if (!tags.length) {
    return res.status(400).json({ error: 'Añade al menos una etiqueta.' });
  }

  const ownerToken = ownerTokenFromReq(req);
  if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
  try {
    // Permitir editar tags de quizzes locales sin sesión
    if (isLocalQuizId(quizIdParam)) {
      const q = await getEphemeralQuiz(quizIdParam);
      if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
      const updated = { ...q, tags, updatedAt: new Date() };
      await persistEphemeralQuiz(updated);
      return res.json({ ok: true, id: quizIdParam, tags, local: true });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const collection = await getGamesCollection();
    const quiz = await findGameById(quizIdParam);
    if (!quiz || typeof quiz.id === 'string') {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canManageQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    await collection.updateOne({ id: quiz.id }, { $set: { tags, updatedAt: new Date() } });
    return res.json({ ok: true, id: quiz.id, tags });
  } catch (err) {
    console.error('update-quiz-tags error', err);
    return res.status(500).json({ error: 'No se pudieron actualizar las etiquetas.' });
  }
});

// Replace quiz content
app.put('/api/quizzes/:id', async (req, res) => {
  const quizIdParam = req.params.id;
  const name = (req.body.name || '').trim();
  const questions = normalizeQuestions(req.body.questions || []);
  const tags = normalizeTags(req.body.tags || []);
  const visibility = normalizeVisibility(req.body.visibility);
  const allowClone = normalizeAllowClone(req.body.allowClone);
  const ownerToken = ownerTokenFromReq(req);
  if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
  if (!name) {
    return res.status(400).json({ error: 'Falta nombre.' });
  }
  if (!tags.length) {
    return res.status(400).json({ error: 'Añade al menos una etiqueta.' });
  }
  if (!questions.length) {
    return res.status(400).json({ error: 'Añade al menos una pregunta.' });
  }
  try {
    if (isLocalQuizId(quizIdParam)) {
      const q = await getEphemeralQuiz(quizIdParam);
      if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
      const updated = {
        ...q,
        name,
        tags,
        questions,
        visibility,
        allowClone,
        updatedAt: new Date()
      };
      await persistEphemeralQuiz(updated);
      return res.json({ ok: true, id: quizIdParam, name, local: true });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const collection = await getGamesCollection();
    const quiz = await findGameById(quizIdParam);
    if (!quiz || typeof quiz.id === 'string') {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canManageQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    const result = await collection.updateOne(
      { id: quiz.id },
      {
        $set: {
          name,
          questions,
          tags,
          visibility,
          allowClone,
          updatedAt: new Date()
        }
      }
    );
    return res.json({ ok: true, id: quiz.id, name });
  } catch (err) {
    console.error('update-quiz error', err);
    return res.status(500).json({ error: 'No se pudo actualizar.' });
  }
});

// Delete quiz
app.delete('/api/quizzes/:id', async (req, res) => {
  const quizIdParam = req.params.id;
  const ownerToken = ownerTokenFromReq(req);
  if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
  try {
    if (isLocalQuizId(quizIdParam)) {
      const exists = await getEphemeralQuiz(quizIdParam);
      if (!exists) return res.status(404).json({ error: 'Quiz no encontrado.' });
      await deleteEphemeralQuiz(quizIdParam);
      return res.json({ ok: true, id: quizIdParam, local: true });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const collection = await getGamesCollection();
    const quiz = await findGameById(quizIdParam);
    if (!quiz || typeof quiz.id === 'string') {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canManageQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    const result = await collection.deleteOne({ id: quiz.id });
    return res.json({ ok: true, id: quiz.id });
  } catch (err) {
    console.error('delete-quiz error', err);
    return res.status(500).json({ error: 'No se pudo eliminar.' });
  }
});

// Update visibility and clone permission
app.patch('/api/quizzes/:id/sharing', async (req, res) => {
  const quizIdParam = req.params.id;
  if (!quizIdParam) {
    return res.status(400).json({ error: 'Falta id.' });
  }
  const visibility = normalizeVisibility(req.body.visibility);
  const allowClone = normalizeAllowClone(req.body.allowClone);
  const ownerToken = ownerTokenFromReq(req);
  if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
  try {
    if (isLocalQuizId(quizIdParam)) {
      const q = await getEphemeralQuiz(quizIdParam);
      if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
      // Permitir marcar como público: se mueve a la colección persistente
      if (visibility === 'public') {
        const collection = await getGamesCollection();
        const newId = await nextGameId(collection);
        const doc = {
          id: newId,
          name: q.name,
          tags: normalizeTags(q.tags || []),
          questions: q.questions || [],
          visibility: 'public',
          allowClone,
          ownerToken: q.ownerToken || ownerToken || '',
          playsCount: 0,
          playersCount: 0,
          ownerId: GLOBAL_OWNER_ID,
          ownerEmail: GLOBAL_OWNER_EMAIL,
          ownerNickname: '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await collection.insertOne(doc);
        await deleteEphemeralQuiz(quizIdParam);
        return res.json({ ok: true, id: newId, visibility: 'public', migrated: true });
      }
      const updated = { ...q, visibility, allowClone, ownerToken: q.ownerToken || ownerToken || '', updatedAt: new Date() };
      await persistEphemeralQuiz(updated);
      return res.json({ ok: true, id: quizIdParam, visibility, allowClone, local: true });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    const collection = await getGamesCollection();
    const quiz = await findGameById(quizIdParam);
    if (!quiz || typeof quiz.id === 'string') {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canManageQuiz(quiz, req.user)) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    await collection.updateOne(
      { id: quiz.id },
      { $set: { visibility, allowClone, updatedAt: new Date() } }
    );
    return res.json({ ok: true, visibility, allowClone });
  } catch (err) {
    console.error('update-sharing error', err);
    return res.status(500).json({ error: 'No se pudo actualizar permisos.' });
  }
});

io.on('connection', (socket) => {
  const cookies = parseCookies(socket.handshake.headers.cookie || '');
  const sessionId = cookies.sessionId;
  if (sessionId && sessions.has(sessionId)) {
    socket.user = sessions.get(sessionId);
  }
  socket.on('host-join', async (data) => {
    try {
      const kahoot = await findGameById(data.id);

      if (kahoot && canUseQuiz(kahoot, socket.user)) {
        const gamePin = Math.floor(Math.random() * 90000) + 10000; // new pin for game

        const originalQuestions = Array.isArray(kahoot.questions) ? kahoot.questions : [];
        const multiplayerQuestions = originalQuestions.filter((q) => !isMultiplayerFreeTypeQuestion(q));
        if (multiplayerQuestions.length === 0) {
          socket.emit('hostError', {
            error: 'Este quiz no tiene preguntas compatibles con multijugador (se omiten las de escribir: respuesta corta/numérica).'
          });
          socket.emit('noGameFound');
          return;
        }

        games.addGame(gamePin, socket.id, false, {
          playersAnswered: 0,
          questionLive: false,
          gameid: data.id,
          question: 1,
          questions: [],
          originalQuestions: multiplayerQuestions,
          totalQuestions: multiplayerQuestions.length,
          options: {
            randomQuestions: true,
            randomAnswers: true,
            sendToMobile: true,
            showScoresBetween: true,
            timePerQuestion: 20
          }
        });

        const game = games.getGame(socket.id);
        game.gameOver = false;
        scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);

        socket.join(game.pin);

        console.log('Game Created with pin:', game.pin);
        logGames('host-join');

        socket.emit('showGamePin', {
          pin: game.pin
        });
      } else {
        socket.emit('noGameFound');
      }
    } catch (err) {
      console.error('host-join error', err);
      socket.emit('noGameFound');
    }
  });

  socket.on('host-join-game', async (data) => {
    const oldHostId = data.id;
    const pinParam = data.pin ? data.pin.toString() : '';
    const game = games.getGame(oldHostId) || (pinParam ? games.getGameByPin(pinParam) : null);
    if (game) {
      const previousHostId = game.hostId;
      game.hostId = socket.id;
      game.gameOver = false;
      scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
      socket.join(game.pin);
      const playerData = players.getPlayers(previousHostId);
      for (let i = 0; i < Object.keys(players.players).length; i++) {
        if (players.players[i].hostId === previousHostId) {
          players.players[i].hostId = socket.id;
        }
      }
      const gameid = game.gameData.gameid;
      try {
        const kahootQuestions = game.gameData.questions || game.gameData.originalQuestions || [];
        if (kahootQuestions.length === 0) {
          socket.emit('noGameFound');
          return;
        }

        const currentIdx = Math.max(0, Math.min((game.gameData.question || 1) - 1, kahootQuestions.length - 1));
        const currentQuestion = kahootQuestions[currentIdx];

        socket.emit('gameQuestions', {
          q1: currentQuestion.question,
          a1: currentQuestion.answers[0],
          a2: currentQuestion.answers[1],
          a3: currentQuestion.answers[2],
          a4: currentQuestion.answers[3],
          correct: currentQuestion.correct,
          correctAnswers: getQuestionMeta(currentQuestion).correctAnswers,
          type: currentQuestion.type || 'quiz',
          image: currentQuestion.image || '',
          video: currentQuestion.video || '',
          playersInGame: playerData.length,
          showScores: game.gameData.options ? game.gameData.options.showScoresBetween !== false : true,
          questionNumber: game.gameData.question,
          totalQuestions: game.gameData.totalQuestions || kahootQuestions.length || 0,
          time: (game.gameData.options && game.gameData.options.timePerQuestion) || currentQuestion.time || 20
        });
        socket.emit('gamePin', { pin: game.pin });
        socket.emit('hostSession', { hostId: game.hostId, pin: game.pin });
        io.to(game.pin).emit('questionMedia', { image: currentQuestion.image || '', video: currentQuestion.video || '' });
        if (!game.gameData.options || game.gameData.options.sendToMobile !== false) {
          io.to(game.pin).emit('playerQuestion', {
            question: currentQuestion.question,
            answers: currentQuestion.answers,
            type: currentQuestion.type || 'quiz',
            image: currentQuestion.image || '',
            video: currentQuestion.video || ''
          });
        }
      } catch (err) {
        console.error('host-join-game error', err);
        socket.emit('noGameFound');
      }

      io.to(game.pin).emit('gameStartedPlayer');
      game.gameData.questionLive = true;
    } else {
      socket.emit('noGameFound');
    }
  });

  socket.on('player-join', (params) => {
    console.log('[player-join] params:', params);
    logGames('player-join');
    let gameFound = false;
    const pinParam = params.pin ? params.pin.toString() : '';
    const token = params.token;

    for (let i = 0; i < games.games.length; i++) {
      if (pinParam === games.games[i].pin.toString()) {
        console.log('Player connected to game pin', pinParam);

        const hostId = games.games[i].hostId;

        let existing = null;
        if (token) {
          existing = players.getByToken(token);
          if (existing && existing.hostId === hostId) {
            existing.playerId = socket.id;
            socket.join(params.pin);
            const playersInGame = players.getPlayers(hostId);
            io.to(params.pin).emit('updatePlayerLobby', playersInGame);
            socket.emit('playerRejoin', { ok: true });
            if (games.games[i].gameLive) {
              socket.emit('gameStartedPlayer');
            }
            gameFound = true;
            break;
          }
        }

        const safeName = normalizePlayerName(params.name);
        players.addPlayer(hostId, socket.id, safeName, { score: 0, answer: 0 }, params.icon || '', token);

        socket.join(params.pin);

        const playersInGame = players.getPlayers(hostId);

        io.to(params.pin).emit('updatePlayerLobby', playersInGame);
        if (games.games[i].gameLive) {
          socket.emit('gameStartedPlayer');
        }
        gameFound = true;
      }
    }

    if (gameFound === false) {
      console.log('[player-join] noGameFound for pin:', params.pin);
      socket.emit('noGameFound');
    } else {
      console.log('[player-join] joined pin:', params.pin, 'playerId:', socket.id);
    }
  });

  socket.on('player-join-game', (data) => {
    let player = players.getPlayer(data.id);
    if (!player && data.token) {
      player = players.getByToken(data.token);
      if (player) {
        player.playerId = socket.id;
      }
    }
    if (player) {
      const game = games.getGame(player.hostId);
      socket.join(game.pin);
      player.playerId = socket.id;

      const playerData = players.getPlayers(game.hostId);
      socket.emit('playerGameData', playerData);
      const questions = game.gameData.questions || [];
      const current = questions[game.gameData.question - 1];
      if (current) {
        socket.emit('playerQuestion', {
          question: current.question,
          answers: current.answers,
          type: current.type || 'quiz',
          image: current.image || '',
          video: current.video || ''
        });
        socket.emit('questionMedia', { image: current.image || '', video: current.video || '' });
      }
    } else {
      socket.emit('noGameFound');
    }
  });

  socket.on('disconnect', () => {
    const game = games.getGame(socket.id);
    if (game) {
      if (game.gameLive === false) {
        games.removeGame(socket.id);
        console.log('Game ended with pin:', game.pin);
        logGames('host-disconnect');

        const playersToRemove = players.getPlayers(game.hostId);

        for (let i = 0; i < playersToRemove.length; i++) {
          players.removePlayer(playersToRemove[i].playerId);
        }

        io.to(game.pin).emit('hostDisconnect');
        socket.leave(game.pin);
      }
    } else {
      const player = players.getPlayer(socket.id);
      if (player) {
        const hostId = player.hostId;
        const hostGame = games.getGame(hostId);
        if (hostGame) {
          const pin = hostGame.pin;
          // gracia: no expulsar al instante, esperar unos segundos por si reanuda
          setTimeout(() => {
            const stillMissing = players.getPlayer(socket.id);
            if (stillMissing) {
              players.removePlayer(socket.id);
              const playersInGame = players.getPlayers(hostId);
              io.to(pin).emit('updatePlayerLobby', playersInGame);
              io.to(pin).emit('playersUpdated', playersInGame.length);
            }
          }, 15000);
          socket.leave(pin);
        }
      }
    }
    logGames('disconnect');
  });

  socket.on('playerAnswer', async (num) => {
    const player = players.getPlayer(socket.id);
    if (!player) {
      socket.emit('noGameFound');
      return;
    }
    const hostId = player.hostId;
    if (!allowAnswer(socket, hostId)) {
      socket.emit('tooManyAnswers');
      return;
    }
    const playerNum = players.getPlayers(hostId);
    const game = games.getGame(hostId);

    if (game.gameData.questionLive === true) {
      game.gameData.playersAnswered += 1;

      const gameQuestion = game.gameData.question;
      try {
        const questions = game.gameData.questions || [];
        const current = questions[gameQuestion - 1];
        if (!current) {
          socket.emit('noGameFound');
          return;
        }

        const meta = getQuestionMeta(current);
        let normalizedSubmission;
        if (meta.type === 'multiple') {
          normalizedSubmission = normalizeCorrectAnswers(num, false);
        } else if (meta.type === 'short-answer') {
          if (num && typeof num === 'object' && num.text !== undefined) {
            normalizedSubmission = { text: String(num.text || '') };
          } else {
            normalizedSubmission = { text: String(num || '') };
          }
        } else if (meta.type === 'numeric') {
          if (num && typeof num === 'object' && num.number !== undefined) {
            normalizedSubmission = { number: num.number };
          } else {
            normalizedSubmission = { number: num };
          }
        } else {
          normalizedSubmission = Number(num);
        }
        player.gameData.answer = normalizedSubmission;

        if (isSubmissionCorrect(meta, normalizedSubmission)) {
          player.gameData.score += 100;
          io.to(game.pin).emit('getTime', socket.id);
          socket.emit('answerResult', true);
        }

        if (game.gameData.playersAnswered === playerNum.length) {
          game.gameData.questionLive = false;
          // Agotar tiempo en clientes porque ya contestaron todos
          io.to(game.pin).emit('time', { player: player.hostId, time: 0 });
          emitQuestionOverPayload(game);
        } else {
          io.to(game.pin).emit('updatePlayersAnswered', {
            playersInGame: playerNum.length,
            playersAnswered: game.gameData.playersAnswered
          });
        }
        scheduleGameCleanup(hostId, GAME_INACTIVITY_TIMEOUT);
      } catch (err) {
        console.error('playerAnswer error', err);
        socket.emit('noGameFound');
      }
    }
  });

  socket.on('getScore', () => {
    const player = players.getPlayer(socket.id);
    if (!player) {
      socket.emit('noGameFound');
      return;
    }
    socket.emit('newScore', player.gameData.score);
  });

  socket.on('time', (data) => {
    const playerid = data.player;
    const player = players.getPlayer(playerid);
    const hostId = player ? player.hostId : null;
    const game = hostId ? games.getGame(hostId) : null;
    const limit = (game && game.gameData && game.gameData.options && game.gameData.options.timePerQuestion) || 20;
    let time = data.time / limit;
    time *= 100;
    if (player) {
      player.gameData.score += time;
    }
  });

  socket.on('timeUp', async () => {
    const game = games.getGame(socket.id);
    if (!game) {
      socket.emit('noGameFound');
      return;
    }
    game.gameData.questionLive = false;
    const gameQuestion = game.gameData.question;

    try {
      const questions = game.gameData.questions || [];
      const current = questions[gameQuestion - 1];
      if (!current) {
        socket.emit('noGameFound');
        return;
      }
      emitQuestionOverPayload(game);
      scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
    } catch (err) {
      console.error('timeUp error', err);
      socket.emit('noGameFound');
    }
  });

  socket.on('skipQuestion', async () => {
    const game = games.getGame(socket.id);
    if (!game) {
      socket.emit('noGameFound');
      return;
    }
    game.gameData.questionLive = false;
    const gameQuestion = game.gameData.question;
    try {
      const questions = game.gameData.questions || [];
      const current = questions[gameQuestion - 1];
      if (!current) {
        socket.emit('noGameFound');
        return;
      }
      io.to(game.pin).emit('hostSkipped');
      emitQuestionOverPayload(game);
      scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
    } catch (err) {
      console.error('skipQuestion error', err);
      socket.emit('noGameFound');
    }
  });

  socket.on('nextQuestion', async () => {
    const playerData = players.getPlayers(socket.id);
    for (let i = 0; i < Object.keys(players.players).length; i++) {
      if (players.players[i].hostId === socket.id) {
        players.players[i].gameData.answer = 0;
      }
    }

    const game = games.getGame(socket.id);
    game.gameData.playersAnswered = 0;
    game.gameData.questionLive = true;
    game.gameData.question += 1;

    try {
      const questions = game.gameData.questions || [];

      if (questions.length >= game.gameData.question) {
        const questionNum = game.gameData.question - 1;
        const current = questions[questionNum];
        const question = current.question;
        const answer1 = current.answers[0];
        const answer2 = current.answers[1];
        const answer3 = current.answers[2];
        const answer4 = current.answers[3];
        const correctAnswer = current.correct;
        const image = current.image || '';
        const video = current.video || '';
        const meta = getQuestionMeta(current);

        socket.emit('gameQuestions', {
          q1: question,
          a1: answer1,
          a2: answer2,
          a3: answer3,
          a4: answer4,
          correct: correctAnswer,
          correctAnswers: meta.correctAnswers,
          type: meta.type,
          image,
          video,
          playersInGame: playerData.length,
          showScores: game.gameData.options ? game.gameData.options.showScoresBetween !== false : true,
          questionNumber: game.gameData.question,
          totalQuestions: game.gameData.totalQuestions || questions.length,
          time: (game.gameData.options && game.gameData.options.timePerQuestion) || current.time || 20
        });
      io.to(game.pin).emit('questionMedia', { image, video });
      if (!game.gameData.options || game.gameData.options.sendToMobile !== false) {
        io.to(game.pin).emit('playerQuestion', {
          question,
          answers: [answer1, answer2, answer3, answer4],
          type: meta.type,
          image,
          video,
          time: (game.gameData.options && game.gameData.options.timePerQuestion) || current.time || 20
        });
      }
      scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
    } else {
        const playersInGame = players.getPlayers(game.hostId);
        const first = { name: '', score: 0 };
        const second = { name: '', score: 0 };
        const third = { name: '', score: 0 };
        const fourth = { name: '', score: 0 };
        const fifth = { name: '', score: 0 };

        for (let i = 0; i < playersInGame.length; i++) {
          if (playersInGame[i].gameData.score > fifth.score) {
            if (playersInGame[i].gameData.score > fourth.score) {
              if (playersInGame[i].gameData.score > third.score) {
                if (playersInGame[i].gameData.score > second.score) {
                  if (playersInGame[i].gameData.score > first.score) {
                    fifth.name = fourth.name;
                    fifth.score = fourth.score;

                    fourth.name = third.name;
                    fourth.score = third.score;

                    third.name = second.name;
                    third.score = second.score;

                    second.name = first.name;
                    second.score = first.score;

                    first.name = playersInGame[i].name;
                    first.score = playersInGame[i].gameData.score;
                  } else {
                    fifth.name = fourth.name;
                    fifth.score = fourth.score;

                    fourth.name = third.name;
                    fourth.score = third.score;

                    third.name = second.name;
                    third.score = second.score;

                    second.name = playersInGame[i].name;
                    second.score = playersInGame[i].gameData.score;
                  }
                } else {
                  fifth.name = fourth.name;
                  fifth.score = fourth.score;

                  fourth.name = third.name;
                  fourth.score = third.score;

                  third.name = playersInGame[i].name;
                  third.score = playersInGame[i].gameData.score;
                }
              } else {
                fifth.name = fourth.name;
                fifth.score = fourth.score;

                fourth.name = playersInGame[i].name;
                fourth.score = playersInGame[i].gameData.score;
              }
            } else {
              fifth.name = playersInGame[i].name;
              fifth.score = playersInGame[i].gameData.score;
            }
          }
        }

        io.to(game.pin).emit('GameOver', {
          num1: first.name,
          num2: second.name,
          num3: third.name,
          num4: fourth.name,
          num5: fifth.name
        });
        const uniquePlayers = Array.isArray(playersInGame) ? playersInGame.length : 0;
        await incrementQuizStats(game.gameData.gameid, uniquePlayers);
        game.gameLive = false;
        game.gameOver = true;
        scheduleGameCleanup(socket.id);
      }
    } catch (err) {
      console.error('nextQuestion error', err);
      socket.emit('noGameFound');
    }

    io.to(game.pin).emit('nextQuestionPlayer');
  });

  socket.on('startGame', (opts) => {
    const game = games.getGame(socket.id);
    if (!game || !game.gameData) {
      socket.emit('noGameFound');
      return;
    }
    const options = Object.assign({
      randomQuestions: true,
      randomAnswers: true,
      sendToMobile: true,
      showScoresBetween: true,
      timePerQuestion: 20
    }, opts || {});
    if (!options.timePerQuestion || Number.isNaN(parseInt(options.timePerQuestion, 10))) {
      options.timePerQuestion = 20;
    }
    game.gameData.options = options;
    const originalQuestions = Array.isArray(game.gameData.originalQuestions) ? game.gameData.originalQuestions : [];
    // build question set based on options (incluye filtrado de tipos libres)
    game.gameData.questions = buildQuestions(originalQuestions, options);
    if (!game.gameData.questions || game.gameData.questions.length === 0) {
      socket.emit('hostError', {
        error: 'Este quiz no tiene preguntas compatibles con multijugador (se omiten las de escribir: respuesta corta/numérica).'
      });
      return;
    }
    game.gameData.totalQuestions = (game.gameData.questions || []).length;
    game.gameLive = true;
    game.gameOver = false;
    scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
    socket.emit('gameStarted', game.hostId);
  });

  socket.on('requestDbNames', async () => {
    try {
      const collection = await getGamesCollection();
      const res = await collection.find().project({ questions: 0 }).toArray();
      const filtered = selectQuizzesForUser(res, socket.user);
      socket.emit('gameNamesData', filtered);
    } catch (err) {
      console.error('requestDbNames error', err);
      socket.emit('gameNamesData', []);
    }
  });

  socket.on('newQuiz', async (data) => {
    try {
      const collection = await getGamesCollection();
      const newId = await nextGameId(collection);
    const quiz = {
      id: newId,
      name: (data.name || '').trim() || `Quiz ${newId}`,
      questions: normalizeQuestions(data.questions || []),
      tags: normalizeTags(data.tags || []),
      playsCount: 0,
      playersCount: 0,
      visibility: normalizeVisibility(data.visibility),
      allowClone: normalizeAllowClone(data.allowClone),
      ownerId: (socket.user && socket.user.id) || GLOBAL_OWNER_ID,
      ownerEmail: (socket.user && socket.user.email) || GLOBAL_OWNER_EMAIL,
      ownerNickname: (socket.user && socket.user.nickname) || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      if (!quiz.tags.length) {
        socket.emit('quizValidationError', { error: 'Añade al menos una etiqueta.' });
        return;
      }
      if (quiz.questions.length === 0) {
        socket.emit('noGameFound');
        return;
      }

      await collection.insertOne(quiz);
      socket.emit('startGameFromCreator', newId);
    } catch (err) {
      console.error('newQuiz error', err);
      socket.emit('noGameFound');
    }
  });
});
app.get('/api/quizzes', async (req, res) => {
  try {
    const ownerToken = ownerTokenFromReq(req);
    if (ownerToken) {
      req.user = { ...(req.user || {}), ownerToken };
    }
    const tagParam = req.query.tags;
    const tags = Array.isArray(tagParam)
      ? tagParam
      : (typeof tagParam === 'string' && tagParam.length ? tagParam.split(',') : []);
    const normalized = normalizeTags(tags);
    const mineOnly = req.query.mine === '1';
    const tagMode = req.query.tagMode === 'any' ? 'any' : 'all';
    const collection = await getGamesCollection();
    const baseQuery = normalized.length
      ? { tags: tagMode === 'all' ? { $all: normalized } : { $in: normalized } }
      : {};
    let quizzesRaw = await collection.find(baseQuery).project({ questions: 0 }).toArray();
    if (mineOnly && req.user) {
      quizzesRaw = quizzesRaw.filter((q) => {
        if (q.ownerId && req.user.id && q.ownerId.toString() === req.user.id.toString()) return true;
        if (req.user.ownerToken && q.ownerToken && q.ownerToken === req.user.ownerToken) return true;
        return false;
      });
    }
    const quizzes = selectQuizzesForUser(quizzesRaw, req.user).map((quiz) => ({
      id: quiz.id,
      name: quiz.name,
      tags: quiz.tags || [],
      playsCount: quiz.playsCount || 0,
      playersCount: quiz.playersCount || 0,
      visibility: currentVisibility(quiz),
      allowClone: normalizeAllowClone(quiz.allowClone),
      ownerId: quiz.ownerId,
      ownerEmail: quiz.ownerEmail || '',
      ownerNickname: quiz.ownerNickname || '',
      sourceQuizId: quiz.sourceQuizId,
      createdAt: quiz.createdAt || quiz.updatedAt || new Date(0)
    }));
    // Añadir quizzes efímeros solicitados
    const localIdsParam = req.query.localIds;
    const localIds = Array.isArray(localIdsParam)
      ? localIdsParam
      : (typeof localIdsParam === 'string' && localIdsParam.length ? localIdsParam.split(',') : []);
    const validLocal = [];
    for (const id of localIds) {
      const q = await getEphemeralQuiz(id);
      if (q && !isEphemeralExpired(q)) {
        validLocal.push({
          id: q.id,
          name: q.name,
          tags: q.tags || [],
          playsCount: 0,
          playersCount: 0,
          visibility: currentVisibility(q),
          allowClone: normalizeAllowClone(q.allowClone),
          ownerId: null,
          ownerEmail: '',
          ownerNickname: '',
          sourceQuizId: q.sourceQuizId,
          createdAt: q.createdAt || q.updatedAt || new Date()
        });
      }
    }
    return res.json(quizzes.concat(validLocal));
  } catch (err) {
    console.error('list-quizzes error', err);
    return res.status(500).json({ error: 'No se pudo obtener la lista.' });
  }
});

// Listar solo quizzes públicos (para modo individual)
app.get('/api/public-quizzes', async (req, res) => {
  try {
    const mode = (req.query.mode || '').toString();
    const multiplayerMode = mode === 'multiplayer';
    const collection = await getGamesCollection();
    const quizzes = await collection
      .find({ $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] })
      .project({
        id: 1,
        name: 1,
        tags: 1,
        playsCount: 1,
        playersCount: 1,
        ownerNickname: 1,
        createdAt: 1,
        updatedAt: 1,
        questions: 1
      })
      .toArray();

    let mapped = (quizzes || []).map((quiz) => {
      const allQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
      const questions = multiplayerMode
        ? allQuestions.filter((q) => !isMultiplayerFreeTypeQuestion(q))
        : allQuestions;

      const mediaQuestions = questions.filter((q) => q && (q.image || q.video));
      const mediaQuestion = mediaQuestions.length
        ? mediaQuestions[Math.floor(Math.random() * mediaQuestions.length)]
        : null;
      return {
        id: quiz.id,
        name: quiz.name,
        tags: quiz.tags || [],
        playsCount: quiz.playsCount || 0,
        playersCount: quiz.playersCount || 0,
        ownerNickname: quiz.ownerNickname || '',
        createdAt: quiz.createdAt || quiz.updatedAt || new Date(0),
        questionsCount: questions.length,
        coverImage: mediaQuestion ? mediaQuestion.image : '',
        coverVideo: mediaQuestion ? mediaQuestion.video : ''
      };
    });

    if (multiplayerMode) {
      mapped = mapped.filter((q) => (q.questionsCount || 0) > 0);
    }
    return res.json(mapped);
  } catch (err) {
    console.error('list-public-quizzes error', err);
    return res.status(500).json({ error: 'No se pudo obtener la lista.' });
  }
});

// Ranking global para modo individual
app.get('/api/quizzes/:id/solo-ranking', async (req, res) => {
  const quizIdParam = req.params.id;
  try {
    const quiz = await findGameById(quizIdParam);
    if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado.' });
    if (currentVisibility(quiz) !== 'public') {
      return res.status(403).json({ error: 'Solo disponible para quizzes públicos.' });
    }
    const quizKey = quiz.id !== undefined && quiz.id !== null ? quiz.id.toString() : quizIdParam.toString();
    const top = await getTopSoloScores(quizKey, 10);
    return res.json({ quizId: quiz.id, top });
  } catch (err) {
    console.error('solo-ranking error', err);
    return res.status(500).json({ error: 'No se pudo obtener el ranking.' });
  }
});

// Registrar partida individual y devolver top 10
app.post('/api/quizzes/:id/solo-run', async (req, res) => {
  const quizIdParam = req.params.id;
  try {
    const quiz = await findGameById(quizIdParam);
    if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado.' });
    if (currentVisibility(quiz) !== 'public') {
      return res.status(403).json({ error: 'Solo disponible para quizzes públicos.' });
    }
    const quizKey = quiz.id !== undefined && quiz.id !== null ? quiz.id.toString() : quizIdParam.toString();
    const playerName = normalizeSoloName(req.body.name);
    const rawScore = parseInt(req.body.score, 10);
    const rawTotal = parseInt(req.body.totalQuestions, 10);
    if (Number.isNaN(rawScore) || Number.isNaN(rawTotal)) {
      return res.status(400).json({ error: 'Datos inválidos.' });
    }
    const score = Math.max(0, Math.min(rawScore, 1000000));
    const totalQuestions = Math.max(0, Math.min(rawTotal, 500));
    await enqueueSoloScore({
      quizId: quizKey,
      quizName: quiz.name || '',
      playerName,
      score,
      totalQuestions,
      createdAt: new Date()
    });
    const top = await getTopSoloScores(quizKey, 10);
    const position = top.findIndex((r) => r.playerName === playerName && r.score === score);
    try{
      await incrementQuizStats(quiz.id, 1);
    }catch(e){
      console.error('solo-run stat increment failed', e);
    }
    return res.json({ ok: true, top, position });
  } catch (err) {
    console.error('solo-run error', err);
    return res.status(500).json({ error: 'No se pudo registrar la partida.' });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    const ownerToken = ownerTokenFromReq(req);
    if (ownerToken) {
      req.user = { ...(req.user || {}), ownerToken };
    }
    const collection = await getGamesCollection();
    const quizzesRaw = await collection
      .find({}, { projection: { tags: 1, visibility: 1, ownerId: 1, allowClone: 1 } })
      .toArray();
    const quizzes = selectQuizzesForUser(quizzesRaw, req.user);
    const set = new Set();
    quizzes.forEach((quiz) => {
      const normalized = normalizeTags(quiz.tags || []);
      normalized.forEach((t) => set.add(t));
    });
    return res.json({ tags: Array.from(set).sort() });
  } catch (err) {
    console.error('list-tags error', err);
    return res.status(500).json({ error: 'No se pudieron obtener etiquetas.' });
  }
});

// Clone quiz (when permitted)
app.post('/api/quizzes/:id/clone', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Debes iniciar sesión para clonar.' });
  }
  const quizIdParam = req.params.id;
  try {
    const collection = await getGamesCollection();
    const original = await findGameById(quizIdParam);
    if (!original) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    if (!canCloneQuiz(original, req.user)) {
      return res.status(403).json({ error: 'No se puede clonar este quiz.' });
    }
    const newId = await nextGameId(collection);
    const cloned = {
      id: newId,
      name: `${original.name || 'Quiz'} (copia)`,
      questions: normalizeQuestions(original.questions || []),
      tags: normalizeTags(original.tags || []),
      playsCount: 0,
      playersCount: 0,
      visibility: 'private',
      allowClone: false,
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      sourceQuizId: original.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await collection.insertOne(cloned);
    return res.json({ ok: true, id: newId });
  } catch (err) {
    console.error('clone-quiz error', err);
    return res.status(500).json({ error: 'No se pudo clonar.' });
  }
});

// Crear quiz en memoria (sin login)
app.post('/api/quizzes/local', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const questions = normalizeQuestions(req.body.questions || []);
    const tags = normalizeTags(req.body.tags || []);
    const visibility = normalizeVisibility(req.body.visibility);
    const allowClone = normalizeAllowClone(req.body.allowClone);
    if (!name) return res.status(400).json({ error: 'Falta nombre.' });
    if (!tags.length) return res.status(400).json({ error: 'Añade al menos una etiqueta.' });
    if (!questions.length) return res.status(400).json({ error: 'Añade preguntas.' });
    if (visibility === 'private') {
      const saved = await saveEphemeralQuiz({ name, questions, tags, visibility, allowClone });
      return res.json({ ok: true, id: saved.id, count: questions.length });
    }
    const collection = await getGamesCollection();
    const newId = await nextGameId(collection);
    const quiz = {
      id: newId,
      name,
      questions,
      tags,
      playsCount: 0,
      playersCount: 0,
      visibility,
      allowClone,
      ownerId: GLOBAL_OWNER_ID,
      ownerEmail: GLOBAL_OWNER_EMAIL,
      ownerNickname: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await collection.insertOne(quiz);
    return res.json({ ok: true, id: newId, count: questions.length });
  } catch (err) {
    console.error('local-quiz error', err);
    return res.status(500).json({ error: 'No se pudo crear el quiz local.' });
  }
});
// Auth endpoints
app.post('/api/auth/bootstrap', async (req, res) => {
  try {
    const users = await getUsersCollection();
    const count = await users.countDocuments();
    if (count > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario, usa login.' });
    }
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';
    if (!email || !password) return res.status(400).json({ error: 'Faltan email o contraseña.' });
    const { salt, hash } = hashPassword(password);
    const nickname = (req.body.nickname || '').trim();
    const user = { email, passwordSalt: salt, passwordHash: hash, role: 'admin', createdAt: new Date() };
    if (nickname) user.nickname = nickname;
    await users.insertOne(user);
    return res.json({ ok: true });
  } catch (err) {
    console.error('bootstrap error', err);
    return res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';
    const users = await getUsersCollection();
    const user = await users.findOne({ email });
    if (!user || !verifyPassword(password, user)) {
      return res.status(401).json({ error: 'Credenciales no válidas.' });
    }
    const sid = createSession(user);
    res.cookie('sessionId', sid, { httpOnly: true, sameSite: 'lax' });
    return res.json({
      ok: true,
      id: (user._id || user.id || '').toString(),
      email: user.email,
      role: user.role || 'editor',
      nickname: user.nickname || ''
    });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
  }
});

app.post('/api/auth/users', requireRole('admin'), async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';
    const role = (req.body.role || 'editor').toLowerCase();
    const nickname = (req.body.nickname || '').trim();
    if (!email || !password) return res.status(400).json({ error: 'Faltan email o contraseña.' });
    if (!['editor', 'admin'].includes(role)) return res.status(400).json({ error: 'Rol no válido.' });
    const users = await getUsersCollection();
    const exists = await users.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
    const { salt, hash } = hashPassword(password);
    const user = { email, passwordSalt: salt, passwordHash: hash, role, createdAt: new Date() };
    if (nickname) user.nickname = nickname;
    await users.insertOne(user);
    return res.json({ ok: true });
  } catch (err) {
    console.error('create-user error', err);
    return res.status(500).json({ error: 'No se pudo crear el usuario.' });
  }
});

app.post('/api/auth/reset-admin', requireRole('admin'), async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';
    if (!email || !password) return res.status(400).json({ error: 'Faltan email o contraseña.' });
    const users = await getUsersCollection();
    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const newFields = setPasswordFields(password);
    await users.updateOne({ _id: user._id }, { $set: { ...newFields } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('reset-admin error', err);
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const sid = cookies.sessionId;
  if (sid) sessions.delete(sid);
  res.cookie('sessionId', '', { httpOnly: true, sameSite: 'lax', expires: new Date(0) });
  return res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  return res.json({ id: req.user.id, email: req.user.email, role: req.user.role || 'editor', nickname: req.user.nickname || '' });
});

app.patch('/api/auth/profile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
  try {
    const nickname = (req.body.nickname || '').trim();
    const users = await getUsersCollection();
    await users.updateOne({ _id: new ObjectId(req.user.id) }, { $set: { nickname } });
    // Update session data
    for (const [sid, session] of sessions.entries()) {
      if (session.userId === req.user.id) {
        sessions.set(sid, { ...session, nickname });
      }
    }
    return res.json({ ok: true, nickname });
  } catch (err) {
    console.error('update-nick error', err);
    return res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
  }
});

app.get('/api/admin/stats', requireRole('admin'), async (req, res) => {
  try {
    const collection = await getGamesCollection();
    const gamesList = await collection.find({}, { projection: { questions: 1, playsCount: 1, playersCount: 1, visibility: 1 } }).toArray();
    const totalQuizzes = gamesList.length;
    const totalQuestions = gamesList.reduce((sum, g) => sum + ((g.questions || []).length), 0);
    const totalPlays = gamesList.reduce((sum, g) => sum + (g.playsCount || 0), 0);
    const totalPlayers = gamesList.reduce((sum, g) => sum + (g.playersCount || 0), 0);
    const visibilityCounts = gamesList.reduce((acc, g) => {
      const vis = currentVisibility(g);
      acc[vis] = (acc[vis] || 0) + 1;
      return acc;
    }, { public: 0, unlisted: 0, private: 0 });

    const liveGames = games.games.length;
    const livePlayers = games.games.reduce((acc, g) => acc + players.getPlayers(g.hostId).length, 0);

    const ephemerals = await getEphemeralCollection();
    const now = new Date();
    const ephemeralList = await ephemerals.find(
      { $or: [{ expires: { $exists: false } }, { expires: { $gte: now } }] },
      { projection: { questions: 1 } }
    ).toArray();
    const ephemeralQuestions = ephemeralList.reduce((sum, q) => sum + ((q.questions || []).length), 0);

    const avgQuestionsPerQuiz = totalQuizzes ? Number((totalQuestions / totalQuizzes).toFixed(2)) : 0;

    return res.json({
      ok: true,
      data: {
        totalQuizzes,
        totalQuestions,
        totalPlays,
        totalPlayers,
        avgQuestionsPerQuiz,
        visibilityCounts,
        liveGames,
        livePlayers,
        ephemeral: {
          totalQuizzes: ephemeralList.length,
          totalQuestions: ephemeralQuestions
        }
      }
    });
  } catch (err) {
    console.error('admin-stats error', err);
    return res.status(500).json({ error: 'No se pudieron obtener las estadísticas.' });
  }
});

app.get('/admin/stats', requireRole('admin'), (req, res) => {
  res.sendFile(path.join(publicPath, 'admin-stats.html'));
});

// Solicitar token de reseteo (se guarda en BD y se muestra en logs)
app.post('/api/auth/request-reset', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Falta email.' });
    const users = await getUsersCollection();
    const user = await users.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await users.updateOne({ _id: user._id }, { $set: { resetToken: token, resetExpires: expires } });
      console.log(`[password-reset] Para ${email} usa el token: ${token} (caduca ${expires.toISOString()})`);
    }
    // responder genérico para no filtrar emails
    return res.json({ ok: true });
  } catch (err) {
    console.error('request-reset error', err);
    return res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
  }
});

// Resetear contraseña usando token
app.post('/api/auth/reset', async (req, res) => {
  try {
    const token = (req.body.token || '').trim();
    const password = req.body.password || '';
    if (!token || !password) return res.status(400).json({ error: 'Faltan token o contraseña.' });
    const users = await getUsersCollection();
    const user = await users.findOne({
      resetToken: token,
      resetExpires: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ error: 'Token no válido o caducado.' });
    }
    const newFields = setPasswordFields(password);
    await users.updateOne(
      { _id: user._id },
      { $set: { ...newFields }, $unset: { resetToken: '', resetExpires: '' } }
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('reset error', err);
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
  }
});

// Fallback para errores de rutas no capturados
app.use((err, req, res, next) => {
  console.error('[express-error]', err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' });
});
