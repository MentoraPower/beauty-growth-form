import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, UserPlus, Mail, Lock, Briefcase, Phone } from "lucide-react";

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roles = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema" },
  { value: "suporte", label: "Suporte", description: "Atendimento ao cliente" },
  { value: "gestor_trafego", label: "Gestor de Tráfego", description: "Gerencia campanhas" },
  { value: "closer", label: "Closer", description: "Fechamento de vendas" },
  { value: "sdr", label: "SDR", description: "Prospecção de leads" },
];

export function AddTeamMemberDialog({
  open,
  onOpenChange,
}: AddTeamMemberDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("");
  const queryClient = useQueryClient();

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setShowPassword(false);
    setRole("");
  };

  const createMember = useMutation({
    mutationFn: async () => {
      if (!name || !email || !password || !role) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      const { data, error } = await supabase.functions.invoke("create-team-member", {
        body: { name, email, phone, password, role },
      });

      if (error) {
        let errorMessage = error.message || "Erro ao criar membro";
        const jsonMatch = errorMessage.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error) {
              errorMessage = parsed.error;
            }
          } catch {
            // Keep original error message
          }
        }
        throw new Error(errorMessage);
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro adicionado com sucesso!");
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Erro ao criar membro:", error);
      toast.error(error.message || "Erro ao criar membro");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-foreground px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-background" />
            </div>
            <div>
              <DialogTitle className="text-background text-lg">Novo membro</DialogTitle>
              <DialogDescription className="text-background/60 text-sm">
                Adicione um novo membro à equipe
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="member-name" className="text-sm font-medium">
              Nome completo
            </Label>
            <div className="relative">
              <Input
                id="member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite o nome"
                className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
              />
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Email field */}
          <div className="space-y-2">
            <Label htmlFor="member-email" className="text-sm font-medium">
              E-mail
            </Label>
            <div className="relative">
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Phone field */}
          <div className="space-y-2">
            <Label htmlFor="member-phone" className="text-sm font-medium">
              Telefone <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <div className="relative">
              <Input
                id="member-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
              />
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <Label htmlFor="member-password" className="text-sm font-medium">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="member-password"
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

          {/* Role field */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Função</Label>
            <div className="relative">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
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
            onClick={() => createMember.mutate()}
            disabled={createMember.isPending}
            className="flex-1 h-11 bg-foreground text-background hover:bg-foreground/90"
          >
            {createMember.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              "Adicionar membro"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
