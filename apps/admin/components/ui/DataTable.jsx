// Generic horizontally-scrollable data table used across admin list views.
// Scrolls within its own container on small screens instead of overflowing
// the page, per the mobile-responsiveness requirement.
export default function DataTable({ columns, rows, emptyMessage = "No records found." }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-brand-charcoal/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/10 bg-gray-50 text-left">
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-3 font-semibold text-brand-charcoal/70">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-black/5 last:border-0 hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-brand-charcoal">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
