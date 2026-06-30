// paths.js — Localização dos arquivos do app (dados do usuário, banco, backups).
// Único módulo que importa 'electron'; mantém o núcleo (security/database/backup)
// testável sem Electron.

import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { DB_FILENAME, META_FILENAME } from './backup.js';

// Pasta de dados do usuário (ex.: %APPDATA%/Cosmi no Windows).
export function userDataDir() {
  return app.getPath('userData');
}

export function dbPath() {
  return path.join(userDataDir(), DB_FILENAME);
}

export function metaPath() {
  return path.join(userDataDir(), META_FILENAME);
}

// Pasta padrão de backups. Pode ser sobrescrita por configuração (settings).
export function defaultBackupDir() {
  return path.join(userDataDir(), 'backups');
}

export function dbExists() {
  return fs.existsSync(dbPath()) && fs.existsSync(metaPath());
}
