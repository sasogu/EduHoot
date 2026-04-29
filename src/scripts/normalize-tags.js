#!/usr/bin/env node

const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
const dbName = process.env.MONGO_DB || 'kahootDB';
const dryRun = process.env.DRY_RUN === '1';
const collections = ['kahootGames', 'ephemeralQuizzes'];

function normalizeTags(list = []) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    let clean = (raw || '').toString().trim().toLowerCase();
    if (!clean) continue;
    try {
      clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (err) {}
    clean = clean.replace(
      /(^|[^a-z0-9])(\d+)\s*[\.\-]?\s*(º|ª|°|o|a|er|ero|era|ro|ra|do|da|to|ta|mo|ma|vo|va)(?=$|[^a-z0-9])/g,
      '$1$2'
    );
    clean = clean
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
      .replace(/^-|-$/g, '');
    if (!clean || out.includes(clean)) continue;
    out.push(clean);
  }
  return out;
}

function sameTags(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function normalizeCollection(db, collectionName) {
  const collection = db.collection(collectionName);
  const cursor = collection.find({ tags: { $exists: true } }, { projection: { id: 1, name: 1, tags: 1 } });
  let scanned = 0;
  let changed = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;
    const before = Array.isArray(doc.tags) ? doc.tags : [];
    const after = normalizeTags(before);
    if (sameTags(before, after)) continue;
    changed += 1;
    const label = doc.name || doc.id || doc._id;
    console.log(`[${collectionName}] ${label}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    if (!dryRun) {
      await collection.updateOne({ _id: doc._id }, { $set: { tags: after, updatedAt: new Date() } });
    }
  }

  console.log(`[${collectionName}] revisados=${scanned}, cambiados=${changed}${dryRun ? ' (dry-run)' : ''}`);
  return { scanned, changed };
}

async function main() {
  const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`Normalizando etiquetas en ${mongoUrl}${dbName}${dryRun ? ' (dry-run)' : ''}`);
    let totalChanged = 0;
    for (const collectionName of collections) {
      const result = await normalizeCollection(db, collectionName);
      totalChanged += result.changed;
    }
    console.log(`Listo. Documentos cambiados: ${totalChanged}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('No se pudieron normalizar las etiquetas:', err && err.message ? err.message : err);
  process.exit(1);
});
