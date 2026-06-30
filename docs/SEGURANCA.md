# Segurança — Cosmi (Seção 1)

Este documento explica, em detalhe, **como a criptografia e o backup funcionam**.
É a explicação pedida na spec (§1 e §9): como a chave é derivada da senha, onde
ela fica, e como restaurar um backup.

> **Natureza do app:** registro de **apoio** para um único profissional. **Não
> substitui** o prontuário oficial. Funciona **offline**, sem nuvem, sem
> telemetria. Nenhum dado sai da máquina.

---

## 1. Criptografia em repouso

- Banco **SQLite criptografado com SQLCipher** (via `better-sqlite3-multiple-ciphers`,
  motor *SQLite3MultipleCiphers*, compatível com SQLCipher).
- Cifra: **AES-256-CBC** com **HMAC-SHA512 por página** (autenticação de
  integridade) — perfil SQLCipher v4 (`PRAGMA cipher='sqlcipher'; PRAGMA legacy=4`).
- **Tudo** mora dentro do banco e, portanto, fica cifrado: dados dos pacientes,
  catálogo, atendimentos, marcações do mapa e **fotos** (guardadas como BLOB).

O teste `npm run test:core` confirma que o arquivo `.db` em disco **não contém**
o cabeçalho `SQLite format 3` nem textos em claro — ou seja, está realmente cifrado.

---

## 2. Como a chave é derivada da senha mestra

```
senha mestra ──► Argon2id(senha, salt, params) ──► chave de 32 bytes (256 bits)
                                                         │
                                                         ▼
                              PRAGMA key = "x'<chave em hex>'"   (modo RAW KEY)
```

- A senha mestra **nunca** é usada diretamente como chave.
- Passa por **Argon2id** (KDF *memory-hard*), que resiste muito melhor a ataques
  de força bruta com GPU do que o PBKDF2.
- Parâmetros padrão (em `src/main/security.js`, gravados no `meta.json` de cada banco):
  - `memoryCost = 262144 KiB` (**256 MiB**)
  - `timeCost = 3`
  - `parallelism = 1`
  - `keyLength = 32` bytes
- A chave de 32 bytes entra no SQLCipher em **modo raw key**
  (`PRAGMA key = "x'...'"`), então o SQLCipher **usa a chave que já derivamos** e
  **não aplica um segundo KDF mais fraco** por cima. O salt aleatório do **HMAC**
  continua sendo gerado e guardado pelo próprio SQLCipher no cabeçalho do arquivo.

### Por que guardamos os parâmetros no `meta.json`
Para poder **evoluir** os parâmetros do Argon2 no futuro (máquinas mais rápidas)
sem quebrar bancos antigos: cada banco/backup lembra com quais parâmetros foi feito.

---

## 3. Onde a chave fica

- **A chave derivada vive APENAS na RAM do processo principal do Electron**,
  enquanto o app está destravado. Nunca é gravada em disco e **nunca é enviada ao
  renderer** (a interface). A senha só trafega para o processo principal nos
  momentos de criar/destravar/trocar senha.
- Ao **travar** o app ou **fechar** a janela, a chave é **zerada na memória**
  (`buffer.fill(0)`) e o banco é fechado.
- **Sempre pede a senha ao abrir.** Por decisão (dado de saúde / LGPD), a chave
  **não é persistida** entre execuções. Não há "lembrar neste PC".

### O que fica em disco
| Arquivo | Conteúdo | É segredo? |
|---|---|---|
| `cosmi.db` | banco cifrado (AES-256) | os dados estão protegidos pela cifra |
| `cosmi.meta.json` | `saltHex` + parâmetros do Argon2 + versão | **não** — salt público é seguro |

O `meta.json` precisa ser legível **antes** de abrir o banco (senão não dá para
derivar a chave). Salt público é uma prática criptográfica padrão e segura.

### Não guardamos hash da senha
A verificação da senha é o **próprio banco**: senha errada → chave errada → o
SQLCipher falha ao ler a primeira página (`SENHA_INCORRETA`). Não existe um hash
de senha separado nem "porta dos fundos".

> **Sem recuperação:** se a senha mestra for esquecida, os dados ficam
> **inacessíveis**. Isso é intencional. Guarde a senha com cuidado.

