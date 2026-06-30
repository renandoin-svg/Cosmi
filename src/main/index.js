// index.js — Processo principal do Electron: ciclo de vida, janela, IPC e
// orquestração de segurança/backup. A chave derivada vive APENAS aqui, na RAM,
// enquanto o app está destravado. Nunca é enviada ao renderer nem gravada.

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  deriveKey, keyToHex, wipeKey, generateSalt,
  DEFAULT_KDF_PARAMS, assessPasswordStrength,
} from './security.js';
import {
  openOrCreate, rekey, getSetting, setSetting, setMeta,
} from './database.js';
import {
  buildMeta, writeMeta, readMeta, createBackup, listBackups,
  restoreBackup, backupHealth, isAutoBackupDue, BACKUP_DEFAULTS,
} from './backup.js';
import {
  userDataDir, dbPath, metaPath, defaultBackupDir, dbExists,
} from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ----- Estado em memória (somente processo principal) -----
let mainWindow = null;
let db = null;          // instância aberta enquanto destravado
let keyBuffer = null;   // chave derivada (Buffer) — zerada ao travar
let autoBackupTimer = null;

// ----- Helpers de configuração de backup -----
function backupDir() {
  if (db) {
    const custom = getSetting(db, 'backup_dir', null);
    if (custom) return custom;
  }
  return defaultBackupDir();
}
function retention() {
  return db ? Number(getSetting(db, 'backup_retention', BACKUP_DEFAULTS.retention)) : BACKUP_DEFAULTS.retention;
}
function warnDays() {
  return db ? Number(getSetting(db, 'backup_warn_days', BACKUP_DEFAULTS.warnDays)) : BACKUP_DEFAULTS.warnDays;
}
function autoIntervalHours() {
  return db ? Number(getSetting(db, 'backup_auto_hours', BACKUP_DEFAULTS.autoIntervalHours)) : BACKUP_DEFAULTS.autoIntervalHours;
}

function lock() {
  if (autoBackupTimer) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
  if (db) { try { db.close(); } catch { /* ignore */ } db = null; }
  if (keyBuffer) { wipeKey(keyBuffer); keyBuffer = null; }
}

function scheduleAutoBackup() {
  if (autoBackupTimer) clearInterval(autoBackupTimer);
  // Verifica de hora em hora se já passou o intervalo configurado.
  autoBackupTimer = setInterval(() => {
    try {
      if (db && isAutoBackupDue(db, autoIntervalHours())) {
        createBackup({ db, dbPath: dbPath(), metaPath: metaPath(), backupDir: backupDir(), retention: retention(), reason: 'auto' });
        if (mainWindow) mainWindow.webContents.send('backup:changed');
      }
    } catch (e) { console.error('Auto-backup falhou:', e); }
  }, 60 * 60 * 1000);
}

// Backup automático na abertura, se já estiver na hora.
function autoBackupOnUnlock() {
  try {
    if (db && isAutoBackupDue(db, autoIntervalHours())) {
      createBackup({ db, dbPath: dbPath(), metaPath: metaPath(), backupDir: backupDir(), retention: retention(), reason: 'auto' });
    }
  } catch (e) { console.error('Auto-backup (unlock) falhou:', e); }
}

// ----- IPC: estado / autenticação -----
ipcMain.handle('app:status', () => ({
  hasDatabase: dbExists(),
  unlocked: !!db,
  userDataDir: userDataDir(),
}));

ipcMain.handle('auth:passwordStrength', (_e, password) => assessPasswordStrength(String(password || '')));

// Primeiro uso: cria o banco cifrado com uma nova senha mestra.
ipcMain.handle('auth:setup', async (_e, password) => {
  if (dbExists()) throw new Error('JA_EXISTE');
  if (!password || String(password).length < 8) throw new Error('SENHA_CURTA');
  fs.mkdirSync(userDataDir(), { recursive: true });

  const salt = generateSalt();
  const meta = buildMeta(salt, DEFAULT_KDF_PARAMS);
  writeMeta(metaPath(), meta);

  keyBuffer = await deriveKey(String(password), salt, DEFAULT_KDF_PARAMS);
  db = openOrCreate(dbPath(), keyToHex(keyBuffer), { create: true });

  // Configurações iniciais de backup.
  setSetting(db, 'backup_retention', BACKUP_DEFAULTS.retention);
  setSetting(db, 'backup_warn_days', BACKUP_DEFAULTS.warnDays);
  setSetting(db, 'backup_auto_hours', BACKUP_DEFAULTS.autoIntervalHours);
  setMeta(db, 'created_at', new Date().toISOString());

  // Primeiro backup imediato.
  createBackup({ db, dbPath: dbPath(), metaPath: metaPath(), backupDir: backupDir(), retention: retention(), reason: 'auto' });
  scheduleAutoBackup();
  return { ok: true };
});

