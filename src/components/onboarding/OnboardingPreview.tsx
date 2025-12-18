import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronRight, ChevronLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import scaleLogo from "@/assets/scale-logo-red.png";

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

interface OnboardingPreviewProps {
  fields: OnboardingField[];
  isSequential: boolean;
  formName: string;
}

export function OnboardingPreview({ fields, isSequential, formName }: OnboardingPreviewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});

  if (fields.length === 0) {
    return (
      <div className="bg-background rounded-2xl border border-[#00000010] shadow-lg overflow-hidden min-h-[500px] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#00000010]">
          <img src={scaleLogo} alt="Scale" className="h-10 w-auto mx-auto" />
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              Adicione campos ao formulário para ver a pré-visualização
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentField = isSequential ? fields[currentStep] : null;

  const renderField = (field: OnboardingField) => {
    switch (field.field_type) {
      case "text_short":
        return (
          <Input
            placeholder="Digite sua resposta..."
            value={responses[field.id] || ""}
            onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
            className="bg-background"
          />
        );
      
      case "text_long":
        return (
          <Textarea
            placeholder="Digite sua resposta..."
            value={responses[field.id] || ""}
            onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
            className="bg-background min-h-[100px] resize-none"
          />
        );
      
      case "number":
        return (
          <Input
            type="text"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={responses[field.id] || ""}
            onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
            className="bg-background"
          />
        );
      
      case "dropdown":
        return (
          <Select
            value={responses[field.id] || ""}
            onValueChange={(value) => setResponses({ ...responses, [field.id]: value })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: string, index: number) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((option: string, index: number) => {
              const currentValues = (responses[field.id] as string[]) || [];
              const isChecked = currentValues.includes(option);
              
              return (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    id={`${field.id}-${index}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setResponses({ ...responses, [field.id]: [...currentValues, option] });
                      } else {
                        setResponses({ ...responses, [field.id]: currentValues.filter((v) => v !== option) });
                      }
                    }}
                  />
                  <Label htmlFor={`${field.id}-${index}`} className="text-sm cursor-pointer">
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        );
      
      default:
        return null;
    }
  };

  // Sequential mode
  if (isSequential && currentField) {
    const progress = ((currentStep + 1) / fields.length) * 100;
    
    return (
      <div className="bg-background rounded-2xl border border-[#00000010] shadow-lg overflow-hidden min-h-[500px] flex flex-col">
        {/* Progress bar */}
        <div className="h-2 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-[#F40000] to-[#A10000] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-6 flex justify-center">
          <img src={scaleLogo} alt="Scale" className="h-10 w-auto" />
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col justify-center px-8 pb-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{currentField.title}</h2>
              {currentField.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentField.description}</p>
              )}
              {currentField.is_required && (
                <span className="text-xs text-destructive">* Obrigatório</span>
              )}
            </div>
            
            <div className="mt-4">
              {renderField(currentField)}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-6 border-t border-[#00000010] flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          
          {currentStep < fields.length - 1 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000]"
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              className="bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000]"
            >
              Enviar
            </Button>
          )}
        </div>
      </div>
    );
  }

  // All fields at once mode
  return (
    <div className="bg-background rounded-2xl border border-[#00000010] shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#00000010]">
        <img src={scaleLogo} alt="Scale" className="h-10 w-auto mx-auto" />
      </div>
      
      {/* Fields */}
      <div className="p-6 space-y-6">
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <div>
              <Label className="font-medium">
                {field.title}
                {field.is_required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
              )}
            </div>
            {renderField(field)}
          </div>
        ))}
        
        {/* Submit button */}
        <Button
          className="w-full bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D40000] hover:to-[#910000]"
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}
