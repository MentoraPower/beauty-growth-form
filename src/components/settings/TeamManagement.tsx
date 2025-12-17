import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2, Shield, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { AddTeamMemberDialog } from "./AddTeamMemberDialog";
import { EditPermissionsDialog } from "./EditPermissionsDialog";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  user_id: string;
  permissions?: {
    can_access_whatsapp: boolean;
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

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  suporte: "bg-blue-100 text-blue-700 border-blue-200",
  gestor_trafego: "bg-purple-100 text-purple-700 border-purple-200",
  closer: "bg-green-100 text-green-700 border-green-200",
  sdr: "bg-orange-100 text-orange-700 border-orange-200",
};

export function TeamManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const queryClient = useQueryClient();

  // Fetch team members with their roles and permissions
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Get profiles for those users
      const userIds = roles?.map((r) => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get permissions
      const { data: permissions, error: permissionsError } = await supabase
        .from("user_permissions")
        .select("*")
        .in("user_id", userIds);

      if (permissionsError) throw permissionsError;

      // Combine data
      const members: TeamMember[] = roles?.map((role) => {
        const profile = profiles?.find((p) => p.id === role.user_id);
        const permission = permissions?.find((p) => p.user_id === role.user_id);

        return {
          id: role.id,
          user_id: role.user_id,
          name: profile?.name || null,
          email: profile?.email || null,
          role: role.role,
          permissions: permission
            ? {
                can_access_whatsapp: permission.can_access_whatsapp,
                allowed_origin_ids: permission.allowed_origin_ids || [],
                allowed_sub_origin_ids: permission.allowed_sub_origin_ids || [],
              }
            : null,
        };
      }) || [];

      return members;
    },
  });

  // Delete team member
  const deleteMember = useMutation({
    mutationFn: async (userId: string) => {
      // Delete role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;

      // Delete permissions
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Equipe</h2>
          <p className="text-sm text-muted-foreground">
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

      {/* Team members list */}
      <div className="space-y-3">
        {teamMembers?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum membro na equipe</p>
            <p className="text-sm">Adicione membros para gerenciar permissões</p>
          </div>
        )}

        {teamMembers?.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-background"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                {member.role === "admin" ? (
                  <ShieldCheck className="w-5 h-5 text-red-600" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {member.name || "Sem nome"}
                </p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border",
                  roleColors[member.role] || "bg-gray-100 text-gray-700"
                )}
              >
                {roleLabels[member.role] || member.role}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingMember(member)}
                className="h-8 w-8"
              >
                <Edit2 className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("Tem certeza que deseja remover este membro?")) {
                    deleteMember.mutate(member.user_id);
                  }
                }}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add dialog */}
      <AddTeamMemberDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {/* Edit permissions dialog */}
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
