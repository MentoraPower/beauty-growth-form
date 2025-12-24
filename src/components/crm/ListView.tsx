import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, User, Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lead, Pipeline } from "@/types/crm";
import { useNavigate } from "react-router-dom";

interface ListViewProps {
  pipelines: Pipeline[];
  leadsByPipeline: Map<string, Lead[]>;
  subOriginId: string | null;
}

export function ListView({ pipelines, leadsByPipeline, subOriginId }: ListViewProps) {
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(
    new Set(pipelines.map(p => p.id))
  );
  const navigate = useNavigate();

  const togglePipeline = (pipelineId: string) => {
    setExpandedPipelines(prev => {
      const next = new Set(prev);
      if (next.has(pipelineId)) {
        next.delete(pipelineId);
      } else {
        next.add(pipelineId);
      }
      return next;
    });
  };

  const handleLeadClick = (lead: Lead) => {
    navigate(`/admin/lead/${lead.id}`);
  };

  const getPipelineColor = (index: number) => {
    const colors = [
      "bg-violet-600",
      "bg-amber-500",
      "bg-emerald-500",
      "bg-blue-500",
      "bg-rose-500",
      "bg-cyan-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="flex-1 overflow-auto bg-background rounded-lg border border-border">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-foreground">List</span>
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Pipelines as sections */}
        <div className="space-y-1">
          {pipelines.map((pipeline, index) => {
            const leads = leadsByPipeline.get(pipeline.id) || [];
            const isExpanded = expandedPipelines.has(pipeline.id);

            return (
              <div key={pipeline.id} className="border-b border-border/50 last:border-b-0">
                {/* Pipeline Header */}
                <div className="flex items-center gap-2 py-2 px-1 hover:bg-muted/30 rounded transition-colors">
                  <button
                    onClick={() => togglePipeline(pipeline.id)}
                    className="p-0.5 hover:bg-muted rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  
                  <span className={cn(
                    "px-2.5 py-1 text-xs font-semibold text-white rounded",
                    getPipelineColor(index)
                  )}>
                    {pipeline.nome.toUpperCase()}
                  </span>
                  
                  <span className="text-xs text-muted-foreground">{leads.length}</span>
                  
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2">
                    <Plus className="w-3 h-3" />
                    Adicionar Lead
                  </button>
                </div>

                {/* Leads Table */}
                {isExpanded && leads.length > 0 && (
                  <div className="ml-6">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 py-2 px-3 text-xs text-muted-foreground border-b border-border/30">
                      <div className="col-span-6">Nome</div>
                      <div className="col-span-2">Responsável</div>
                      <div className="col-span-2">Data de entrada</div>
                      <div className="col-span-1">MQL</div>
                      <div className="col-span-1"></div>
                    </div>

                    {/* Leads Rows */}
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => handleLeadClick(lead)}
                        className="grid grid-cols-12 gap-4 py-2.5 px-3 hover:bg-muted/40 rounded cursor-pointer transition-colors group border-b border-border/20 last:border-b-0"
                      >
                        <div className="col-span-6 flex items-center gap-2">
                          <div className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                            getPipelineColor(index)
                          )}>
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-foreground truncate">{lead.name}</span>
                        </div>
                        
                        <div className="col-span-2 flex items-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        
                        <div className="col-span-2 flex items-center">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground ml-1">
                            {new Date(lead.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short"
                            })}
                          </span>
                        </div>
                        
                        <div className="col-span-1 flex items-center">
                          {lead.is_mql && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded">
                              MQL
                            </span>
                          )}
                        </div>
                        
                        <div className="col-span-1 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 hover:bg-muted rounded"
                          >
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add Lead Row */}
                    <button className="flex items-center gap-2 py-2 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded w-full transition-colors">
                      <Plus className="w-3 h-3" />
                      Adicionar Lead
                    </button>
                  </div>
                )}

                {/* Empty state when expanded but no leads */}
                {isExpanded && leads.length === 0 && (
                  <div className="ml-6 py-4 px-3">
                    <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Plus className="w-3 h-3" />
                      Adicionar Lead
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
