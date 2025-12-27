import { useState } from "react";
import { 
  Settings2, 
  Trash2, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Clock, 
  LayoutGrid,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TeamMemberCardProps {
  member: {
    id: string;
    name: string | null;
    email: string | null;
    phone?: string | null;
    role: string | null;
    user_id: string;
  };
  roleLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  stats?: {
    completedActivities: number;
    pendingActivities: number;
    assignedCards: number;
  };
}

export function TeamMemberCard({ 
  member, 
  roleLabel, 
  onEdit, 
  onDelete,
  stats = { completedActivities: 0, pendingActivities: 0, assignedCards: 0 }
}: TeamMemberCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const initials = (member.name || member.email || "?")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  const completionRate = stats.completedActivities + stats.pendingActivities > 0
    ? Math.round((stats.completedActivities / (stats.completedActivities + stats.pendingActivities)) * 100)
    : 0;

  return (
    <div
      className={cn(
        "group relative bg-background border border-border rounded-2xl overflow-hidden",
        "transition-all duration-300 ease-out",
        isHovered && "shadow-lg border-border/80"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header with gradient accent */}
      <div className="relative h-16 bg-gradient-to-br from-foreground/5 to-foreground/10">
        {/* Actions - appear on hover */}
        <div className={cn(
          "absolute top-3 right-3 flex items-center gap-1.5",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Avatar - overlapping header */}
      <div className="absolute top-8 left-5">
        <div className="w-16 h-16 rounded-2xl bg-foreground flex items-center justify-center text-background text-xl font-bold shadow-lg">
          {initials}
        </div>
      </div>

      {/* Content */}
      <div className="pt-10 pb-5 px-5">
        {/* Name and Role */}
        <div className="mb-4">
          <h3 className="font-bold text-foreground text-lg leading-tight">
            {member.name || "Sem nome"}
          </h3>
          <span className="inline-flex mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-foreground/10 text-foreground">
            {roleLabel}
          </span>
        </div>

        {/* Contact Info - 2 columns */}
        <div className="grid grid-cols-2 gap-3 pb-4 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{member.email || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{member.phone || "—"}</span>
          </div>
        </div>

        {/* Responsibilities Section */}
        <div className="pt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Responsabilidades</span>
            <button className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground transition-colors">
              Ver mais
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Cards Assigned */}
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold text-foreground">{stats.assignedCards}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cards</p>
            </div>

            {/* Completed */}
            <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-emerald-600">{stats.completedActivities}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Concluídas</p>
            </div>

            {/* Pending */}
            <div className="bg-amber-500/10 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <p className="text-lg font-bold text-amber-600">{stats.pendingActivities}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pendentes</p>
            </div>
          </div>

          {/* Completion Rate Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Nível de conclusão</span>
              <span className="font-semibold text-foreground">{completionRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
