const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Simple CSV parser for qplay-style files (semicolon separator, quoted fields).
function splitSemicolons(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ';' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);

  return parts.map((field) => field.trim().replace(/^"(.*)"$/, '$1').trim());
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, '') // strip BOM if present
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows = [];

  for (const line of lines) {
    const cells = splitSemicolons(line);
    if (cells.length < 8) continue;
    if (cells[0].toLowerCase() === 'tipo') continue; // header lines

    rows.push({
      tipo: cells[0],
      pregunta: cells[1],
      r1: cells[2],
      r2: cells[3],
      r3: cells[4],
      r4: cells[5],
      tiempo: cells[6],
      correcta: cells[7],
      imagen: cells[8] || '',
      video: cells[9] || ''
    });
  }

  return rows;
}

function toQuestion(row) {
  const answers = [row.r1, row.r2, row.r3, row.r4];
  const correct = parseInt(row.correcta, 10);

  return {
    question: row.pregunta,
    answers,
    correct: Number.isNaN(correct) ? 1 : correct,
    time: Number(row.tiempo) || 0,
    image: row.imagen || '',
    video: row.video || ''
  };
}

async function insertQuiz(filePath, quizName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(content);

  if (rows.length === 0) {
    throw new Error('No se pudieron leer preguntas del CSV.');
  }

  // Prefer IPv4 loopback to evitar problemas de conexión con ::1
  const url = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
  const client = new MongoClient(url);
  await client.connect();

  const db = client.db('kahootDB');
  const collection = db.collection('kahootGames');

  const existing = await collection.find().toArray();
  const nextId = existing.length === 0
    ? 1
    : Math.max(...existing.map((doc) => doc.id || 0)) + 1;

  const quiz = {
    id: nextId,
    name: quizName,
    questions: rows.map(toQuestion)
  };

  await collection.insertOne(quiz);
  await client.close();

  return { id: nextId, count: quiz.questions.length };
}

async function main() {
  const [, , csvPath, nameArg] = process.argv;
  if (!csvPath) {
    console.error('Uso: node server/importCsv.js <ruta_csv> [nombre_quiz]');
    process.exit(1);
  }

  const quizName = nameArg || path.basename(csvPath, path.extname(csvPath));

  try {
    const result = await insertQuiz(csvPath, quizName);
    console.log(`Insertado quiz "${quizName}" (id ${result.id}) con ${result.count} preguntas desde ${csvPath}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseCsv, toQuestion, insertQuiz };
