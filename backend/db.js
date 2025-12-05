import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// Resolve DB file relative to this file so it persists across runs.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "inventory.db");

// Open a persistent SQLite connection. better-sqlite3 is synchronous and fast for local use.
const db = new Database(dbPath);

// Ensure schema exists on startup.
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    quality TEXT,
    ch_price REAL DEFAULT 0,
    caring TEXT,
    ppp REAL,
    retail_price REAL,
    ws_price REAL,
    quantity INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value REAL
  );
`);

// Seed a default exchange rate if missing.
const existingRate = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get();
if (!existingRate) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('exchange_rate', ?)").run(1);
}

export default db;
