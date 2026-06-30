// Teste headless do núcleo de segurança + backup (sem Electron).
// Roda com: npm run test:core
//
// Cobre: criação cifrada, derivação Argon2id, senha errada falha,
// persistência entre aberturas, troca de senha (rekey), backup, rotação,
// restauração com a senha correta e rejeição com a senha errada, aviso de
// backup velho, e confirmação de que o arquivo NÃO é texto claro.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

import { deriveKey, keyToHex, generateSalt } from '../src/main/security.js';
import { openOrCreate, rekey, setMeta, getMeta } from '../src/main/database.js';
import {
  buildMeta, writeMeta, readMeta, createBackup, listBackups,
  restoreBackup, backupHealth, DB_FILENAME, META_FILENAME,
} from '../src/main/backup.js';

let passed = 0;
function ok(msg) { passed++; console.log(`  ✓ ${msg}`); }

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmi-test-'));
const dbPath = path.join(work, DB_FILENAME);
const metaPath = path.join(work, META_FILENAME);
const backupDir = path.join(work, 'backups');

async function main() {
  console.log(`\nDiretório de teste: ${work}\n`);

  // 1) Criar banco cifrado a partir de uma senha mestra.
  const password = 'SenhaMestra-Forte#2026';
  const salt = generateSalt();
  const meta = buildMeta(salt);
  writeMeta(metaPath, meta);
  let key = await deriveKey(password, meta.saltHex, meta.kdf);
  let db = openOrCreate(dbPath, keyToHex(key), { create: true });
  setMeta(db, 'created_marker', 'ola-mundo');
  db.prepare("INSERT INTO brands(name, name_normalized) VALUES('Restylane','restylane')").run();
  db.close();
  ok('banco criado e cifrado, dados gravados');

  // 2) Reabrir com a senha correta (deriva de novo a partir do meta).
  const meta2 = readMeta(metaPath);
  key = await deriveKey(password, meta2.saltHex, meta2.kdf);
  db = openOrCreate(dbPath, keyToHex(key), { create: false });
  assert.equal(getMeta(db, 'created_marker'), 'ola-mundo');
  const brandCount = db.prepare('SELECT count(*) AS n FROM brands').get().n;
  assert.equal(brandCount, 1);
  ok('reabertura com senha correta lê os dados de volta');
  db.close();

  // 3) Senha errada deve falhar.
  const wrongKey = await deriveKey('senha-errada', meta2.saltHex, meta2.kdf);
  let threw = false;
  try {
    openOrCreate(dbPath, keyToHex(wrongKey), { create: false });
  } catch (e) {
    threw = e.code === 'SENHA_INCORRETA';
  }
  assert.ok(threw, 'esperava SENHA_INCORRETA');
  ok('senha errada é rejeitada');

  // 4) O arquivo NÃO pode conter nossos textos em claro.
  const bytes = fs.readFileSync(dbPath);
  assert.ok(!bytes.includes(Buffer.from('SQLite format 3\0')), 'cabeçalho SQLite não pode estar em claro');
  assert.ok(!bytes.includes(Buffer.from('Restylane')), 'dados não podem aparecer em claro');
  ok('arquivo está cifrado (sem cabeçalho/dados em claro)');

  // 5) Backup manual + rotação.
  db = openOrCreate(dbPath, keyToHex(await deriveKey(password, meta2.saltHex, meta2.kdf)), { create: false });
  const b1 = createBackup({ db, dbPath, metaPath, backupDir, retention: 3, reason: 'manual' });
  assert.ok(fs.existsSync(path.join(b1.folder, DB_FILENAME)));
  assert.ok(fs.existsSync(path.join(b1.folder, META_FILENAME)));
  ok('backup criado com cópia cifrada + meta.json');

  // saúde do backup: acabou de ser feito => não está velho
  const health = backupHealth(db, 7);
  assert.equal(health.stale, false);
  assert.equal(health.neverBackedUp, false);
  ok('saúde do backup: recente, não está velho');

  // simular backup antigo => deve avisar
  setMeta(db, 'last_backup_at', new Date(Date.now() - 10 * 86400000).toISOString());
  assert.equal(backupHealth(db, 7).stale, true);
  ok('aviso de backup velho dispara após N dias');

  // 6) Trocar a senha mestra (rekey) e confirmar.
  const newPassword = 'NovaSenha-AindaMaisForte#2026';
  const newSalt = generateSalt();
  const newKey = await deriveKey(newPassword, newSalt, meta2.kdf);
  rekey(db, keyToHex(newKey));
  // atualiza o meta em uso com o novo salt
  writeMeta(metaPath, buildMeta(newSalt, meta2.kdf));
  db.close();
  // a senha antiga não abre mais
  let oldFails = false;
  try {
    openOrCreate(dbPath, keyToHex(await deriveKey(password, newSalt, meta2.kdf)), { create: false });
  } catch (e) { oldFails = e.code === 'SENHA_INCORRETA'; }
  assert.ok(oldFails);
  // a nova abre
  db = openOrCreate(dbPath, keyToHex(await deriveKey(newPassword, newSalt, meta2.kdf)), { create: false });
  assert.equal(getMeta(db, 'created_marker'), 'ola-mundo');
  ok('troca de senha (rekey): senha antiga falha, nova funciona');

  // gerar mais alterações depois do backup b1 (que foi com a senha ANTIGA)
  db.prepare("INSERT INTO brands(name, name_normalized) VALUES('Juvederm','juvederm')").run();
  assert.equal(db.prepare('SELECT count(*) AS n FROM brands').get().n, 2);
  db.close();

  // 7) Restaurar o backup b1 (feito com a senha ANTIGA) — prova de autossuficiência.
  //    A senha errada deve ser rejeitada; a senha de quando o backup foi feito funciona.
  let restoreWrong = false;
  try {
    await restoreBackup({ backupFolder: b1.folder, password: 'qualquer-coisa', dbPath, metaPath, backupDir });
  } catch (e) { restoreWrong = e.code === 'SENHA_INCORRETA'; }
  assert.ok(restoreWrong, 'restauração com senha errada deve falhar');
  ok('restauração rejeita senha errada');

  const res = await restoreBackup({ backupFolder: b1.folder, password, dbPath, metaPath, backupDir });
  // reabrir com a chave devolvida pela restauração
  db = openOrCreate(dbPath, res.keyHex, { create: false });
  // b1 foi feito quando só existia 'Restylane' => deve ter 1 marca
  assert.equal(db.prepare('SELECT count(*) AS n FROM brands').get().n, 1);
  assert.equal(getMeta(db, 'created_marker'), 'ola-mundo');
  ok('restauração com a senha da época funciona e volta ao estado do backup');
  db.close();

  // 8) A restauração deve ter criado um pre-restore (rede de segurança).
  const backups = listBackups(backupDir);
  assert.ok(backups.some((b) => b.reason === 'pre-restore'), 'esperava um pre-restore');
  ok('restauração gera backup de segurança (pre-restore) do estado anterior');

  console.log(`\n✓ TODOS OS ${passed} TESTES PASSARAM\n`);
}

main()
  .catch((e) => { console.error('\n✗ FALHA:', e); process.exitCode = 1; })
  .finally(() => { try { fs.rmSync(work, { recursive: true, force: true }); } catch {} });
