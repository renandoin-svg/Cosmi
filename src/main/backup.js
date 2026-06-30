// backup.js — Backup automático/manual, rotação, restauração e aviso de validade.
//
// Modelo de backup:
//  - Um backup = uma PASTA com data/hora, contendo:
//      cosmi.db        (cópia do arquivo JÁ CIFRADO — backup nunca expõe texto claro)
//      cosmi.meta.json (salt + parâmetros do Argon2 daquele momento)
//  - Incluir o meta.json torna o backup AUTOSSUFICIENTE: restaura desde que se
//    saiba a senha que valia quando o backup foi feito (importante se a senha
//    mestra for trocada depois, pois o banco é re-cifrado).
//  - Snapshot por cópia de arquivo (fs.copyFileSync) após checkpoint => cópia
//    cifrada e consistente. Ver nota em database.js sobre por que não usamos a
//    API de backup online (geraria texto claro).

import fs from 'node:fs';
import path from 'node:path';
import { checkpoint, verifyKey, setMeta, getMeta } from './database.js';
import { deriveKey, keyToHex, DEFAULT_KDF_PARAMS } from './security.js';

export const DB_FILENAME = 'cosmi.db';
export const META_FILENAME = 'cosmi.meta.json';
export const META_FORMAT_VERSION = 1;

// Padrões de configuração de backup.
export const BACKUP_DEFAULTS = Object.freeze({
  retention: 14,          // quantos backups manter
  warnDays: 7,            // avisar se o último backup passar disso
  autoIntervalHours: 24,  // intervalo do backup automático
});

// ---------------------------------------------------------------------------
// Sidecar meta.json (salt + params). Fica AO LADO do banco, em texto claro.
// O salt não é secreto; é necessário para derivar a chave antes de abrir o DB.
// ---------------------------------------------------------------------------
export function readMeta(metaPath) {
  const raw = fs.readFileSync(metaPath, 'utf8');
  return JSON.parse(raw);
}

export function writeMeta(metaPath, meta) {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), { encoding: 'utf8' });
}

