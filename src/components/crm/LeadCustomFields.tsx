import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EditableField } from "./EditableField";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy, Check, Settings2 } from "lucide-react";
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

    // Fetch custom fields for this sub-origin
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
      // Fetch responses for this lead
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
    // Check if response already exists
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

  // Get a generic icon based on field type
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
        
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
              <Settings2 className="h-4 w-4" />
              Gerenciar Campos
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-80 p-0 bg-popover border border-border shadow-lg z-50"
            sideOffset={5}
          >
            <div className="p-3 border-b border-border">
              <h4 className="font-medium text-sm">Campos Personalizados</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use o ID do campo no webhook
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {fields.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground italic">
                  Nenhum campo criado
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-2 bg-muted/30 rounded-md text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{field.field_label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          ID: {field.id.slice(0, 8)}...
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                        {getFieldTypeLabel(field.field_type)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyFieldId(field.id);
                        }}
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
                        className="h-6 w-6 flex-shrink-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteField(field.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new field form */}
            <div className="p-3 border-t border-border space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do campo</Label>
                <Input
                  placeholder="Ex: Profissão"
                  value={newField.field_label}
                  onChange={(e) => setNewField({ ...newField, field_label: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Obrigatório</Label>
                  <div className="flex items-center gap-2 h-8">
                    <Switch
                      checked={newField.is_required}
                      onCheckedChange={(checked) => setNewField({ ...newField, is_required: checked })}
                    />
                    <span className="text-xs text-muted-foreground">
                      {newField.is_required ? "Sim" : "Não"}
                    </span>
                  </div>
                </div>
              </div>

              {newField.field_type === "select" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Opções (separadas por vírgula)</Label>
                  <Input
                    placeholder="Ex: Opção 1, Opção 2"
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

            {/* Webhook info */}
            {fields.length > 0 && (
              <div className="p-3 border-t border-border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">
                  Exemplo de payload webhook:
                </p>
                <pre className="text-[10px] bg-background p-2 rounded border overflow-x-auto">
{`{
  "custom_fields": {
${fields.map(f => `    "${f.id}": "valor"`).join(",\n")}
  }
}`}
                </pre>
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
  );
}
