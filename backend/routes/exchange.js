import { Router } from "express";
import db from "../db.js";

const router = Router();

// Fetch the persisted exchange rate for UI consumption.
router.get("/", (_req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'exchange_rate'").get();
  res.json({ exchange_rate: row ? Number(row.value) : 1 });
});

// PUT /api/exchange-rate - update the rate and cascade price recalculation.
router.put("/", (req, res) => {
  const rate = Number(req.body.exchange_rate);
  if (!rate || Number.isNaN(rate) || rate <= 0) {
    return res.status(400).json({ error: "exchange_rate must be a positive number" });
  }

  // Persist new rate so future operations use it.
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('exchange_rate', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(rate);

  // Recalculate dependent price fields for every item.
  db.prepare(
    "UPDATE items SET ppp = ch_price * ?, retail_price = ch_price * ?, ws_price = ch_price * ?"
  ).run(rate, rate, rate);

  res.json({ exchange_rate: rate });
});

export default router;
