import { useState, useCallback, useEffect, useRef } from "react";
import { FileText, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pipeline } from "@/types/crm";
import { cn } from "@/lib/utils";

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
  const [subOriginName, setSubOriginName] = useState("");
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPipelines, setSelectedPipelines] = useState<Set<string>>(new Set(["all"]));
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const lastOpenAtRef = useRef(0);
  const isOpenRef = useRef(false);

  // Keep isOpenRef in sync with isOpen state
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Listen for custom event - registered only once
  useEffect(() => {
    const handleOpenExport = async (e: CustomEvent<{ subOriginId: string }>) => {
      const now = Date.now();
      
      // Prevent duplicate opens: check if already open or opened recently (800ms throttle)
      if (isOpenRef.current || now - lastOpenAtRef.current < 800) {
        return;
      }
      
      lastOpenAtRef.current = now;
      
      setSubOriginId(e.detail.subOriginId);
      setIsOpen(true);
      setIsLoading(true);
      setSelectedPipelines(new Set(["all"]));
      
      // Fetch sub-origin name
      const { data: subOriginData } = await supabase
        .from("crm_sub_origins")
        .select("nome")
        .eq("id", e.detail.subOriginId)
        .single();
      
      if (subOriginData) {
        setSubOriginName(subOriginData.nome);
        setFileName(`leads-${subOriginData.nome.toLowerCase().replace(/\s+/g, "-")}`);
      }
      
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

  const togglePipeline = (pipelineId: string) => {
    setSelectedPipelines(prev => {
      const next = new Set(prev);
      
      if (pipelineId === "all") {
        // If clicking "all", clear everything and select all
        if (next.has("all")) {
          next.clear();
        } else {
          next.clear();
          next.add("all");
        }
      } else {
        // If clicking a specific pipeline
        next.delete("all"); // Remove "all" when selecting specific pipelines
        if (next.has(pipelineId)) {
          next.delete(pipelineId);
        } else {
          next.add(pipelineId);
        }
        
        // If all pipelines are selected, switch to "all"
        if (next.size === pipelines.length) {
          next.clear();
          next.add("all");
        }
        
        // If nothing is selected, select all
        if (next.size === 0) {
          next.add("all");
        }
      }
      
      return next;
    });
  };

  const getExportCount = () => {
    if (selectedPipelines.has("all")) {
      return Object.values(pipelineCounts).reduce((sum, count) => sum + count, 0);
    }
    return Array.from(selectedPipelines).reduce((sum, id) => sum + (pipelineCounts[id] || 0), 0);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allLeads: any[] = [];
      
      // Determine which pipeline IDs to fetch
      const pipelineIds = selectedPipelines.has("all") 
        ? pipelines.map(p => p.id)
        : Array.from(selectedPipelines);
      
      for (const pipelineId of pipelineIds) {
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("leads")
            .select(selectedColumns.map(c => c.key).join(","))
            .eq("sub_origin_id", subOriginId)
            .eq("pipeline_id", pipelineId)
            .order("created_at", { ascending: false })
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
      link.download = `${fileName}-${new Date().toISOString().split("T")[0]}.csv`;
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
  }, [columns, selectedPipelines, subOriginId, fileName, pipelines]);

  const getSelectedPipelinesLabel = () => {
    if (selectedPipelines.has("all")) return "Todas as etapas";
    const count = selectedPipelines.size;
    if (count === 0) return "Selecionar etapas";
    if (count === 1) {
      const id = Array.from(selectedPipelines)[0];
      const pipeline = pipelines.find(p => p.id === id);
      return pipeline?.nome || "1 etapa";
    }
    return `${count} etapas selecionadas`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {/* Sub Origin Name as subtle header */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{subOriginName}</p>
            </div>

            {/* File Name */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Nome do arquivo
              </Label>
              <div className="flex-1 relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="pl-9 pr-12"
                  placeholder="nome-do-arquivo"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">.csv</span>
              </div>
            </div>

            {/* Pipeline Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Etapas
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Todas</span>
                  <Switch
                    checked={selectedPipelines.has("all")}
                    onCheckedChange={() => togglePipeline("all")}
                  />
                </div>
              </div>
              
              {!selectedPipelines.has("all") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors text-left">
                      <span className="text-sm">{getSelectedPipelinesLabel()}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                    {pipelines.map((pipeline) => {
                      const isSelected = selectedPipelines.has(pipeline.id);
                      return (
                        <DropdownMenuCheckboxItem
                          key={pipeline.id}
                          checked={isSelected}
                          onCheckedChange={() => togglePipeline(pipeline.id)}
                          className="gap-2"
                        >
                          <span 
                            className="w-2 h-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: pipeline.cor }}
                          />
                          <span className="flex-1">{pipeline.nome}</span>
                          <span className="text-xs text-muted-foreground tabular-nums ml-2">
                            {pipelineCounts[pipeline.id] || 0}
                          </span>
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Columns */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Colunas
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {columns.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => toggleColumn(col.key)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg transition-all text-left",
                      col.selected
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                      col.selected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                    )}>
                      {col.selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <span className="text-sm">{col.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <Button 
              onClick={exportToCsv} 
              disabled={isExporting || columns.filter(c => c.selected).length === 0}
              className="w-full h-11"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  Exportando...
                </>
              ) : (
                "Exportar"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
