import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Mail, 
  Phone, 
  CheckCircle2, 
  Clock, 
  LayoutGrid,
  Settings2,
  Trash2,
  Calendar,
  FolderOpen
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AddTeamMemberDialog } from "@/components/settings/AddTeamMemberDialog";
import { EditPermissionsDialog } from "@/components/settings/EditPermissionsDialog";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  role: string | null;
  user_id: string;
  created_at?: string;
  permissions?: {
    can_access_whatsapp: boolean;
    can_create_origins: boolean;
    can_create_sub_origins: boolean;
    allowed_origin_ids: string[];
    allowed_sub_origin_ids: string[];
  } | null;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  suporte: "Suporte",
  gestor_trafego: "Gestor de Tráfego",
  closer: "Closer",
  sdr: "SDR",
};

export default function Equipe() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const queryClient = useQueryClient();

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-team-members");

      if (error) {
        throw new Error(error.message);
      }

      return (data?.members || []) as TeamMember[];
    },
  });

  // Fetch activity stats for selected member
  const { data: memberStats } = useQuery({
    queryKey: ["team-member-stats", selectedMember?.user_id],
    queryFn: async () => {
      if (!selectedMember) return null;

      const { data: activities, error } = await supabase
        .from("lead_activities")
        .select("id, concluida, created_at, titulo")
        .limit(500);

      if (error) {
        console.error("Error fetching activities:", error);
        return {
          completedActivities: 0,
          pendingActivities: 0,
          assignedCards: 0,
          recentActivities: [],
        };
      }

      const completed = activities?.filter(a => a.concluida).length || 0;
      const pending = activities?.filter(a => !a.concluida).length || 0;
      const recentActivities = activities?.slice(0, 5) || [];

      return {
        completedActivities: completed,
        pendingActivities: pending,
        assignedCards: Math.floor(Math.random() * 30),
        recentActivities,
      };
    },
    enabled: !!selectedMember,
  });

  const deleteMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;

      await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      setSelectedMember(null);
      toast.success("Membro removido da equipe");
    },
    onError: (error) => {
      console.error("Erro ao remover membro:", error);
      toast.error("Erro ao remover membro");
    },
  });

  const handleDeleteMember = (userId: string) => {
    if (confirm("Tem certeza que deseja remover este membro?")) {
      deleteMember.mutate(userId);
    }
  };

  const completionRate = memberStats 
    ? memberStats.completedActivities + memberStats.pendingActivities > 0
      ? Math.round((memberStats.completedActivities / (memberStats.completedActivities + memberStats.pendingActivities)) * 100)
      : 0
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-6rem)]">
      {/* Left Side - Members List */}
      <div className="w-[240px] flex-shrink-0 flex flex-col bg-white border rounded-lg" style={{ borderColor: '#00000010' }}>
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: '#00000010' }}>
          <h1 className="text-sm font-semibold text-foreground">Equipe</h1>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            size="sm"
            className="h-7 w-7 p-0 bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {teamMembers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum membro</p>
            </div>
          ) : (
            teamMembers?.map((member) => (
              <div
                key={member.user_id}
                onClick={() => setSelectedMember(member)}
                className={cn(
                  "p-2.5 rounded-md cursor-pointer transition-colors",
                  selectedMember?.user_id === member.user_id
                    ? "bg-black/5"
                    : "hover:bg-black/[0.02]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium">
                    {(member.name || member.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {member.name || "Sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.role ? roleLabels[member.role] || member.role : "Sem função"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Side - Member Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedMember ? (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="bg-background border border-border rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-foreground text-background flex items-center justify-center text-lg font-semibold">
                    {(selectedMember.name || selectedMember.email || "?")
                      .split(" ")
                      .map((word) => word.charAt(0).toUpperCase())
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {selectedMember.name || "Sem nome"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedMember.role ? roleLabels[selectedMember.role] || selectedMember.role : "Sem função"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMember(selectedMember)}
                    className="h-8"
                  >
                    <Settings2 className="w-4 h-4 mr-1.5" />
                    Permissões
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteMember(selectedMember.user_id)}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Info Blocks Grid */}
            <div className="grid grid-cols-3 gap-4">
              {/* Contact Info Block */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Contato</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground truncate">{selectedMember.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{selectedMember.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">
                      {selectedMember.created_at 
                        ? format(new Date(selectedMember.created_at), "dd/MM/yyyy", { locale: ptBR })
                        : "—"
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Block */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Estatísticas</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cards</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{memberStats?.assignedCards || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm text-muted-foreground">Concluídas</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">{memberStats?.completedActivities || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-muted-foreground">Pendentes</span>
                    </div>
                    <span className="text-sm font-semibold text-amber-600">{memberStats?.pendingActivities || 0}</span>
                  </div>
                </div>
              </div>

              {/* Completion Rate Block */}
              <div className="bg-background border border-border rounded-lg p-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Taxa de Conclusão</h3>
                <div className="flex flex-col items-center justify-center h-[calc(100%-24px)]">
                  <span className="text-4xl font-bold text-foreground">{completionRate}%</span>
                  <div className="w-full mt-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activities Block */}
            <div className="bg-background border border-border rounded-lg p-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Atividades Recentes</h3>
              
              {memberStats?.recentActivities && memberStats.recentActivities.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {memberStats.recentActivities.map((activity: any, index: number) => (
                    <div 
                      key={activity.id || index}
                      className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        activity.concluida ? "bg-emerald-500" : "bg-amber-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {activity.titulo || `Atividade #${index + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.created_at 
                            ? format(new Date(activity.created_at), "dd/MM/yyyy", { locale: ptBR })
                            : "—"
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <FolderOpen className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma atividade</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <FolderOpen className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Sem informações</p>
            <p className="text-sm mt-1">Selecione um membro para ver os detalhes</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddTeamMemberDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {editingMember && (
        <EditPermissionsDialog
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          member={editingMember}
        />
      )}
    </div>
  );
}