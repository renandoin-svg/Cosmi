// schema.js — Modelo de dados completo do Cosmi (Seção 1), como string SQL.
// Mantido em JS (não .sql) para funcionar igual no teste Node e no build Electron,
// sem depender de cópia de assets pelo bundler.
//
// Tudo vive dentro do banco SQLCipher => criptografado em repouso, inclusive
// fotos (BLOBs). As seções 2–6 constroem UI/lógica sobre este esquema.

// SCHEMA_VERSION controla migrações via PRAGMA user_version.
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- Metadados / configurações (chave-valor)
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- §3 Pacientes
CREATE TABLE IF NOT EXISTS patients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name       TEXT NOT NULL,
  birth_date      TEXT,
  cpf             TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  allergies       TEXT,
  medical_history TEXT,
  notes           TEXT,
  photo           BLOB,
  photo_mime      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_cpf  ON patients(cpf);

CREATE TABLE IF NOT EXISTS patient_identifiers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pident_value   ON patient_identifiers(value);
CREATE INDEX IF NOT EXISTS idx_pident_patient ON patient_identifiers(patient_id);

-- §4 Catálogo: MARCA -> PRODUTO/SKU -> LOTE
CREATE TABLE IF NOT EXISTS brands (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id            INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  name_normalized     TEXT NOT NULL,
  type                TEXT,
  unit                TEXT,
  active_ingredient   TEXT,
  presentation        TEXT,
  technology          TEXT,
  indicated_region    TEXT,
  concentration_mg_ml TEXT,
  warning             TEXT,
  discontinued        INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(brand_id, name_normalized)
);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);

CREATE TABLE IF NOT EXISTS lots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_number     TEXT NOT NULL,
  expiry_date    TEXT,
  stock_quantity REAL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, lot_number)
);
CREATE INDEX IF NOT EXISTS idx_lots_product ON lots(product_id);
CREATE INDEX IF NOT EXISTS idx_lots_expiry  ON lots(expiry_date);

-- §5 Atendimentos / sessões
CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date    ON sessions(session_date);

CREATE TABLE IF NOT EXISTS procedures (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  data_json  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_procedures_session ON procedures(session_id);

-- §2 Mapa facial
CREATE TABLE IF NOT EXISTS face_maps (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  view             TEXT NOT NULL,
  background_photo BLOB,
  background_mime  TEXT,
  UNIQUE(session_id, view)
);

CREATE TABLE IF NOT EXISTS markings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  face_map_id  INTEGER NOT NULL REFERENCES face_maps(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  lot_id       INTEGER REFERENCES lots(id),
  marking_type TEXT NOT NULL,
  geometry     TEXT NOT NULL,
  dose_value   REAL,
  dose_unit    TEXT,
  region       TEXT,
  instrument   TEXT,
  depth_plane  TEXT,
  technique    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_markings_map ON markings(face_map_id);
`;
