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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
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

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "suporte", label: "Suporte" },
  { value: "gestor_trafego", label: "Gestor de Tráfego" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
];

export function EditPermissionsDialog({
  open,
  onOpenChange,
  member,
}: EditPermissionsDialogProps) {
  const [name, setName] = useState(member.name || "");
  const [role, setRole] = useState(member.role || "");
  const [canAccessWhatsapp, setCanAccessWhatsapp] = useState(false);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedSubOrigins, setSelectedSubOrigins] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Initialize state from member
  useEffect(() => {
    setName(member.name || "");
    setRole(member.role || "");
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

  // Save member data and permissions via edge function (admin-only)
  const saveMember = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Nome é obrigatório");
      if (!role) throw new Error("Selecione a função");

      const { data, error } = await supabase.functions.invoke("update-team-member", {
        body: {
          user_id: member.user_id,
          name: trimmedName,
          role,
          can_access_whatsapp: canAccessWhatsapp,
          allowed_origin_ids: selectedOrigins,
          allowed_sub_origin_ids: selectedSubOrigins,
        },
      });

      if (error) {
        let msg = error.message || "Erro ao salvar";
        const jsonMatch = msg.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error) msg = parsed.error;
          } catch {
            // ignore
          }
        }
        throw new Error(msg);
      }

      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro atualizado!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar alterações");
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
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do membro"
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show permissions only for non-admin roles */}
          {role !== "admin" && (
            <>
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
            </>
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
              onClick={() => saveMember.mutate()}
              disabled={saveMember.isPending}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              {saveMember.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
