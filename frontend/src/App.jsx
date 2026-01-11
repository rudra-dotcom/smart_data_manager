import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ExportExcel from "./components/ExportExcel.jsx";
import ChatBox from "./components/ChatBox.jsx";

const API_BASE = "http://localhost:5001" || "http://51.20.35.200:5001" || import.meta.env.VITE_API_URL ;

const baseColumns = [
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "carrying", label: "Carrying" },
  { key: "created_on", label: "Created On" },
];

const finalColumns = [
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "last_changed_on", label: "Last Changed" },
  { key: "bill_no", label: "Bill No" },
  { key: "quantity", label: "Quantity" },
  { key: "price", label: "Price" },
  { key: "carrying", label: "Carrying" },
  { key: "wsp", label: "WSP" },
  { key: "rp", label: "RP" },
  { key: "ppp", label: "PPP" },
];

const purchaseColumns = [
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "quantity", label: "Quantity" },
  { key: "ppp", label: "PPP" },
  { key: "wsp", label: "WSP" },
  { key: "rp", label: "RP" },
  { key: "bill_no", label: "Bill No" },
  { key: "created_on", label: "Created On" },
];

const today = new Date();

const startBillDate = {
  day: String(today.getDate()).padStart(2, "0"),
  month: String(today.getMonth() + 1).padStart(2, "0"),
  year: String(today.getFullYear()),
};

