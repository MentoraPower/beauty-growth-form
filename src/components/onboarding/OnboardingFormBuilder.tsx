import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Type,
  AlignLeft,
  ChevronDown,
  CheckSquare,
  Circle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OnboardingForm {
  id: string;
  name: string;
  slug: string;
  is_sequential: boolean;
  is_active: boolean;
  is_published: boolean;
  published_at: string | null;
}

interface OnboardingField {
  id: string;
  form_id: string;
  field_type: string;
  title: string;
  description: string | null;
  options: any; // JSON from database
  is_required: boolean;
  ordem: number;
}

interface OnboardingFormBuilderProps {
  form: OnboardingForm;
  fields: OnboardingField[];
  onClose: () => void;
  onUpdate: () => void;
}

const FIELD_TYPES = [
  { id: "text_short", label: "Texto Curto", icon: Type },
  { id: "text_long", label: "Texto Longo", icon: AlignLeft },
  { id: "number", label: "Número (R$)", icon: Type },
  { id: "dropdown", label: "Menu Suspenso", icon: ChevronDown },
  { id: "checkbox", label: "Caixa de Seleção", icon: CheckSquare },
];

export function OnboardingFormBuilder({
  form,
  fields: initialFields,
  onClose,
  onUpdate,
}: OnboardingFormBuilderProps) {
  const [isSequential, setIsSequential] = useState(form.is_sequential);
  const [fields, setFields] = useState<OnboardingField[]>(initialFields);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const addField = async (fieldType: string) => {
    const fieldData = {
      form_id: form.id,
      field_type: fieldType,
      title: "Nova Pergunta",
      description: null,
      options: ["dropdown", "checkbox", "radio"].includes(fieldType) ? ["Opção 1"] : null,
      is_required: false,
      ordem: fields.length,
    };

    const { data, error } = await supabase
      .from("lead_onboarding_fields")
      .insert(fieldData)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao adicionar campo");
      return;
    }

    const addedField: OnboardingField = {
      id: data.id,
      form_id: data.form_id,
      field_type: data.field_type,
      title: data.title,
      description: data.description,
      options: data.options,
      is_required: data.is_required,
      ordem: data.ordem,
    };
    setFields([...fields, addedField]);
    setEditingField(data.id);
  };

  const updateField = async (fieldId: string, updates: Partial<OnboardingField>) => {
    const { error } = await supabase
      .from("lead_onboarding_fields")
      .update(updates)
      .eq("id", fieldId);

    if (error) {
      toast.error("Erro ao atualizar campo");
      return;
    }

    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const deleteField = async (fieldId: string) => {
    const { error } = await supabase
      .from("lead_onboarding_fields")
      .delete()
      .eq("id", fieldId);

    if (error) {
      toast.error("Erro ao remover campo");
      return;
    }

    setFields(fields.filter((f) => f.id !== fieldId));
    if (editingField === fieldId) setEditingField(null);
  };

  const addOption = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const currentOptions = field.options || [];
    const newOptions = [...currentOptions, `Opção ${currentOptions.length + 1}`];
    updateField(fieldId, { options: newOptions });
  };

  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = [...field.options];
    newOptions[optionIndex] = value;
    updateField(fieldId, { options: newOptions });
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = field.options.filter((_, i) => i !== optionIndex);
    updateField(fieldId, { options: newOptions });
  };

  const saveSequentialMode = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from("lead_onboarding_forms")
      .update({ is_sequential: isSequential })
      .eq("id", form.id);

    if (error) {
      toast.error("Erro ao salvar");
    }
    setIsSaving(false);
  };

  const handlePublish = async () => {
    if (fields.length === 0) {
      toast.error("Adicione pelo menos uma pergunta");
      return;
    }

    setIsPublishing(true);
    const { error } = await supabase
      .from("lead_onboarding_forms")
      .update({
        is_published: true,
        is_sequential: isSequential,
        published_at: new Date().toISOString(),
      })
      .eq("id", form.id);

    if (error) {
      toast.error("Erro ao publicar");
      setIsPublishing(false);
      return;
    }

    toast.success("Formulário publicado!");
    onUpdate();
    onClose();
  };

  const getFieldIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find((f) => f.id === type);
    return fieldType?.icon || Type;
  };

  const getFieldLabel = (type: string) => {
    const fieldType = FIELD_TYPES.find((f) => f.id === type);
    return fieldType?.label || type;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Editor de Onboarding</h2>
        </div>
        <Button
          onClick={handlePublish}
          disabled={isPublishing || fields.length === 0}
          className="bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000]"
        >
          {isPublishing ? "Publicando..." : "Publicar"}
        </Button>
      </div>

      {/* Mode toggle */}
      <Card className="border-[#00000010] shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Modo Sequência</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSequential
                  ? "Perguntas aparecem uma por vez"
                  : "Todas as perguntas aparecem juntas"}
              </p>
            </div>
            <Switch
              checked={isSequential}
              onCheckedChange={(checked) => {
                setIsSequential(checked);
                saveSequentialMode();
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fields list */}
      <div className="space-y-3">
        {fields.map((field, index) => {
          const Icon = getFieldIcon(field.field_type);
          const isEditing = editingField === field.id;

          return (
            <Card
              key={field.id}
              className={`border-[#00000010] shadow-none transition-all ${
                isEditing ? "ring-2 ring-primary/20" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 pt-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <div className="h-8 w-8 rounded bg-muted/50 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-3">
                    {isEditing ? (
                      <>
                        <Input
                          value={field.title}
                          onChange={(e) => updateField(field.id, { title: e.target.value })}
                          placeholder="Título da pergunta"
                          className="font-medium"
                        />
                        <Textarea
                          value={field.description || ""}
                          onChange={(e) =>
                            updateField(field.id, { description: e.target.value || null })
                          }
                          placeholder="Descrição (opcional)"
                          className="resize-none min-h-[60px]"
                        />

                        {/* Options for dropdown, checkbox, radio */}
                        {["dropdown", "checkbox", "radio"].includes(field.field_type) && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Opções</Label>
                            {field.options?.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) =>
                                    updateOption(field.id, optIndex, e.target.value)
                                  }
                                  placeholder={`Opção ${optIndex + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeOption(field.id, optIndex)}
                                  disabled={(field.options?.length || 0) <= 1}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(field.id)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Adicionar opção
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.is_required}
                            onCheckedChange={(checked) =>
                              updateField(field.id, { is_required: checked })
                            }
                          />
                          <Label className="text-xs">Obrigatório</Label>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingField(field.id)}
                        className="text-left w-full"
                      >
                        <p className="font-medium">{field.title}</p>
                        {field.description && (
                          <p className="text-sm text-muted-foreground">{field.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {getFieldLabel(field.field_type)}
                          {field.is_required && " • Obrigatório"}
                        </p>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingField(null)}
                      >
                        Fechar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add field button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full border-2 border-dashed border-black/20 rounded-lg p-4 flex items-center justify-center gap-2 hover:border-black/40 hover:bg-muted/20 transition-colors cursor-pointer">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">Adicionar Campo</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          {FIELD_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.id}
              onClick={() => addField(type.id)}
              className="cursor-pointer"
            >
              <type.icon className="h-4 w-4 mr-2" />
              {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
