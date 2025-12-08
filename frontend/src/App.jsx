import { useEffect, useState } from "react";
import axios from "axios";
import BaseForm from "./components/BaseForm.jsx";
import PurchaseForm from "./components/PurchaseForm.jsx";
import BaseTable from "./components/BaseTable.jsx";
import PurchaseTable from "./components/PurchaseTable.jsx";
import ExportExcel from "./components/ExportExcel.jsx";
import ChatBox from "./components/ChatBox.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

const emptyBase = { name: "", carrying: "", brand_type: "Samsung" };
const emptyPurchase = { name: "", price_rmb: "", quantity: "", wsp: "", rp: "", ppp: 0 };

const baseColumns = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "carrying", label: "Carrying" },
  { key: "brand_type", label: "Brand Type" },
  { key: "created_at", label: "Created At" },
];

const purchaseColumns = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "price_rmb", label: "Price RMB" },
  { key: "quantity", label: "Quantity" },
  { key: "ppp", label: "PPP" },
  { key: "wsp", label: "WSP" },
  { key: "rp", label: "RP" },
  { key: "created_at", label: "Created At" },
];

export default function App() {
  const [baseItems, setBaseItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [baseForm, setBaseForm] = useState(emptyBase);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [editingBaseId, setEditingBaseId] = useState(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [statusBase, setStatusBase] = useState("");
  const [statusPurchase, setStatusPurchase] = useState("");
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingPurchase, setLoadingPurchase] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    fetchBaseItems();
    fetchPurchases();
    fetchExchangeRate();
  };

  const fetchBaseItems = async () => {
    setLoadingBase(true);
    try {
      const res = await axios.get(`${API_BASE}/api/base-items`);
      setBaseItems(res.data);
    } catch (err) {
      console.error(err);
      setStatusBase("Could not load sheet 1.");
    } finally {
      setLoadingBase(false);
    }
  };

  const fetchPurchases = async () => {
    setLoadingPurchase(true);
    try {
      const res = await axios.get(`${API_BASE}/api/purchases`);
      setPurchases(res.data);
    } catch (err) {
      console.error(err);
      setStatusPurchase("Could not load sheet 2.");
    } finally {
      setLoadingPurchase(false);
    }
  };

  const fetchExchangeRate = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/exchange-rate`);
      setExchangeRate(res.data.exchange_rate ?? 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBaseSubmit = async (e) => {
    e.preventDefault();
    setStatusBase("");
    try {
      if (editingBaseId) {
        await axios.put(`${API_BASE}/api/base-items/${editingBaseId}`, normalizeBase(baseForm));
        setStatusBase("Sheet 1 entry updated.");
      } else {
        await axios.post(`${API_BASE}/api/base-items`, normalizeBase(baseForm));
        setStatusBase("Sheet 1 entry created.");
      }
      resetBaseForm();
      fetchBaseItems();
    } catch (err) {
      console.error(err);
      setStatusBase(err.response?.data?.error || "Save failed.");
    }
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    setStatusPurchase("");
    try {
      if (editingPurchaseId) {
        await axios.put(`${API_BASE}/api/purchases/${editingPurchaseId}`, normalizePurchase(purchaseForm));
        setStatusPurchase("Purchase updated.");
      } else {
        await axios.post(`${API_BASE}/api/purchases`, normalizePurchase(purchaseForm));
        setStatusPurchase("Purchase added.");
      }
      resetPurchaseForm();
      fetchPurchases();
    } catch (err) {
      console.error(err);
      setStatusPurchase(err.response?.data?.error || "Save failed.");
    }
  };

  const handleBaseEdit = (item) => {
    setEditingBaseId(item.id);
    setBaseForm({
      name: item.name,
      carrying: item.carrying,
      brand_type: item.brand_type,
    });
  };
  const handleBaseDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/base-items/${id}`);
      setStatusBase("Deleted.");
      if (editingBaseId === id) resetBaseForm();
      fetchBaseItems();
    } catch (err) {
      console.error(err);
      setStatusBase("Delete failed.");
    }
  };

  const handlePurchaseEdit = (item) => {
    setEditingPurchaseId(item.id);
    setPurchaseForm({
      name: item.name,
      price_rmb: item.price_rmb,
      quantity: item.quantity,
      wsp: item.wsp ?? "",
      rp: item.rp ?? "",
      ppp: item.ppp ?? 0,
    });
  };
  const handlePurchaseDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/purchases/${id}`);
      setStatusPurchase("Deleted.");
      if (editingPurchaseId === id) resetPurchaseForm();
      fetchPurchases();
    } catch (err) {
      console.error(err);
      setStatusPurchase("Delete failed.");
    }
  };

  const handleExchangeUpdate = async () => {
    if (!exchangeRate || Number(exchangeRate) <= 0) {
      setStatusPurchase("Provide a positive exchange rate.");
      return;
    }
    try {
      await axios.put(`${API_BASE}/api/exchange-rate`, { exchange_rate: Number(exchangeRate) });
      setStatusPurchase("Exchange rate updated and PPP recalculated.");
      fetchPurchases();
    } catch (err) {
      console.error(err);
      setStatusPurchase(err.response?.data?.error || "Exchange update failed.");
    }
  };

  const resetBaseForm = () => {
    setEditingBaseId(null);
    setBaseForm(emptyBase);
  };
  const resetPurchaseForm = () => {
    setEditingPurchaseId(null);
    setPurchaseForm(emptyPurchase);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
      <header className="flex flex-col gap-2">
        <p className="text-teal-300 uppercase tracking-[0.2em] text-xs">Dual sheets</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">Smart Data Manager</h1>
          <span className="text-sm text-slate-300 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700">
            RMB → INR @ {exchangeRate || "—"}
          </span>
        </div>
        <p className="text-slate-300 max-w-4xl">
          Sheet 1 holds base items (Name, Carrying, Brand). Sheet 2 records purchases and auto-calculates PPP = price_rmb × exchange_rate + carrying.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-teal-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-100">Sheet 1: Base</h2>
            {editingBaseId && (
              <button onClick={resetBaseForm} className="text-sm text-teal-300 hover:text-teal-200 underline">
                Cancel edit
              </button>
            )}
          </div>
          <BaseForm formData={baseForm} setFormData={setBaseForm} onSubmit={handleBaseSubmit} editing={Boolean(editingBaseId)} />
          {statusBase && <p className="text-sm text-teal-200">{statusBase}</p>}
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-cyan-500/5 space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Exchange Rate</h2>
          <p className="text-sm text-slate-400">Updating rate recalculates PPP for Sheet 2.</p>
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
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-teal-500/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Sheet 1 Entries</h3>
          <button onClick={fetchBaseItems} className="text-sm text-teal-300 hover:text-teal-200 underline">
            Refresh
          </button>
        </div>
        <div className="grid md:grid-cols-[2fr,1fr] gap-4 items-start">
          <BaseTable items={baseItems} onEdit={handleBaseEdit} onDelete={handleBaseDelete} loading={loadingBase} />
          <ExportExcel items={baseItems} columns={baseColumns} filename="sheet1_base.xlsx" sheetName="Sheet1_Base" />
        </div>
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-amber-500/5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-100">Sheet 2: Bill Purchase</h2>
          {editingPurchaseId && (
            <button onClick={resetPurchaseForm} className="text-sm text-amber-200 hover:text-amber-100 underline">
              Cancel edit
            </button>
          )}
        </div>
        <PurchaseForm
          formData={purchaseForm}
          setFormData={setPurchaseForm}
          onSubmit={handlePurchaseSubmit}
          editing={Boolean(editingPurchaseId)}
          baseItems={baseItems}
          exchangeRate={exchangeRate}
        />
        {statusPurchase && <p className="text-sm text-amber-200">{statusPurchase}</p>}
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-teal-500/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Sheet 2 Entries</h3>
          <button onClick={fetchPurchases} className="text-sm text-teal-300 hover:text-teal-200 underline">
            Refresh
          </button>
        </div>
        <div className="grid md:grid-cols-[2fr,1fr] gap-4 items-start">
          <PurchaseTable items={purchases} onEdit={handlePurchaseEdit} onDelete={handlePurchaseDelete} loading={loadingPurchase} />
          <ExportExcel items={purchases} columns={purchaseColumns} filename="sheet2_purchases.xlsx" sheetName="Sheet2_Purchases" />
        </div>
      </section>

      <ChatBox />
    </div>
  );
}

const normalizeBase = (data) => ({
  name: data.name?.trim(),
  carrying: Number(data.carrying || 0),
  brand_type: data.brand_type?.trim() || "",
});

const normalizePurchase = (data) => ({
  name: data.name?.trim(),
  price_rmb: Number(data.price_rmb || 0),
  quantity: Number(data.quantity || 0),
  wsp: data.wsp === "" ? null : Number(data.wsp),
  rp: data.rp === "" ? null : Number(data.rp),
});
