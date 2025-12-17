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
import { Plus, Trash2, Pencil, Users, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AddTeamMemberDialog } from "./AddTeamMemberDialog";
import { EditPermissionsDialog } from "./EditPermissionsDialog";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string | null;
  email: string | null;
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

const roleColors: Record<string, string> = {
  admin: "bg-red-50 text-red-700 border-red-200",
  suporte: "bg-blue-50 text-blue-700 border-blue-200",
  gestor_trafego: "bg-purple-50 text-purple-700 border-purple-200",
  closer: "bg-green-50 text-green-700 border-green-200",
  sdr: "bg-orange-50 text-orange-700 border-orange-200",
};

export function TeamManagement() {
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
                <TableHead className="font-semibold text-foreground">Função</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers?.map((member) => (
                <TableRow key={member.user_id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                        {(member.name || member.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">
                        {member.name || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.email || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex px-2.5 py-1 rounded-full text-xs font-medium border",
                        member.role
                          ? roleColors[member.role] || "bg-gray-50 text-gray-700 border-gray-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                      )}
                    >
                      {member.role ? roleLabels[member.role] || member.role : "Sem função"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {member.role ? (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Ativo</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm">Inativo</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingMember(member)}
                        className="h-8 w-8 hover:bg-muted"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja remover este membro?")) {
                            deleteMember.mutate(member.user_id);
                          }
                        }}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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