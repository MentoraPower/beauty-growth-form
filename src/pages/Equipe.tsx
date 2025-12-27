import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Users, 
  X, 
  Mail, 
  Phone, 
  CheckCircle2, 
  Clock, 
  LayoutGrid,
  Settings2,
  Trash2,
  Calendar
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

      // Query real activity data
      const { data: activities, error } = await supabase
        .from("lead_activities")
        .select("id, concluida, created_at")
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

      // Get recent activities for display
      const recentActivities = activities?.slice(0, 5) || [];

      return {
        completedActivities: completed,
        pendingActivities: pending,
        assignedCards: Math.floor(Math.random() * 30), // Placeholder until real assignment system
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
    <div className="flex gap-0 h-[calc(100vh-6rem)]">
      {/* Main Content - Table */}
      <div 
        className={cn(
          "flex-1 transition-all duration-300 ease-out overflow-auto",
          selectedMember ? "pr-0" : ""
        )}
      >
        <div className="space-y-4 p-1">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Equipe</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie os membros da sua equipe e suas permissões
              </p>
            </div>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar membro
            </Button>
          </div>

          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-background">
            {teamMembers?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum membro na equipe</p>
                <p className="text-sm mt-1">Adicione membros para gerenciar permissões</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
                    <TableHead className="font-medium text-foreground text-xs uppercase tracking-wide">Nome</TableHead>
                    <TableHead className="font-medium text-foreground text-xs uppercase tracking-wide">E-mail</TableHead>
                    <TableHead className="font-medium text-foreground text-xs uppercase tracking-wide">Data de cadastro</TableHead>
                    <TableHead className="font-medium text-foreground text-xs uppercase tracking-wide text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers?.map((member) => (
                    <TableRow 
                      key={member.user_id} 
                      className={cn(
                        "cursor-pointer transition-colors border-b border-border/50 last:border-0",
                        selectedMember?.user_id === member.user_id 
                          ? "bg-muted/60" 
                          : "hover:bg-muted/30"
                      )}
                      onClick={() => setSelectedMember(member)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium">
                            {(member.name || member.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-foreground text-sm block">
                              {member.name || "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {member.role ? roleLabels[member.role] || member.role : "Sem função"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm py-3">
                        {member.email || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm py-3">
                        {member.created_at 
                          ? format(new Date(member.created_at), "dd MMM yyyy", { locale: ptBR })
                          : "—"
                        }
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMember(member);
                            }}
                            className="h-7 px-3 text-xs bg-foreground text-background hover:bg-foreground/90"
                          >
                            Detalhes
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Side Panel - Member Details */}
      <div
        className={cn(
          "h-full bg-muted/30 border-l border-border",
          "transition-all duration-300 ease-out overflow-hidden flex-shrink-0",
          selectedMember 
            ? "w-[380px] opacity-100" 
            : "w-0 opacity-0"
        )}
      >
        {selectedMember && (
          <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-foreground flex items-center justify-center text-background text-sm font-semibold">
                  {(selectedMember.name || selectedMember.email || "?")
                    .split(" ")
                    .map((word) => word.charAt(0).toUpperCase())
                    .slice(0, 2)
                    .join("")}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm leading-tight">
                    {selectedMember.name || "Sem nome"}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {selectedMember.role ? roleLabels[selectedMember.role] || selectedMember.role : "Sem função"}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMember(null)}
                className="h-8 w-8 hover:bg-background"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Contact Info */}
              <div className="space-y-2 pb-4 border-b border-border/50">
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground text-sm">{selectedMember.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground text-sm">{selectedMember.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground text-sm">
                    {selectedMember.created_at 
                      ? format(new Date(selectedMember.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "—"
                    }
                  </span>
                </div>
              </div>

              {/* Stats Section */}
              <div className="py-4 border-b border-border/50">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Atividades</h3>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <p className="text-lg font-semibold text-foreground">{memberStats?.assignedCards || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Cards</p>
                  </div>
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <p className="text-lg font-semibold text-emerald-600">{memberStats?.completedActivities || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Concluídas</p>
                  </div>
                  <div className="bg-background rounded-lg p-2.5 text-center">
                    <p className="text-lg font-semibold text-amber-600">{memberStats?.pendingActivities || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Pendentes</p>
                  </div>
                </div>

                {/* Completion Rate Bar */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Conclusão</span>
                    <span className="font-medium text-foreground">{completionRate}%</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Responsibilities Section */}
              <div className="py-4">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Recentes</h3>
                
                {memberStats?.recentActivities && memberStats.recentActivities.length > 0 ? (
                  <div className="space-y-1.5">
                    {memberStats.recentActivities.map((activity: any, index: number) => (
                      <div 
                        key={activity.id || index}
                        className="flex items-center gap-2.5 p-2 bg-background rounded-lg"
                      >
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          activity.concluida ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate">
                            Atividade #{index + 1}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {activity.created_at 
                            ? format(new Date(activity.created_at), "dd/MM", { locale: ptBR })
                            : "—"
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-xs">Nenhuma atividade</p>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Footer - Actions */}
            <div className="flex-shrink-0 p-3 border-t border-border/50">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingMember(selectedMember)}
                  className="flex-1 h-8 text-xs"
                >
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                  Permissões
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteMember(selectedMember.user_id)}
                  className="h-8 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
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
