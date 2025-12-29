import React from "react";
import { cn } from "@/lib/utils";
import { Table, ExternalLink, FileSpreadsheet } from "lucide-react";

interface CsvChatCardProps {
  fileName: string;
  totalRows: number;
  columns: string[];
  previewData: Array<Record<string, string>>;
  onOpenPanel: () => void;
  mappedColumns?: {
    name?: string;
    email?: string;
    whatsapp?: string;
  };
}

export function CsvChatCard({
  fileName,
  totalRows,
  columns,
  previewData,
  onOpenPanel,
  mappedColumns,
}: CsvChatCardProps) {
  // Show max 4 columns and 3 rows in preview
  const displayColumns = columns.slice(0, 4);
  const displayRows = previewData.slice(0, 3);
  const hasMoreColumns = columns.length > 4;
  const hasMoreRows = previewData.length > 3;

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white overflow-hidden max-w-md">
      {/* Header */}
      <div className="px-4 py-3 border-b border-emerald-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate text-sm">{fileName}</p>
          <p className="text-xs text-gray-500">{totalRows} leads • {columns.length} colunas</p>
        </div>
      </div>

      {/* Mini spreadsheet preview */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-emerald-50/50">
              {displayColumns.map((col, i) => (
                <th 
                  key={i} 
                  className={cn(
                    "px-3 py-2 text-left font-medium text-emerald-700 whitespace-nowrap border-r border-emerald-100 last:border-r-0",
                    mappedColumns?.name === col && "bg-blue-50 text-blue-700",
                    mappedColumns?.email === col && "bg-purple-50 text-purple-700",
                    mappedColumns?.whatsapp === col && "bg-green-50 text-green-700"
                  )}
                >
                  {col}
                  {mappedColumns?.name === col && <span className="ml-1 text-[10px] opacity-60">(nome)</span>}
                  {mappedColumns?.email === col && <span className="ml-1 text-[10px] opacity-60">(email)</span>}
                  {mappedColumns?.whatsapp === col && <span className="ml-1 text-[10px] opacity-60">(tel)</span>}
                </th>
              ))}
              {hasMoreColumns && (
                <th className="px-3 py-2 text-center text-gray-400 whitespace-nowrap">
                  +{columns.length - 4}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-emerald-50">
                {displayColumns.map((col, colIdx) => (
                  <td 
                    key={colIdx} 
                    className="px-3 py-1.5 text-gray-600 whitespace-nowrap max-w-[120px] truncate border-r border-emerald-50 last:border-r-0"
                  >
                    {row[col] || '-'}
                  </td>
                ))}
                {hasMoreColumns && (
                  <td className="px-3 py-1.5 text-center text-gray-300">...</td>
                )}
              </tr>
            ))}
            {hasMoreRows && (
              <tr className="border-t border-emerald-50">
                <td 
                  colSpan={displayColumns.length + (hasMoreColumns ? 1 : 0)} 
                  className="px-3 py-1.5 text-center text-gray-400 text-[10px]"
                >
                  +{totalRows - 3} leads
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer action */}
      <button
        onClick={onOpenPanel}
        className="w-full px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 text-emerald-700 text-sm font-medium border-t border-emerald-100"
      >
        <Table className="w-4 h-4" />
        Abrir planilha completa
        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
      </button>
    </div>
  );
}
