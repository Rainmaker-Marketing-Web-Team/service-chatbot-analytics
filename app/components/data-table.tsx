import { formatCellValue, formatColumnLabel } from "@/app/lib/utils/format";

type DataTableProps = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{formatColumnLabel(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${String(row.id ?? rowIndex)}-${rowIndex}`}>
              {columns.map((column) => (
                <td key={`${column}-${rowIndex}`}>{formatCellValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
