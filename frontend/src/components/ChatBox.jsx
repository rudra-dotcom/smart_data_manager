import { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

export default function ChatBox() {
  const [sheet, setSheet] = useState("purchase");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [sql, setSql] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) {
      setStatus("Ask a question.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const res = await axios.post(`${API_BASE}/api/chat`, { sheet, query });
      setRows(res.data.rows || []);
      setSql(res.data.sql || "");
      setStatus("");
    } catch (err) {
      console.error("Chat failed", err);
      setStatus(err.response?.data?.error || "Chat failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl shadow-purple-500/10 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-lg font-semibold text-slate-100">Chat with your data</h3>
        <select
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
          className="rounded-lg bg-slate-800 text-slate-100 px-3 py-2 border border-slate-700 text-sm"
        >
          <option value="base">Sheet 1 (Base)</option>
          <option value="purchase">Sheet 2 (Purchases)</option>
        </select>
      </div>
      <p className="text-sm text-slate-400">
        Offline rule-based interpreter (no external LLM). Try: "products between 3000 and 5000 PPP" or "apple items".
      </p>
      <div className="flex gap-2 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about PPP ranges, price, brand, etc."
          className="flex-1 min-w-[240px] rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
        />
        <button
          onClick={handleAsk}
          disabled={loading}
          className="bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-slate-950 font-semibold px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-60"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </div>
      {status && <p className="text-sm text-amber-200">{status}</p>}
      {sql && <p className="text-xs text-slate-400">Query: {sql}</p>}
      {!!rows.length && <ResultTable rows={rows} />}
    </div>
  );
}

function ResultTable({ rows }) {
  const columns = Object.keys(rows[0] || {});
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-slate-200 border border-slate-800 rounded-lg overflow-hidden mt-2">
        <thead className="bg-slate-800 text-slate-100">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left whitespace-nowrap capitalize">
                {c.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || JSON.stringify(row)} className="border-t border-slate-800 hover:bg-slate-800/60">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 whitespace-nowrap">
                  {String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
