import { useState, useCallback } from "react";
import { Download, FileSpreadsheet, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExportColumn {
  key: string;
  label: string;
  selected: boolean;
}

interface ExportLeadsDropdownProps {
  pipelineId?: string | null;
  pipelineName?: string;
  subOriginId: string | null;
  totalLeads?: number;
}

const DEFAULT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Nome", selected: true },
  { key: "email", label: "Email", selected: true },
  { key: "whatsapp", label: "WhatsApp", selected: true },
  { key: "created_at", label: "Data de Cadastro", selected: true },
  { key: "instagram", label: "Instagram", selected: false },
  { key: "clinic_name", label: "Nome da Clínica", selected: false },
  { key: "service_area", label: "Área de Atuação", selected: false },
  { key: "monthly_billing", label: "Faturamento Mensal", selected: false },
];

export function ExportLeadsDropdown({ 
  pipelineId, 
  pipelineName, 
  subOriginId,
  totalLeads = 0 
}: ExportLeadsDropdownProps) {
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [isExporting, setIsExporting] = useState(false);

  const toggleColumn = (key: string) => {
    setColumns(prev => 
      prev.map(col => 
        col.key === key ? { ...col, selected: !col.selected } : col
      )
    );
  };

  const exportToCsv = useCallback(async () => {
    if (!subOriginId) {
      toast.error("Nenhuma origem selecionada");
      return;
    }

    const selectedColumns = columns.filter(c => c.selected);
    if (selectedColumns.length === 0) {
      toast.error("Selecione pelo menos uma coluna para exportar");
      return;
    }

    setIsExporting(true);
    
    try {
      // Build query
      let query = supabase
        .from("leads")
        .select(selectedColumns.map(c => c.key).join(","))
        .eq("sub_origin_id", subOriginId);

      // Filter by pipeline if specified
      if (pipelineId) {
        query = query.eq("pipeline_id", pipelineId);
      }

      // Order by created_at
      query = query.order("created_at", { ascending: false });

      // Fetch all leads (may need multiple requests for large datasets)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allLeads: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allLeads.push(...data);
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      if (allLeads.length === 0) {
        toast.info("Nenhum lead encontrado para exportar");
        return;
      }

      // Create CSV content
      const headers = selectedColumns.map(c => c.label);
      const rows = allLeads.map(lead => 
        selectedColumns.map(col => {
          const value = lead[col.key];
          if (col.key === "created_at" && value) {
            return new Date(value as string).toLocaleDateString("pt-BR");
          }
          // Escape quotes and wrap in quotes if contains comma
          const strValue = String(value ?? "");
          if (strValue.includes(",") || strValue.includes('"') || strValue.includes("\n")) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        })
      );

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // Create and download file
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const fileName = pipelineName 
        ? `leads-${pipelineName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`
        : `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${allLeads.length} leads exportados com sucesso!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar leads");
    } finally {
      setIsExporting(false);
    }
  }, [columns, pipelineId, pipelineName, subOriginId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover z-[9999]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Exportar para CSV
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Colunas
          </span>
        </div>
        
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={col.selected}
            onCheckedChange={() => toggleColumn(col.key)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
        
        <DropdownMenuSeparator />
        
        <div className="p-2">
          <Button 
            onClick={exportToCsv} 
            disabled={isExporting || columns.filter(c => c.selected).length === 0}
            className="w-full gap-2"
            size="sm"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Baixar CSV {totalLeads > 0 && `(${totalLeads} leads)`}
              </>
            )}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
