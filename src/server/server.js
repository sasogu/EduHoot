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

const publicPath = path.join(__dirname, '../public');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const games = new LiveGames();
const players = new Players();
const sessions = new Map();

// MongoDB setup (single shared client to avoid legacy OP_QUERY code path)
// Prefer IPv4 loopback to avoid ::1 connection issues on some setups
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
const DB_NAME = 'kahootDB';
const GAMES_COLLECTION = 'kahootGames';
const USERS_COLLECTION = 'users';
const mongoClient = new MongoClient(mongoUrl);
let db;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
function logGames(tag) {
  const pins = games.games.map((g) => `${g.pin}(host:${g.hostId})`);
  console.log(`[${tag}] Active games:`, pins.length ? pins.join(', ') : 'none');
}

function logEvent(tag, payload) {
  console.log(`[${tag}]`, payload);
}

async function getDb() {
  if (!db) {
    console.log(`Connecting to MongoDB at ${mongoUrl}`);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    console.log(`Connected to MongoDB at ${mongoUrl}`);
  }
  return db;
}

async function getGamesCollection() {
  const database = await getDb();
  return database.collection(GAMES_COLLECTION);
}

async function getUsersCollection() {
  const database = await getDb();
  return database.collection(USERS_COLLECTION);
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
  return game;
}

async function nextGameId(collection) {
  const gamesInDb = await collection.find({}, { projection: { id: 1 } }).toArray();
  const maxId = gamesInDb.reduce((max, game) => Math.max(max, game.id || 0), 0);
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
  const header = 'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video';
  const lines = (quiz.questions || []).map((q) => {
    const answers = q.answers || ['', '', '', ''];
    const row = [
      'quiz',
      escapeCsvField(q.question || ''),
      escapeCsvField(answers[0] || ''),
      escapeCsvField(answers[1] || ''),
      escapeCsvField(answers[2] || ''),
      escapeCsvField(answers[3] || ''),
      escapeCsvField(q.time || 20),
      escapeCsvField(q.correct || 1),
      escapeCsvField(q.image || ''),
      escapeCsvField(q.video || '')
    ];
    return row.join(';');
  });
  return [header].concat(lines).join('\n');
}

