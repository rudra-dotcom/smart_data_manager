export default function ItemForm({ formData, setFormData, onSubmit, editing }) {
  // Shared change handler keeps inputs controlled.
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Name" name="name" value={formData.name} onChange={handleChange} required />
        <Input label="Brand" name="brand" value={formData.brand} onChange={handleChange} />
        <Input label="Quality" name="quality" value={formData.quality} onChange={handleChange} />
        <Input
          label="Quantity"
          name="quantity"
          type="number"
          value={formData.quantity}
          onChange={handleChange}
        />
        <Input
          label="CH Price (RMB)"
          name="ch_price"
          type="number"
          step="0.01"
          value={formData.ch_price}
          onChange={handleChange}
        />
        <Input label="Caring" name="caring" value={formData.caring} onChange={handleChange} />
        <Input
          label="PPP"
          name="ppp"
          type="number"
          step="0.01"
          value={formData.ppp}
          onChange={handleChange}
        />
        <Input
          label="Retail Price (INR)"
          name="retail_price"
          type="number"
          step="0.01"
          value={formData.retail_price}
          onChange={handleChange}
        />
        <Input
          label="Wholesale Price (INR)"
          name="ws_price"
          type="number"
          step="0.01"
          value={formData.ws_price}
          onChange={handleChange}
        />
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 text-slate-950 font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition"
      >
        {editing ? "Update Item" : "Add Item"}
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
