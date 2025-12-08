import { useEffect, useMemo } from "react";

export default function PurchaseForm({
  formData,
  setFormData,
  onSubmit,
  editing,
  baseItems,
  exchangeRate,
}) {
  const carryingForName = useMemo(() => {
    const found = baseItems.find((b) => b.name === formData.name);
    return found ? Number(found.carrying) || 0 : 0;
  }, [baseItems, formData.name]);

  const computedPPP = useMemo(() => {
    const price = Number(formData.price_rmb) || 0;
    const rate = Number(exchangeRate) || 0;
    return price * rate + carryingForName;
  }, [formData.price_rmb, exchangeRate, carryingForName]);

  // Keep PPP mirrored for preview (server is source of truth on save).
  useEffect(() => {
    setFormData((prev) => ({ ...prev, ppp: computedPPP }));
  }, [computedPPP, setFormData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1 text-sm text-slate-200">
          <span className="block text-slate-300">Name (from Sheet 1)</span>
          <input
            list="base-names"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
            placeholder="Select or type"
            required
          />
          <datalist id="base-names">
            {baseItems.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>
          <p className="text-xs text-slate-400">Carrying auto from Sheet 1: {carryingForName}</p>
        </div>

        <Input
          label="Price (RMB)"
          name="price_rmb"
          type="number"
          step="0.01"
          value={formData.price_rmb}
          onChange={handleChange}
          required
        />
        <Input
          label="Quantity"
          name="quantity"
          type="number"
          value={formData.quantity}
          onChange={handleChange}
        />
        <Input
          label="WSP (optional)"
          name="wsp"
          type="number"
          step="0.01"
          value={formData.wsp}
          onChange={handleChange}
        />
        <Input
          label="RP (optional)"
          name="rp"
          type="number"
          step="0.01"
          value={formData.rp}
          onChange={handleChange}
        />
        <div className="text-sm text-slate-200 space-y-1">
          <span className="block text-slate-300">PPP (auto)</span>
          <div className="w-full rounded-lg bg-slate-800 text-teal-200 px-3 py-2 border border-slate-700">
            {Number.isFinite(computedPPP) ? computedPPP.toFixed(2) : "—"}
          </div>
          <p className="text-xs text-slate-400">
            PPP = price_rmb × exchange_rate + carrying
          </p>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-slate-950 font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition"
      >
        {editing ? "Update Purchase" : "Add Purchase"}
      </button>
    </form>
  );
}

function Input({ label, name, value, onChange, type = "text", required = false, step }) {
  return (
    <label className="text-sm text-slate-200 space-y-1">
      <span className="block text-slate-300">{label}</span>
      <input
        className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
        name={name}
        value={value}
        type={type}
        step={step}
        onChange={onChange}
        required={required}
      />
    </label>
  );
}