Onde os arquivos ficam no Windows: `%APPDATA%\Cosmi\` (mostrado na tela do app).

---

## 4. Backup

- **Um backup = uma pasta** com carimbo de data/hora
  (`backup-AAAAMMDD-HHMMSS/`) contendo:
  - `cosmi.db` — **cópia do arquivo já cifrado** (o backup **nunca** expõe texto claro);
  - `cosmi.meta.json` — salt + parâmetros do Argon2 **daquele momento**;
  - `backup-info.json` — data e tipo (`manual` / `auto` / `pre-restore`).
- **Por que a cópia é por arquivo (e não pela API de backup do SQLite):**
  a API de backup online e o `VACUUM INTO` operam sobre páginas **decifradas** e
  poderiam gerar uma cópia em **texto claro**. Copiamos o **próprio arquivo
  cifrado** (após `wal_checkpoint`); como `better-sqlite3` é síncrono/single-thread,
  o arquivo em disco está consistente entre operações. Resultado: snapshot
  **cifrado e íntegro**.
- **Automático:** ao destravar (se já passou o intervalo) e a cada N horas
  (padrão 24h). **Manual:** botão "Backup agora".
- **Rotação:** mantém os últimos N (padrão **14**); backups de "pré-restauração"
  são preservados à parte.
- **Aviso de backup velho:** se o último backup passar de **N dias** (padrão **7**),
  a tela mostra um aviso visível com botão para fazer backup na hora.

### Por que cada backup inclui o `meta.json`
Para ser **autossuficiente**. Se você **trocar a senha mestra**, o banco é
**re-cifrado** (`PRAGMA rekey`) com um salt novo. Um backup antigo continua
cifrado com a **chave/salt da época**. Como o salt daquele momento viaja junto no
backup, ele pode ser restaurado **desde que você informe a senha que valia quando
o backup foi feito**.

---

## 5. Como restaurar um backup

Na tela **Segurança & Backup** → lista "Backups disponíveis" → **Restaurar**
(ou aponte para uma pasta de backup). O fluxo:

1. O app lê o `meta.json` **do backup** (salt + parâmetros daquela época).
2. Deriva a chave com **a senha que você digitar** + aquele salt.
3. **Valida** abrindo o `cosmi.db` do backup com essa chave. Senha errada →
   recusa com `SENHA_INCORRETA` (nada é sobrescrito).
4. Faz um **backup de segurança do estado atual** (pasta `...-pre-restore`).
5. Substitui `cosmi.db` e `cosmi.meta.json` em uso pelos do backup.
6. Reabre o banco **já destravado** com a chave validada.

> **Importante (lembrete da spec §9):** *teste uma restauração de verdade* antes
> de confiar nos backups. O teste automatizado já exercita isto, mas faça também
> manualmente de tempos em tempos. **Backup que você nunca restaurou não é backup.**

---

## 6. Troca de senha mestra

Tela → "Trocar senha". Valida a senha atual, faz um **backup de segurança**,
re-cifra o banco com `PRAGMA rekey` usando uma chave derivada da nova senha
(novo salt) e atualiza o `meta.json`. A senha antiga deixa de abrir o banco em uso
(mas ainda abre **backups antigos** feitos com ela — por isso eles guardam o salt).

---

## 7. Limites e ressalvas honestas

- **Proteção é em repouso.** Enquanto o app está **aberto e destravado**, os dados
  estão decifrados na memória, como em qualquer app. Trave o app ao se afastar.
- **Não é um S-RES certificado.** É registro de apoio.
- **Revisão recomendada (spec §9):** peça a alguém de confiança técnica para
  revisar como a criptografia ficou. Este documento existe para facilitar isso.
- A chave em memória é zerada no `lock`/fechamento (best-effort do runtime JS).

---

## 8. Onde está cada coisa no código

| Arquivo | Responsabilidade |
|---|---|
| `src/main/security.js` | Argon2id, derivação/limpeza da chave, força de senha |
| `src/main/database.js` | abrir/criar SQLCipher (raw key), migrações, `rekey`, checkpoint |
| `src/main/schema.js` | modelo de dados completo (esquema SQL) |
| `src/main/backup.js` | backup/rotação/restauração, `meta.json`, aviso de validade |
| `src/main/paths.js` | localização dos arquivos (único que usa `electron`) |
| `src/main/index.js` | processo principal: IPC, ciclo de vida, chave em memória |
| `src/preload/index.js` | ponte segura renderer↔main (sem expor a chave) |
| `src/renderer/` | interface (Setup / Unlock / Segurança & Backup) |
| `test/core.test.mjs` | teste headless de toda a lógica de cripto + backup |
