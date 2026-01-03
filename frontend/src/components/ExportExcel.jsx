import { useState } from "react";
import * as XLSX from "xlsx";

// Convert items to a sheet using provided columns [{ key, label }]
const buildSheet = (items, columns) => {
  const headers = columns.map((c) => c.label);
  const rows = items.map((item) => columns.map((c) => item[c.key] ?? ""));
  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
};

const readWorkbookFromFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        resolve(workbook);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });

// If the File System Access API is available, let the user overwrite in place; otherwise fall back to download.
const saveWorkbook = async (workbook, filename, { isAppend }) => {
  const supportsFilePicker = typeof window.showSaveFilePicker === "function";
  if (!supportsFilePicker) {
    // Fallback: trigger a download; user can overwrite the original manually.
    const downloadName = isAppend ? `updated-${filename}` : filename;
    XLSX.writeFile(workbook, downloadName);
    return { fallbackDownload: downloadName };
  }

  const handle = await window.showSaveFilePicker({
    suggestedName: filename,
    types: [
      {
        description: "Excel Workbook",
        accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
      },
    ],
  });

  const wbArray = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const writable = await handle.createWritable();
  await writable.write(wbArray);
  await writable.close();
  return { fallbackDownload: null };
};

export default function ExportExcel({ items, columns, filename = "items_export.xlsx", sheetName = "Items", fetchAllItems }) {
  const [mode, setMode] = useState("new");
  const [existingFile, setExistingFile] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    setMessage("");

    try {
      // If fetchAllItems is provided, use it to get all items; otherwise use the items prop
      let itemsToExport = items;
      if (fetchAllItems) {
        itemsToExport = await fetchAllItems();
      }

      if (!itemsToExport || !itemsToExport.length) {
        setMessage("No items to export.");
        setBusy(false);
        return;
      }

      let workbook;

      if (mode === "append") {
        if (!existingFile) {
          setMessage("Choose an existing Excel file to append.");
          setBusy(false);
          return;
        }
        workbook = await readWorkbookFromFile(existingFile);
      } else {
        workbook = XLSX.utils.book_new();
      }

      const sheet = buildSheet(itemsToExport, columns);
      workbook.Sheets[sheetName] = sheet;
      // Ensure the sheet name is in the front of the list.
      const otherNames = workbook.SheetNames.filter((n) => n !== sheetName);
      workbook.SheetNames = [sheetName, ...otherNames];

      const targetName = mode === "append" ? existingFile.name : filename;
      const { fallbackDownload } = await saveWorkbook(workbook, targetName, { isAppend: mode === "append" });
      if (fallbackDownload) {
        setMessage(`Downloaded "${fallbackDownload}". Overwrite your original file manually to apply the update.`);
      } else {
        setMessage(`Exported ${itemsToExport.length} items to ${targetName}`);
      }
    } catch (err) {
      console.error("Export failed", err);
      setMessage("Export failed. Ensure the file is a valid .xlsx or try creating a new one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl shadow-emerald-500/5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-teal-300 uppercase tracking-[0.15em]">Export</p>
          <h3 className="text-lg font-semibold text-slate-100">Save items to Excel</h3>
        </div>
        <button
          onClick={handleExport}
          disabled={busy}
          className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-semibold px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60"
        >
          {busy ? "Working..." : "Save to Excel"}
        </button>
      </div>

      <div className="flex flex-col gap-2 text-sm text-slate-200">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="export-mode"
            value="new"
            checked={mode === "new"}
            onChange={() => setMode("new")}
          />
          Create new file (items_export.xlsx)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="export-mode"
            value="append"
            checked={mode === "append"}
            onChange={() => setMode("append")}
          />
          Append/replace sheet in existing Excel
        </label>
        {mode === "append" && (
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setExistingFile(e.target.files?.[0] || null)}
            className="text-slate-300"
          />
        )}
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <p>Creates/updates sheet "{sheetName}" with all rows.</p>
        <p>Append keeps other sheets in your file; create-new only contains this sheet.</p>
        <p>If your browser cannot overwrite files in place, an updated copy is downloaded; you can overwrite the original manually.</p>
      </div>

      {message && <p className="text-sm text-emerald-200">{message}</p>}
    </div>
  );
}
