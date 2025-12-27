import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Mail, 
  Phone, 
  Settings2,
  Trash2,
  Calendar,
  FolderOpen,
  UserCircle
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

  // No stats available yet - would require user_id tracking on activities
  const memberStats = null;

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
                  <UserCircle className="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
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
            <div className="bg-white rounded-lg p-5" style={{ border: '1px solid #00000010' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <UserCircle className="w-14 h-14 text-muted-foreground" strokeWidth={1} />
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

            {/* Info and Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              {/* Contact Block */}
              <div className="bg-white rounded-lg p-4" style={{ border: '1px solid #00000010' }}>
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

              {/* Activities Chart Placeholder */}
              <div className="bg-white rounded-lg p-4" style={{ border: '1px solid #00000010' }}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Atividades</h3>
                <div className="flex flex-col items-center justify-center h-[calc(100%-24px)] text-muted-foreground">
                  <FolderOpen className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">Sem atividades</p>
                </div>
              </div>

              {/* Performance Chart Placeholder */}
              <div className="bg-white rounded-lg p-4" style={{ border: '1px solid #00000010' }}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Desempenho</h3>
                <div className="flex flex-col items-center justify-center h-[calc(100%-24px)] text-muted-foreground">
                  <FolderOpen className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">Sem atividades</p>
                </div>
              </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-white rounded-lg p-4" style={{ border: '1px solid #00000010' }}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Histórico de Atividades</h3>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FolderOpen className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Sem atividades registradas</p>
                <p className="text-xs mt-1">As atividades do membro aparecerão aqui</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <UserCircle className="w-20 h-20 mb-4 opacity-30" strokeWidth={1} />
            <p className="text-lg font-medium">Nenhum perfil selecionado</p>
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