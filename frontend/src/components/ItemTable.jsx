export default function ItemTable({ items, onEdit, onDelete, loading }) {
  if (loading) {
    return <p className="text-slate-300">Loading items…</p>;
  }

  if (!items.length) {
    return <p className="text-slate-300">No items yet. Add your first entry above.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-slate-200 border border-slate-800 rounded-lg overflow-hidden">
        <thead className="bg-slate-800 text-slate-100">
          <tr>
            <Th>Name</Th>
            <Th>Brand</Th>
            <Th>Quality</Th>
            <Th>CH Price</Th>
            <Th>PPP</Th>
            <Th>Retail</Th>
            <Th>Wholesale</Th>
            <Th>Qty</Th>
            <Th>Created</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-800/60">
              <Td>{item.name}</Td>
              <Td>{item.brand}</Td>
              <Td>{item.quality}</Td>
              <Td>{item.ch_price}</Td>
              <Td>{item.ppp}</Td>
              <Td>{item.retail_price}</Td>
              <Td>{item.ws_price}</Td>
              <Td>{item.quantity}</Td>
              <Td>{item.created_at?.slice(0, 10)}</Td>
              <Td>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="text-teal-300 hover:text-teal-200 underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="text-rose-300 hover:text-rose-200 underline"
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
  );
}

function Th({ children }) {
  return <th className="px-3 py-2 text-left whitespace-nowrap">{children}</th>;
}

function Td({ children }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}
