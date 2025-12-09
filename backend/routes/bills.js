import { Router } from "express";
import { baseDb, billsDb, purchasesDb, finalDb } from "../db.js";

const router = Router();

const nowIso = () => new Date().toISOString();

const getBaseMeta = (name) => {
  const row = baseDb.prepare("SELECT * FROM base_items WHERE name = ? COLLATE NOCASE").get(name);
  return row || { carrying: 0, brand: "" };
};

const computePPP = ({ name, price, exchangeRate }) => {
  const base = getBaseMeta(name);
  const rate = Number(exchangeRate) || 1;
  const cleanPrice = Number(price) || 0;
  return cleanPrice * rate + (Number(base.carrying) || 0);
};

const updateFinalEntry = ({ name, billNo, price, quantity, wsp, rp, ppp, createdOn }) => {
  const base = getBaseMeta(name);
  const brand = base.brand || "";
  const carrying = Number(base.carrying) || 0;
  const safePPP = ppp ?? computePPP({ name, price, exchangeRate: 1 });
  console.log("[final] upsert", { name, billNo, price, quantity, wsp, rp, safePPP, createdOn });

  finalDb
    .prepare(
      `INSERT INTO final_entries (name, brand, last_changed_on, bill_no, quantity, price, carrying, wsp, rp, ppp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         brand = excluded.brand,
         last_changed_on = excluded.last_changed_on,
         bill_no = excluded.bill_no,
         quantity = excluded.quantity,
         price = excluded.price,
         carrying = excluded.carrying,
         wsp = excluded.wsp,
         rp = excluded.rp,
         ppp = excluded.ppp`
    )
    .run(
      name,
      brand,
      createdOn || nowIso(),
      billNo,
      Number(quantity) || 0,
      Number(price) || 0,
      carrying,
      wsp === undefined ? null : Number(wsp),
      rp === undefined ? null : Number(rp),
      Number(safePPP) || 0
    );
};

const refreshFinalFromPurchases = (name) => {
  console.log("[final] refresh from purchases for", name);
  const latest = purchasesDb
    .prepare(
      `SELECT * FROM purchases WHERE name = ? COLLATE NOCASE ORDER BY created_on DESC, id DESC LIMIT 1`
    )
    .get(name);
  if (!latest) {
    finalDb.prepare("DELETE FROM final_entries WHERE name = ? COLLATE NOCASE").run(name);
    return;
  }
  const brandMeta = getBaseMeta(name);
  updateFinalEntry({
    name,
    billNo: latest.bill_no,
    price: latest.price,
    quantity: latest.quantity,
    wsp: latest.wsp,
    rp: latest.rp,
    ppp: latest.ppp,
    createdOn: latest.created_on,
    brand: brandMeta.brand,
  });
};

const recomputeBillTotal = (billNo) => {
  const rows = purchasesDb.prepare("SELECT quantity, ppp FROM purchases WHERE bill_no = ?").all(billNo);
  const total = rows.reduce((sum, row) => {
    const qty = Number(row.quantity) || 0;
    const ppp = Number(row.ppp) || 0;
    return sum + qty * ppp;
  }, 0);
  billsDb.prepare("UPDATE bills SET total_price = ? WHERE bill_no = ?").run(total, billNo);
  console.log("[bill] recomputed total", { billNo, total, count: rows.length });
  return total;
};