function normalizeQuestions(list = []) {
  return list
    .map((item) => {
      const answers = Array.isArray(item.answers) ? item.answers : [];
      const safeAnswers = [answers[0] || '', answers[1] || '', answers[2] || '', answers[3] || ''];
      const correctNum = parseInt(item.correct, 10);
      const correct = Number.isNaN(correctNum) ? 1 : Math.min(Math.max(correctNum, 1), 4);
      return {
        question: item.question || '',
        answers: safeAnswers,
        correct,
        time: Number(item.time) || 20,
        image: item.image || '',
        video: item.video || ''
      };
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

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.passwordHash || !user.passwordSalt) return false;
  const hash = crypto.pbkdf2Sync(password, user.passwordSalt, 10000, 64, 'sha512').toString('hex');
  return hash === user.passwordHash;
}

function createSession(user) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  sessions.set(sessionId, {
    userId: user._id ? user._id.toString() : user.id,
    role: user.role || 'editor',
    email: user.email
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
    req.user = { id: session.userId, email: session.email, role: session.role };
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

function shuffleQuestions(originalQuestions = []) {
  const ordered = shuffleArray(originalQuestions);
  return ordered;
}

function buildQuestions(questions = [], opts = {}) {
  const randomQ = opts.randomQuestions !== false;
  const randomA = opts.randomAnswers !== false;

  const base = randomQ ? shuffleQuestions(questions) : [...questions];

  return base.map((q) => {
    const answerOrder = randomA ? shuffleArray(q.answers.map((_, idx) => idx)) : q.answers.map((_, idx) => idx);
    const answers = answerOrder.map((idx) => q.answers[idx]);
    const correctZero = (q.correct || 1) - 1;
    const newCorrect = answerOrder.indexOf(correctZero) + 1;
    return {
      question: q.question,
      answers,
      correct: newCorrect,
      time: q.time || 0,
      image: q.image || '',
      video: q.video || ''
    };
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicPath));
app.use(sessionMiddleware);

server.listen(3000, () => {
  console.log('Server started on port 3000');
});

app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No autorizado' });
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
    const collection = await getGamesCollection();
    const newId = await nextGameId(collection);
    const tags = normalizeTags(req.body.tags ? [].concat(req.body.tags) : []);
    const quiz = { id: newId, name: quizName, tags, questions };

    await collection.insertOne(quiz);
    logEvent('upload-csv:success', { filename: req.file.originalname, newId, count: questions.length });
    return res.json({ id: newId, name: quizName, count: questions.length });
  } catch (err) {
    console.error('upload-csv error', err);
    return res.status(500).json({ error: 'No se pudo importar el CSV.' });
  }
});

// Get quiz by id
app.get('/api/quizzes/:id', async (req, res) => {
  const quizId = parseInt(req.params.id, 10);
  if (!quizId) {
    return res.status(400).json({ error: 'Falta id.' });
  }
  try {
    const quiz = await findGameById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    return res.json({ id: quiz.id, name: quiz.name, tags: quiz.tags || [], questions: quiz.questions || [] });
  } catch (err) {
    console.error('get-quiz error', err);
    return res.status(500).json({ error: 'No se pudo obtener el quiz.' });
  }
});

// Download quiz as CSV
app.get('/api/quizzes/:id/csv', async (req, res) => {
  const quizId = parseInt(req.params.id, 10);
  if (!quizId) {
    return res.status(400).json({ error: 'Falta id.' });
  }
  try {
    const quiz = await findGameById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
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

// Rename quiz
app.patch('/api/quizzes/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const quizId = parseInt(req.params.id, 10);
  const newName = (req.body.name || '').trim();
  if (!quizId || !newName) {
    return res.status(400).json({ error: 'Faltan id o nombre.' });
  }
  try {
    const collection = await getGamesCollection();
    const result = await collection.updateOne({ id: quizId }, { $set: { name: newName } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    return res.json({ ok: true, id: quizId, name: newName });
  } catch (err) {
    console.error('rename-quiz error', err);
    return res.status(500).json({ error: 'No se pudo renombrar.' });
  }
});

// Replace quiz content
app.put('/api/quizzes/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const quizId = parseInt(req.params.id, 10);
  if (!quizId) {
    return res.status(400).json({ error: 'Falta id.' });
  }
  const name = (req.body.name || '').trim();
  const questions = normalizeQuestions(req.body.questions || []);
  const tags = normalizeTags(req.body.tags || []);
  if (!name) {
    return res.status(400).json({ error: 'Falta nombre.' });
  }
  if (!questions.length) {
    return res.status(400).json({ error: 'Añade al menos una pregunta.' });
  }
  try {
    const collection = await getGamesCollection();
    const result = await collection.updateOne({ id: quizId }, { $set: { name, questions, tags } });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    return res.json({ ok: true, id: quizId, name });
  } catch (err) {
    console.error('update-quiz error', err);
    return res.status(500).json({ error: 'No se pudo actualizar.' });
  }
});

// Delete quiz
app.delete('/api/quizzes/:id', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const quizId = parseInt(req.params.id, 10);
  if (!quizId) {
    return res.status(400).json({ error: 'Falta id.' });
  }
  try {
    const collection = await getGamesCollection();
    const result = await collection.deleteOne({ id: quizId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Quiz no encontrado.' });
    }
    return res.json({ ok: true, id: quizId });
  } catch (err) {
    console.error('delete-quiz error', err);
    return res.status(500).json({ error: 'No se pudo eliminar.' });
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

      if (kahoot) {
        const gamePin = Math.floor(Math.random() * 90000) + 10000; // new pin for game

        games.addGame(gamePin, socket.id, false, {
          playersAnswered: 0,
          questionLive: false,
          gameid: data.id,
          question: 1,
          questions: [],
          originalQuestions: kahoot.questions || [],
          totalQuestions: (kahoot.questions || []).length,
          options: {
            randomQuestions: true,
            randomAnswers: true,
            sendToMobile: true,
            showScoresBetween: true
          }
        });

        const game = games.getGame(socket.id);

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
    const game = games.getGame(oldHostId);
    if (game) {
      game.hostId = socket.id;
      socket.join(game.pin);
      const playerData = players.getPlayers(oldHostId);
      for (let i = 0; i < Object.keys(players.players).length; i++) {
        if (players.players[i].hostId === oldHostId) {
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

        const firstQuestion = kahootQuestions[0];

        socket.emit('gameQuestions', {
          q1: firstQuestion.question,
          a1: firstQuestion.answers[0],
          a2: firstQuestion.answers[1],
          a3: firstQuestion.answers[2],
          a4: firstQuestion.answers[3],
          correct: firstQuestion.correct,
          image: firstQuestion.image || '',
          video: firstQuestion.video || '',
          playersInGame: playerData.length,
          showScores: game.gameData.options ? game.gameData.options.showScoresBetween !== false : true
        });
        io.to(game.pin).emit('questionMedia', { image: firstQuestion.image || '', video: firstQuestion.video || '' });
        if (!game.gameData.options || game.gameData.options.sendToMobile !== false) {
          io.to(game.pin).emit('playerQuestion', {
            question: firstQuestion.question,
            answers: firstQuestion.answers,
            image: firstQuestion.image || '',
            video: firstQuestion.video || ''
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

    for (let i = 0; i < games.games.length; i++) {
      if (pinParam === games.games[i].pin.toString()) {
        console.log('Player connected to game pin', pinParam);

        const hostId = games.games[i].hostId;

        players.addPlayer(hostId, socket.id, params.name, { score: 0, answer: 0 }, params.icon || '');

        socket.join(params.pin);

        const playersInGame = players.getPlayers(hostId);

        io.to(params.pin).emit('updatePlayerLobby', playersInGame);
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
    const player = players.getPlayer(data.id);
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
          image: current.image || ''
        });
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
        const pin = hostGame.pin;

        if (hostGame.gameLive === false) {
          players.removePlayer(socket.id);
          const playersInGame = players.getPlayers(hostId);

          io.to(pin).emit('updatePlayerLobby', playersInGame);
          socket.leave(pin);
        }
      }
    }
    logGames('disconnect');
  });

  socket.on('playerAnswer', async (num) => {
    const player = players.getPlayer(socket.id);
    const hostId = player.hostId;
    const playerNum = players.getPlayers(hostId);
    const game = games.getGame(hostId);

    if (game.gameData.questionLive === true) {
      player.gameData.answer = num;
      game.gameData.playersAnswered += 1;

      const gameQuestion = game.gameData.question;
      const gameid = game.gameData.gameid;

      try {
        const questions = game.gameData.questions || [];
        const current = questions[gameQuestion - 1];
        if (!current) {
          socket.emit('noGameFound');
          return;
        }

        const correctAnswer = current.correct;
        if (num === correctAnswer) {
          player.gameData.score += 100;
          io.to(game.pin).emit('getTime', socket.id);
          socket.emit('answerResult', true);
        }

        if (game.gameData.playersAnswered === playerNum.length) {
          game.gameData.questionLive = false;
          const playerData = players.getPlayers(game.hostId);
          io.to(game.pin).emit('questionOver', playerData, correctAnswer);
        } else {
          io.to(game.pin).emit('updatePlayersAnswered', {
            playersInGame: playerNum.length,
            playersAnswered: game.gameData.playersAnswered
          });
        }
      } catch (err) {
        console.error('playerAnswer error', err);
        socket.emit('noGameFound');
      }
    }
  });

  socket.on('getScore', () => {
    const player = players.getPlayer(socket.id);
    socket.emit('newScore', player.gameData.score);
  });

  socket.on('time', (data) => {
    let time = data.time / 20;
    time *= 100;
    const playerid = data.player;
    const player = players.getPlayer(playerid);
    player.gameData.score += time;
  });

  socket.on('timeUp', async () => {
    const game = games.getGame(socket.id);
    game.gameData.questionLive = false;
    const playerData = players.getPlayers(game.hostId);

    const gameQuestion = game.gameData.question;

    try {
      const questions = game.gameData.questions || [];
      const current = questions[gameQuestion - 1];
      if (!current) {
        socket.emit('noGameFound');
        return;
      }
      const correctAnswer = current.correct;
      io.to(game.pin).emit('questionOver', playerData, correctAnswer);
    } catch (err) {
      console.error('timeUp error', err);
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

        socket.emit('gameQuestions', {
          q1: question,
          a1: answer1,
          a2: answer2,
          a3: answer3,
          a4: answer4,
          correct: correctAnswer,
          image,
          video,
          playersInGame: playerData.length,
          showScores: game.gameData.options ? game.gameData.options.showScoresBetween !== false : true
        });
        io.to(game.pin).emit('questionMedia', { image, video });
        if (!game.gameData.options || game.gameData.options.sendToMobile !== false) {
          io.to(game.pin).emit('playerQuestion', {
            question,
            answers: [answer1, answer2, answer3, answer4],
            image,
            video
          });
        }
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
      }
    } catch (err) {
      console.error('nextQuestion error', err);
      socket.emit('noGameFound');
    }

    io.to(game.pin).emit('nextQuestionPlayer');
  });

  socket.on('startGame', (opts) => {
    const game = games.getGame(socket.id);
    const options = Object.assign({
      randomQuestions: true,
      randomAnswers: true,
      sendToMobile: true,
      showScoresBetween: true
    }, opts || {});
    game.gameData.options = options;
    // build question set based on options
    game.gameData.questions = buildQuestions(game.gameData.originalQuestions || [], options);
    game.gameLive = true;
    socket.emit('gameStarted', game.hostId);
  });

  socket.on('requestDbNames', async () => {
    try {
      const collection = await getGamesCollection();
      const res = await collection.find().toArray();
      socket.emit('gameNamesData', res);
    } catch (err) {
      console.error('requestDbNames error', err);
      socket.emit('gameNamesData', []);
    }
  });

  socket.on('newQuiz', async (data) => {
    if (!socket.user) {
      socket.emit('noGameFound');
      return;
    }
    try {
      const collection = await getGamesCollection();
      const newId = await nextGameId(collection);
      const quiz = {
        id: newId,
        name: (data.name || '').trim() || `Quiz ${newId}`,
        questions: normalizeQuestions(data.questions || []),
        tags: normalizeTags(data.tags || [])
      };
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
    const tagParam = req.query.tags;
    const tags = Array.isArray(tagParam)
      ? tagParam
      : (typeof tagParam === 'string' && tagParam.length ? tagParam.split(',') : []);
    const normalized = normalizeTags(tags);
    const collection = await getGamesCollection();
    const query = normalized.length ? { tags: { $all: normalized } } : {};
    const quizzes = await collection.find(query).project({ questions: 0 }).toArray();
    return res.json(quizzes);
  } catch (err) {
    console.error('list-quizzes error', err);
    return res.status(500).json({ error: 'No se pudo obtener la lista.' });
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
    const user = { email, passwordSalt: salt, passwordHash: hash, role: 'admin', createdAt: new Date() };
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
    return res.json({ ok: true, email: user.email, role: user.role || 'editor' });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
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
  return res.json({ email: req.user.email, role: req.user.role || 'editor' });
});
