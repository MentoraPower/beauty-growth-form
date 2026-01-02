import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Bell, Shield, Palette, HelpCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "profile" | "notifications" | "security" | "appearance" | "help";

const menuItems: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "security", label: "Segurança", icon: Shield },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "help", label: "Ajuda", icon: HelpCircle },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      return { profile: data, user };
    },
    enabled: open,
  });

  useEffect(() => {
    if (profile?.profile) {
      setName(profile.profile.name || "");
      setEmail(profile.profile.email || profile.user?.email || "");
    } else if (profile?.user) {
      setEmail(profile.user.email || "");
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado");

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          name,
          email,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Perfil atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao atualizar perfil");
    },
  });

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Perfil</h2>
              <p className="text-sm text-zinc-500">Gerencie suas informações pessoais</p>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50" style={{ border: '1px solid #00000008' }}>
              <div className="h-14 w-14 rounded-full bg-zinc-200 flex items-center justify-center">
                <User className="h-6 w-6 text-zinc-500" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">{name || "Usuário"}</p>
                <p className="text-sm text-zinc-500">{email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-700">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-white border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-700">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled
                  className="bg-zinc-50 border-zinc-200"
                />
                <p className="text-xs text-zinc-400">
                  O e-mail não pode ser alterado
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => updateProfile.mutate()}
                disabled={updateProfile.isPending || isLoading}
                className="bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        );
      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Notificações</h2>
              <p className="text-sm text-zinc-500">Configure como você recebe notificações</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-zinc-50 text-zinc-400">
              Em breve
            </div>
          </div>
        );
      case "security":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Segurança</h2>
              <p className="text-sm text-zinc-500">Gerencie sua senha e autenticação</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-zinc-50 text-zinc-400">
              Em breve
            </div>
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Aparência</h2>
              <p className="text-sm text-zinc-500">Personalize a interface do sistema</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-zinc-50 text-zinc-400">
              Em breve
            </div>
          </div>
        );
      case "help":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Ajuda</h2>
              <p className="text-sm text-zinc-500">Suporte e documentação</p>
            </div>
            <div className="flex items-center justify-center h-40 rounded-xl bg-zinc-50 text-zinc-400">
              Em breve
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Configurações</DialogTitle>
        
        <div className="flex h-[480px]">
          {/* Sidebar Menu */}
          <div className="w-[200px] bg-zinc-50 p-3 flex flex-col gap-1" style={{ borderRight: '1px solid #00000010' }}>
            <div className="px-2 py-3 mb-2">
              <h3 className="text-sm font-semibold text-zinc-900">Configurações</h3>
            </div>
            
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg transition-colors text-left",
                  activeTab === item.id
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-600 hover:bg-white/50 hover:text-zinc-900"
                )}
                style={activeTab === item.id ? { border: '1px solid #00000008' } : undefined}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {activeTab === item.id && (
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                )}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}