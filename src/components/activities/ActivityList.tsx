import { memo, useCallback } from "react";
import { Plus, MoreVertical, Trash2, Pencil, ClipboardList, ListChecks, Phone, Mail, MessageCircle, Instagram, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadActivity } from "@/hooks/use-lead-activities";

interface ActivityListProps {
  activities: LeadActivity[];
  selectedActivityId?: string | null;
  onActivityClick: (activity: LeadActivity) => void;
  onToggleConcluida: (activityId: string, concluida: boolean) => void;
  onEditActivity: (activity: LeadActivity) => void;
  onDeleteActivity: (activityId: string) => void;
  onAddActivity: () => void;
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

const ActivityItem = memo(function ActivityItem({
  activity,
  isSelected,
  onActivityClick,
  onToggleConcluida,
  onEditActivity,
  onDeleteActivity,
}: {
  activity: LeadActivity;
  isSelected: boolean;
  onActivityClick: (activity: LeadActivity) => void;
  onToggleConcluida: (activityId: string, concluida: boolean) => void;
  onEditActivity: (activity: LeadActivity) => void;
  onDeleteActivity: (activityId: string) => void;
}) {
  const handleClick = useCallback(() => {
    onActivityClick(activity);
  }, [activity, onActivityClick]);

  const handleCheckboxChange = useCallback((checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      onToggleConcluida(activity.id, checked);
    }
  }, [activity.id, onToggleConcluida]);

  const handleEdit = useCallback(() => {
    onEditActivity(activity);
  }, [activity, onEditActivity]);

  const handleDelete = useCallback(() => {
    onDeleteActivity(activity.id);
  }, [activity.id, onDeleteActivity]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
        isSelected ? "bg-primary/10" : "hover:bg-muted/50",
        activity.concluida && "opacity-60"
      )}
      onClick={handleClick}
    >
      <span className="text-xs text-muted-foreground w-12 flex-shrink-0">
        {format(new Date(activity.data + 'T00:00:00'), "dd/MM", { locale: ptBR })}
      </span>
      
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-muted-foreground">
          {getTipoIcon(activity.tipo)}
        </span>
        <span className={cn(
          "text-sm truncate",
          activity.concluida && "line-through"
        )}>
          {activity.titulo}
        </span>
      </div>

      <Checkbox
        checked={activity.concluida}
        onCheckedChange={handleCheckboxChange}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

export const ActivityList = memo(function ActivityList({
  activities,
  selectedActivityId,
  onActivityClick,
  onToggleConcluida,
  onEditActivity,
  onDeleteActivity,
  onAddActivity,
}: ActivityListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-muted-foreground">Atividades</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddActivity}
          className="h-8 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nova atividade
        </Button>
      </div>

      <div className="space-y-1">
        {activities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isSelected={selectedActivityId === activity.id}
            onActivityClick={onActivityClick}
            onToggleConcluida={onToggleConcluida}
            onEditActivity={onEditActivity}
            onDeleteActivity={onDeleteActivity}
          />
        ))}
        
        {activities.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhuma atividade cadastrada nesta etapa
          </div>
        )}
      </div>
    </div>
  );
});
