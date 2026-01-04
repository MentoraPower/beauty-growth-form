import { FolderOpen } from "lucide-react";

function ActivityHistoryContent() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-zinc-500 dark:text-zinc-500">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mb-4">
        <FolderOpen className="w-7 h-7 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm font-medium text-foreground/70">Sem atividades registradas</p>
      <p className="text-xs mt-1 text-zinc-500 dark:text-zinc-500">As atividades do membro aparecerão aqui</p>
    </div>
  );
}

export function ActivityHistoryBlock() {
  return (
    <div className="rounded-xl p-5 bg-card border border-border/30">
      <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Histórico de Atividades</h3>
      <div className="rounded-xl p-3 bg-zinc-100/50 dark:bg-zinc-800">
        <ActivityHistoryContent />
      </div>
    </div>
  );
}


