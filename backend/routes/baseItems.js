import { Router } from "express";
import { baseDb } from "../db.js";

const router = Router();

const normalizeBase = (payload) => ({
  name: payload.name?.trim(),
  brand: payload.brand?.trim() || "",
  carrying: Number(payload.carrying ?? 0) || 0,
});

// GET /api/base-items/search?query=text
router.get("/search", (req, res) => {
  const query = req.query.query?.trim();
  console.log("[base] search query:", query);
  if (!query) return res.json([]);
  const items = baseDb
    .prepare(
      `SELECT * FROM base_items WHERE name LIKE ? COLLATE NOCASE ORDER BY created_on DESC LIMIT 20`
    )
    .all(`%${query}%`);
  res.json(items);
});

// GET /api/base-items/brands?query=text
router.get("/brands", (req, res) => {
  const query = req.query.query?.trim() || "";
  console.log("[base] brand search:", query);
  const rows = baseDb
    .prepare(
      `SELECT DISTINCT brand FROM base_items
       WHERE brand LIKE ? COLLATE NOCASE
       ORDER BY brand ASC
       LIMIT 20`
    )
    .all(`%${query}%`);
  res.json(rows.map((r) => r.brand).filter(Boolean));
});

// POST /api/base-items
router.post("/", (req, res) => {
  const { name, brand, carrying } = normalizeBase(req.body);
  console.log("[base] create payload:", req.body);
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const stmt = baseDb.prepare(
      `INSERT INTO base_items (name, brand, carrying, created_on)
       VALUES (?, ?, ?, datetime('now'))`
    );
    stmt.run(name, brand, carrying);
    const created = baseDb.prepare("SELECT * FROM base_items WHERE name = ?").get(name);
    res.status(201).json(created);
  } catch (err) {
    console.error("[base] create failed", err.message);
    res.status(400).json({ error: "Could not create base item", detail: err.message });
  }
});

// GET /api/base-items?all=true
router.get("/", (req, res) => {
  const getAll = req.query.all === "true";
  console.log("[base] list all", getAll ? "(all items)" : "(limited)");
  const query = getAll 
    ? "SELECT * FROM base_items ORDER BY created_on DESC"
    : "SELECT * FROM base_items ORDER BY created_on DESC LIMIT 5";
  const rows = baseDb.prepare(query).all();
  res.json(rows);
});

// GET /api/base-items/:name
router.get("/:name", (req, res) => {
  console.log("[base] fetch one", req.params.name);
  const row = baseDb.prepare("SELECT * FROM base_items WHERE name = ? COLLATE NOCASE").get(req.params.name);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// PUT /api/base-items/:name
router.put("/:name", (req, res) => {
  const existing = baseDb.prepare("SELECT * FROM base_items WHERE name = ? COLLATE NOCASE").get(req.params.name);
  console.log("[base] update request", req.params.name, req.body);
  if (!existing) return res.status(404).json({ error: "not found" });
  const payload = normalizeBase({ ...existing, ...req.body, name: req.params.name });
  try {
    baseDb
      .prepare(
        `UPDATE base_items SET brand = ?, carrying = ? WHERE name = ? COLLATE NOCASE`
      )
      .run(payload.brand, payload.carrying, req.params.name);
    const updated = baseDb.prepare("SELECT * FROM base_items WHERE name = ? COLLATE NOCASE").get(req.params.name);
    res.json(updated);
  } catch (err) {
    console.error("[base] update failed", err.message);
    res.status(400).json({ error: "Update failed", detail: err.message });
  }
});

// DELETE /api/base-items/:name
router.delete("/:name", (req, res) => {
  console.log("[base] delete", req.params.name);
  const result = baseDb.prepare("DELETE FROM base_items WHERE name = ? COLLATE NOCASE").run(req.params.name);
  if (result.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ success: true });
});

export default router;
