import { useState, useCallback, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pipeline } from "@/types/crm";

interface ExportColumn {
  key: string;
  label: string;
  selected: boolean;
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

export function ExportLeadsDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [subOriginId, setSubOriginId] = useState<string | null>(null);
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("all");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Listen for custom event
  useEffect(() => {
    const handleOpenExport = async (e: CustomEvent<{ subOriginId: string }>) => {
      setSubOriginId(e.detail.subOriginId);
      setIsOpen(true);
      setIsLoading(true);
      
      // Fetch pipelines for this sub-origin
      const { data: pipelinesData } = await supabase
        .from("pipelines")
        .select("*")
        .eq("sub_origin_id", e.detail.subOriginId)
        .order("ordem");
      
      if (pipelinesData) {
        setPipelines(pipelinesData);
        
        // Fetch counts for each pipeline
        const counts: Record<string, number> = {};
        for (const p of pipelinesData) {
          const { count } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("pipeline_id", p.id);
          counts[p.id] = count || 0;
        }
        setPipelineCounts(counts);
      }
      
      setIsLoading(false);
    };

    window.addEventListener('open-export-dialog', handleOpenExport as EventListener);
    return () => window.removeEventListener('open-export-dialog', handleOpenExport as EventListener);
  }, []);

  const toggleColumn = (key: string) => {
    setColumns(prev => 
      prev.map(col => 
        col.key === key ? { ...col, selected: !col.selected } : col
      )
    );
  };

  const getExportCount = () => {
    if (selectedPipeline === "all") {
      return Object.values(pipelineCounts).reduce((sum, count) => sum + count, 0);
    }
    return pipelineCounts[selectedPipeline] || 0;
  };

  const getSelectedPipelineName = () => {
    if (selectedPipeline === "all") return "todas-pipelines";
    const pipeline = pipelines.find(p => p.id === selectedPipeline);
    return pipeline?.nome.toLowerCase().replace(/\s+/g, "-") || "pipeline";
  };

  const exportToCsv = useCallback(async () => {
    if (!subOriginId) return;

    const selectedColumns = columns.filter(c => c.selected);
    if (selectedColumns.length === 0) {
      toast.error("Selecione pelo menos uma coluna para exportar");
      return;
    }

    setIsExporting(true);
    
    try {
      let query = supabase
        .from("leads")
        .select(selectedColumns.map(c => c.key).join(","))
        .eq("sub_origin_id", subOriginId);

      if (selectedPipeline !== "all") {
        query = query.eq("pipeline_id", selectedPipeline);
      }

      query = query.order("created_at", { ascending: false });

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

      const headers = selectedColumns.map(c => c.label);
      const rows = allLeads.map(lead => 
        selectedColumns.map(col => {
          const value = lead[col.key];
          if (col.key === "created_at" && value) {
            return new Date(value as string).toLocaleDateString("pt-BR");
          }
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

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `leads-${getSelectedPipelineName()}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${allLeads.length} leads exportados com sucesso!`);
      setIsOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar leads");
    } finally {
      setIsExporting(false);
    }
  }, [columns, selectedPipeline, subOriginId, getSelectedPipelineName]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0F9D58]/10 flex items-center justify-center">
              <svg className="h-5 w-5 text-[#0F9D58]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 11V9h-4V5h-2v4H9v2h4v4h2v-4h4zm2-8H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
              </svg>
            </div>
            Exportar para Planilha
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Pipeline Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pipeline
              </Label>
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todas as pipelines ({Object.values(pipelineCounts).reduce((sum, count) => sum + count, 0)})
                  </SelectItem>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: pipeline.cor }}
                        />
                        {pipeline.nome} ({pipelineCounts[pipeline.id] || 0})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Columns */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Colunas para exportar
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={col.selected}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <Button 
              onClick={exportToCsv} 
              disabled={isExporting || columns.filter(c => c.selected).length === 0}
              className="w-full gap-2 bg-[#0F9D58] hover:bg-[#0F9D58]/90"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Baixar CSV ({getExportCount()} leads)
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
