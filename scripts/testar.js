#!/usr/bin/env node
// Executa os testes automatizados num banco SEPARADO.
//   1. Usa DATABASE_URL_TEST (o nome do banco precisa terminar em _test).
//   2. Apaga e recria esse banco aplicando as migrações (prisma migrate reset).
//   3. Roda os testes (node --test).
// O banco de desenvolvimento (DATABASE_URL) não é tocado.
require('dotenv').config({ quiet: true });
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  console.error('Defina DATABASE_URL_TEST no .env (veja .env.example).');
  process.exit(1);
}
let nomeBanco;
try {
  nomeBanco = new URL(url).pathname.replace(/^\//, '');
} catch {
  console.error('DATABASE_URL_TEST inválida.');
  process.exit(1);
}
if (!nomeBanco.endsWith('_test')) {
  console.error(`Por segurança, o banco de testes precisa terminar em _test (atual: "${nomeBanco}").`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test', IDENTIFICACAO_MODO: 'cabecalho' };
const raiz = path.join(__dirname, '..');
const executar = (comando, args) => spawnSync(comando, args, { cwd: raiz, env, stdio: 'inherit', shell: process.platform === 'win32' });

console.log(`Recriando o banco de testes "${nomeBanco}"...`);
const reset = executar('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate']);
if (reset.status !== 0) process.exit(reset.status ?? 1);

// Lista explícita de arquivos (funciona igual no Node 20 e 22, Windows ou Linux).
const arquivos = require('node:fs').readdirSync(path.join(raiz, 'tests'))
  .filter((nome) => nome.endsWith('.test.js'))
  .sort()
  .map((nome) => path.join('tests', nome));
const argsExtras = process.argv.slice(2);
const testes = executar(process.execPath, ['--test', '--test-concurrency=1', ...argsExtras, ...arquivos]);
process.exit(testes.status ?? 1);
