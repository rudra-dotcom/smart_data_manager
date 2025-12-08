import { Router } from "express";
import { baseDb, purchaseDb } from "../db.js";

const router = Router();

const getCarrying = (name) => {
  const row = baseDb.prepare("SELECT carrying FROM base_items WHERE name = ?").get(name);
  return row ? Number(row.carrying) : 0;
};

// GET current rate
router.get("/", (_req, res) => {
  const row = baseDb.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get();
  res.json({ exchange_rate: row ? Number(row.value) : 1 });
});

// PUT new rate, update all purchases PPP
router.put("/", (req, res) => {
  const rate = Number(req.body.exchange_rate);
  if (!rate || Number.isNaN(rate) || rate <= 0) {
    return res.status(400).json({ error: "exchange_rate must be a positive number" });
  }

  baseDb
    .prepare(
      "INSERT INTO settings (key, value) VALUES ('exchange_rate', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(rate);

  // Recompute PPP for every purchase (price_rmb * rate + carrying from base items)
  const purchases = purchaseDb.prepare("SELECT * FROM purchases").all();
  const updateStmt = purchaseDb.prepare("UPDATE purchases SET ppp = ? WHERE id = ?");
  purchases.forEach((p) => {
    const carrying = getCarrying(p.name);
    const ppp = (Number(p.price_rmb) || 0) * rate + carrying;
    updateStmt.run(ppp, p.id);
  });

  res.json({ exchange_rate: rate });
});

export default router;
