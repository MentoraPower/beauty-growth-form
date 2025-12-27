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
      <div className="w-[260px] flex-shrink-0 flex flex-col bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-100/80 to-slate-50/50 border-b border-slate-100">
          <h1 className="text-sm font-semibold text-slate-800">Equipe</h1>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            size="sm"
            className="h-8 px-3 bg-slate-900 text-white hover:bg-slate-800 rounded-lg shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo
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
                  "p-3 rounded-lg cursor-pointer transition-all duration-200",
                  selectedMember?.user_id === member.user_id
                    ? "bg-gradient-to-r from-slate-200/80 to-slate-100/60 shadow-sm"
                    : "hover:bg-slate-100/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    selectedMember?.user_id === member.user_id
                      ? "bg-gradient-to-br from-slate-700 to-slate-900"
                      : "bg-gradient-to-br from-slate-200 to-slate-300"
                  )}>
                    <UserCircle className={cn(
                      "w-6 h-6",
                      selectedMember?.user_id === member.user_id ? "text-white" : "text-slate-500"
                    )} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">
                      {member.name || "Sem nome"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
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
          <div className="space-y-4 animate-fade-in">
            {/* Header Card */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <UserCircle className="w-10 h-10 text-white/80" strokeWidth={1} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {selectedMember.name || "Sem nome"}
                    </h2>
                    <p className="text-sm text-white/60">
                      {selectedMember.role ? roleLabels[selectedMember.role] || selectedMember.role : "Sem função"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMember(selectedMember)}
                    className="h-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                  >
                    <Settings2 className="w-4 h-4 mr-1.5" />
                    Permissões
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteMember(selectedMember.user_id)}
                    className="h-8 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Info and Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              {/* Contact Block */}
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-100 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Contato</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="text-sm text-slate-700 truncate">{selectedMember.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="text-sm text-slate-700">{selectedMember.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="text-sm text-slate-700">
                      {selectedMember.created_at 
                        ? format(new Date(selectedMember.created_at), "dd/MM/yyyy", { locale: ptBR })
                        : "—"
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Activities Chart Placeholder */}
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-5 border border-blue-100 shadow-sm">
                <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-4">Atividades</h3>
                <div className="flex flex-col items-center justify-center h-[calc(100%-32px)] text-slate-400">
                  <div className="w-12 h-12 rounded-xl bg-blue-100/50 flex items-center justify-center mb-3">
                    <FolderOpen className="w-6 h-6 text-blue-300" />
                  </div>
                  <p className="text-xs text-slate-400">Sem atividades</p>
                </div>
              </div>

              {/* Performance Chart Placeholder */}
              <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-5 border border-emerald-100 shadow-sm">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-4">Desempenho</h3>
                <div className="flex flex-col items-center justify-center h-[calc(100%-32px)] text-slate-400">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100/50 flex items-center justify-center mb-3">
                    <FolderOpen className="w-6 h-6 text-emerald-300" />
                  </div>
                  <p className="text-xs text-slate-400">Sem atividades</p>
                </div>
              </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-5 border border-slate-100 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Histórico de Atividades</h3>
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <FolderOpen className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">Sem atividades registradas</p>
                <p className="text-xs mt-1 text-slate-400">As atividades do membro aparecerão aqui</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6 shadow-inner">
              <UserCircle className="w-14 h-14 text-slate-300" strokeWidth={1} />
            </div>
            <p className="text-lg font-medium text-slate-500">Nenhum perfil selecionado</p>
            <p className="text-sm mt-1 text-slate-400">Selecione um membro para ver os detalhes</p>
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