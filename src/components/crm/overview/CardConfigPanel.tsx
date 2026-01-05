import { useState, useEffect } from "react";
import { X, Settings2, Eye, Percent, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataSource, OverviewCard } from "./types";
import { Lead, Pipeline } from "@/types/crm";
import { ChartRenderer } from "./ChartRenderer";
import { supabase } from "@/integrations/supabase/client";

interface CustomField {
  id: string;
  field_label: string;
  field_key: string;
  field_type: string;
}

interface CustomFieldResponse {
  field_id: string;
  lead_id: string;
  response_value: string | null;
}

interface CardConfigPanelProps {
  card: OverviewCard;
  leads: Lead[];
  pipelines: Pipeline[];
  leadTags: Array<{ lead_id: string; name: string; color: string }>;
  subOriginId: string | null;
  onClose: () => void;
  onUpdateCard: (cardId: string, updates: Partial<OverviewCard>) => void;
}

const DATA_SOURCES: Array<{ id: DataSource; title: string }> = [
  { id: "total_leads", title: "Total de Leads" },
  { id: "leads_over_time", title: "Leads ao Longo do Tempo" },
  { id: "recent_leads", title: "Leads Recentes" },
  { id: "leads_by_tag", title: "Leads por Tag" },
  { id: "leads_by_utm", title: "Leads por UTM" },
  { id: "leads_by_custom_field", title: "Leads por Campo Personalizado" },
];

export function CardConfigPanel({ 
  card, 
  leads, 
  pipelines, 
  leadTags,
  subOriginId,
  onClose, 
  onUpdateCard 
}: CardConfigPanelProps) {
  const [showAsDonut, setShowAsDonut] = useState(false);
  const [showPercentages, setShowPercentages] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldResponses, setCustomFieldResponses] = useState<CustomFieldResponse[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Load custom fields when subOriginId changes
  useEffect(() => {
    if (!subOriginId) return;

    const loadCustomFields = async () => {
      setIsLoadingFields(true);
      try {
        const { data: fields, error: fieldsError } = await supabase
          .from("sub_origin_custom_fields")
          .select("id, field_label, field_key, field_type")
          .eq("sub_origin_id", subOriginId)
          .order("ordem");

        if (fieldsError) throw fieldsError;
        setCustomFields(fields || []);

        // Load responses for these fields - filter by field_id instead of lead_id
        // This avoids hitting Supabase's .in() limit when there are many leads
        if (fields && fields.length > 0) {
          const fieldIds = fields.map(f => f.id);
          const { data: responses, error: responsesError } = await supabase
            .from("lead_custom_field_responses")
            .select("field_id, lead_id, response_value")
            .in("field_id", fieldIds);

          if (responsesError) throw responsesError;
          setCustomFieldResponses(responses || []);
        }
      } catch (error) {
        console.error("Error loading custom fields:", error);
      } finally {
        setIsLoadingFields(false);
      }
    };

    loadCustomFields();
  }, [subOriginId]);

  const handleDataSourceChange = (dataSource: DataSource) => {
    onUpdateCard(card.id, { dataSource });
  };

  const handleCustomFieldChange = (fieldId: string) => {
    onUpdateCard(card.id, { 
      config: { 
        ...card.config, 
        customFieldId: fieldId 
      } 
    });
  };

  const selectedCustomField = customFields.find(f => f.id === card.config?.customFieldId);

  return (
    <>
      {/* Backdrop with blur - covers entire page including menus */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-8 sm:inset-16 z-[9999] bg-background flex overflow-hidden rounded-xl border border-border shadow-2xl">
      {/* Left side - Chart Preview */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h1 className="text-lg font-semibold">{card.title}</h1>
        </div>

        {/* Chart Area */}
        <div className="flex-1 p-8">
          <div className="w-full h-full max-w-3xl mx-auto">
            <ChartRenderer
              cardId={card.id}
              dataSource={card.dataSource}
              chartType={card.chartType}
              leads={leads}
              pipelines={pipelines}
              leadTags={leadTags}
              height={400}
              showEmptyState={false}
              customFieldId={card.config?.customFieldId}
              customFields={customFields}
              customFieldResponses={customFieldResponses}
            />
          </div>
        </div>
      </div>

      {/* Right side - Config Panel */}
      <div className="w-[380px] border-l border-border bg-background flex flex-col">
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Configurações</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Fonte de dados */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Fonte de dados</label>
                <Select 
                  value={card.dataSource || ""} 
                  onValueChange={(value) => handleDataSourceChange(value as DataSource)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar fonte" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border">
                    {DATA_SOURCES.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campo Personalizado Selector - only show when custom field data source is selected */}
              {card.dataSource === "leads_by_custom_field" && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Campo Personalizado</label>
                  {isLoadingFields ? (
                    <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
                  ) : customFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum campo personalizado encontrado
                    </p>
                  ) : (
                    <Select 
                      value={card.config?.customFieldId || ""} 
                      onValueChange={handleCustomFieldChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar campo" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border">
                        {customFields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.field_label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedCustomField && (
                    <p className="text-xs text-muted-foreground">
                      Tipo: {selectedCustomField.field_type === "text" ? "Texto" : 
                             selectedCustomField.field_type === "number" ? "Número" :
                             selectedCustomField.field_type === "select" ? "Seleção" :
                             selectedCustomField.field_type === "boolean" ? "Sim/Não" : 
                             selectedCustomField.field_type}
                    </p>
                  )}
                </div>
              )}

              {/* Tela */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Tela</h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Exibir como gráfico em anel</span>
                  </div>
                  <Switch checked={showAsDonut} onCheckedChange={setShowAsDonut} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Exibir como porcentagens</span>
                  </div>
                  <Switch checked={showPercentages} onCheckedChange={setShowPercentages} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Mostrar legenda</span>
                  </div>
                  <Switch checked={showLegend} onCheckedChange={setShowLegend} />
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
    </>
  );
}