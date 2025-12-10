import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLeadActivities, LeadActivity } from "@/hooks/use-lead-activities";
import { StepNavigation } from "./StepNavigation";
import { AddActivityDialog } from "./AddActivityDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreVertical, Trash2, Pencil, ClipboardList, ListChecks, Phone, Mail, MessageCircle, Calendar, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Instagram from "@/components/icons/Instagram";

interface ActivitiesBoardProps {
  leadId: string;
  leadName: string;
  currentPipelineId: string | null;
}

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'tarefas':
      return <ClipboardList className="h-4 w-4" />;
    case 'checklist':
      return <ListChecks className="h-4 w-4" />;
    case 'agendamento':
      return <Calendar className="h-4 w-4" />;
    case 'reuniao':
      return <Users className="h-4 w-4" />;
    case 'whatsapp':
      return <MessageCircle className="h-4 w-4" />;
    case 'instagram':
      return <Instagram className="h-4 w-4" />;
    case 'ligacao':
      return <Phone className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    default:
      return <ClipboardList className="h-4 w-4" />;
  }
};

export function ActivitiesBoard({ leadId, leadName, currentPipelineId }: ActivitiesBoardProps) {
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LeadActivity | null>(null);

  const {
    pipelines,
    viewingPipelineId,
    activities,
    selectedActivity,
    isLoadingActivities,
    currentPipelineName,
    handlePipelineClick,
    handleActivityClick,
    handleAddActivity,
    handleDeleteActivity,
    handleToggleConcluida,
  } = useLeadActivities({ leadId, currentPipelineId });

  const handleEditActivity = useCallback((activity: LeadActivity) => {
    setEditingActivity(activity);
    setIsAddActivityOpen(true);
  }, []);

  const handleOpenAddDialog = useCallback(() => {
    setEditingActivity(null);
    setIsAddActivityOpen(true);
  }, []);

  const handleCloseAddDialog = useCallback((open: boolean) => {
    setIsAddActivityOpen(open);
    if (!open) {
      setEditingActivity(null);
    }
  }, []);

  const handleSubmitActivity = useCallback(async (activity: { titulo: string; tipo: string; data: Date; hora: string }) => {
    await handleAddActivity(activity, editingActivity?.id);
    setEditingActivity(null);
  }, [handleAddActivity, editingActivity?.id]);

  return (
    <div className="space-y-4">
      {/* Step Navigation */}
      <Card className="border-[#00000010] bg-muted/30 shadow-none">
        <CardContent className="p-4 pt-2">
          <StepNavigation
            pipelines={pipelines}
            viewingPipelineId={viewingPipelineId}
            currentPipelineId={currentPipelineId}
            leadName={leadName}
            onPipelineClick={handlePipelineClick}
          />
        </CardContent>
      </Card>

      {/* Two columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left block - Activities List */}
        <Card className="border-black/5">
          <CardContent className="p-4 flex flex-col h-[400px]">
            {isLoadingActivities ? (
              <div className="space-y-3 flex-1">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {activities.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">
                        Clique abaixo para criar sua primeira atividade
                      </p>
                    </div>
                  ) : (
                    activities.map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => handleActivityClick(activity)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border",
                          selectedActivity?.id === activity.id 
                            ? "bg-primary/5 border-primary/20" 
                            : "bg-muted/30 border-transparent hover:bg-muted/50",
                          activity.concluida && "opacity-60"
                        )}
                      >
                        <Checkbox
                          checked={activity.concluida}
                          onCheckedChange={(checked) => {
                            if (typeof checked === 'boolean') {
                              handleToggleConcluida(activity.id, checked);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-muted-foreground">
                            {getTipoIcon(activity.tipo)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              activity.concluida && "line-through"
                            )}>
                              {activity.titulo}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(activity.data + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })} às {activity.hora.slice(0, 5)}
                            </p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleEditActivity(activity)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteActivity(activity.id)} 
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))
                  )}
                </div>

                {/* Add activity button at bottom */}
                <Button
                  variant="outline"
                  className="w-full mt-4 border-dashed"
                  onClick={handleOpenAddDialog}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova atividade
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right block - Activity Details / Tasks */}
        <Card className="border-black/5">
          <CardContent className="p-4 h-[400px] flex flex-col">
            {selectedActivity ? (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-3 pb-4 border-b border-black/5">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {getTipoIcon(selectedActivity.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{selectedActivity.titulo}</h3>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedActivity.data + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })} às {selectedActivity.hora.slice(0, 5)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 mt-4 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground text-center">
                    Tarefas em desenvolvimento
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center">
                  Selecione uma atividade para ver os detalhes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Activity Dialog */}
      <AddActivityDialog
        open={isAddActivityOpen}
        onOpenChange={handleCloseAddDialog}
        stepName={currentPipelineName}
        onAddActivity={handleSubmitActivity}
        editingActivity={editingActivity}
      />
    </div>
  );
}
