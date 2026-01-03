import { Router } from "express";
import { finalDb, baseDb } from "../db.js";

const router = Router();

const nowIso = () => new Date().toISOString();

const getCarrying = (name) => {
  const row = baseDb.prepare("SELECT carrying FROM base_items WHERE name = ? COLLATE NOCASE").get(name);
  return row ? Number(row.carrying) || 0 : 0;
};

// GET /api/final?all=true
router.get("/", (req, res) => {
  const name = req.query.name?.trim();
  const getAll = req.query.all === "true";
  console.log("[final] list filter", name, getAll ? "(all items)" : "(limited)");
  let rows;
  if (name) {
    const query = getAll
      ? `SELECT * FROM final_entries WHERE name LIKE ? COLLATE NOCASE ORDER BY last_changed_on DESC`
      : `SELECT * FROM final_entries WHERE name LIKE ? COLLATE NOCASE ORDER BY last_changed_on DESC LIMIT 5`;
    rows = finalDb.prepare(query).all(`%${name}%`);
  } else {
    const query = getAll
      ? "SELECT * FROM final_entries ORDER BY last_changed_on DESC"
      : "SELECT * FROM final_entries ORDER BY last_changed_on DESC LIMIT 5";
    rows = finalDb.prepare(query).all();
  }
  res.json(rows);
});

// GET /api/final/names
router.get("/names/all", (_req, res) => {
  console.log("[final] names all");
  const rows = finalDb.prepare("SELECT name FROM final_entries ORDER BY name ASC").all();
  res.json(rows.map((r) => r.name));
});

// PUT /api/final/:name
router.put("/:name", (req, res) => {
  const name = req.params.name?.trim();
  console.log("[final] update", name, req.body);
  if (!name) return res.status(400).json({ error: "Name is required" });

  const existing = finalDb.prepare("SELECT * FROM final_entries WHERE name = ? COLLATE NOCASE").get(name);
  if (!existing) return res.status(404).json({ error: "Entry not found" });

  // Preserve previous values for carrying, exchange_rate, price, quantity
  const exchangeRate = existing.exchange_rate;
  const price = existing.price;
  const quantity = existing.quantity;
  const carrying = existing.carrying ?? getCarrying(name);
  const wsp = req.body.wsp === "" ? null : req.body.wsp !== undefined ? Number(req.body.wsp) : existing.wsp;
  const rp = req.body.rp === "" ? null : req.body.rp !== undefined ? Number(req.body.rp) : existing.rp;

  // Keep PPP as is (blocked from user changes)
  const ppp = existing.ppp;

  finalDb
    .prepare(
      `UPDATE final_entries
       SET price = ?, quantity = ?, wsp = ?, rp = ?, ppp = ?, last_changed_on = ?, bill_no = ?, carrying = ?
       WHERE name = ? COLLATE NOCASE`
    )
    .run(price, quantity, wsp, rp, ppp, nowIso(), "N/A", carrying, name);

  const updated = finalDb.prepare("SELECT * FROM final_entries WHERE name = ? COLLATE NOCASE").get(name);
  res.json(updated);
});

export default router;
