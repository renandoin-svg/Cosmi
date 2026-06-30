# Cosmi

Aplicativo **desktop (Windows), offline**, de **prontuário de apoio em cosmiatria**
para um único dermatologista. **Não substitui** o prontuário oficial (não é S-RES
certificado). Sem nuvem, sem telemetria. Interface em **português do Brasil**.

> ⚠️ Dado sensível de saúde (LGPD). Segurança é requisito. Veja
> [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

## Estado atual — Seção 1 concluída (modelo de dados + segurança)

Esta entrega cobre **apenas a §1** da spec. As demais seções (mapa facial,
cadastro, catálogo, atendimento, histórico) vêm depois, na ordem da spec.

Implementado:
- Banco **SQLite criptografado em repouso com SQLCipher** (AES-256 + HMAC-SHA512).
- **Senha mestra** com chave derivada por **Argon2id** (modo raw key). Sem senha,
  sem dados. A chave vive só na RAM; nunca é gravada.
- **Backup** automático (na abertura + a cada 24h) e **manual**, com **rotação** e
  **aviso visível** se o último backup passar de N dias (padrão 7).
- **Restauração** de backup (autossuficiente: cada backup leva seu salt) e
  **troca de senha mestra** (re-cifra o banco).
- **Modelo de dados completo** (esquema) já criado para as próximas seções.

## Stack

- **Electron + React** (interface), **better-sqlite3-multiple-ciphers**
  (SQLCipher, com binários pré-compilados para Windows), **argon2** (N-API).
- Empacotamento: **electron-builder** → instalador **NSIS** para Windows.
- Escolha justificada: o recurso central (mapa facial, §2) é SVG/Canvas e já tem
  referência em React; SQLCipher em Node tem binários prontos (instalação simples
  no Windows), evitando a dor de compilar `pysqlcipher3` no caminho PyQt.

## Rodar

```bash
npm install            # instala deps e recompila nativos para o ABI do Electron
npm run test:core      # teste headless de criptografia + backup (não precisa de GUI)
npm run dev            # roda o app em desenvolvimento
npm run dist:win       # gera o instalador Windows (.exe NSIS) — rodar no Windows
```

> Nota de desenvolvimento: `better-sqlite3-multiple-ciphers` é nativo. O
> `postinstall` (`electron-builder install-app-deps`) o recompila para o ABI do
> **Electron**. Para rodar `npm run test:core` sob o **Node** puro, rode antes
> `npm rebuild better-sqlite3-multiple-ciphers`; depois restaure o ABI do Electron
> com `npx electron-builder install-app-deps`. (`argon2` é N-API e funciona nos dois.)

## Estrutura

```
src/main/      processo principal: segurança, banco, backup, IPC
src/preload/   ponte segura renderer↔main
src/renderer/  interface React (Setup / Unlock / Segurança & Backup)
test/          teste headless do núcleo
docs/          SEGURANCA.md (decisões de cripto/backup)
```

## Avisos operacionais (spec §9)

- **Teste a restauração de um backup de verdade** antes de confiar nele.
- Peça revisão técnica de como a criptografia ficou (`docs/SEGURANCA.md` ajuda).
- A senha mestra **não tem recuperação**: esquecê-la = dados inacessíveis.
