import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal, Calendar, X, User, Phone, Mail, Instagram } from "lucide-react";
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

interface ListViewProps {
  pipelines: Pipeline[];
  leadsByPipeline: Map<string, Lead[]>;
  subOriginId: string | null;
}

interface InlineAddRowProps {
  pipelineId: string;
  subOriginId: string | null;
  onClose: () => void;
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

export function ListView({ pipelines, leadsByPipeline, subOriginId }: ListViewProps) {
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(
    new Set(pipelines.map(p => p.id))
  );
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [addingToPipeline, setAddingToPipeline] = useState<string | null>(null);
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
          {pipelines.map((pipeline) => {
            const leads = leadsByPipeline.get(pipeline.id) || [];
            const isExpanded = expandedPipelines.has(pipeline.id);
            const allSelected = leads.length > 0 && leads.every(lead => selectedLeads.has(lead.id));
            const isAdding = addingToPipeline === pipeline.id;

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
                {isExpanded && (
                  <div className="ml-6">
                    {/* Table Header */}
                    {leads.length > 0 && (
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
                    )}

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
