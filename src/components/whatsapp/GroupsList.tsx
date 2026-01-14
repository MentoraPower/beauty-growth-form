import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Users, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getInitials } from '@/lib/whatsapp-utils';

export interface WhatsAppGroup {
  id: string;
  groupJid: string;
  name: string;
  participantCount: number;
  photoUrl?: string | null;
}

interface GroupsListProps {
  groups: WhatsAppGroup[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectGroup?: (group: WhatsAppGroup) => void;
  className?: string;
}

const GroupItem = memo(function GroupItem({
  group,
  onSelect,
}: {
  group: WhatsAppGroup;
  onSelect?: (group: WhatsAppGroup) => void;
}) {
  return (
    <div 
      onClick={() => onSelect?.(group)}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer rounded-lg"
    >
      {/* Avatar with participant count badge */}
      <div className="relative flex-shrink-0">
        {group.photoUrl ? (
          <img
            src={group.photoUrl}
            alt={group.name}
            className="w-11 h-11 rounded-full object-cover ring-1 ring-border/50"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={cn(
          "w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-medium text-white",
          group.photoUrl && "hidden"
        )}>
          {getInitials(group.name)}
        </div>
        
        {/* Participant count badge */}
        {group.participantCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-semibold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 shadow-sm border border-background">
            {group.participantCount > 99 ? '99+' : group.participantCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-foreground truncate block">
          {group.name}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <Users className="w-3 h-3" />
          <span>
            {group.participantCount >= 0
              ? `${group.participantCount} participantes`
              : "— participantes"}
          </span>
        </div>
      </div>
    </div>
  );
});

export const GroupsList = memo(function GroupsList({
  groups,
  isLoading,
  onRefresh,
  onSelectGroup,
  className,
}: GroupsListProps) {
  if (isLoading && groups.length === 0) {
    return (
      <div className={cn("flex-1 flex flex-col", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Grupos</span>
          </div>
          <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
        </div>
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">Carregando grupos...</span>
          </div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={cn("flex-1 flex flex-col", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Grupos</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 hover:bg-muted rounded-full transition-colors disabled:opacity-50"
            title="Atualizar grupos"
          >
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="text-center">
            <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum grupo encontrado</p>
            <button
              onClick={onRefresh}
              className="mt-2 text-xs text-emerald-600 hover:underline"
            >
              Clique para atualizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col min-h-0", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Grupos ({groups.length})</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 hover:bg-muted rounded-full transition-colors disabled:opacity-50"
          title="Atualizar grupos"
        >
          <RefreshCw className={cn("w-4 h-4 text-muted-foreground", isLoading && "animate-spin")} />
        </button>
      </div>
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-1">
          {groups.map((group) => (
            <GroupItem 
              key={group.id} 
              group={group} 
              onSelect={onSelectGroup}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});

export default GroupsList;
