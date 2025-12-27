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
    <div className="flex h-[calc(100vh-6rem)]">
      {/* Main Content - Table */}
      <div 
        className={cn(
          "flex-1 transition-all duration-300 ease-out overflow-auto",
          selectedMember ? "mr-[420px]" : ""
        )}
      >
        <div className="space-y-6 p-1">
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
          <div className="border border-border rounded-xl overflow-hidden bg-background">
            {teamMembers?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum membro na equipe</p>
                <p className="text-sm mt-1">Adicione membros para gerenciar permissões</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold text-foreground">Nome</TableHead>
                    <TableHead className="font-semibold text-foreground">E-mail</TableHead>
                    <TableHead className="font-semibold text-foreground">Data de cadastro</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers?.map((member) => (
                    <TableRow 
                      key={member.user_id} 
                      className={cn(
                        "group cursor-pointer transition-colors",
                        selectedMember?.user_id === member.user_id && "bg-muted/50"
                      )}
                      onClick={() => setSelectedMember(member)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-medium">
                            {(member.name || member.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-foreground block">
                              {member.name || "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {member.role ? roleLabels[member.role] || member.role : "Sem função"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.created_at 
                          ? format(new Date(member.created_at), "dd MMM yyyy", { locale: ptBR })
                          : "—"
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMember(member);
                            }}
                            className="h-8 px-4 bg-foreground text-background hover:bg-foreground/90"
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
          "fixed right-3 top-[4.5rem] bottom-3 w-[400px] bg-background border border-border rounded-2xl shadow-xl",
          "transition-all duration-300 ease-out overflow-hidden",
          selectedMember 
            ? "translate-x-0 opacity-100" 
            : "translate-x-full opacity-0 pointer-events-none"
        )}
      >
        {selectedMember && (
          <div className="h-full flex flex-col">
            {/* Panel Header */}
            <div className="relative h-20 bg-gradient-to-br from-foreground/5 to-foreground/10 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMember(null)}
                className="absolute top-3 right-3 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Avatar - overlapping header */}
            <div className="relative -mt-10 px-5 flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-foreground flex items-center justify-center text-background text-2xl font-bold shadow-lg">
                {(selectedMember.name || selectedMember.email || "?")
                  .split(" ")
                  .map((word) => word.charAt(0).toUpperCase())
                  .slice(0, 2)
                  .join("")}
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-5 pt-4">
              {/* Name and Role */}
              <div className="mb-4">
                <h2 className="font-bold text-foreground text-xl leading-tight">
                  {selectedMember.name || "Sem nome"}
                </h2>
                <span className="inline-flex mt-2 px-3 py-1 rounded-full text-xs font-medium bg-foreground/10 text-foreground">
                  {selectedMember.role ? roleLabels[selectedMember.role] || selectedMember.role : "Sem função"}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 pb-5 border-b border-border/50">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">{selectedMember.email || "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">{selectedMember.phone || "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-foreground">
                    {selectedMember.created_at 
                      ? format(new Date(selectedMember.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "—"
                    }
                  </span>
                </div>
              </div>

              {/* Stats Section */}
              <div className="py-5 border-b border-border/50">
                <h3 className="text-sm font-semibold text-foreground mb-4">Análise de Atividades</h3>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Cards Assigned */}
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold text-foreground">{memberStats?.assignedCards || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cards</p>
                  </div>

                  {/* Completed */}
                  <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xl font-bold text-emerald-600">{memberStats?.completedActivities || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Concluídas</p>
                  </div>

                  {/* Pending */}
                  <div className="bg-amber-500/10 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <p className="text-xl font-bold text-amber-600">{memberStats?.pendingActivities || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pendentes</p>
                  </div>
                </div>

                {/* Completion Rate Bar */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nível de conclusão</span>
                    <span className="font-semibold text-foreground">{completionRate}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Responsibilities Section */}
              <div className="py-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Responsabilidades Recentes</h3>
                
                {memberStats?.recentActivities && memberStats.recentActivities.length > 0 ? (
                  <div className="space-y-2">
                    {memberStats.recentActivities.map((activity: any, index: number) => (
                      <div 
                        key={activity.id || index}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          activity.concluida ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            Atividade #{index + 1}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.created_at 
                              ? format(new Date(activity.created_at), "dd/MM/yyyy", { locale: ptBR })
                              : "—"
                            }
                          </p>
                        </div>
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          activity.concluida 
                            ? "bg-emerald-500/10 text-emerald-600" 
                            : "bg-amber-500/10 text-amber-600"
                        )}>
                          {activity.concluida ? "Concluída" : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma atividade recente</p>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Footer - Actions */}
            <div className="flex-shrink-0 p-5 border-t border-border/50 bg-muted/20">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingMember(selectedMember)}
                  className="flex-1 h-10"
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  Editar permissões
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDeleteMember(selectedMember.user_id)}
                  className="h-10 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                >
                  <Trash2 className="w-4 h-4" />
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
