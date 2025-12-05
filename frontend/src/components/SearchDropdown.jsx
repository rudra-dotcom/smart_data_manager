import { useEffect, useState } from "react";
import axios from "axios";

export default function SearchDropdown({ apiBase, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    // Small debounce to avoid flooding the API while typing.
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${apiBase}/api/items/search`, {
          params: { query },
          signal: controller.signal,
        });
        setResults(res.data);
        setOpen(true);
      } catch (error) {
        if (error.name !== "CanceledError") {
          console.error("Search failed", error);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, apiBase]);

  const handleSelect = (item) => {
    // Fill the input with the chosen name and bubble up selection.
    setQuery(item.name);
    setOpen(false);
    onSelect(item);
  };

  return (
    <div className="relative mb-4">
      <label className="text-sm text-slate-300 block mb-1">Search by name</label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Type to search items..."
        className="w-full rounded-lg bg-slate-800 text-slate-50 px-3 py-2 border border-slate-700"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-100"
            >
              <div className="font-semibold">{item.name}</div>
              <div className="text-xs text-slate-300">
                {item.brand} • {item.quality} • {item.ws_price} INR
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
