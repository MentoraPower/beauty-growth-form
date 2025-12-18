import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Link as LinkIcon, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { OnboardingFormBuilder } from "./OnboardingFormBuilder";
import { Badge } from "@/components/ui/badge";

interface OnboardingForm {
  id: string;
  name: string;
  slug: string;
  is_sequential: boolean;
  is_active: boolean;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

interface OnboardingField {
  id: string;
  form_id: string;
  field_type: string;
  title: string;
  description: string | null;
  options: any;
  is_required: boolean;
  ordem: number;
}

interface OnboardingResponse {
  id: string;
  field_id: string;
  response_value: string | null;
  response_options: any;
  answered_at: string;
}

interface OnboardingSectionProps {
  leadId: string;
  leadName: string;
}

export function OnboardingSection({ leadId, leadName }: OnboardingSectionProps) {
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [fields, setFields] = useState<OnboardingField[]>([]);
  const [responses, setResponses] = useState<OnboardingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchOnboardingData = async () => {
    setIsLoading(true);
    
    // Fetch form
    const { data: formData } = await supabase
      .from("lead_onboarding_forms")
      .select("*")
      .eq("lead_id", leadId)
      .maybeSingle();
    
    if (formData) {
      setForm(formData);
      
      // Fetch fields
      const { data: fieldsData } = await supabase
        .from("lead_onboarding_fields")
        .select("*")
        .eq("form_id", formData.id)
        .order("ordem", { ascending: true });
      
      setFields(fieldsData || []);
      
      // Fetch responses
      const { data: responsesData } = await supabase
        .from("lead_onboarding_responses")
        .select("*")
        .eq("form_id", formData.id);
      
      setResponses(responsesData || []);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOnboardingData();
  }, [leadId]);

  const handleCreateForm = async () => {
    // Generate slug from lead name
    const slug = leadName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    
    const { data, error } = await supabase
      .from("lead_onboarding_forms")
      .insert({
        lead_id: leadId,
        name: "Onboarding",
        slug: `${slug}-${Date.now()}`,
        is_sequential: false,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      toast.error("Erro ao criar formulário");
      console.error(error);
      return;
    }
    
    setForm(data);
    setShowBuilder(true);
  };

  const getFormLink = () => {
    if (!form) return "";
    return `https://io.scalebeauty.com.br/form/${form.slug}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(getFormLink());
    setCopiedLink(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text_short: "Texto Curto",
      text_long: "Texto Longo",
      number: "Número (R$)",
      dropdown: "Menu Suspenso",
      checkbox: "Caixa de Seleção",
    };
    return labels[type] || type;
  };

  const getResponseForField = (fieldId: string) => {
    return responses.find((r) => r.field_id === fieldId);
  };

  if (showBuilder && form) {
    return (
      <OnboardingFormBuilder
        form={form}
        fields={fields}
        onClose={() => {
          setShowBuilder(false);
          fetchOnboardingData();
        }}
        onUpdate={() => fetchOnboardingData()}
      />
    );
  }

  return (
    <Card className="border-[#00000010] shadow-none mt-6">
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Onboarding
        </h3>

        {isLoading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="animate-pulse text-sm text-muted-foreground">Carregando...</div>
          </div>
        ) : !form ? (
          // Empty state - show add button
          <button
            onClick={handleCreateForm}
            className="w-full border-2 border-dashed border-black/20 rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:border-black/40 hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">Adicionar Onboarding</span>
          </button>
        ) : (
          // Form exists
          <div className="space-y-4">
            {/* Form header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{form.name}</span>
                {form.is_published ? (
                  <Badge className="bg-green-500">Publicado</Badge>
                ) : (
                  <Badge variant="secondary">Rascunho</Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowBuilder(true)}>
                Editar
              </Button>
            </div>

            {/* Published link */}
            {form.is_published && (
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {getFormLink()}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyLink}>
                  {copiedLink ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <a href={getFormLink()} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            )}

            {/* Fields and responses */}
            {fields.length > 0 && (
              <div className="space-y-3">
                {fields.map((field) => {
                  const response = getResponseForField(field.id);
                  return (
                    <div
                      key={field.id}
                      className="p-3 bg-muted/30 border border-[#00000010] rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{field.title}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {getFieldTypeLabel(field.field_type)}
                            </Badge>
                          </div>
                          {field.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {field.description}
                            </p>
                          )}
                        </div>
                        {response ? (
                          <Badge className="bg-green-500 text-[10px]">Respondido</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Aguardando</Badge>
                        )}
                      </div>
                      {response && (
                        <div className="mt-2 pt-2 border-t border-black/5">
                          <p className="text-sm">
                            {response.response_value || 
                              (response.response_options && Array.isArray(response.response_options) 
                                ? response.response_options.join(", ") 
                                : "-")}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
