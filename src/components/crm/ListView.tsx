import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lead, Pipeline } from "@/types/crm";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";

interface ListViewProps {
  pipelines: Pipeline[];
  leadsByPipeline: Map<string, Lead[]>;
  subOriginId: string | null;
}

export function ListView({ pipelines, leadsByPipeline, subOriginId }: ListViewProps) {
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(
    new Set(pipelines.map(p => p.id))
  );
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
    const params = new URLSearchParams();
    if (subOriginId) params.set("origin", subOriginId);
    const searchQuery = searchParams.get("search");
    if (searchQuery) params.set("search", searchQuery);
    const queryString = params.toString();
    const url = `/admin/crm/${lead.id}${queryString ? `?${queryString}` : ''}`;
    navigate(url);
  };

  const toggleLeadSelection = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const toggleAllInPipeline = (pipelineId: string) => {
    const leads = leadsByPipeline.get(pipelineId) || [];
    const allSelected = leads.every(lead => selectedLeads.has(lead.id));
    
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (allSelected) {
        leads.forEach(lead => next.delete(lead.id));
      } else {
        leads.forEach(lead => next.add(lead.id));
      }
      return next;
    });
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
            const allSelected = leads.length > 0 && leads.every(lead => selectedLeads.has(lead.id));

            return (
              <div key={pipeline.id} className="border-b border-border/50 last:border-b-0">
                {/* Pipeline Header */}
                <div className="flex items-center gap-2 py-2 px-1 hover:bg-muted/30 rounded transition-colors group">
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
                  
                  <span className="text-sm font-medium text-foreground">
                    {pipeline.nome}
                  </span>
                  
                  <span className="text-xs text-muted-foreground">{leads.length}</span>
                  
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>

                {/* Leads Table */}
                {isExpanded && leads.length > 0 && (
                  <div className="ml-6">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 py-2 px-3 text-xs text-muted-foreground border-b border-border/30">
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleAllInPipeline(pipeline.id)}
                          className="border-[#00000040] data-[state=checked]:bg-[#00000040] data-[state=checked]:border-[#00000040]"
                        />
                      </div>
                      <div className="col-span-7">Nome</div>
                      <div className="col-span-3">Data de entrada</div>
                      <div className="col-span-1"></div>
                    </div>

                    {/* Leads Rows */}
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => handleLeadClick(lead)}
                        className={cn(
                          "grid grid-cols-12 gap-4 py-2.5 px-3 hover:bg-muted/40 rounded cursor-pointer transition-colors group border-b border-border/20 last:border-b-0",
                          selectedLeads.has(lead.id) && "bg-primary/5"
                        )}
                      >
                        <div className="col-span-1 flex items-center">
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={() => {}}
                            onClick={(e) => toggleLeadSelection(lead.id, e)}
                            className="border-[#00000040] data-[state=checked]:bg-[#00000040] data-[state=checked]:border-[#00000040]"
                          />
                        </div>
                        <div className="col-span-7 flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-bold flex-shrink-0">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-foreground truncate">{lead.name}</span>
                        </div>
                        
                        <div className="col-span-3 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(lead.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
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
