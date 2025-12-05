import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ItemForm from "./components/ItemForm.jsx";
import ItemTable from "./components/ItemTable.jsx";
import SearchDropdown from "./components/SearchDropdown.jsx";

// Prefer env override to let users point the frontend at any backend host.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const emptyItem = {
  name: "",
  brand: "",
  quality: "",
  ch_price: "",
  caring: "",
  ppp: "",
  retail_price: "",
  ws_price: "",
  quantity: "",
};

export default function App() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);
  const [exchangeRate, setExchangeRate] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch items and exchange rate together on mount.
  useEffect(() => {
    fetchItems();
    fetchExchangeRate();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/items`);
      setItems(res.data);
    } catch (error) {
      console.error("Failed to load items", error);
      setStatus("Could not load items.");
    } finally {
      setLoading(false);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/exchange-rate`);
      setExchangeRate(res.data.exchange_rate ?? 1);
    } catch (error) {
      console.error("Failed to load exchange rate", error);
      setStatus("Could not load exchange rate.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/api/items/${editingId}`, normalizePayload(formData));
        setStatus("Item updated.");
      } else {
        await axios.post(`${API_BASE}/api/items`, normalizePayload(formData));
        setStatus("Item created.");
      }
      resetForm();
      fetchItems();
    } catch (error) {
      console.error("Save failed", error);
      setStatus(error.response?.data?.error || "Save failed.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/items/${id}`);
      setStatus("Item deleted.");
      if (id === editingId) {
        resetForm();
      }
      fetchItems();
    } catch (error) {
      console.error("Delete failed", error);
      setStatus("Delete failed.");
    }
  };

  const handleEdit = (item) => {
    // Pre-fill form with selected item so the user can edit quickly.
    setEditingId(item.id);
    setFormData({
      name: item.name ?? "",
      brand: item.brand ?? "",
      quality: item.quality ?? "",
      ch_price: item.ch_price ?? "",
      caring: item.caring ?? "",
      ppp: item.ppp ?? "",
      retail_price: item.retail_price ?? "",
      ws_price: item.ws_price ?? "",
      quantity: item.quantity ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectSuggestion = (item) => {
    // Selecting from autocomplete behaves like edit for convenience.
    handleEdit(item);
  };

  const handleExchangeUpdate = async () => {
    if (!exchangeRate || Number(exchangeRate) <= 0) {
      setStatus("Please provide a positive exchange rate.");
      return;
    }
    try {
      await axios.put(`${API_BASE}/api/exchange-rate`, { exchange_rate: Number(exchangeRate) });
      setStatus("Exchange rate updated and prices recalculated.");
      fetchItems();
    } catch (error) {
      console.error("Exchange rate update failed", error);
      setStatus(error.response?.data?.error || "Exchange rate update failed.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyItem);
  };

  // Keep payload numeric where needed.
  const normalizePayload = (data) => ({
    ...data,
    ch_price: Number(data.ch_price || 0),
    ppp: data.ppp === "" ? undefined : Number(data.ppp),
    retail_price: data.retail_price === "" ? undefined : Number(data.retail_price),
    ws_price: data.ws_price === "" ? undefined : Number(data.ws_price),
    quantity: Number(data.quantity || 0),
  });

  const headline = useMemo(
    () =>
      editingId ? "Update Item" : "Add New Item",
    [editingId]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="flex flex-col gap-2">
        <p className="text-teal-300 uppercase tracking-[0.2em] text-xs">Inventory cockpit</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">Smart Data Manager</h1>
          <span className="text-sm text-slate-300 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700">
            RMB → INR @ {exchangeRate || "—"}
          </span>
        </div>
        <p className="text-slate-300 max-w-3xl">
          Local-first control of your catalog with live autocomplete, one-click edits, and global exchange updates that ripple through every price.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-teal-500/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-100">{headline}</h2>
            {editingId && (
              <button
                onClick={resetForm}
                className="text-sm text-teal-300 hover:text-teal-200 underline"
              >
                Cancel edit
              </button>
            )}
          </div>
          <SearchDropdown apiBase={API_BASE} onSelect={handleSelectSuggestion} />
          <ItemForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            editing={Boolean(editingId)}
          />
          {status && <p className="text-sm text-teal-200 mt-2">{status}</p>}
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-cyan-500/5">
          <h2 className="text-xl font-semibold text-slate-100 mb-3">Exchange Rate</h2>
          <p className="text-sm text-slate-400 mb-4">
            Updating the RMB → INR rate recalculates all price fields instantly.
          </p>
          <div className="space-y-3">
            <input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
              placeholder="e.g. 11.50"
            />
            <button
              onClick={handleExchangeUpdate}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-semibold py-2 rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition"
            >
              Update Rate
            </button>
          </div>
        </div>
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-teal-500/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-100">All Items</h2>
          <button
            onClick={fetchItems}
            className="text-sm text-teal-300 hover:text-teal-200 underline"
          >
            Refresh
          </button>
        </div>
        <ItemTable items={items} onEdit={handleEdit} onDelete={handleDelete} loading={loading} />
      </section>
    </div>
  );
}
