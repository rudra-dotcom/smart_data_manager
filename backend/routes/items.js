import { Router } from "express";
import db from "../db.js";

const router = Router();

// Helper to read the latest exchange rate stored in the settings table.
const getExchangeRate = () => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get();
  return row ? Number(row.value) : 1;
};

// Convert incoming payload into a normalized item object.
const normalizeItemPayload = (body) => {
  const exchangeRate = getExchangeRate();
  const chPrice = Number(body.ch_price ?? 0);

  return {
    name: body.name?.trim() ?? "",
    brand: body.brand?.trim() ?? "",
    quality: body.quality?.trim() ?? "",
    ch_price: chPrice,
    caring: body.caring?.trim() ?? "",
    ppp: body.ppp !== undefined ? Number(body.ppp) : chPrice * exchangeRate,
    retail_price: body.retail_price !== undefined ? Number(body.retail_price) : chPrice * exchangeRate,
    ws_price: body.ws_price !== undefined ? Number(body.ws_price) : chPrice * exchangeRate,
    quantity: Number(body.quantity ?? 0),
  };
};

// GET /api/items/search?query=text - partial match lookup for autocomplete.
router.get("/search", (req, res) => {
  const query = req.query.query?.trim();
  if (!query) {
    return res.json([]);
  }

  // Use LIKE with wildcards to support substring matches, limited to avoid unbounded results.
  const stmt = db.prepare(`
    SELECT * FROM items
    WHERE name LIKE ?
    ORDER BY created_at DESC
    LIMIT 20
  `);

  const items = stmt.all(`%${query}%`);
  res.json(items);
});

// POST /api/items - create a new item.
router.post("/", (req, res) => {
  const payload = normalizeItemPayload(req.body);
  if (!payload.name) {
    return res.status(400).json({ error: "Item name is required" });
  }

  const stmt = db.prepare(`
    INSERT INTO items (name, brand, quality, ch_price, caring, ppp, retail_price, ws_price, quantity, created_at)
    VALUES (@name, @brand, @quality, @ch_price, @caring, @ppp, @retail_price, @ws_price, @quantity, datetime('now'))
  `);

  const result = stmt.run(payload);
  const newItem = db.prepare("SELECT * FROM items WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(newItem);
});

// GET /api/items - list all items.
router.get("/", (_req, res) => {
  const items = db.prepare("SELECT * FROM items ORDER BY created_at DESC").all();
  res.json(items);
});

// GET /api/items/:id - fetch a single item by ID.
router.get("/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.json(item);
});

// PUT /api/items/:id - update an item.
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Item not found" });
  }

  const payload = normalizeItemPayload({ ...existing, ...req.body });
  const stmt = db.prepare(`
    UPDATE items
    SET name = @name,
        brand = @brand,
        quality = @quality,
        ch_price = @ch_price,
        caring = @caring,
        ppp = @ppp,
        retail_price = @retail_price,
        ws_price = @ws_price,
        quantity = @quantity
    WHERE id = @id
  `);

  stmt.run({ ...payload, id: req.params.id });
  const updated = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE /api/items/:id - remove an item.
router.delete("/:id", (req, res) => {
  const stmt = db.prepare("DELETE FROM items WHERE id = ?");
  const result = stmt.run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Item not found" });
  }

  res.json({ success: true });
});

export default router;
