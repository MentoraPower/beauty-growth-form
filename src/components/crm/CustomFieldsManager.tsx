import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Settings2, Copy, Check } from "lucide-react";
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
  const isDialogOpen = open !== undefined ? open : internalOpen;
  const setIsDialogOpen = onOpenChange || setInternalOpen;
  
  // New field form state
  const [newField, setNewField] = useState({
    field_key: "",
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
    fetchFields();
  }, [subOriginId]);

  const generateFieldKey = (label: string) => {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleLabelChange = (value: string) => {
    setNewField({
      ...newField,
      field_label: value,
      field_key: generateFieldKey(value),
    });
  };

  const handleAddField = async () => {
    if (!newField.field_label || !newField.field_key) {
      toast.error("Preencha o nome e chave do campo");
      return;
    }

    const options = newField.field_type === "select" && newField.options
      ? newField.options.split(",").map(o => o.trim()).filter(Boolean)
      : null;

    const { data, error } = await supabase
      .from("sub_origin_custom_fields")
      .insert({
        sub_origin_id: subOriginId,
        field_key: newField.field_key,
        field_label: newField.field_label,
        field_type: newField.field_type,
        is_required: newField.is_required,
        options,
        ordem: fields.length,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe um campo com essa chave");
      } else {
        toast.error("Erro ao criar campo");
      }
      return;
    }

    setFields([...fields, data]);
    setNewField({
      field_key: "",
      field_label: "",
      field_type: "text",
      is_required: false,
      options: "",
    });
    toast.success("Campo criado com sucesso");
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

  // If controlled externally, don't render the trigger button
  if (open !== undefined) {
    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Campos Personalizados</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Existing fields */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Campos existentes</h4>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando...</div>
              ) : fields.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">
                  Nenhum campo personalizado criado ainda
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-lg"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{field.field_label}</span>
                          {field.is_required && (
                            <span className="text-xs text-destructive">*</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Chave: {field.field_key}</span>
                          <span>•</span>
                          <span>{getFieldTypeLabel(field.field_type)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyFieldId(field.id)}
                        title="Copiar ID do campo"
                      >
                        {copiedId === field.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteField(field.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new field */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground">Adicionar novo campo</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do campo</Label>
                  <Input
                    placeholder="Ex: Profissão"
                    value={newField.field_label}
                    onChange={(e) => handleLabelChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chave (para webhook)</Label>
                  <Input
                    placeholder="Ex: profissao"
                    value={newField.field_key}
                    onChange={(e) => setNewField({ ...newField, field_key: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de campo</Label>
                  <Select
                    value={newField.field_type}
                    onValueChange={(value) => setNewField({ ...newField, field_type: value })}
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Campo obrigatório</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={newField.is_required}
                      onCheckedChange={(checked) => setNewField({ ...newField, is_required: checked })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {newField.is_required ? "Sim" : "Não"}
                    </span>
                  </div>
                </div>
              </div>

              {newField.field_type === "select" && (
                <div className="space-y-2">
                  <Label>Opções (separadas por vírgula)</Label>
                  <Input
                    placeholder="Ex: Opção 1, Opção 2, Opção 3"
                    value={newField.options}
                    onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                  />
                </div>
              )}

              <Button onClick={handleAddField} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Campo
              </Button>
            </div>

            {/* Webhook info */}
            <div className="p-4 bg-muted/50 rounded-lg border border-border mt-4">
              <h4 className="text-sm font-medium mb-2">Integração via Webhook</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Para enviar dados para campos personalizados via webhook, use a chave do campo como nome do parâmetro.
                Exemplo de payload JSON:
              </p>
              <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
{`{
  "name": "João Silva",
  "email": "joao@email.com",
${fields.map(f => `  "${f.field_key}": "valor_aqui"`).join(",\n")}
}`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Campos Personalizados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Campos Personalizados</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Existing fields */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Campos existentes</h4>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : fields.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">
                Nenhum campo personalizado criado ainda
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-lg"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{field.field_label}</span>
                        {field.is_required && (
                          <span className="text-xs text-destructive">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Chave: {field.field_key}</span>
                        <span>•</span>
                        <span>{getFieldTypeLabel(field.field_type)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyFieldId(field.id)}
                      title="Copiar ID do campo"
                    >
                      {copiedId === field.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new field */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">Adicionar novo campo</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do campo</Label>
                <Input
                  placeholder="Ex: Profissão"
                  value={newField.field_label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Chave (para webhook)</Label>
                <Input
                  placeholder="Ex: profissao"
                  value={newField.field_key}
                  onChange={(e) => setNewField({ ...newField, field_key: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de campo</Label>
                <Select
                  value={newField.field_type}
                  onValueChange={(value) => setNewField({ ...newField, field_type: value })}
                >
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Campo obrigatório</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={newField.is_required}
                    onCheckedChange={(checked) => setNewField({ ...newField, is_required: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {newField.is_required ? "Sim" : "Não"}
                  </span>
                </div>
              </div>
            </div>

            {newField.field_type === "select" && (
              <div className="space-y-2">
                <Label>Opções (separadas por vírgula)</Label>
                <Input
                  placeholder="Ex: Opção 1, Opção 2, Opção 3"
                  value={newField.options}
                  onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                />
              </div>
            )}

            <Button onClick={handleAddField} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Campo
            </Button>
          </div>

          {/* Webhook info */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border mt-4">
            <h4 className="text-sm font-medium mb-2">Integração via Webhook</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Para enviar dados para campos personalizados via webhook, use a chave do campo como nome do parâmetro.
              Exemplo de payload JSON:
            </p>
            <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
{`{
  "name": "João Silva",
  "email": "joao@email.com",
${fields.map(f => `  "${f.field_key}": "valor_aqui"`).join(",\n")}
}`}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
