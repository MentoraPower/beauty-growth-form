import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";

interface CsvChatCardProps {
  fileName: string;
  totalRows: number;
  columns: string[];
  previewData: Array<Record<string, string>>;
  onOpenPanel?: () => void;
  mappedColumns?: {
    name?: string;
    email?: string;
    whatsapp?: string;
  };
}

const PAGE_SIZE = 10;

export function CsvChatCard({
  fileName,
  totalRows,
  columns,
  previewData,
  mappedColumns,
}: CsvChatCardProps) {
  const [currentPage, setCurrentPage] = useState(0);
  
  const totalPages = Math.ceil(previewData.length / PAGE_SIZE);
  const startIdx = currentPage * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, previewData.length);
  const displayRows = previewData.slice(startIdx, endIdx);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden max-w-2xl shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-4.5 h-4.5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 truncate text-sm">{fileName}</p>
        </div>
      </div>

      {/* Full spreadsheet with scroll */}
      <div className="overflow-auto max-h-[300px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap border-r border-gray-100 w-8">
                #
              </th>
              {columns.map((col, i) => (
                <th 
                  key={i} 
                  className={cn(
                    "px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap border-r border-gray-100 last:border-r-0",
                    mappedColumns?.name === col && "bg-blue-50/70 text-blue-600",
                    mappedColumns?.email === col && "bg-purple-50/70 text-purple-600",
                    mappedColumns?.whatsapp === col && "bg-green-50/70 text-green-600"
                  )}
                >
                  {col}
                  {mappedColumns?.name === col && <span className="ml-1 text-[10px] opacity-60">(nome)</span>}
                  {mappedColumns?.email === col && <span className="ml-1 text-[10px] opacity-60">(email)</span>}
                  {mappedColumns?.whatsapp === col && <span className="ml-1 text-[10px] opacity-60">(tel)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-1.5 text-gray-400 text-center border-r border-gray-100 font-mono text-[10px]">
                  {startIdx + rowIdx + 1}
                </td>
                {columns.map((col, colIdx) => (
                  <td 
                    key={colIdx} 
                    className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[180px] truncate border-r border-gray-50 last:border-r-0"
                    title={row[col] || undefined}
                  >
                    {row[col] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {startIdx + 1}-{endIdx} de {previewData.length} leads
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs text-gray-600 min-w-[60px] text-center">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
