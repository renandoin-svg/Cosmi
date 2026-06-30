// database.js — Abertura/criação do banco SQLCipher e migrações.
//
// Usa better-sqlite3-multiple-ciphers (motor SQLite3MultipleCiphers, compatível
// com SQLCipher). A chave entra em modo RAW KEY: PRAGMA key = "x'<hex>'".
// Em raw key, o SQLCipher usa diretamente nossos 32 bytes derivados via Argon2id
// (não aplica PBKDF2 por cima). O salt do HMAC continua sendo o salt aleatório
// que o SQLCipher grava no cabeçalho do próprio arquivo.

import Database from 'better-sqlite3-multiple-ciphers';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';

// Aplica os PRAGMAs de cifra na ordem correta e a chave bruta.
function applyCipher(db, keyHex) {
  db.pragma("cipher='sqlcipher'");
  db.pragma('legacy=4'); // compatibilidade SQLCipher v4 (AES-256-CBC + HMAC-SHA512)
  db.pragma(`key="x'${keyHex}'"`);
}

// Verifica se a chave abre o banco. Chave errada => leitura falha.
function assertReadable(db) {
  // Se a chave estiver errada, esta consulta lança "file is not a database".
  db.prepare('SELECT count(*) AS n FROM sqlite_master').get();
}

// Executa migrações idempotentes e fixa user_version.
function migrate(db) {
  db.exec(SCHEMA_SQL);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

// Abre um banco existente OU cria um novo, já cifrado, com o esquema aplicado.
// Lança Error('SENHA_INCORRETA') se a chave não abrir um banco existente.
export function openOrCreate(dbPath, keyHex, { create = false } = {}) {
  const db = new Database(dbPath);
  try {
    applyCipher(db, keyHex);
    db.pragma('foreign_keys = ON');
    if (create) {
      migrate(db);
    } else {
      try {
        assertReadable(db);
      } catch {
        db.close();
        const err = new Error('SENHA_INCORRETA');
        err.code = 'SENHA_INCORRETA';
        throw err;
      }
      // banco abriu: garante esquema/migrações em dia
      migrate(db);
    }
    return db;
  } catch (e) {
    try { db.close(); } catch { /* ignore */ }
    throw e;
  }
}

// Abre um banco apenas para validar a chave (usado na restauração). Fecha em seguida.
export function verifyKey(dbPath, keyHex) {
  const db = new Database(dbPath, { readonly: true });
  try {
    applyCipher(db, keyHex);
    assertReadable(db);
    return true;
  } catch {
    return false;
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

// Re-cifra o banco aberto com uma nova chave (troca de senha mestra).
export function rekey(db, newKeyHex) {
  db.pragma(`rekey="x'${newKeyHex}'"`);
}

// Garante que o arquivo .db em disco reflita o último estado commitado.
// IMPORTANTE: NÃO usamos a API de backup online do SQLite nem VACUUM INTO para
// backup, porque elas operam sobre páginas DECIFRADAS e podem gerar uma cópia
// em TEXTO CLARO. O backup é feito por cópia do próprio arquivo cifrado
// (ver backup.js). Como better-sqlite3 é síncrono/single-thread, após o
// checkpoint o arquivo está consistente entre operações.
export function checkpoint(db) {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)'); // inócuo se não estiver em WAL
  } catch {
    /* ignore */
  }
}

// Helpers de chave-valor em app_meta.
export function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key);
  return row ? row.value : null;
}
export function setMeta(db, key, value) {
  db.prepare(
    'INSERT INTO app_meta(key, value) VALUES(?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

// Helpers de configurações (settings).
export function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
export function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings(key, value) VALUES(?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}
