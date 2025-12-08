const BRAND_OPTIONS = ["Samsung", "Apple", "Custom"];

export default function BaseForm({ formData, setFormData, onSubmit, editing }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const brandIsCustom = !BRAND_OPTIONS.includes(formData.brand_type) || formData.brand_type === "Custom";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Name" name="name" value={formData.name} onChange={handleChange} required />
        <Input
          label="Carrying"
          name="carrying"
          type="number"
          step="0.01"
          value={formData.carrying}
          onChange={handleChange}
        />
        <div className="space-y-1 text-sm text-slate-200">
          <span className="block text-slate-300">Brand Type</span>
          <select
            name="brand_type"
            value={brandIsCustom ? "Custom" : formData.brand_type}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                brand_type: e.target.value === "Custom" ? "" : e.target.value,
              }))
            }
            className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
          >
            {BRAND_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {brandIsCustom && (
            <input
              name="brand_type"
              value={formData.brand_type}
              onChange={handleChange}
              placeholder="Enter brand"
              className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
            />
          )}
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 text-slate-950 font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition"
      >
        {editing ? "Update Entry" : "Add Entry"}
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