export function buildMeta(saltHex, kdfParams = DEFAULT_KDF_PARAMS) {
  return {
    formatVersion: META_FORMAT_VERSION,
    kdf: { ...kdfParams },
    saltHex,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Nomes de pasta de backup com carimbo de data/hora ordenável.
// ---------------------------------------------------------------------------
function timestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Criar backup (manual ou automático).
//   db        : instância aberta (para checkpoint + registrar last_backup_at)
//   dbPath    : caminho do arquivo .db cifrado em uso
//   metaPath  : caminho do meta.json em uso
//   backupDir : pasta raiz dos backups
//   retention : quantos manter (rotação)
//   reason    : 'manual' | 'auto' | 'pre-restore' (registro)
// Retorna { folder, createdAt }.
// ---------------------------------------------------------------------------
export function createBackup({ db, dbPath, metaPath, backupDir, retention = BACKUP_DEFAULTS.retention, reason = 'manual' }) {
  ensureDir(backupDir);
  if (db) checkpoint(db);

  const folderName = `backup-${timestamp()}${reason === 'pre-restore' ? '-pre-restore' : ''}`;
  const folder = path.join(backupDir, folderName);
  ensureDir(folder);

  fs.copyFileSync(dbPath, path.join(folder, DB_FILENAME));
  fs.copyFileSync(metaPath, path.join(folder, META_FILENAME));

  const info = { folder, name: folderName, createdAt: new Date().toISOString(), reason };
  fs.writeFileSync(path.join(folder, 'backup-info.json'), JSON.stringify(info, null, 2));

  if (db) setMeta(db, 'last_backup_at', info.createdAt);

  // Rotação: mantém apenas os `retention` mais recentes (ignora pre-restore na contagem).
  rotateBackups(backupDir, retention);

  return info;
}

// ---------------------------------------------------------------------------
// Listar backups existentes (mais recentes primeiro).
// ---------------------------------------------------------------------------
export function listBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  const entries = fs.readdirSync(backupDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('backup-'));

  const out = entries.map((e) => {
    const folder = path.join(backupDir, e.name);
    const dbFile = path.join(folder, DB_FILENAME);
    let createdAt = null;
    let reason = 'manual';
    try {
      const infoPath = path.join(folder, 'backup-info.json');
      if (fs.existsSync(infoPath)) {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        createdAt = info.createdAt;
        reason = info.reason || reason;
      }
    } catch { /* ignore */ }
    let sizeBytes = 0;
    try { sizeBytes = fs.statSync(dbFile).size; } catch { /* ignore */ }
    return {
      name: e.name,
      folder,
      createdAt,
      reason,
      sizeBytes,
      valid: fs.existsSync(dbFile) && fs.existsSync(path.join(folder, META_FILENAME)),
    };
  });

  out.sort((a, b) => b.name.localeCompare(a.name)); // nome carimba data/hora
  return out;
}

// ---------------------------------------------------------------------------
// Rotação: remove os backups "normais" além do limite. Pre-restore não conta
// (são redes de segurança e ficam separados na contagem, mas também podados se
// excederem o dobro do limite para não acumular indefinidamente).
// ---------------------------------------------------------------------------
export function rotateBackups(backupDir, retention) {
  const all = listBackups(backupDir);
  const normal = all.filter((b) => b.reason !== 'pre-restore');
  const preRestore = all.filter((b) => b.reason === 'pre-restore');

  const toRemove = [
    ...normal.slice(retention),
    ...preRestore.slice(Math.max(retention, 5)),
  ];
  for (const b of toRemove) {
    try { fs.rmSync(b.folder, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Saúde do backup: idade do último e se está "velho".
// ---------------------------------------------------------------------------
export function backupHealth(db, warnDays = BACKUP_DEFAULTS.warnDays) {
  const last = db ? getMeta(db, 'last_backup_at') : null;
  if (!last) {
    return { lastBackupAt: null, ageDays: null, stale: true, neverBackedUp: true };
  }
  const ageMs = Date.now() - new Date(last).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return {
    lastBackupAt: last,
    ageDays: Math.floor(ageDays),
    stale: ageDays > warnDays,
    neverBackedUp: false,
  };
}

// Decide se já está na hora do backup automático.
export function isAutoBackupDue(db, intervalHours = BACKUP_DEFAULTS.autoIntervalHours) {
  const last = db ? getMeta(db, 'last_backup_at') : null;
  if (!last) return true;
  const ageMs = Date.now() - new Date(last).getTime();
  return ageMs >= intervalHours * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Restaurar a partir de uma pasta de backup.
//   backupFolder : pasta do backup escolhido
//   password     : senha mestra que valia quando o backup foi feito
//   dbPath/metaPath : destinos "em uso"
//   backupDir    : para gravar uma rede de segurança (pre-restore) do estado atual
// Passos: valida a senha contra o backup -> faz pre-restore do atual -> troca.
// Lança Error('SENHA_INCORRETA') se a senha não abrir o backup.
// Retorna o keyHex derivado (para o app reabrir já destravado).
// ---------------------------------------------------------------------------
export async function restoreBackup({ backupFolder, password, dbPath, metaPath, backupDir }) {
  const backupDb = path.join(backupFolder, DB_FILENAME);
  const backupMetaPath = path.join(backupFolder, META_FILENAME);
  if (!fs.existsSync(backupDb) || !fs.existsSync(backupMetaPath)) {
    throw new Error('BACKUP_INVALIDO');
  }

  const backupMeta = readMeta(backupMetaPath);
  const key = await deriveKey(password, backupMeta.saltHex, backupMeta.kdf);
  const keyHex = keyToHex(key);

  if (!verifyKey(backupDb, keyHex)) {
    const err = new Error('SENHA_INCORRETA');
    err.code = 'SENHA_INCORRETA';
    throw err;
  }

  // Rede de segurança: preserva o estado atual antes de sobrescrever.
  if (fs.existsSync(dbPath) && fs.existsSync(metaPath)) {
    ensureDir(backupDir);
    const folder = path.join(backupDir, `backup-${timestamp()}-pre-restore`);
    ensureDir(folder);
    fs.copyFileSync(dbPath, path.join(folder, DB_FILENAME));
    fs.copyFileSync(metaPath, path.join(folder, META_FILENAME));
    fs.writeFileSync(
      path.join(folder, 'backup-info.json'),
      JSON.stringify({ name: path.basename(folder), createdAt: new Date().toISOString(), reason: 'pre-restore' }, null, 2),
    );
  }

  // Troca atômica-na-prática: copia backup -> destinos em uso.
  fs.copyFileSync(backupDb, dbPath);
  fs.copyFileSync(backupMetaPath, metaPath);

  return { keyHex, meta: backupMeta };
}
