import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Calendar, X, User, Phone, Mail, Instagram, GripVertical, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lead, Pipeline } from "@/types/crm";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { countries, Country, getFlagUrl } from "@/data/countries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { trackLeadEvent } from "@/lib/leadTracking";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ListViewProps {
  pipelines: Pipeline[];
  leadsByPipeline: Map<string, Lead[]>;
  subOriginId: string | null;
  tagsMap: Map<string, { id: string; name: string; color: string }[]>;
}

interface InlineAddRowProps {
  pipelineId: string;
  subOriginId: string | null;
  onClose: () => void;
}

interface SortableLeadRowProps {
  lead: Lead;
  isSelected: boolean;
  onLeadClick: (lead: Lead) => void;
  onToggleSelection: (leadId: string, e: React.MouseEvent) => void;
  isOverlay?: boolean;
  tags?: { id: string; name: string; color: string }[];
}

const MAX_VISIBLE_TAGS = 2;

function TagsBadge({ tags }: { tags?: { id: string; name: string; color: string }[] }) {
  if (!tags || tags.length === 0) return null;

  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const remainingTags = tags.slice(MAX_VISIBLE_TAGS);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleTags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[80px]"
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
          }}
        >
          {tag.name}
        </span>
      ))}
      {remainingTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <Tag className="w-3 h-3" />
              +{remainingTags.length}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-2 min-w-[120px]">
            <div className="flex flex-col gap-1">
              {remainingTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function SortableLeadRow({ lead, isSelected, onLeadClick, onToggleSelection, isOverlay = false, tags = [] }: SortableLeadRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: lead.id, disabled: isOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
  };

  const formatPhone = (phone: string, countryCode: string) => {
    if (!phone) return "-";
    return `${countryCode} ${phone}`;
  };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      onClick={() => !isDragging && onLeadClick(lead)}
      className={cn(
        "grid grid-cols-12 gap-2 py-2.5 px-3 hover:bg-muted/40 rounded cursor-pointer transition-colors group border-b border-border/20 last:border-b-0",
        isSelected && "bg-primary/5",
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "shadow-lg bg-background border border-border rounded-lg"
      )}
    >
      <div className="col-span-1 flex items-center gap-1">
        <div
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className="p-1 cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => {}}
          onClick={(e) => onToggleSelection(lead.id, e)}
          className="border-[#00000040] data-[state=checked]:bg-[#00000040] data-[state=checked]:border-[#00000040]"
        />
      </div>
      
      {/* Nome */}
      <div className="col-span-3 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-[10px] font-bold flex-shrink-0">
          {lead.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm text-foreground truncate">{lead.name}</span>
      </div>
      
      {/* Email */}
      <div className="col-span-2 flex items-center gap-1 min-w-0">
        <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          {lead.email && lead.email !== "sem@email.com" ? lead.email : "-"}
        </span>
      </div>
      
      {/* WhatsApp */}
      <div className="col-span-2 flex items-center gap-1 min-w-0">
        <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          {formatPhone(lead.whatsapp, lead.country_code)}
        </span>
      </div>
      
      {/* Tags */}
      <div className="col-span-2 flex items-center min-w-0">
        <TagsBadge tags={tags} />
      </div>
      
      {/* Data */}
      <div className="col-span-1 flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          {new Date(lead.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
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
  );
}

function InlineAddRow({ pipelineId, subOriginId, onClose }: InlineAddRowProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find(c => c.code === "BR") || countries[0]
  );
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryButtonRef = useRef<HTMLButtonElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        countryButtonRef.current &&
        !countryButtonRef.current.contains(e.target as Node) &&
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (showCountryDropdown && countryButtonRef.current) {
      const rect = countryButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showCountryDropdown]);

  const filteredCountries = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dialCode.includes(countrySearch)
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from("leads").insert({
        name: name.trim(),
        whatsapp: phone.trim(),
        country_code: selectedCountry.dialCode,
        email: email.trim() || "sem@email.com",
        instagram: instagram.trim() || "@",
        service_area: "Outro",
        monthly_billing: "Não informado",
        weekly_attendance: "0",
        workspace_type: "Não informado",
        years_experience: "0",
        pipeline_id: pipelineId,
        sub_origin_id: subOriginId,
        ordem: 0,
      }).select("id").single();

      if (error) throw error;

      if (data?.id) {
        await trackLeadEvent({
          leadId: data.id,
          tipo: "cadastro",
          titulo: "Lead adicionado manualmente",
          descricao: `Nome: ${name.trim()}`,
          dados: {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || "sem@email.com",
            instagram: instagram.trim() || "@",
          },
        });
      }

      toast.success("Lead adicionado!");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
    } catch (error) {
      console.error("Erro ao adicionar lead:", error);
      toast.error("Erro ao adicionar lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  const countryDropdown = showCountryDropdown
    ? createPortal(
        <div
          ref={countryDropdownRef}
          className="fixed w-64 max-h-64 overflow-hidden rounded-lg border bg-popover shadow-xl"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 99999,
          }}
        >
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar país..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  setSelectedCountry(country);
                  setShowCountryDropdown(false);
                  setCountrySearch("");
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted",
                  selectedCountry.code === country.code && "bg-muted"
                )}
              >
                <img
                  src={getFlagUrl(country.code)}
                  alt={country.name}
                  className="w-5 h-3.5 object-cover rounded-sm"
                />
                <span className="flex-1 truncate">{country.name}</span>
                <span className="text-muted-foreground">{country.dialCode}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="grid grid-cols-12 gap-2 py-2 px-3 bg-muted/30 rounded border border-border/50">
      <div className="col-span-1 flex items-center">
        <button onClick={onClose} className="p-1 hover:bg-muted rounded">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      
      {/* Nome */}
      <div className="col-span-3">
        <div className="relative">
          <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 pl-7 text-xs"
            autoFocus
          />
        </div>
      </div>

      {/* Telefone */}
      <div className="col-span-3 flex">
        <button
          ref={countryButtonRef}
          type="button"
          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
          className="flex items-center gap-1 h-8 px-2 border border-r-0 rounded-l-md bg-muted/50 hover:bg-muted flex-shrink-0"
        >
          <img
            src={getFlagUrl(selectedCountry.code)}
            alt={selectedCountry.name}
            className="w-4 h-3 object-cover rounded-sm"
          />
          <span className="text-[10px] text-muted-foreground">{selectedCountry.dialCode}</span>
        </button>
        <div className="relative flex-1">
          <Phone className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 pl-7 text-xs rounded-l-none"
          />
        </div>
      </div>
      {countryDropdown}

      {/* Email */}
      <div className="col-span-2">
        <div className="relative">
          <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Instagram */}
      <div className="col-span-2">
        <div className="relative">
          <Instagram className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="@instagram"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Botão salvar */}
      <div className="col-span-1 flex items-center justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !name.trim()}
          size="sm"
          className="h-8 text-xs px-3"
        >
          {isSubmitting ? "..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export function ListView({ pipelines, leadsByPipeline, subOriginId, tagsMap }: ListViewProps) {
  const queryClient = useQueryClient();
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(
    new Set(pipelines.map(p => p.id))
  );
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [addingToPipeline, setAddingToPipeline] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [localLeadsByPipeline, setLocalLeadsByPipeline] = useState<Map<string, Lead[]>>(leadsByPipeline);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Sync local state with prop
  useEffect(() => {
    setLocalLeadsByPipeline(leadsByPipeline);
  }, [leadsByPipeline]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

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
    params.set("view", "lista");
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
    const leads = localLeadsByPipeline.get(pipelineId) || [];
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find which pipeline contains the dragged lead
    let sourcePipelineId: string | null = null;
    for (const [pipelineId, leads] of localLeadsByPipeline.entries()) {
      if (leads.some(l => l.id === active.id)) {
        sourcePipelineId = pipelineId;
        break;
      }
    }

    if (!sourcePipelineId) return;

    const leads = localLeadsByPipeline.get(sourcePipelineId) || [];
    const oldIndex = leads.findIndex(l => l.id === active.id);
    const newIndex = leads.findIndex(l => l.id === over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    // Reorder immediately during drag
    const newLeads = arrayMove(leads, oldIndex, newIndex);
    setLocalLeadsByPipeline(prev => {
      const next = new Map(prev);
      next.set(sourcePipelineId!, newLeads);
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);

    // Find which pipeline contains the dragged lead
    let sourcePipelineId: string | null = null;
    for (const [pipelineId, leads] of localLeadsByPipeline.entries()) {
      if (leads.some(l => l.id === event.active.id)) {
        sourcePipelineId = pipelineId;
        break;
      }
    }

    if (!sourcePipelineId) return;

    const currentLeads = localLeadsByPipeline.get(sourcePipelineId) || [];

    // Update ordem in database
    try {
      const updates = currentLeads.map((lead, index) => ({
        id: lead.id,
        ordem: index,
      }));

      for (const update of updates) {
        await supabase
          .from("leads")
          .update({ ordem: update.ordem })
          .eq("id", update.id);
      }

      queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
    } catch (error) {
      console.error("Erro ao reordenar leads:", error);
      toast.error("Erro ao reordenar leads");
      // Revert on error
      setLocalLeadsByPipeline(leadsByPipeline);
    }
  };

  // Find the active lead for overlay
  const activeLead = activeDragId
    ? Array.from(localLeadsByPipeline.values()).flat().find(l => l.id === activeDragId)
    : null;

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
          {pipelines.map((pipeline) => {
            const leads = localLeadsByPipeline.get(pipeline.id) || [];
            const isExpanded = expandedPipelines.has(pipeline.id);
            const allSelected = leads.length > 0 && leads.every(lead => selectedLeads.has(lead.id));
            const isAdding = addingToPipeline === pipeline.id;

            return (
              <div key={pipeline.id} className="border-b border-border/50 last:border-b-0">
                {/* Pipeline Header */}
                <div className="flex items-center gap-2 py-2 px-3 bg-background hover:bg-muted/30 rounded transition-colors group">
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
                {isExpanded && (
                  <div className="ml-6">
                    {/* Table Header */}
                    {leads.length > 0 && (
                      <div className="grid grid-cols-12 gap-2 py-2 px-3 text-xs text-muted-foreground border-b border-border/30">
                        <div className="col-span-1 flex items-center">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleAllInPipeline(pipeline.id)}
                            className="border-[#00000040] data-[state=checked]:bg-[#00000040] data-[state=checked]:border-[#00000040] ml-6"
                          />
                        </div>
                        <div className="col-span-3">Nome</div>
                        <div className="col-span-2">Email</div>
                        <div className="col-span-2">WhatsApp</div>
                        <div className="col-span-2">Tags</div>
                        <div className="col-span-1">Entrada</div>
                        <div className="col-span-1"></div>
                      </div>
                    )}

                    {/* Leads Rows with DnD */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      measuring={measuring}
                    >
                      <SortableContext
                        items={leads.map(l => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {leads.map((lead) => (
                          <SortableLeadRow
                            key={lead.id}
                            lead={lead}
                            isSelected={selectedLeads.has(lead.id)}
                            onLeadClick={handleLeadClick}
                            onToggleSelection={toggleLeadSelection}
                            tags={tagsMap.get(lead.id) || []}
                          />
                        ))}
                      </SortableContext>

                      {createPortal(
                        <DragOverlay>
                          {activeLead ? (
                            <SortableLeadRow
                              lead={activeLead}
                              isSelected={selectedLeads.has(activeLead.id)}
                              onLeadClick={() => {}}
                              onToggleSelection={() => {}}
                              isOverlay
                              tags={tagsMap.get(activeLead.id) || []}
                            />
                          ) : null}
                        </DragOverlay>,
                        document.body
                      )}
                    </DndContext>

                    {/* Inline Add Row */}
                    {isAdding ? (
                      <InlineAddRow
                        pipelineId={pipeline.id}
                        subOriginId={subOriginId}
                        onClose={() => setAddingToPipeline(null)}
                      />
                    ) : (
                      <button 
                        onClick={() => setAddingToPipeline(pipeline.id)}
                        className="flex items-center gap-2 py-2 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded w-full transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Lead
                      </button>
                    )}
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
