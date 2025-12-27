import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { AddTeamMemberDialog } from "@/components/settings/AddTeamMemberDialog";
import { EditPermissionsDialog } from "@/components/settings/EditPermissionsDialog";
import { TeamMemberCard } from "@/components/settings/TeamMemberCard";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
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

  // Fetch activity stats for team members
  const { data: memberStats } = useQuery({
    queryKey: ["team-member-stats", teamMembers?.map(m => m.user_id)],
    queryFn: async () => {
      if (!teamMembers || teamMembers.length === 0) return {};

      // For now, return mock stats - in production, you'd query real data
      const stats: Record<string, { completedActivities: number; pendingActivities: number; assignedCards: number }> = {};
      
      teamMembers.forEach((member) => {
        // Mock stats - replace with real data query
        stats[member.user_id] = {
          completedActivities: Math.floor(Math.random() * 50),
          pendingActivities: Math.floor(Math.random() * 20),
          assignedCards: Math.floor(Math.random() * 30),
        };
      });

      return stats;
    },
    enabled: !!teamMembers && teamMembers.length > 0,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Cards Grid */}
      {teamMembers?.length === 0 ? (
        <div className="border border-border rounded-2xl bg-background">
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum membro na equipe</p>
            <p className="text-sm mt-1">Adicione membros para gerenciar permissões</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {teamMembers?.map((member) => (
            <TeamMemberCard
              key={member.user_id}
              member={member}
              roleLabel={member.role ? roleLabels[member.role] || member.role : "Sem função"}
              onEdit={() => setEditingMember(member)}
              onDelete={() => handleDeleteMember(member.user_id)}
              stats={memberStats?.[member.user_id]}
            />
          ))}
        </div>
      )}

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
