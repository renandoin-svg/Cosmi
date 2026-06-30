// preload — Ponte segura entre renderer e processo principal.
// Expõe apenas funções específicas via contextBridge. A senha mestra trafega
// para o main apenas durante setup/unlock/troca; a CHAVE derivada nunca sai do main.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('cosmi', {
  // estado / auth
  status: () => ipcRenderer.invoke('app:status'),
  passwordStrength: (pwd) => ipcRenderer.invoke('auth:passwordStrength', pwd),
  setup: (pwd) => ipcRenderer.invoke('auth:setup', pwd),
  unlock: (pwd) => ipcRenderer.invoke('auth:unlock', pwd),
  lock: () => ipcRenderer.invoke('auth:lock'),
  changePassword: (current, next) => ipcRenderer.invoke('auth:changePassword', { current, next }),

  // backup
  backupNow: () => ipcRenderer.invoke('backup:now'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  backupHealth: () => ipcRenderer.invoke('backup:health'),
  openBackupFolder: () => ipcRenderer.invoke('backup:openFolder'),
  chooseBackupFolder: () => ipcRenderer.invoke('backup:chooseFolder'),
  restore: (folder, password) => ipcRenderer.invoke('backup:restore', { folder, password }),
  getBackupSettings: () => ipcRenderer.invoke('backup:getSettings'),
  setBackupSettings: (s) => ipcRenderer.invoke('backup:setSettings', s),
  chooseBackupDir: () => ipcRenderer.invoke('backup:chooseDir'),

  // diagnóstico
  dbCounts: () => ipcRenderer.invoke('db:counts'),

  // eventos vindos do main (ex.: backup automático aconteceu)
  onBackupChanged: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('backup:changed', handler);
    return () => ipcRenderer.removeListener('backup:changed', handler);
  },
});
