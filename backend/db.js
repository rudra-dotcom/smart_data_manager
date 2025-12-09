import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDbPath = path.join(__dirname, "base.db");
const billsDbPath = path.join(__dirname, "bills.db");
const purchasesDbPath = path.join(__dirname, "purchases.db");
const finalDbPath = path.join(__dirname, "final.db");

const baseDb = new Database(baseDbPath);
const billsDb = new Database(billsDbPath);
const purchasesDb = new Database(purchasesDbPath);
const finalDb = new Database(finalDbPath);

const enablePragmas = (db) => {
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  } catch (err) {
    console.warn("[db] pragma setup failed", err.message);
  }
};

[baseDb, billsDb, purchasesDb, finalDb].forEach(enablePragmas);

// Base DB: holds master catalog.
baseDb.exec(`
  CREATE TABLE IF NOT EXISTS base_items (
    name TEXT PRIMARY KEY COLLATE NOCASE,
    brand TEXT,
    carrying REAL DEFAULT 0,
    created_on TEXT DEFAULT (datetime('now'))
  );
`);

// Migrate legacy schema (id + brand_type) to the required shape.
const baseColumns = baseDb.prepare("PRAGMA table_info(base_items)").all();
const hasBrandColumn = baseColumns.some((c) => c.name === "brand");
const hasLegacyId = baseColumns.some((c) => c.name === "id");
if (!hasBrandColumn || hasLegacyId) {
  console.log("[db] migrating base_items schema to {name, brand, carrying}");
  baseDb.exec(`
    CREATE TABLE IF NOT EXISTS base_items_new (
      name TEXT PRIMARY KEY COLLATE NOCASE,
      brand TEXT,
      carrying REAL DEFAULT 0,
      created_on TEXT DEFAULT (datetime('now'))
    );
  `);
  // Best-effort copy from legacy columns.
  baseDb.exec(`
    INSERT OR IGNORE INTO base_items_new (name, brand, carrying, created_on)
    SELECT name,
           COALESCE(brand, brand_type, ''),
           carrying,
           COALESCE(created_on, created_at, datetime('now'))
    FROM base_items
    ON CONFLICT(name) DO NOTHING;
  `);
  baseDb.exec(`DROP TABLE base_items`);
  baseDb.exec(`ALTER TABLE base_items_new RENAME TO base_items`);
}

// Bills DB: header rows.
billsDb.exec(`
  CREATE TABLE IF NOT EXISTS bills (
    bill_no INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_name TEXT NOT NULL,
    created_on TEXT NOT NULL,
    exchange_rate REAL DEFAULT 1,
    total_price REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Purchases DB: bill line items.
purchasesDb.exec(`
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    quantity REAL DEFAULT 0,
    wsp REAL,
    rp REAL,
    ppp REAL DEFAULT 0,
    created_on TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_bill_no ON purchases(bill_no);
  CREATE INDEX IF NOT EXISTS idx_purchases_name ON purchases(name COLLATE NOCASE);
`);

// Final DB: consolidated latest per name.
finalDb.exec(`
  CREATE TABLE IF NOT EXISTS final_entries (
    name TEXT PRIMARY KEY COLLATE NOCASE,
    brand TEXT,
    last_changed_on TEXT,
    bill_no INTEGER,
    quantity REAL,
    price REAL,
    carrying REAL,
    wsp REAL,
    rp REAL,
    ppp REAL
  );
`);

export { baseDb, billsDb, purchasesDb, finalDb };
