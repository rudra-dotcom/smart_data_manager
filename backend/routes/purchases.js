import { Router } from "express";
import { baseDb, purchaseDb } from "../db.js";

const router = Router();

const getExchangeRate = () => {
  const row = baseDb.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get();
  return row ? Number(row.value) : 1;
};

const getCarryingForName = (name) => {
  const row = baseDb.prepare("SELECT carrying FROM base_items WHERE name = ?").get(name);
  return row ? Number(row.carrying) : 0;
};

const computePPP = (name, priceRmb) => {
  const rate = getExchangeRate();
  const carrying = getCarryingForName(name);
  return priceRmb * rate + carrying;
};

// GET /api/purchases/search?query=text for dropdown
router.get("/search", (req, res) => {
  const query = req.query.query?.trim();
  if (!query) return res.json([]);
  const items = purchaseDb
    .prepare(
      `SELECT * FROM purchases WHERE name LIKE ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(`%${query}%`);
  res.json(items);
});

// POST /api/purchases
router.post("/", (req, res) => {
  const { name, price_rmb = 0, quantity = 0, wsp = null, rp = null } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const price = Number(price_rmb) || 0;
  const ppp = computePPP(name.trim(), price);

  const stmt = purchaseDb.prepare(
    `INSERT INTO purchases (name, price_rmb, quantity, ppp, wsp, rp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const result = stmt.run(name.trim(), price, Number(quantity) || 0, ppp, wsp !== undefined ? Number(wsp) : null, rp !== undefined ? Number(rp) : null);
  const created = purchaseDb.prepare("SELECT * FROM purchases WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// GET /api/purchases
router.get("/", (_req, res) => {
  const rows = purchaseDb.prepare("SELECT * FROM purchases ORDER BY created_at DESC").all();
  res.json(rows);
});

// GET /api/purchases/:id
router.get("/:id", (req, res) => {
  const row = purchaseDb.prepare("SELECT * FROM purchases WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// PUT /api/purchases/:id
router.put("/:id", (req, res) => {
  const existing = purchaseDb.prepare("SELECT * FROM purchases WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });

  const name = req.body.name?.trim() || existing.name;
  const price = req.body.price_rmb !== undefined ? Number(req.body.price_rmb) : existing.price_rmb;
  const quantity = req.body.quantity !== undefined ? Number(req.body.quantity) : existing.quantity;
  const wsp = req.body.wsp !== undefined ? Number(req.body.wsp) : existing.wsp;
  const rp = req.body.rp !== undefined ? Number(req.body.rp) : existing.rp;

  const ppp = computePPP(name, price);

  purchaseDb
    .prepare(
      `UPDATE purchases
       SET name = ?, price_rmb = ?, quantity = ?, ppp = ?, wsp = ?, rp = ?
       WHERE id = ?`
    )
    .run(name, price, quantity, ppp, wsp, rp, req.params.id);
  const updated = purchaseDb.prepare("SELECT * FROM purchases WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE /api/purchases/:id
router.delete("/:id", (req, res) => {
  const result = purchaseDb.prepare("DELETE FROM purchases WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ success: true });
});

export { computePPP, getExchangeRate };
export default router;
