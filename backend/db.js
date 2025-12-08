import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// We keep two DB files as requested: one for the master catalog (sheet 1) and one for purchases (sheet 2).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDbPath = path.join(__dirname, "base.db");
const purchaseDbPath = path.join(__dirname, "purchase.db");

const baseDb = new Database(baseDbPath);
const purchaseDb = new Database(purchaseDbPath);

// Base DB: name, carrying, brand_type plus settings for exchange rate.
baseDb.exec(`
  CREATE TABLE IF NOT EXISTS base_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    carrying REAL DEFAULT 0,
    brand_type TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value REAL
  );
`);

// Purchases DB: depends on exchange rate and carrying from base.
purchaseDb.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price_rmb REAL DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    ppp REAL DEFAULT 0,
    wsp REAL,
    rp REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed exchange rate if missing.
const existingRate = baseDb.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get();
if (!existingRate) {
  baseDb.prepare("INSERT INTO settings (key, value) VALUES ('exchange_rate', ?)").run(1);
}

export { baseDb, purchaseDb };
