import { Router } from "express";
import { baseDb, billsDb, purchasesDb, finalDb } from "../db.js";

const router = Router();

const schemaPrompt = `
You convert natural language to SAFE SQLite SELECT queries.
- Output ONLY SQL wrapped inside <sql>...</sql> tags. No prose, no thinking text.
- NEVER use INSERT/UPDATE/DELETE/PRAGMA; SELECT only.
- Do not use multiple statements.
- Whenever data is given convert them into form "YYYY-MM-DD" and accordinly use them in the query.
- Tables:
  base_items(name, brand, carrying, created_on)
  bills(bill_no, vendor_name, created_on, exchange_rate, total_price, created_at)
  purchases(id, bill_no, name, price, quantity, wsp, rp, ppp, created_on)
  final_entries(name, brand, last_changed_on, bill_no, quantity, price, carrying, wsp, rp, ppp)
Use only the columns listed above. Example for a range: SELECT * FROM purchases WHERE ppp BETWEEN 1500 AND 2000 ORDER BY created_on DESC;
`;

const tableForSheet = (sheet) => {
  switch (sheet) {
    case "base":
      return { name: "base_items", db: baseDb, orderBy: "created_on" };
    case "bills":
      return { name: "bills", db: billsDb, orderBy: "created_on" };
    case "purchases":
      return { name: "purchases", db: purchasesDb, orderBy: "created_on" };
    case "final":
    default:
      return { name: "final_entries", db: finalDb, orderBy: "last_changed_on" };
  }
};

const buildPrompt = (sheet, question) => {
  const table = tableForSheet(sheet).name;
  return `${schemaPrompt}
Sheet "${sheet}" maps to table ${table}. Query ONLY this table.
Always include ORDER BY and LIMIT 100.
Respond with exactly: <sql>YOUR SELECT HERE</sql>
User question: ${question}`;
};

router.post("/", async (req, res) => {
  const { sheet = "final", query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: "query is required" });
  console.log("[chat] request", { sheet, query });

  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "qwen/qwen3-32b";
  if (!key) return res.status(500).json({ error: "GROQ_API_KEY missing in backend .env" });

  try {
    const prompt = buildPrompt(sheet, query);
    console.log("[chat] model:", model);
    console.log("[chat] prompt:", prompt);
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 300,
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text();
      console.error("[chat] groq non-200", groqRes.status, text);
      return res.status(502).json({ error: "Groq call failed", detail: text });
    }

    const data = await groqRes.json();
    console.log("[chat] groq response (truncated):", JSON.stringify(data)?.slice(0, 500));
    const raw = data.choices?.[0]?.message?.content || "";
    const sql = extractSqlFromTags(raw, tableForSheet(sheet).orderBy);
    if (!sql) {
      console.error("[chat] invalid SQL from LLM:", raw);
      return res.status(400).json({ error: "LLM did not return a clean SELECT query in <sql> tags" });
    }

    try {
      const { db } = tableForSheet(sheet);
      const rows = db.prepare(sql).all();
      console.log("[chat] executed SQL:", sql, "rows:", rows.length);
      res.json({ sql, rows });
    } catch (dbErr) {
      console.error("[chat] SQL error:", dbErr.message);
      return res.status(400).json({ error: "SQL failed", detail: dbErr.message, sql });
    }
  } catch (err) {
    console.error("Chat error", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// Extract the SQL between <sql>...</sql>
const extractSqlFromTags = (text = "", defaultOrder = "created_on") => {
  const match = text.match(/<sql>([\s\S]*?)<\/sql>/i);
  if (!match) return null;
  const inner = match[1].trim();
  if (!inner.toLowerCase().startsWith("select")) return null;
  return ensureOrderAndLimit(inner, defaultOrder);
};

const ensureOrderAndLimit = (sql, defaultOrder) => {
  const hasOrder = /\border\s+by\b/i.test(sql);
  const hasLimit = /\blimit\b\s+\d+/i.test(sql);
  let updated = sql;
  if (!hasOrder) {
    updated += ` ORDER BY ${defaultOrder} DESC`;
  }
  if (!hasLimit) {
    updated += " LIMIT 100";
  }
  return updated;
};

export default router;
