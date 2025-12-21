import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EditableField } from "./EditableField";
import { Skeleton } from "@/components/ui/skeleton";
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

  useEffect(() => {
    if (!subOriginId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

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

  return (
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
  );
}
