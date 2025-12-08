import { Router } from "express";
import { baseDb } from "../db.js";

const router = Router();

// GET /api/base-items/search?query=text
router.get("/search", (req, res) => {
  const query = req.query.query?.trim();
  if (!query) return res.json([]);
  const items = baseDb
    .prepare(
      `SELECT * FROM base_items WHERE name LIKE ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(`%${query}%`);
  res.json(items);
});

// POST /api/base-items
router.post("/", (req, res) => {
  const { name, carrying = 0, brand_type = "" } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const stmt = baseDb.prepare(
    `INSERT INTO base_items (name, carrying, brand_type, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  );
  const result = stmt.run(name.trim(), Number(carrying) || 0, brand_type.trim());
  const created = baseDb.prepare("SELECT * FROM base_items WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// GET /api/base-items
router.get("/", (_req, res) => {
  const rows = baseDb.prepare("SELECT * FROM base_items ORDER BY created_at DESC").all();
  res.json(rows);
});

// GET /api/base-items/:id
router.get("/:id", (req, res) => {
  const row = baseDb.prepare("SELECT * FROM base_items WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// PUT /api/base-items/:id
router.put("/:id", (req, res) => {
  const existing = baseDb.prepare("SELECT * FROM base_items WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const name = req.body.name?.trim() || existing.name;
  const carrying = req.body.carrying !== undefined ? Number(req.body.carrying) : existing.carrying;
  const brand_type = req.body.brand_type !== undefined ? req.body.brand_type.trim() : existing.brand_type;

  baseDb
    .prepare(
      `UPDATE base_items SET name = ?, carrying = ?, brand_type = ? WHERE id = ?`
    )
    .run(name, carrying, brand_type, req.params.id);
  const updated = baseDb.prepare("SELECT * FROM base_items WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE /api/base-items/:id
router.delete("/:id", (req, res) => {
  const result = baseDb.prepare("DELETE FROM base_items WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ success: true });
});

export default router;
