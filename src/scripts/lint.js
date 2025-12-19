#!/usr/bin/env node

/*
  Lint mínimo sin dependencias:
  - Recorre JS del backend y del frontend
  - Ejecuta `node --check` (valida sintaxis)

  Motivación: el proyecto no tenía script `lint` ni ESLint configurado.
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

const CHECK_DIRS = [
  path.join(projectRoot, 'server'),
  path.join(projectRoot, 'public', 'js')
];

const SKIP_DIRS = new Set([
  path.join(projectRoot, 'public', 'js', 'libs')
]);

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function walkJsFiles(dir, out = []) {
  if (!isDirectory(dir)) return out;
  if (SKIP_DIRS.has(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(full)) walkJsFiles(full, out);
      continue;
    }
    if (ent.isFile() && ent.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function checkFileSyntax(filePath) {
  const res = spawnSync(process.execPath, ['--check', filePath], {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  if (res.status === 0) return { ok: true };
  const stderr = (res.stderr || '').trim();
  const stdout = (res.stdout || '').trim();
  return {
    ok: false,
    message: [stderr, stdout].filter(Boolean).join('\n')
  };
}

function main() {
  const files = [];
  for (const d of CHECK_DIRS) walkJsFiles(d, files);

  if (!files.length) {
    console.log('No JS files found to lint.');
    process.exit(0);
  }

  let failed = 0;
  for (const f of files) {
    const rel = path.relative(projectRoot, f);
    const result = checkFileSyntax(f);
    if (!result.ok) {
      failed += 1;
      console.error(`\n[syntax-error] ${rel}`);
      console.error(result.message || '(sin detalles)');
    }
  }

  if (failed > 0) {
    console.error(`\nLint falló: ${failed} archivo(s) con errores de sintaxis.`);
    process.exit(1);
  }

  console.log(`OK: sintaxis válida en ${files.length} archivo(s).`);
  process.exit(0);
}

main();
