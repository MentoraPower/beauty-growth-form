import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Plus, Trash2, Settings2, Copy, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface CustomField {
  id: string;
  sub_origin_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options: unknown;
  ordem: number;
  is_required: boolean;
  created_at: string;
}

interface CustomFieldsManagerProps {
  subOriginId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CustomFieldsManager({ subOriginId, open, onOpenChange }: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [internalOpen, setInternalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Use controlled or uncontrolled state
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;
  
  // New field form state
  const [newField, setNewField] = useState({
    field_label: "",
    field_type: "text",
    is_required: false,
    options: "",
  });

  const fetchFields = async () => {
    const { data, error } = await supabase
      .from("sub_origin_custom_fields")
      .select("*")
      .eq("sub_origin_id", subOriginId)
      .order("ordem");

    if (error) {
      console.error("Error fetching custom fields:", error);
      return;
    }

    setFields(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchFields();
    }
  }, [subOriginId, isOpen]);

  const generateFieldKey = (label: string) => {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleAddField = async () => {
    if (!newField.field_label) {
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

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
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
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
          ) : fields.length === 0 ? (
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
  );
}