// Destravar banco existente.
ipcMain.handle('auth:unlock', async (_e, password) => {
  if (!dbExists()) throw new Error('SEM_BANCO');
  const meta = readMeta(metaPath());
  const key = await deriveKey(String(password), meta.saltHex, meta.kdf);
  try {
    db = openOrCreate(dbPath(), keyToHex(key), { create: false });
  } catch (e) {
    wipeKey(key);
    throw e; // SENHA_INCORRETA
  }
  keyBuffer = key;
  autoBackupOnUnlock();
  scheduleAutoBackup();
  return { ok: true };
});

ipcMain.handle('auth:lock', () => { lock(); return { ok: true }; });

// Trocar senha mestra (rekey + novo salt no meta).
ipcMain.handle('auth:changePassword', async (_e, { current, next }) => {
  if (!db) throw new Error('TRAVADO');
  // valida a senha atual derivando e comparando com a chave em uso
  const meta = readMeta(metaPath());
  const curKey = await deriveKey(String(current), meta.saltHex, meta.kdf);
  if (keyToHex(curKey) !== keyToHex(keyBuffer)) { wipeKey(curKey); throw new Error('SENHA_INCORRETA'); }
  wipeKey(curKey);
  if (!next || String(next).length < 8) throw new Error('SENHA_CURTA');

  // backup de segurança antes de re-cifrar
  createBackup({ db, dbPath: dbPath(), metaPath: metaPath(), backupDir: backupDir(), retention: retention(), reason: 'manual' });

  const newSalt = generateSalt();
  const newKey = await deriveKey(String(next), newSalt, DEFAULT_KDF_PARAMS);
  rekey(db, keyToHex(newKey));
  writeMeta(metaPath(), buildMeta(newSalt, DEFAULT_KDF_PARAMS));
  wipeKey(keyBuffer);
  keyBuffer = newKey;
  return { ok: true };
});

// ----- IPC: backup -----
ipcMain.handle('backup:now', () => {
  if (!db) throw new Error('TRAVADO');
  const info = createBackup({ db, dbPath: dbPath(), metaPath: metaPath(), backupDir: backupDir(), retention: retention(), reason: 'manual' });
  return info;
});

ipcMain.handle('backup:list', () => listBackups(backupDir()));

ipcMain.handle('backup:health', () => {
  if (!db) return { neverBackedUp: true, stale: true, lastBackupAt: null, ageDays: null };
  return backupHealth(db, warnDays());
});

ipcMain.handle('backup:openFolder', () => {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
  return { ok: true };
});

// Escolher uma pasta de backup para restaurar.
ipcMain.handle('backup:chooseFolder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha a pasta do backup',
    defaultPath: backupDir(),
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  return { canceled: false, folder: r.filePaths[0] };
});

// Restaurar: requer a senha que valia quando o backup foi feito.
ipcMain.handle('backup:restore', async (_e, { folder, password }) => {
  // fecha o banco atual antes de sobrescrever os arquivos
  const dir = backupDir();
  if (db) { try { db.close(); } catch { /* ignore */ } db = null; }
  if (keyBuffer) { wipeKey(keyBuffer); keyBuffer = null; }

  const res = await restoreBackup({ backupFolder: folder, password: String(password), dbPath: dbPath(), metaPath: metaPath(), backupDir: dir });
  // reabre já destravado com a chave devolvida
  db = openOrCreate(dbPath(), res.keyHex, { create: false });
  keyBuffer = Buffer.from(res.keyHex, 'hex');
  scheduleAutoBackup();
  return { ok: true };
});

ipcMain.handle('backup:getSettings', () => ({
  backupDir: backupDir(),
  retention: retention(),
  warnDays: warnDays(),
  autoIntervalHours: autoIntervalHours(),
}));

ipcMain.handle('backup:setSettings', (_e, s) => {
  if (!db) throw new Error('TRAVADO');
  if (s.retention != null) setSetting(db, 'backup_retention', Math.max(1, Number(s.retention)));
  if (s.warnDays != null) setSetting(db, 'backup_warn_days', Math.max(1, Number(s.warnDays)));
  if (s.autoIntervalHours != null) setSetting(db, 'backup_auto_hours', Math.max(1, Number(s.autoIntervalHours)));
  if (s.backupDir != null && String(s.backupDir).trim()) setSetting(db, 'backup_dir', String(s.backupDir).trim());
  return { ok: true };
});

ipcMain.handle('backup:chooseDir', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha a pasta para guardar os backups',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  return { canceled: false, dir: r.filePaths[0] };
});

// Diagnóstico simples (contagens) — demonstra que o banco está acessível.
ipcMain.handle('db:counts', () => {
  if (!db) throw new Error('TRAVADO');
  const tables = ['patients', 'brands', 'products', 'lots', 'sessions', 'procedures', 'markings'];
  const counts = {};
  for (const t of tables) {
    counts[t] = db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n;
  }
  return counts;
});

// ----- Janela / ciclo de vida -----
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    title: 'Cosmi',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  lock(); // garante que a chave saia da memória
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => lock());
