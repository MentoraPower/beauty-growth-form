import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Table, Search, Filter, Download, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { toast } from "sonner";

export interface CsvLead {
  name: string;
  email?: string;
  whatsapp?: string;
  [key: string]: string | undefined;
}

interface CsvSidePanelProps {
  isOpen: boolean;
  leads: CsvLead[];
  onLeadsChange: (leads: CsvLead[]) => void;
  onClose?: () => void;
  fileName?: string;
}

const ROWS_PER_PAGE = 50;

export function CsvSidePanel({ 
  isOpen, 
  leads, 
  onLeadsChange,
  onClose,
  fileName = "lista.csv"
}: CsvSidePanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Get all unique columns from data
  const columns = useMemo(() => {
    const cols = new Set<string>();
    cols.add('name');
    leads.forEach(lead => {
      Object.keys(lead).forEach(key => cols.add(key));
    });
    // Prioritize common columns
    const priority = ['name', 'email', 'whatsapp'];
    const sorted = Array.from(cols).sort((a, b) => {
      const aIdx = priority.indexOf(a);
      const bIdx = priority.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [leads]);

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter(lead => 
      Object.values(lead).some(val => 
        val?.toString().toLowerCase().includes(term)
      )
    );
  }, [leads, searchTerm]);

  // Paginate
  const totalPages = Math.ceil(filteredLeads.length / ROWS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice(
    currentPage * ROWS_PER_PAGE, 
    (currentPage + 1) * ROWS_PER_PAGE
  );

  // Handle cell edit
  const startEdit = (rowIndex: number, col: string, value: string) => {
    setEditingCell({ row: rowIndex, col });
    setEditValue(value || "");
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const actualIndex = currentPage * ROWS_PER_PAGE + row;
    
    const newLeads = [...leads];
    newLeads[actualIndex] = { ...newLeads[actualIndex], [col]: editValue };
    onLeadsChange(newLeads);
    
    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // Handle row selection
  const toggleRowSelection = (rowIndex: number) => {
    const actualIndex = currentPage * ROWS_PER_PAGE + rowIndex;
    const newSelected = new Set(selectedRows);
    if (newSelected.has(actualIndex)) {
      newSelected.delete(actualIndex);
    } else {
      newSelected.add(actualIndex);
    }
    setSelectedRows(newSelected);
  };

  const selectAll = () => {
    const start = currentPage * ROWS_PER_PAGE;
    const end = Math.min(start + ROWS_PER_PAGE, filteredLeads.length);
    const newSelected = new Set(selectedRows);
    for (let i = start; i < end; i++) {
      newSelected.add(i);
    }
    setSelectedRows(newSelected);
  };

  const deselectAll = () => {
    setSelectedRows(new Set());
  };

  // Delete selected rows
  const deleteSelected = () => {
    if (selectedRows.size === 0) return;
    const newLeads = leads.filter((_, idx) => !selectedRows.has(idx));
    onLeadsChange(newLeads);
    setSelectedRows(new Set());
    toast.success(`${selectedRows.size} linhas removidas`);
  };

  // Export to CSV
  const exportCsv = () => {
    const header = columns.join(',');
    const rows = leads.map(lead => 
      columns.map(col => {
        const val = lead[col] || '';
        // Escape quotes and wrap in quotes if needed
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace('.csv', '_editado.csv');
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("CSV exportado!");
  };

  if (!isOpen) return null;

  return (
    <div className="w-[560px] flex-shrink-0 h-full bg-background flex flex-col my-4 mr-4 rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{fileName}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {filteredLeads.length} de {leads.length} leads
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-7 h-7 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                title="Fechar painel"
              >
                <ChevronsRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(0);
            }}
            placeholder="Buscar na lista..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 py-2 border-b border-border bg-muted/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedRows.size > 0 ? (
            <>
              <span className="text-xs text-muted-foreground">{selectedRows.size} selecionados</span>
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Remover
              </button>
              <button
                onClick={deselectAll}
                className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar seleção
              </button>
            </>
          ) : (
            <button
              onClick={selectAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Selecionar página
            </button>
          )}
        </div>
        
        <button
          onClick={exportCsv}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="w-3 h-3" />
          Exportar
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="w-10 px-2 py-2 text-left">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border"
                  checked={paginatedLeads.length > 0 && paginatedLeads.every((_, i) => 
                    selectedRows.has(currentPage * ROWS_PER_PAGE + i)
                  )}
                  onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                />
              </th>
              <th className="w-10 px-2 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
              {columns.map(col => (
                <th 
                  key={col} 
                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paginatedLeads.map((lead, rowIdx) => {
              const actualIdx = currentPage * ROWS_PER_PAGE + rowIdx;
              const isSelected = selectedRows.has(actualIdx);
              
              return (
                <tr 
                  key={actualIdx} 
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border"
                      checked={isSelected}
                      onChange={() => toggleRowSelection(rowIdx)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-xs text-muted-foreground">
                    {actualIdx + 1}
                  </td>
                  {columns.map(col => {
                    const isEditing = editingCell?.row === rowIdx && editingCell?.col === col;
                    const value = lead[col] || "";
                    
                    return (
                      <td key={col} className="px-3 py-1.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-full px-2 py-0.5 text-xs bg-background border border-primary rounded focus:outline-none"
                              autoFocus
                            />
                            <button onClick={saveEdit} className="p-0.5 text-green-500 hover:bg-green-500/10 rounded">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={cancelEdit} className="p-0.5 text-red-500 hover:bg-red-500/10 rounded">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="group flex items-center gap-1 cursor-pointer"
                            onClick={() => startEdit(rowIdx, col, value)}
                          >
                            <span className="text-xs text-foreground truncate max-w-[150px]" title={value}>
                              {value || <span className="text-muted-foreground italic">vazio</span>}
                            </span>
                            <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {paginatedLeads.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {searchTerm ? "Nenhum resultado encontrado" : "Lista vazia"}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {currentPage + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
