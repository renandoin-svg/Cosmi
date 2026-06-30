// security.js — Derivação de chave a partir da senha mestra.
//
// Decisões (ver docs/SEGURANCA.md):
//  - A senha mestra NUNCA é a chave. Passa por Argon2id (memory-hard).
//  - Argon2id(senha, salt, params) -> chave de 32 bytes (256 bits).
//  - Essa chave entra no SQLCipher em modo "raw key" (PRAGMA key = "x'<hex>'"),
//    sem um segundo KDF mais fraco por cima.
//  - Em disco guardamos apenas salt + params (não secretos). Nunca a chave.
//  - A chave só vive na RAM enquanto o app está destravado.

import crypto from 'node:crypto';
import argon2 from 'argon2';

// Parâmetros padrão do Argon2id. Ficam gravados no meta.json de cada banco,
// então podem evoluir no futuro sem quebrar bancos antigos.
export const DEFAULT_KDF_PARAMS = Object.freeze({
  algorithm: 'argon2id',
  // memoryCost em KiB. 262144 KiB = 256 MiB.
  memoryCost: 262144,
  timeCost: 3,
  parallelism: 1,
  // Tamanho da chave derivada, em bytes (256 bits para AES-256).
  keyLength: 32,
});

// Gera um salt aleatório de 16 bytes (128 bits), em hex.
export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// Deriva a chave bruta (Buffer de keyLength bytes) a partir da senha mestra.
// `saltHex` é o salt em hex; `params` segue o formato de DEFAULT_KDF_PARAMS.
export async function deriveKey(password, saltHex, params = DEFAULT_KDF_PARAMS) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Senha mestra vazia.');
  }
  const salt = Buffer.from(saltHex, 'hex');
  const key = await argon2.hash(password, {
    type: argon2.argon2id,
    raw: true, // queremos os bytes brutos da chave, não o hash codificado
    salt,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
    hashLength: params.keyLength,
  });
  return key; // Buffer
}

// Converte a chave (Buffer) para a string hex usada no PRAGMA key do SQLCipher.
export function keyToHex(keyBuffer) {
  return keyBuffer.toString('hex');
}

// Zera um Buffer de chave na memória (best-effort) quando o app trava.
export function wipeKey(keyBuffer) {
  if (Buffer.isBuffer(keyBuffer)) keyBuffer.fill(0);
}

// Avaliação simples de força da senha (apenas orientação na UI; não bloqueia).
export function assessPasswordStrength(password) {
  const len = password.length;
  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['muito fraca', 'fraca', 'razoável', 'boa', 'forte', 'forte'];
  return { score, label: labels[Math.min(score, 5)] };
}
