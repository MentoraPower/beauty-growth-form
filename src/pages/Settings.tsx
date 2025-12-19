import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { useAppSettings } from "@/hooks/useAppSettings";
import { CalendarDays } from "lucide-react";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"profile" | "team" | "customize">("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();
  const { settings, updateSetting } = useAppSettings();

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["current-user-is-admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      return !!data;
    },
  });

  // Fetch current user profile
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
      
      if (data) {
        setName(data.name || "");
        setEmail(data.email || user.email || "");
      } else {
        setEmail(user.email || "");
      }
      
      return data;
    },
  });

  // Update profile mutation
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
    },
    onError: (error) => {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao atualizar perfil");
    },
  });

  const tabs = [
    { id: "profile" as const, label: "Perfil" },
    ...(isAdmin ? [{ id: "team" as const, label: "Equipe" }] : []),
    { id: "customize" as const, label: "Personalizado" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie seu perfil e equipe
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "profile" && (
        <div className="max-w-md space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado
              </p>
            </div>
          </div>

          <Button
            onClick={() => updateProfile.mutate()}
            disabled={updateProfile.isPending}
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            {updateProfile.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      )}

      {activeTab === "team" && <TeamManagement />}

      {activeTab === "customize" && (
        <div className="max-w-md space-y-6">
          <div className="space-y-4">
            {/* Agenda Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Agenda</p>
                  <p className="text-xs text-muted-foreground">
                    Mostrar a Agenda no menu lateral
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.agendaEnabled}
                onCheckedChange={(checked) => {
                  updateSetting("agendaEnabled", checked);
                  toast.success(checked ? "Agenda ativada" : "Agenda desativada");
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
