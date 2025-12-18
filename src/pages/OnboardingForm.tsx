import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingForm {
  id: string;
  name: string;
  slug: string;
  is_sequential: boolean;
  lead_id: string;
}

interface OnboardingField {
  id: string;
  form_id: string;
  field_type: string;
  title: string;
  description: string | null;
  options: any; // JSON from database - will be string[]
  is_required: boolean;
  ordem: number;
}

export default function OnboardingForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [fields, setFields] = useState<OnboardingField[]>([]);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchForm = async () => {
      if (!slug) return;

      const { data: formData, error } = await supabase
        .from("lead_onboarding_forms")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error || !formData) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setForm(formData);

      const { data: fieldsData } = await supabase
        .from("lead_onboarding_fields")
        .select("*")
        .eq("form_id", formData.id)
        .order("ordem", { ascending: true }) as { data: OnboardingField[] | null };

      setFields(fieldsData || []);
      setIsLoading(false);
    };

    fetchForm();
  }, [slug]);

  const handleInputChange = (fieldId: string, value: string | string[]) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setResponses((prev) => {
      const current = (prev[fieldId] as string[]) || [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      } else {
        return { ...prev, [fieldId]: current.filter((o) => o !== option) };
      }
    });
  };

  const handleSubmit = async () => {
    if (!form) return;

    // Validate required fields
    for (const field of fields) {
      if (field.is_required) {
        const response = responses[field.id];
        if (!response || (Array.isArray(response) && response.length === 0)) {
          toast.error(`Por favor, preencha: ${field.title}`);
          return;
        }
      }
    }

    setIsSubmitting(true);

    // Save responses
    const responsesToInsert = fields.map((field) => ({
      form_id: form.id,
      field_id: field.id,
      response_value: typeof responses[field.id] === "string" ? (responses[field.id] as string) : null,
      response_options:
        Array.isArray(responses[field.id]) ? responses[field.id] : null,
    }));

    const { error } = await supabase
      .from("lead_onboarding_responses")
      .insert(responsesToInsert);

    if (error) {
      toast.error("Erro ao enviar respostas");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  const renderField = (field: OnboardingField) => {
    switch (field.field_type) {
      case "text_short":
        return (
          <Input
            value={(responses[field.id] as string) || ""}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder="Digite sua resposta"
          />
        );

      case "text_long":
        return (
          <Textarea
            value={(responses[field.id] as string) || ""}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder="Digite sua resposta"
            className="min-h-[100px]"
          />
        );

      case "number":
        return (
          <Input
            value={(responses[field.id] as string) || ""}
            onChange={(e) => {
              // Remove non-numeric characters except comma and dot
              let value = e.target.value.replace(/[^\d,\.]/g, "");
              // Replace dot with comma for BR format
              value = value.replace(".", ",");
              // Only allow one comma
              const parts = value.split(",");
              if (parts.length > 2) {
                value = parts[0] + "," + parts.slice(1).join("");
              }
              // Limit decimals to 2
              if (parts.length === 2 && parts[1].length > 2) {
                value = parts[0] + "," + parts[1].slice(0, 2);
              }
              handleInputChange(field.id, value);
            }}
            placeholder="R$ 0,00"
            className="font-mono"
          />
        );

      case "dropdown":
        return (
          <Select
            value={(responses[field.id] as string) || ""}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup
            value={(responses[field.id] as string) || ""}
            onValueChange={(value) => handleInputChange(field.id, value)}
          >
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${index}`} />
                <Label htmlFor={`${field.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${index}`}
                  checked={((responses[field.id] as string[]) || []).includes(option)}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(field.id, option, checked as boolean)
                  }
                />
                <Label htmlFor={`${field.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <h1 className="text-xl font-semibold mb-2">Formulário não encontrado</h1>
            <p className="text-muted-foreground">
              Este formulário não existe ou não está disponível.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Obrigado!</h1>
            <p className="text-muted-foreground">
              Suas respostas foram enviadas com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sequential mode
  if (form?.is_sequential && fields.length > 0) {
    const currentField = fields[currentStep];
    const isLastStep = currentStep === fields.length - 1;
    const canProceed = !currentField.is_required || 
      (responses[currentField.id] && 
        (typeof responses[currentField.id] === "string" 
          ? responses[currentField.id] !== "" 
          : (responses[currentField.id] as string[]).length > 0));

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Progress bar */}
        <div className="w-full h-1 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-[#F40000] to-[#A10000] transition-all duration-300"
            style={{ width: `${((currentStep + 1) / fields.length) * 100}%` }}
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-2 text-sm text-muted-foreground">
                  Pergunta {currentStep + 1} de {fields.length}
                </div>
                <h2 className="text-2xl font-semibold mb-2">{currentField.title}</h2>
                {currentField.description && (
                  <p className="text-muted-foreground mb-6">{currentField.description}</p>
                )}
                <div className="mb-8">{renderField(currentField)}</div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              {isLastStep ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed || isSubmitting}
                  className="bg-gradient-to-r from-[#F40000] to-[#A10000]"
                >
                  {isSubmitting ? "Enviando..." : "Enviar"}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentStep((s) => s + 1)}
                  disabled={!canProceed}
                >
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // All fields at once mode
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold mb-6 text-center">{form?.name}</h1>

        <div className="space-y-6">
          {fields.map((field) => (
            <Card key={field.id} className="border-[#00000010] shadow-none">
              <CardContent className="p-6">
                <Label className="text-base font-medium">
                  {field.title}
                  {field.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.description && (
                  <p className="text-sm text-muted-foreground mb-3">{field.description}</p>
                )}
                <div className="mt-3">{renderField(field)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-[#F40000] to-[#A10000]"
          >
            {isSubmitting ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