// POST /api/bills - create bill header
router.post("/", (req, res) => {
  const vendorName = req.body.vendor_name?.trim();
  const createdOn = req.body.created_on?.trim() || nowIso().slice(0, 10);
  const exchangeRate = Number(req.body.exchange_rate || 1) || 1;
  console.log("[bill] create", req.body);

  if (!vendorName) return res.status(400).json({ error: "Vendor Name is required" });

  const stmt = billsDb.prepare(
    `INSERT INTO bills (vendor_name, created_on, exchange_rate, total_price, created_at)
     VALUES (?, ?, ?, 0, datetime('now'))`
  );
  const result = stmt.run(vendorName, createdOn, exchangeRate);
  const created = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

// GET /api/bills
router.get("/", (_req, res) => {
  console.log("[bill] list all");
  const rows = billsDb.prepare("SELECT * FROM bills ORDER BY created_on DESC, bill_no DESC").all();
  res.json(rows);
});

// GET /api/bills/search
router.get("/search", (req, res) => {
  const vendor = req.query.vendor_name?.trim();
  const createdOn = req.query.created_on?.trim();
  const name = req.query.name?.trim();
  console.log("[bill] search", { vendor, createdOn, name });

  if (!vendor && !createdOn && !name) {
    const rows = billsDb.prepare("SELECT * FROM bills ORDER BY created_on DESC, bill_no DESC").all();
    return res.json(rows);
  }

  const billNosForName =
    name && !vendor && !createdOn
      ? purchasesDb
          .prepare(
            `SELECT DISTINCT bill_no FROM purchases WHERE name LIKE ? COLLATE NOCASE`
          )
          .all(`%${name}%`)
          .map((r) => r.bill_no)
      : [];

  let sql = "SELECT * FROM bills";
  const clauses = [];
  const params = [];

  if (vendor) {
    clauses.push("vendor_name LIKE ? COLLATE NOCASE");
    params.push(`%${vendor}%`);
  }
  if (createdOn) {
    clauses.push("created_on LIKE ?");
    params.push(`%${createdOn}%`);
  }
  if (clauses.length) {
    sql += " WHERE " + clauses.join(" AND ");
  }

  sql += " ORDER BY created_on DESC, bill_no DESC";
  const rows = billsDb.prepare(sql).all(...params);

  if (name) {
    const billSet =
      billNosForName.length > 0
        ? new Set(billNosForName)
        : new Set(
            purchasesDb
              .prepare("SELECT DISTINCT bill_no FROM purchases WHERE name LIKE ? COLLATE NOCASE")
              .all(`%${name}%`)
              .map((r) => r.bill_no)
          );
    return res.json(rows.filter((r) => billSet.has(r.bill_no)));
  }

  res.json(rows);
});

// GET /api/bills/:billNo
router.get("/:billNo", (req, res) => {
  const billNo = Number(req.params.billNo);
  console.log("[bill] fetch", billNo);
  const bill = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(billNo);
  if (!bill) return res.status(404).json({ error: "Bill not found" });
  const items = purchasesDb.prepare("SELECT * FROM purchases WHERE bill_no = ? ORDER BY id ASC").all(billNo);
  const total = recomputeBillTotal(billNo);
  res.json({ ...bill, total_price: total, items });
});

// PUT /api/bills/:billNo
router.put("/:billNo", (req, res) => {
  const billNo = Number(req.params.billNo);
  const existing = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(billNo);
  console.log("[bill] update", billNo, req.body);
  if (!existing) return res.status(404).json({ error: "Bill not found" });

  const vendor = req.body.vendor_name?.trim() || existing.vendor_name;
  const createdOn = req.body.created_on?.trim() || existing.created_on;
  const exchangeRate =
    req.body.exchange_rate !== undefined ? Number(req.body.exchange_rate) || existing.exchange_rate : existing.exchange_rate;

  billsDb
    .prepare("UPDATE bills SET vendor_name = ?, created_on = ?, exchange_rate = ? WHERE bill_no = ?")
    .run(vendor, createdOn, exchangeRate, billNo);

  const rateChanged = exchangeRate !== existing.exchange_rate;
  const createdChanged = createdOn !== existing.created_on;

  if (rateChanged || createdChanged) {
    const items = purchasesDb.prepare("SELECT * FROM purchases WHERE bill_no = ?").all(billNo);
    const updateStmt = purchasesDb.prepare(
      `UPDATE purchases SET ppp = ?, created_on = ? WHERE id = ?`
    );
    items.forEach((item) => {
      const newPPP = rateChanged ? computePPP({ name: item.name, price: item.price, exchangeRate }) : item.ppp;
      updateStmt.run(newPPP, createdOn, item.id);
      updateFinalEntry({
        name: item.name,
        billNo,
        price: item.price,
        quantity: item.quantity,
        wsp: item.wsp,
        rp: item.rp,
        ppp: newPPP,
        createdOn,
      });
    });
  }

  const total = recomputeBillTotal(billNo);
  const updated = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(billNo);
  res.json({ ...updated, total_price: total });
});

// DELETE /api/bills/:billNo
router.delete("/:billNo", (req, res) => {
  const billNo = Number(req.params.billNo);
  console.log("[bill] delete", billNo);
  const existing = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(billNo);
  if (!existing) return res.status(404).json({ error: "Bill not found" });

  const impactedNames = purchasesDb
    .prepare("SELECT DISTINCT name FROM purchases WHERE bill_no = ?")
    .all(billNo)
    .map((r) => r.name);

  purchasesDb.prepare("DELETE FROM purchases WHERE bill_no = ?").run(billNo);
  billsDb.prepare("DELETE FROM bills WHERE bill_no = ?").run(billNo);

  impactedNames.forEach((n) => refreshFinalFromPurchases(n));
  res.json({ success: true });
});

// POST /api/bills/:billNo/items
router.post("/:billNo/items", (req, res) => {
  const billNo = Number(req.params.billNo);
  const bill = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(billNo);
  console.log("[bill-item] add", billNo, req.body);
  if (!bill) return res.status(404).json({ error: "Bill not found" });

  const name = req.body.name?.trim();
  const price = Number(req.body.price || 0) || 0;
  const quantity = Number(req.body.quantity || 0) || 0;
  const wsp = req.body.wsp === undefined || req.body.wsp === "" ? null : Number(req.body.wsp);
  const rp = req.body.rp === undefined || req.body.rp === "" ? null : Number(req.body.rp);

  if (!name) return res.status(400).json({ error: "Name is required" });

  const ppp = computePPP({ name, price, exchangeRate: bill.exchange_rate });

  const stmt = purchasesDb.prepare(
    `INSERT INTO purchases (bill_no, name, price, quantity, wsp, rp, ppp, created_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(billNo, name, price, quantity, wsp, rp, ppp, bill.created_on);
  const created = purchasesDb.prepare("SELECT * FROM purchases WHERE id = ?").get(result.lastInsertRowid);

  updateFinalEntry({
    name,
    billNo,
    price,
    quantity,
    wsp,
    rp,
    ppp,
    createdOn: bill.created_on,
  });

  const total = recomputeBillTotal(billNo);
  res.status(201).json({ item: created, total_price: total });
});

// PUT /api/bills/:billNo/items/:itemId
router.put("/:billNo/items/:itemId", (req, res) => {
  const billNo = Number(req.params.billNo);
  const itemId = Number(req.params.itemId);
  const bill = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(billNo);
  const existing = purchasesDb.prepare("SELECT * FROM purchases WHERE id = ?").get(itemId);
  console.log("[bill-item] update", { billNo, itemId, body: req.body });
  if (!bill) return res.status(404).json({ error: "Bill not found" });
  if (!existing) return res.status(404).json({ error: "Item not found" });

  const name = req.body.name?.trim() || existing.name;
  const price = req.body.price !== undefined ? Number(req.body.price) : existing.price;
  const quantity = req.body.quantity !== undefined ? Number(req.body.quantity) : existing.quantity;
  const wsp = req.body.wsp === "" ? null : req.body.wsp !== undefined ? Number(req.body.wsp) : existing.wsp;
  const rp = req.body.rp === "" ? null : req.body.rp !== undefined ? Number(req.body.rp) : existing.rp;
  const ppp = computePPP({ name, price, exchangeRate: bill.exchange_rate });

  purchasesDb
    .prepare(
      `UPDATE purchases SET name = ?, price = ?, quantity = ?, wsp = ?, rp = ?, ppp = ?, created_on = ? WHERE id = ?`
    )
    .run(name, price, quantity, wsp, rp, ppp, bill.created_on, itemId);

  updateFinalEntry({
    name,
    billNo,
    price,
    quantity,
    wsp,
    rp,
    ppp,
    createdOn: bill.created_on,
  });

  const total = recomputeBillTotal(billNo);
  const updated = purchasesDb.prepare("SELECT * FROM purchases WHERE id = ?").get(itemId);
  res.json({ item: updated, total_price: total });
});

// DELETE /api/bills/:billNo/items/:itemId
router.delete("/:billNo/items/:itemId", (req, res) => {
  const billNo = Number(req.params.billNo);
  const itemId = Number(req.params.itemId);
  console.log("[bill-item] delete", { billNo, itemId });
  const bill = billsDb.prepare("SELECT * FROM bills WHERE bill_no = ?").get(billNo);
  const existing = purchasesDb.prepare("SELECT * FROM purchases WHERE id = ?").get(itemId);
  if (!bill) return res.status(404).json({ error: "Bill not found" });
  if (!existing) return res.status(404).json({ error: "Item not found" });

  purchasesDb.prepare("DELETE FROM purchases WHERE id = ?").run(itemId);
  const total = recomputeBillTotal(billNo);
  refreshFinalFromPurchases(existing.name);
  res.json({ success: true, total_price: total });
});

export default router;