export default function App() {
  const [baseItems, setBaseItems] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [baseNameOptions, setBaseNameOptions] = useState([]);
  const [baseForm, setBaseForm] = useState({ name: "", brand: "", carrying: "" });
  const [editingBaseName, setEditingBaseName] = useState(null);
  const [statusBase, setStatusBase] = useState("");

  const [billHeader, setBillHeader] = useState({
    vendor_name: "",
    exchange_rate: "1",
    ...startBillDate,
  });
  const [billItemForm, setBillItemForm] = useState({
    name: "",
    price: "",
    quantity: "",
    wsp: "",
    rp: "",
  });
  const [activeBill, setActiveBill] = useState(null);
  const [activeBillItems, setActiveBillItems] = useState([]);
  const [billStatus, setBillStatus] = useState("");
  const [pppFromFinal, setPppFromFinal] = useState(null);
  const [bills, setBills] = useState([]);
  const [billFilters, setBillFilters] = useState({ vendor_name: "", created_on: "", name: "" });
  const [billDetail, setBillDetail] = useState(null);

  const [finalEntries, setFinalEntries] = useState([]);
  const [finalNames, setFinalNames] = useState([]);
  const [finalForm, setFinalForm] = useState({
    name: "",
    exchange_rate: "",
    price: "",
    quantity: "",
    wsp: "",
    rp: "",
    ppp: "",
    carrying: "",
  });
  const [purchases, setPurchases] = useState([]);
  const [finalStatus, setFinalStatus] = useState("");

  useEffect(() => {
    fetchBaseItems();
    fetchBills();
    fetchFinalEntries();
    fetchFinalNames();
    fetchPurchases();
  }, []);

  useEffect(() => {
    if (!baseForm.brand) {
      setBrandOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/base-items/brands`, {
          params: { query: baseForm.brand },
          signal: controller.signal,
        });
        setBrandOptions(res.data || []);
      } catch (error) {
        if (error.name !== "CanceledError") {
          console.error("brand search failed", error);
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [baseForm.brand]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills(billFilters);
    }, 250);
    return () => clearTimeout(timer);
  }, [billFilters]);

  useEffect(() => {
    if (!billItemForm.name) {
      setBaseNameOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/base-items/search`, {
          params: { query: billItemForm.name },
          signal: controller.signal,
        });
        setBaseNameOptions(res.data || []);
      } catch (error) {
        if (error.name !== "CanceledError") {
          console.error("base name search failed", error);
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [billItemForm.name]);

  // Fetch WSP, RP, and PPP from final.db when name is selected
  useEffect(() => {
    const fetchWspRpPppFromFinal = async () => {
      if (!billItemForm.name?.trim()) {
        setPppFromFinal(null);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/api/final/by-name/${encodeURIComponent(billItemForm.name.trim())}`);
        const finalEntry = res.data;
        
        if (finalEntry) {
          // Update WSP and RP with values from final.db, or 0 if null/undefined
          setBillItemForm((prev) => ({
            ...prev,
            wsp: finalEntry.wsp !== null && finalEntry.wsp !== undefined ? String(finalEntry.wsp) : "0",
            rp: finalEntry.rp !== null && finalEntry.rp !== undefined ? String(finalEntry.rp) : "0",
          }));
          // Store PPP from final.db if available
          if (finalEntry.ppp !== null && finalEntry.ppp !== undefined) {
            setPppFromFinal(Number(finalEntry.ppp));
          } else {
            setPppFromFinal(null);
          }
        } else {
          setPppFromFinal(null);
        }
      } catch (error) {
        // If not found (404) or any other error, set to 0 and clear PPP
        if (error.response?.status !== 404) {
          console.error("Failed to fetch WSP/RP/PPP from final.db", error);
        }
        setBillItemForm((prev) => ({
          ...prev,
          wsp: "0",
          rp: "0",
        }));
        setPppFromFinal(null);
      }
    };

    const timer = setTimeout(() => {
      fetchWspRpPppFromFinal();
    }, 300); // Small delay to avoid too many calls while typing

    return () => clearTimeout(timer);
  }, [billItemForm.name]);

  const fetchBaseItems = async () => {
    console.log("[ui] fetch base items");
    try {
      const res = await axios.get(`${API_BASE}/api/base-items`);
      setBaseItems(res.data || []);
    } catch (err) {
      console.error("load base failed", err);
      setStatusBase("Could not load base items.");
    }
  };

  const fetchBills = async (filters = {}) => {
    try {
      const res = await axios.get(`${API_BASE}/api/bills/search`, { params: filters });
      setBills(res.data || []);
    } catch (err) {
      console.error("load bills failed", err);
      setBillStatus("Could not load bills.");
    }
  };

  const fetchFinalEntries = async (nameFilter = "") => {
    try {
      const res = await axios.get(`${API_BASE}/api/final`, { params: nameFilter ? { name: nameFilter } : {} });
      setFinalEntries(res.data || []);
    } catch (err) {
      console.error("load final failed", err);
      setFinalStatus("Could not load final entries.");
    }
  };

  const fetchFinalNames = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/final/names/all`);
      setFinalNames(res.data || []);
    } catch (err) {
      console.error("load final names failed", err);
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/purchases`);
      setPurchases(res.data || []);
    } catch (err) {
      console.error("load purchases failed", err);
    }
  };

  const buildCreatedOn = () => {
    const day = billHeader.day.padStart(2, "0");
    const month = billHeader.month.padStart(2, "0");
    const year = billHeader.year || String(today.getFullYear());
    return `${year}-${month}-${day}`;
  };

  const carryingForItem = useMemo(() => {
    // First try to find in baseNameOptions (search results with all items)
    let target = baseNameOptions.find((b) => b.name?.toLowerCase() === billItemForm.name?.toLowerCase());
    // If not found in search results, fallback to baseItems (limited to 5 items)
    if (!target) {
      target = baseItems.find((b) => b.name?.toLowerCase() === billItemForm.name?.toLowerCase());
    }
    return target ? Number(target.carrying) || 0 : 0;
  }, [billItemForm.name, baseNameOptions, baseItems]);

  const computedPPP = useMemo(() => {
    const price = Number(billItemForm.price) || 0;
    return price * 1 + carryingForItem;
  }, [billItemForm.price, carryingForItem]);

  const handleBaseSubmit = async (e) => {
    e.preventDefault();
    setStatusBase("");
    const payload = {
      name: baseForm.name?.trim(),
      brand: baseForm.brand?.trim(),
      carrying: Number(baseForm.carrying || 0),
    };
    try {
      if (editingBaseName) {
        await axios.put(`${API_BASE}/api/base-items/${editingBaseName}`, payload);
        setStatusBase("Base entry updated.");
      } else {
        await axios.post(`${API_BASE}/api/base-items`, payload);
        setStatusBase("Base entry saved.");
      }
      setBaseForm({ name: "", brand: "", carrying: "" });
      setEditingBaseName(null);
      fetchBaseItems();
    } catch (err) {
      console.error("save base failed", err);
      setStatusBase(err.response?.data?.error || "Save failed.");
    }
  };

  const handleBaseDelete = async (name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/api/base-items/${name}`);
      if (editingBaseName === name) setEditingBaseName(null);
      fetchBaseItems();
      setStatusBase("Deleted.");
    } catch (err) {
      console.error("delete base failed", err);
      setStatusBase("Delete failed.");
    }
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    setBillStatus("");
    try {
      const payload = {
        vendor_name: billHeader.vendor_name?.trim(),
        created_on: buildCreatedOn(),
        exchange_rate: Number(billHeader.exchange_rate || 1),
      };
      console.log("[ui] create bill payload", payload);
      const res = await axios.post(`${API_BASE}/api/bills`, payload);
      setActiveBill(res.data);
      setActiveBillItems([]);
      setBillStatus(`Bill #${res.data.bill_no} started.`);
    } catch (err) {
      console.error("create bill failed", err);
      setBillStatus(err.response?.data?.error || "Bill creation failed.");
    }
  };

  const refreshBillDetail = async (billNo) => {
    if (!billNo) return;
    try {
      const res = await axios.get(`${API_BASE}/api/bills/${billNo}`);
      setActiveBill(res.data);
      setActiveBillItems(res.data.items || []);
      if (billDetail?.bill_no === billNo) setBillDetail(res.data);
    } catch (err) {
      console.error("refresh bill detail failed", err);
    }
  };

  const handleAddItem = async (complete = false) => {
    if (!activeBill) {
      setBillStatus("Start a bill first.");
      return;
    }
    if (!billItemForm.name?.trim()) {
      setBillStatus("Name is required for items.");
      return;
    }
    try {
      const payload = {
        name: billItemForm.name,
        price: Number(billItemForm.price || 0),
        quantity: Number(billItemForm.quantity || 0),
        wsp: billItemForm.wsp,
        rp: billItemForm.rp,
      };
      console.log("[ui] add item", payload);
      await axios.post(`${API_BASE}/api/bills/${activeBill.bill_no}/items`, payload);
      setBillItemForm({ name: "", price: "", quantity: "", wsp: "", rp: "" });
      setPppFromFinal(null);
      await refreshBillDetail(activeBill.bill_no);
      fetchFinalEntries();
      fetchFinalNames();
      fetchPurchases();
      if (complete) {
        setActiveBill(null);
        setActiveBillItems([]);
        setBillStatus("Bill completed and saved.");
        fetchBills();
      } else {
        setBillStatus("Line item saved. Add more or complete.");
      }
    } catch (err) {
      console.error("add item failed", err);
      setBillStatus(err.response?.data?.error || "Could not save item.");
    }
  };

  const handleBillDelete = async (billNo) => {
    if (!confirm(`Are you sure you want to delete Bill #${billNo}?`)) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/api/bills/${billNo}`);
      if (activeBill?.bill_no === billNo) {
        setActiveBill(null);
        setActiveBillItems([]);
      }
      if (billDetail?.bill_no === billNo) setBillDetail(null);
      fetchBills(billFilters);
      fetchFinalEntries();
      fetchPurchases();
      setBillStatus("Bill deleted.");
    } catch (err) {
      console.error("delete bill failed", err);
      setBillStatus("Delete failed.");
    }
  };

  const handleBillMetaUpdate = async (billNo, payload) => {
    try {
      await axios.put(`${API_BASE}/api/bills/${billNo}`, payload);
      await refreshBillDetail(billNo);
      fetchBills(billFilters);
      fetchFinalEntries();
      fetchPurchases();
      setBillStatus("Bill updated.");
    } catch (err) {
      console.error("update bill meta failed", err);
      setBillStatus("Update failed.");
    }
  };

  const handleBillItemUpdate = async (billNo, itemId, updates) => {
    try {
      await axios.put(`${API_BASE}/api/bills/${billNo}/items/${itemId}`, updates);
      await refreshBillDetail(billNo);
      fetchBills(billFilters);
      fetchFinalEntries();
      fetchPurchases();
      setBillStatus("Item updated.");
    } catch (err) {
      console.error("update bill item failed", err);
      setBillStatus("Item update failed.");
    }
  };

  const handleBillItemDelete = async (billNo, itemId) => {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/api/bills/${billNo}/items/${itemId}`);
      await refreshBillDetail(billNo);
      fetchBills(billFilters);
      fetchFinalEntries();
      fetchPurchases();
      setBillStatus("Item deleted.");
    } catch (err) {
      console.error("delete bill item failed", err);
      setBillStatus("Item delete failed.");
    }
  };

  const handleFinalSelect = (name) => {
    const entry = finalEntries.find((f) => f.name?.toLowerCase() === name?.toLowerCase());
    if (entry) {
      setFinalForm({
        name: entry.name,
        exchange_rate: entry.exchange_rate ?? "",
        price: entry.price ?? "",
        quantity: entry.quantity ?? "",
        wsp: entry.wsp ?? "",
        rp: entry.rp ?? "",
        ppp: entry.ppp ?? "",
        carrying: entry.carrying ?? "",
      });
    } else {
      setFinalForm((prev) => ({ ...prev, name }));
    }
  };

  const handleFinalUpdate = async (e) => {
    e.preventDefault();
    if (!finalForm.name) {
      setFinalStatus("Select a name to edit.");
      return;
    }
    try {
      const payload = {
        wsp: finalForm.wsp,
        rp: finalForm.rp,
      };
      await axios.put(`${API_BASE}/api/final/${finalForm.name}`, payload);
      setFinalStatus("Final entry updated.");
      fetchFinalEntries();
    } catch (err) {
      console.error("update final failed", err);
      setFinalStatus(err.response?.data?.error || "Update failed.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-10">
      <header className="flex flex-col gap-2">
        <p className="text-teal-300 uppercase tracking-[0.2em] text-xs">Smart Data Manager</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-50">4-Section Inventory Suite</h1>
          <span className="text-xs text-slate-300 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700">
            Logs enabled across all actions
          </span>
        </div>
        <p className="text-slate-300 max-w-4xl">
          Base (file 1), Bills (file 2), Purchases (file 3), Final entries (file 4). Autocomplete and searches are case-insensitive; PPP auto
          calculates using exchange rate × price + carrying.
        </p>
      </header>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-teal-500/5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-slate-100">Section 1: Base</h2>
          {editingBaseName && (
            <button
              onClick={() => {
                setEditingBaseName(null);
                setBaseForm({ name: "", brand: "", carrying: "" });
              }}
              className="text-sm text-teal-300 hover:text-teal-200 underline"
            >
              Cancel edit
            </button>
          )}
        </div>
        <form onSubmit={handleBaseSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="Name" value={baseForm.name} onChange={(v) => setBaseForm((prev) => ({ ...prev, name: v }))} required />
          <div className="space-y-1 text-sm text-slate-200">
            <span className="block text-slate-300">Brand (type to autocomplete)</span>
            <input
              list="brand-options"
              value={baseForm.brand}
              onChange={(e) => setBaseForm((prev) => ({ ...prev, brand: e.target.value }))}
              className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
              placeholder="Brand"
            />
            <datalist id="brand-options">
              {brandOptions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <Input
            label="Carrying"
            type="number"
            value={baseForm.carrying}
            onChange={(v) => setBaseForm((prev) => ({ ...prev, carrying: v }))}
            step="0.01"
          />
          <button
            type="submit"
            className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 text-slate-950 font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition"
          >
            {editingBaseName ? "Update Base" : "Save Base"}
          </button>
        </form>
        {statusBase && <p className="text-sm text-teal-200">{statusBase}</p>}
        <div className="grid md:grid-cols-[2fr,1fr] gap-4 items-start">
          <BaseTable items={baseItems} onEdit={(item) => {
            setEditingBaseName(item.name);
            setBaseForm({ name: item.name, brand: item.brand, carrying: item.carrying });
          }} onDelete={handleBaseDelete} />
          <ExportExcel 
            items={baseItems} 
            columns={baseColumns} 
            filename="file1_base.xlsx" 
            sheetName="Base"
            fetchAllItems={async () => {
              const res = await axios.get(`${API_BASE}/api/base-items`, { params: { all: true } });
              return res.data || [];
            }}
          />
        </div>
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-amber-500/5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-slate-100">Section 2: Purchase Bill</h2>
          {activeBill && <span className="text-sm text-amber-200">Working on bill #{activeBill.bill_no}</span>}
        </div>
        <form onSubmit={handleCreateBill} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input
            label="Vendor Name"
            value={billHeader.vendor_name}
            onChange={(v) => setBillHeader((prev) => ({ ...prev, vendor_name: v }))}
            required
          />
          <Input
            label="Exchange Rate"
            type="number"
            step="0.01"
            value={billHeader.exchange_rate}
            onChange={(v) => setBillHeader((prev) => ({ ...prev, exchange_rate: v }))}
            required
          />
          <Input label="Day" value={billHeader.day} onChange={(v) => setBillHeader((p) => ({ ...p, day: v }))} />
          <Input label="Month" value={billHeader.month} onChange={(v) => setBillHeader((p) => ({ ...p, month: v }))} />
          <Input label="Year" value={billHeader.year} onChange={(v) => setBillHeader((p) => ({ ...p, year: v }))} />
          <button
            type="submit"
            className="md:col-span-5 bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-slate-950 font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition"
          >
            Make Bill (save header)
          </button>
        </form>

        {activeBill && (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Add items for bill #{activeBill.bill_no}. PPP auto = price × {activeBill.exchange_rate} + carrying.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1 text-sm text-slate-200">
                    <span className="block text-slate-300">Name (from base)</span>
                    <input
                      list="base-names"
                      value={billItemForm.name}
                      onChange={(e) => setBillItemForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg bg-slate-900 text-slate-50 px-3 py-2 border border-slate-700"
                      placeholder="Name"
                    />
                    <datalist id="base-names">
                      {baseNameOptions.map((b) => (
                        <option key={b.name} value={b.name} />
                      ))}
                    </datalist>
                    <p className="text-xs text-slate-400">Carrying from base: {carryingForItem}</p>
                  </div>
                  <Input
                    label="Price (RMB)"
                    type="number"
                    step="0.01"
                    value={billItemForm.price}
                    onChange={(v) => setBillItemForm((p) => ({ ...p, price: v }))}
                  />
                  <Input
                    label="Quantity"
                    type="number"
                    step="0.01"
                    value={billItemForm.quantity}
                    onChange={(v) => setBillItemForm((p) => ({ ...p, quantity: v }))}
                  />
                  <Input
                    label="WSP (optional)"
                    type="number"
                    step="0.01"
                    value={billItemForm.wsp}
                    onChange={(v) => setBillItemForm((p) => ({ ...p, wsp: v }))}
                  />
                  <Input
                    label="RP (optional)"
                    type="number"
                    step="0.01"
                    value={billItemForm.rp}
                    onChange={(v) => setBillItemForm((p) => ({ ...p, rp: v }))}
                  />
                  <div className="text-sm text-slate-200 space-y-1">
                    <span className="block text-slate-300">
                      {pppFromFinal !== null ? `PPP older = ${pppFromFinal.toFixed(2)}` : "PPP (first time feed)"}
                    </span>
                    <div className="w-full rounded-lg bg-slate-900 text-amber-200 px-3 py-2 border border-slate-700">
                      {Number.isFinite(computedPPP) ? computedPPP.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAddItem(false)}
                    type="button"
                    className="flex-1 bg-amber-500 text-slate-900 font-semibold py-2 rounded-lg hover:shadow-lg hover:shadow-amber-500/40"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => handleAddItem(true)}
                    type="button"
                    className="flex-1 bg-emerald-500 text-slate-900 font-semibold py-2 rounded-lg hover:shadow-lg hover:shadow-emerald-500/40"
                  >
                    Complete
                  </button>
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
                <p className="text-sm text-slate-300">Current total (Price × quantity)</p>
                <p className="text-2xl font-semibold text-amber-200">
                  {Number(activeBill.total_price || 0).toFixed(2)}
                </p>
                <BillItemsTable
                  items={activeBillItems}
                  billNo={activeBill.bill_no}
                  onEdit={handleBillItemUpdate}
                  onDelete={handleBillItemDelete}
                />
              </div>
            </div>
          </div>
        )}
        {billStatus && <p className="text-sm text-amber-200">{billStatus}</p>}

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
          <h3 className="text-lg font-semibold text-slate-100">Search Bills</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              label="Vendor Name"
              value={billFilters.vendor_name}
              onChange={(v) => setBillFilters((p) => ({ ...p, vendor_name: v }))}
            />
            <Input
              label="Created On (YYYY-MM-DD)"
              value={billFilters.created_on}
              onChange={(v) => setBillFilters((p) => ({ ...p, created_on: v }))}
            />
            <Input
              label="Name in Bill"
              value={billFilters.name}
              onChange={(v) => setBillFilters((p) => ({ ...p, name: v }))}
            />
            <button
              onClick={() => fetchBills(billFilters)}
              className="bg-slate-700 text-slate-100 font-semibold rounded-lg px-3 py-2 hover:bg-slate-600"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-200 border border-slate-700 rounded-lg overflow-hidden">
              <thead className="bg-slate-800 text-slate-100">
                <tr>
                  <Th>Bill No</Th>
                  <Th>Vendor</Th>
                  <Th>Created On</Th>
                  <Th>Total Price</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.bill_no} className="border-t border-slate-700 hover:bg-slate-800/50">
                    <Td>{b.bill_no}</Td>
                    <Td>{b.vendor_name}</Td>
                    <Td>{b.created_on}</Td>
                    <Td>{Number(b.total_price || 0).toFixed(2)}</Td>
                    <Td>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={async () => {
                            const res = await axios.get(`${API_BASE}/api/bills/${b.bill_no}`);
                            setBillDetail(res.data);
                          }}
                          className="text-teal-300 hover:text-teal-100 underline"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleBillDelete(b.bill_no)}
                          className="text-rose-300 hover:text-rose-100 underline"
                        >
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {billDetail && (
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-100">Bill #{billDetail.bill_no} details</h4>
              <button onClick={() => setBillDetail(null)} className="text-sm text-slate-300 underline">
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Vendor"
                value={billDetail.vendor_name}
                onChange={(v) => setBillDetail((p) => ({ ...p, vendor_name: v }))}
              />
              <Input
                label="Created On"
                value={billDetail.created_on}
                onChange={(v) => setBillDetail((p) => ({ ...p, created_on: v }))}
              />
              <Input
                label="Exchange Rate"
                type="number"
                step="0.01"
                value={billDetail.exchange_rate}
                onChange={(v) => setBillDetail((p) => ({ ...p, exchange_rate: v }))}
              />
            </div>
            <button
              onClick={() =>
                handleBillMetaUpdate(billDetail.bill_no, {
                  vendor_name: billDetail.vendor_name,
                  created_on: billDetail.created_on,
                  exchange_rate: billDetail.exchange_rate,
                })
              }
              className="bg-slate-700 text-slate-100 rounded-lg px-3 py-2 w-full md:w-auto"
            >
              Modify Bill
            </button>
            <BillItemsTable
              items={billDetail.items || []}
              billNo={billDetail.bill_no}
              onEdit={handleBillItemUpdate}
              onDelete={handleBillItemDelete}
            />
          </div>
        )}
        <div className="grid md:grid-cols-[2fr,1fr] gap-4 items-start">
          <div></div>
          <ExportExcel items={purchases} columns={purchaseColumns} filename="file3_purchases.xlsx" sheetName="Purchases" />
        </div>
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-emerald-500/5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-semibold text-slate-100">Section 3: Final Entries</h2>
          <button onClick={() => fetchFinalEntries()} className="text-sm text-emerald-200 underline">
            Refresh
          </button>
        </div>
        <form onSubmit={handleFinalUpdate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1 text-sm text-slate-200">
            <span className="block text-slate-300">Name (from file 4)</span>
            <input
              list="final-names"
              value={finalForm.name}
              onChange={(e) => handleFinalSelect(e.target.value)}
              className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
              placeholder="Pick name"
            />
            <datalist id="final-names">
              {finalNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <Input label="WSP" type="number" step="0.01" value={finalForm.wsp} onChange={(v) => setFinalForm((p) => ({ ...p, wsp: v }))} />
          <Input label="RP" type="number" step="0.01" value={finalForm.rp} onChange={(v) => setFinalForm((p) => ({ ...p, rp: v }))} />
          <div className="text-sm text-slate-200 space-y-1">
            <span className="block text-slate-300">PPP (read-only)</span>
            <input
              type="number"
              step="0.01"
              value={finalForm.ppp}
              readOnly
              disabled
              className="w-full rounded-lg bg-slate-700 text-slate-400 px-3 py-2 border border-slate-600 cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            className="md:col-span-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition"
          >
            Edit
          </button>
        </form>
        {finalStatus && <p className="text-sm text-emerald-200">{finalStatus}</p>}
        <div className="grid md:grid-cols-[2fr,1fr] gap-4 items-start">
          <FinalTable entries={finalEntries} />
          <ExportExcel 
            items={finalEntries} 
            columns={finalColumns} 
            filename="file4_final.xlsx" 
            sheetName="Final"
            fetchAllItems={async () => {
              const res = await axios.get(`${API_BASE}/api/final`, { params: { all: true } });
              return res.data || [];
            }}
          />
        </div>
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-purple-500/10 space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Section 4: General Query</h2>
        <ChatBox apiBase={API_BASE} />
      </section>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false, step }) {
  return (
    <label className="text-sm text-slate-200 space-y-1">
      <span className="block text-slate-300">{label}</span>
      <input
        className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
        value={value}
        type={type}
        step={step}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Th({ children }) {
  return <th className="px-3 py-2 text-left whitespace-nowrap">{children}</th>;
}
function Td({ children }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}

function BaseTable({ items, onEdit, onDelete }) {
  if (!items.length) return <p className="text-slate-300">No base entries yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-slate-200 border border-slate-800 rounded-lg overflow-hidden">
        <thead className="bg-slate-800 text-slate-100">
          <tr>
            <Th>Name</Th>
            <Th>Brand</Th>
            <Th>Carrying</Th>
            <Th>Created</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name} className="border-t border-slate-800 hover:bg-slate-800/60">
              <Td>{item.name}</Td>
              <Td>{item.brand}</Td>
              <Td>{item.carrying}</Td>
              <Td>{item.created_on?.slice(0, 10)}</Td>
              <Td>
                <div className="flex gap-2">
                  <button onClick={() => onEdit(item)} className="text-teal-300 hover:text-teal-200 underline">
                    Edit
                  </button>
                  <button onClick={() => onDelete(item.name)} className="text-rose-300 hover:text-rose-200 underline">
                    Delete
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillItemsTable({ items, billNo, onEdit, onDelete }) {
  if (!items?.length) return <p className="text-slate-300">No items yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-slate-200 border border-slate-700 rounded-lg overflow-hidden">
        <thead className="bg-slate-800 text-slate-100">
          <tr>
            <Th>Name</Th>
            <Th>Price</Th>
            <Th>Qty</Th>
            <Th>PPP</Th>
            <Th>WSP</Th>
            <Th>RP</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-700 hover:bg-slate-800/50">
              <Td>{item.name}</Td>
              <Td>{item.price}</Td>
              <Td>{item.quantity}</Td>
              <Td>{item.ppp}</Td>
              <Td>{item.wsp ?? "—"}</Td>
              <Td>{item.rp ?? "—"}</Td>
              <Td>
                <div className="flex gap-2 flex-wrap">
                  <InlineEdit
                    item={item}
                    billNo={billNo}
                    onSave={(updates) => onEdit(billNo, item.id, updates)}
                  />
                  <button onClick={() => onDelete(billNo, item.id)} className="text-rose-300 hover:text-rose-100 underline">
                    Delete
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineEdit({ item, billNo, onSave }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    wsp: item.wsp ?? "",
    rp: item.rp ?? "",
  });

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setOpen((v) => !v)} className="text-teal-300 hover:text-teal-100 underline">
        {open ? "Cancel" : "Edit"}
      </button>
      {open && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-2">
          <Input label="Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} />
          <Input label="Price" type="number" value={form.price} onChange={(v) => setForm((p) => ({ ...p, price: v }))} />
          <Input label="Qty" type="number" value={form.quantity} onChange={(v) => setForm((p) => ({ ...p, quantity: v }))} />
          <Input label="WSP" type="number" value={form.wsp} onChange={(v) => setForm((p) => ({ ...p, wsp: v }))} />
          <Input label="RP" type="number" value={form.rp} onChange={(v) => setForm((p) => ({ ...p, rp: v }))} />
          <button
            onClick={() => {
              onSave(form);
              setOpen(false);
            }}
            className="bg-teal-500 text-slate-900 font-semibold px-3 py-2 rounded-lg w-full"
          >
            Save item
          </button>
        </div>
      )}
    </div>
  );
}

function FinalTable({ entries }) {
  if (!entries.length) return <p className="text-slate-300">No final entries yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-slate-200 border border-slate-800 rounded-lg overflow-hidden">
        <thead className="bg-slate-800 text-slate-100">
          <tr>
            <Th>Name</Th>
            <Th>Brand</Th>
            <Th>Last Changed</Th>
            <Th>Bill No</Th>
            <Th>Qty</Th>
            <Th>Price</Th>
            <Th>PPP</Th>
            <Th>Carrying</Th>
            <Th>WSP</Th>
            <Th>RP</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.name} className="border-t border-slate-800 hover:bg-slate-800/60">
              <Td>{e.name}</Td>
              <Td>{e.brand}</Td>
              <Td>{e.last_changed_on?.slice(0, 10)}</Td>
              <Td>{e.bill_no}</Td>
              <Td>{e.quantity}</Td>
              <Td>{e.price}</Td>
              <Td>{e.ppp}</Td>
              <Td>{e.carrying}</Td>
              <Td>{e.wsp}</Td>
              <Td>{e.rp}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
