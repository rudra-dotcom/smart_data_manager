import { Router } from "express";
import { baseDb, purchaseDb } from "../db.js";

const router = Router();

const schemaPrompt = `
You convert natural language to SAFE SQLite SELECT queries.
- Output ONLY SQL wrapped inside <sql>...</sql> tags. No prose, no thinking text.
- NEVER use INSERT/UPDATE/DELETE/PRAGMA; SELECT only.
- Do not use multiple statements.
- Tables:
  base_items(id, name, carrying, brand_type, created_at)
  purchases(id, name, price_rmb, quantity, ppp, wsp, rp, created_at)
Use only the columns listed above. Example for a range: SELECT * FROM purchases WHERE ppp BETWEEN 1500 AND 2000 ORDER BY created_at DESC LIMIT 100;
`;

const buildPrompt = (sheet, question) => {
  const table = sheet === "purchase" ? "purchases" : "base_items";
  return `${schemaPrompt}
Sheet "${sheet}" maps to table ${table}. Query ONLY this table.
Always include ORDER BY created_at DESC and LIMIT 100.
Respond with exactly: <sql>YOUR SELECT HERE</sql>
User question: ${question}`;
};

router.post("/", async (req, res) => {
  const { sheet, query } = req.body;
  if (!sheet || !["base", "purchase"].includes(sheet)) {
    return res.status(400).json({ error: "sheet must be 'base' or 'purchase'" });
  }
  if (!query?.trim()) return res.status(400).json({ error: "query is required" });

  // NEVER hardcode keys; read from env.
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
    const sql = extractSqlFromTags(raw);
    if (!sql) {
      console.error("[chat] invalid SQL from LLM:", raw);
      return res.status(400).json({ error: "LLM did not return a clean SELECT query in <sql> tags" });
    }

    // Execute against the chosen table only.
    try {
      const rows =
        sheet === "purchase"
          ? purchaseDb.prepare(sql).all()
          : baseDb.prepare(sql).all();
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
const extractSqlFromTags = (text = "") => {
  const match = text.match(/<sql>([\s\S]*?)<\/sql>/i);
  if (!match) return null;
  const inner = match[1].trim();
  if (!inner.toLowerCase().startsWith("select")) return null;
  return ensureLimit(inner);
};

const ensureLimit = (sql) => {
  const hasLimit = /\blimit\b\s+\d+/i.test(sql);
  if (!hasLimit) {
    return `${sql} LIMIT 100`;
  }
  return sql;
};

export default router;
