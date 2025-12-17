import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Loader2, Eye, EyeOff, UserCog, Mail, Lock, Briefcase, User } from "lucide-react";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  user_id: string;
  permissions?: {
    can_access_whatsapp: boolean;
    can_create_origins: boolean;
    can_create_sub_origins: boolean;
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
  const [email, setEmail] = useState(member.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(member.role || "");
  const [canAccessWhatsapp, setCanAccessWhatsapp] = useState(false);
  const [canCreateOrigins, setCanCreateOrigins] = useState(false);
  const [canCreateSubOrigins, setCanCreateSubOrigins] = useState(false);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedSubOrigins, setSelectedSubOrigins] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Initialize state from member
  useEffect(() => {
    setName(member.name || "");
    setEmail(member.email || "");
    setPassword("");
    setRole(member.role || "");
    if (member.permissions) {
      setCanAccessWhatsapp(member.permissions.can_access_whatsapp);
      setCanCreateOrigins(member.permissions.can_create_origins ?? false);
      setCanCreateSubOrigins(member.permissions.can_create_sub_origins ?? false);
      setSelectedOrigins(member.permissions.allowed_origin_ids);
      setSelectedSubOrigins(member.permissions.allowed_sub_origin_ids);
    } else {
      setCanAccessWhatsapp(false);
      setCanCreateOrigins(false);
      setCanCreateSubOrigins(false);
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
      const trimmedEmail = email.trim();
      if (!trimmedName) throw new Error("Nome é obrigatório");
      if (!trimmedEmail) throw new Error("E-mail é obrigatório");
      if (!role) throw new Error("Selecione a função");

      // Validate password if provided
      if (password && password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const { data, error } = await supabase.functions.invoke("update-team-member", {
        body: {
          user_id: member.user_id,
          name: trimmedName,
          email: trimmedEmail,
          password: password || undefined,
          role,
          can_access_whatsapp: canAccessWhatsapp,
          can_create_origins: canCreateOrigins,
          can_create_sub_origins: canCreateSubOrigins,
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
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="bg-foreground px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-background" />
            </div>
            <div>
              <DialogTitle className="text-background text-lg">Editar membro</DialogTitle>
              <DialogDescription className="text-background/60 text-sm">
                {member.name || member.email}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-sm font-medium">Nome</Label>
            <div className="relative">
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do membro"
                className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="edit-email" className="text-sm font-medium">E-mail</Label>
            <div className="relative">
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="edit-password" className="text-sm font-medium">
              Nova senha <span className="text-muted-foreground font-normal">(deixe em branco para manter)</span>
            </Label>
            <div className="relative">
              <Input
                id="edit-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Função</Label>
            <div className="relative">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors">
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
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Show permissions only for non-admin roles */}
          {role !== "admin" && (
            <>
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium mb-4">Permissões</p>

                {/* WhatsApp Access */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 mb-3">
                  <div>
                    <Label className="font-medium text-sm">Acesso ao WhatsApp</Label>
                    <p className="text-xs text-muted-foreground">
                      Permite acessar a página de WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={canAccessWhatsapp}
                    onCheckedChange={setCanAccessWhatsapp}
                  />
                </div>

                {/* Create Origins Permission */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 mb-3">
                  <div>
                    <Label className="font-medium text-sm">Criar Origens</Label>
                    <p className="text-xs text-muted-foreground">
                      Permite criar novas origens no CRM
                    </p>
                  </div>
                  <Switch
                    checked={canCreateOrigins}
                    onCheckedChange={setCanCreateOrigins}
                  />
                </div>

                {/* Create Sub-Origins Permission */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div>
                    <Label className="font-medium text-sm">Criar Sub-origens</Label>
                    <p className="text-xs text-muted-foreground">
                      Permite criar novas sub-origens no CRM
                    </p>
                  </div>
                  <Switch
                    checked={canCreateSubOrigins}
                    onCheckedChange={setCanCreateSubOrigins}
                  />
                </div>
              </div>

              {/* Origins Access */}
              <div className="space-y-3">
                <Label className="font-medium text-sm">Origens CRM</Label>
                <p className="text-xs text-muted-foreground">
                  Selecione as origens que o membro pode acessar
                </p>
                <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
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
                        className="text-sm cursor-pointer"
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
                  <Label className="font-medium text-sm">Sub-origens CRM</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione as sub-origens que o membro pode acessar
                  </p>
                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
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
                            className="text-sm cursor-pointer"
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border/50 flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => saveMember.mutate()}
            disabled={saveMember.isPending}
            className="flex-1 h-11 bg-foreground text-background hover:bg-foreground/90"
          >
            {saveMember.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}