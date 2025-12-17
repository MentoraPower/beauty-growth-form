import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "suporte", label: "Suporte" },
  { value: "gestor_trafego", label: "Gestor de Tráfego" },
  { value: "closer", label: "Closer" },
  { value: "sdr", label: "SDR" },
];

export function AddTeamMemberDialog({
  open,
  onOpenChange,
}: AddTeamMemberDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const queryClient = useQueryClient();

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("");
  };

  const createMember = useMutation({
    mutationFn: async () => {
      if (!name || !email || !password || !role) {
        throw new Error("Preencha todos os campos");
      }

      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }

      // Create user via Supabase Admin API through edge function
      const { data, error } = await supabase.functions.invoke("create-team-member", {
        body: { name, email, password, role },
      });

      // Handle edge function errors - the error object or data might contain the message
      if (error) {
        // Try to extract error message from edge function response
        let errorMessage = error.message || "Erro ao criar membro";
        
        // Try to parse JSON from error message (edge function returns JSON in error body)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">Nome</Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do membro"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-email">E-mail</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-password">Senha</Label>
            <Input
              id="member-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

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

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createMember.mutate()}
              disabled={createMember.isPending}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              {createMember.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
