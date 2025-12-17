import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  user_id: string;
  permissions?: {
    can_access_whatsapp: boolean;
    allowed_origin_ids: string[];
    allowed_sub_origin_ids: string[];
  } | null;
}

interface EditPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember;
}

export function EditPermissionsDialog({
  open,
  onOpenChange,
  member,
}: EditPermissionsDialogProps) {
  const [canAccessWhatsapp, setCanAccessWhatsapp] = useState(false);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedSubOrigins, setSelectedSubOrigins] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Initialize state from member permissions
  useEffect(() => {
    if (member.permissions) {
      setCanAccessWhatsapp(member.permissions.can_access_whatsapp);
      setSelectedOrigins(member.permissions.allowed_origin_ids);
      setSelectedSubOrigins(member.permissions.allowed_sub_origin_ids);
    } else {
      setCanAccessWhatsapp(false);
      setSelectedOrigins([]);
      setSelectedSubOrigins([]);
    }
  }, [member]);

  // Fetch origins
  const { data: origins } = useQuery({
    queryKey: ["crm-origins-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_origins")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sub-origins
  const { data: subOrigins } = useQuery({
    queryKey: ["crm-sub-origins-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_sub_origins")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  // Save permissions
  const savePermissions = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_permissions")
        .upsert({
          user_id: member.user_id,
          can_access_whatsapp: canAccessWhatsapp,
          allowed_origin_ids: selectedOrigins,
          allowed_sub_origin_ids: selectedSubOrigins,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Permissões atualizadas!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar permissões:", error);
      toast.error("Erro ao salvar permissões");
    },
  });

  const toggleOrigin = (originId: string) => {
    setSelectedOrigins((prev) =>
      prev.includes(originId)
        ? prev.filter((id) => id !== originId)
        : [...prev, originId]
    );
  };

  const toggleSubOrigin = (subOriginId: string) => {
    setSelectedSubOrigins((prev) =>
      prev.includes(subOriginId)
        ? prev.filter((id) => id !== subOriginId)
        : [...prev, subOriginId]
    );
  };

  // Filter sub-origins based on selected origins
  const filteredSubOrigins = subOrigins?.filter((so) =>
    selectedOrigins.includes(so.origin_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Permissões de {member.name || member.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* WhatsApp Access */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div>
              <Label className="font-medium">Acesso ao WhatsApp</Label>
              <p className="text-sm text-muted-foreground">
                Permite acessar a página de WhatsApp
              </p>
            </div>
            <Switch
              checked={canAccessWhatsapp}
              onCheckedChange={setCanAccessWhatsapp}
            />
          </div>

          {/* Origins Access */}
          <div className="space-y-3">
            <Label className="font-medium">Origens CRM</Label>
            <p className="text-sm text-muted-foreground">
              Selecione as origens que o membro pode acessar
            </p>
            <div className="space-y-2 p-4 rounded-lg border border-border">
              {origins?.map((origin) => (
                <div
                  key={origin.id}
                  className="flex items-center space-x-3"
                >
                  <Checkbox
                    id={`origin-${origin.id}`}
                    checked={selectedOrigins.includes(origin.id)}
                    onCheckedChange={() => toggleOrigin(origin.id)}
                  />
                  <label
                    htmlFor={`origin-${origin.id}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {origin.nome}
                  </label>
                </div>
              ))}
              {(!origins || origins.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma origem cadastrada
                </p>
              )}
            </div>
          </div>

          {/* Sub-Origins Access */}
          {selectedOrigins.length > 0 && (
            <div className="space-y-3">
              <Label className="font-medium">Sub-origens CRM</Label>
              <p className="text-sm text-muted-foreground">
                Selecione as sub-origens que o membro pode acessar
              </p>
              <div className="space-y-2 p-4 rounded-lg border border-border">
                {filteredSubOrigins?.map((subOrigin) => {
                  const origin = origins?.find(
                    (o) => o.id === subOrigin.origin_id
                  );
                  return (
                    <div
                      key={subOrigin.id}
                      className="flex items-center space-x-3"
                    >
                      <Checkbox
                        id={`suborigin-${subOrigin.id}`}
                        checked={selectedSubOrigins.includes(subOrigin.id)}
                        onCheckedChange={() => toggleSubOrigin(subOrigin.id)}
                      />
                      <label
                        htmlFor={`suborigin-${subOrigin.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {origin?.nome} → {subOrigin.nome}
                      </label>
                    </div>
                  );
                })}
                {(!filteredSubOrigins || filteredSubOrigins.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma sub-origem disponível para as origens selecionadas
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => savePermissions.mutate()}
              disabled={savePermissions.isPending}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              {savePermissions.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar permissões"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
