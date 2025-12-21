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
  className?: string;
}

const GroupItem = memo(function GroupItem({
  group,
}: {
  group: WhatsAppGroup;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-border/40 hover:bg-muted/30 transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {group.photoUrl ? (
          <img
            src={group.photoUrl}
            alt={group.name}
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={cn(
          "w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-medium text-white",
          group.photoUrl && "hidden"
        )}>
          {getInitials(group.name)}
        </div>
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
  className,
}: GroupsListProps) {
  if (isLoading) {
    return (
      <div className={cn("border-t border-border/50", className)}>
        <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>Grupos</span>
          </div>
          <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
        </div>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={cn("border-t border-border/50", className)}>
        <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>Grupos</span>
          </div>
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Atualizar grupos"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="text-center py-4 text-xs text-muted-foreground">
          Nenhum grupo encontrado
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-t border-border/50", className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>Grupos ({groups.length})</span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Atualizar grupos"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <ScrollArea className="max-h-[200px]">
        {groups.map((group) => (
          <GroupItem key={group.id} group={group} />
        ))}
      </ScrollArea>
    </div>
  );
});

export default GroupsList;
