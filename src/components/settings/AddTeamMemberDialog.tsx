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
      <DialogContent className="sm:max-w-[640px] bg-white border-0 shadow-2xl p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-gray-900 text-xl font-semibold">Novo membro</DialogTitle>
              <DialogDescription className="text-gray-500 text-sm mt-0.5">
                Adicione um novo membro à equipe
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 pb-6 space-y-5">
          {/* Two columns for name and email */}
          <div className="grid grid-cols-2 gap-4">
            {/* Name field */}
            <div className="space-y-2">
              <Label htmlFor="member-name" className="text-sm font-medium text-gray-700">
                Nome completo
              </Label>
              <div className="relative">
                <Input
                  id="member-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome"
                  className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 placeholder:text-gray-400"
                />
                <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="member-email" className="text-sm font-medium text-gray-700">
                E-mail
              </Label>
              <div className="relative">
                <Input
                  id="member-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 placeholder:text-gray-400"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Two columns for phone and password */}
          <div className="grid grid-cols-2 gap-4">
            {/* Phone field */}
            <div className="space-y-2">
              <Label htmlFor="member-phone" className="text-sm font-medium text-gray-700">
                Telefone <span className="text-gray-400 font-normal">(opcional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="member-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 placeholder:text-gray-400"
                />
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="member-password" className="text-sm font-medium text-gray-700">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="member-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 pr-10 h-12 bg-gray-50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 placeholder:text-gray-400"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 hover:bg-gray-100 rounded-lg"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Role field - full width */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Função</Label>
            <div className="relative">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl shadow-xl">
                  {roles.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="py-3 rounded-lg focus:bg-gray-50">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{r.label}</span>
                        <span className="text-xs text-gray-500">{r.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50/80 border-t border-gray-100 flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-12 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 font-medium"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => createMember.mutate()}
            disabled={createMember.isPending}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30"
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
