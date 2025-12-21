import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EditableField } from "./EditableField";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy, Check, Settings2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import * as LucideIcons from "lucide-react";

interface CustomField {
  id: string;
  sub_origin_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options: unknown;
  ordem: number;
  is_required: boolean;
}

interface CustomFieldResponse {
  id: string;
  lead_id: string;
  field_id: string;
  response_value: string | null;
}

interface LeadCustomFieldsProps {
  leadId: string;
  subOriginId: string | null;
}

export function LeadCustomFields({ leadId, subOriginId }: LeadCustomFieldsProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // New field form state
  const [newField, setNewField] = useState({
    field_label: "",
    field_type: "text",
    is_required: false,
    options: "",
  });

  const fetchData = async () => {
    if (!subOriginId) {
      setIsLoading(false);
      return;
    }

    const { data: fieldsData, error: fieldsError } = await supabase
      .from("sub_origin_custom_fields")
      .select("*")
      .eq("sub_origin_id", subOriginId)
      .order("ordem");

    if (fieldsError) {
      console.error("Error fetching custom fields:", fieldsError);
      setIsLoading(false);
      return;
    }

    setFields(fieldsData || []);

    if (fieldsData && fieldsData.length > 0) {
      const { data: responsesData, error: responsesError } = await supabase
        .from("lead_custom_field_responses")
        .select("*")
        .eq("lead_id", leadId);

      if (responsesError) {
        console.error("Error fetching responses:", responsesError);
      } else {
        const responsesMap: Record<string, string> = {};
        (responsesData || []).forEach((r: CustomFieldResponse) => {
          responsesMap[r.field_id] = r.response_value || "";
        });
        setResponses(responsesMap);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [leadId, subOriginId]);

  const handleUpdateField = async (fieldId: string, value: string) => {
    const { data: existing } = await supabase
      .from("lead_custom_field_responses")
      .select("id")
      .eq("lead_id", leadId)
      .eq("field_id", fieldId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("lead_custom_field_responses")
        .update({ response_value: value })
        .eq("id", existing.id);

      if (error) {
        toast.error("Erro ao atualizar campo");
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("lead_custom_field_responses")
        .insert({
          lead_id: leadId,
          field_id: fieldId,
          response_value: value,
        });

      if (error) {
        toast.error("Erro ao salvar campo");
        throw error;
      }
    }

    setResponses({ ...responses, [fieldId]: value });
    toast.success("Campo atualizado");
  };

  const generateFieldKey = (label: string) => {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleAddField = async () => {
    if (!newField.field_label || !subOriginId) {
      toast.error("Preencha o nome do campo");
      return;
    }

    const fieldKey = generateFieldKey(newField.field_label);
    const options = newField.field_type === "select" && newField.options
      ? newField.options.split(",").map(o => o.trim()).filter(Boolean)
      : null;

    const { data, error } = await supabase
      .from("sub_origin_custom_fields")
      .insert({
        sub_origin_id: subOriginId,
        field_key: fieldKey,
        field_label: newField.field_label,
        field_type: newField.field_type,
        is_required: newField.is_required,
        options,
        ordem: fields.length,
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar campo");
      return;
    }

    setFields([...fields, data]);
    setNewField({
      field_label: "",
      field_type: "text",
      is_required: false,
      options: "",
    });
    toast.success("Campo criado!");
  };

  const handleDeleteField = async (fieldId: string) => {
    const { error } = await supabase
      .from("sub_origin_custom_fields")
      .delete()
      .eq("id", fieldId);

    if (error) {
      toast.error("Erro ao excluir campo");
      return;
    }

    setFields(fields.filter(f => f.id !== fieldId));
    toast.success("Campo excluído");
  };

  const copyFieldId = (fieldId: string) => {
    navigator.clipboard.writeText(fieldId);
    setCopiedId(fieldId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("ID copiado!");
  };

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case "text": return "Texto";
      case "number": return "Número";
      case "select": return "Seleção";
      case "boolean": return "Sim/Não";
      default: return type;
    }
  };

  const formatDisplayValue = (field: CustomField, value: string | null | undefined) => {
    if (!value || value.trim() === "") {
      return <span className="text-sm font-medium text-muted-foreground italic">incompleto</span>;
    }

    if (field.field_type === "boolean") {
      return <span className="text-sm font-medium">{value === "true" ? "Sim" : "Não"}</span>;
    }

    if (field.field_type === "number") {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return <span className="text-sm font-medium">{num.toLocaleString("pt-BR")}</span>;
      }
    }

    return <span className="text-sm font-medium">{value}</span>;
  };

  const getFieldIcon = (field: CustomField) => {
    switch (field.field_type) {
      case "number":
        return <LucideIcons.Hash className="h-4 w-4 text-muted-foreground" />;
      case "boolean":
        return <LucideIcons.ToggleLeft className="h-4 w-4 text-muted-foreground" />;
      case "select":
        return <LucideIcons.List className="h-4 w-4 text-muted-foreground" />;
      default:
        return <LucideIcons.Type className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Informações do Negócio</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!subOriginId) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Informações do Negócio</h3>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setIsManagerOpen(!isManagerOpen)}
        >
          {isManagerOpen ? (
            <>
              <X className="h-4 w-4" />
              Fechar
            </>
          ) : (
            <>
              <Settings2 className="h-4 w-4" />
              Gerenciar Campos
            </>
          )}
        </Button>
      </div>

      <div className={`flex gap-4 transition-all duration-300 ${isManagerOpen ? '' : ''}`}>
        {/* Fields display */}
        <div className={`transition-all duration-300 ${isManagerOpen ? 'flex-1' : 'w-full'}`}>
          {fields.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-lg">
              Nenhum campo personalizado. Clique em "Gerenciar Campos" para adicionar.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field, index) => {
                const value = responses[field.id] || "";
                
                return (
                  <div 
                    key={field.id} 
                    className="p-3 bg-muted/30 border border-[#00000010] rounded-lg animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getFieldIcon(field)}
                      <p className="text-xs text-muted-foreground">
                        {field.field_label}
                        {field.is_required && <span className="text-destructive ml-1">*</span>}
                      </p>
                    </div>
                    <EditableField
                      value={value}
                      onSave={(newValue) => handleUpdateField(field.id, newValue)}
                      placeholder={`Digite ${field.field_label.toLowerCase()}`}
                      displayValue={formatDisplayValue(field, value)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Manager panel - slides in from right */}
        {isManagerOpen && (
          <div className="w-72 flex-shrink-0 bg-muted/20 border border-border rounded-lg p-4 space-y-4 animate-fade-in">
            <div>
              <h4 className="font-medium text-sm">Campos Personalizados</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use o ID do campo no webhook
              </p>
            </div>

            {/* Existing fields list */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {fields.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-2">
                  Nenhum campo criado
                </div>
              ) : (
                fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 p-2 bg-background rounded-md text-sm border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-xs">{field.field_label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        ID: {field.id.slice(0, 8)}...
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={() => copyFieldId(field.id)}
                    >
                      {copiedId === field.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteField(field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Add new field form */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do campo</Label>
                <Input
                  placeholder="Ex: Profissão"
                  value={newField.field_label}
                  onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={newField.field_type}
                  onValueChange={(value) => setNewField({ ...newField, field_type: value })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="select">Seleção</SelectItem>
                    <SelectItem value="boolean">Sim/Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Obrigatório</Label>
                <Switch
                  checked={newField.is_required}
                  onCheckedChange={(checked) => setNewField({ ...newField, is_required: checked })}
                />
              </div>

              {newField.field_type === "select" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Opções (vírgula)</Label>
                  <Input
                    placeholder="Opção 1, Opção 2"
                    value={newField.options}
                    onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              )}

              <Button onClick={handleAddField} size="sm" className="w-full gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>

            {/* Webhook example */}
            {fields.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground mb-1">
                  Exemplo webhook:
                </p>
                <pre className="text-[9px] bg-background p-2 rounded border overflow-x-auto">
{`"custom_fields": {
${fields.slice(0, 2).map(f => `  "${f.id.slice(0, 8)}...": "valor"`).join(",\n")}${fields.length > 2 ? '\n  ...' : ''}
}`}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
