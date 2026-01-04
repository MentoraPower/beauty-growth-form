import { FolderOpen } from "lucide-react";

function PerformanceContent() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100%-32px)] text-zinc-500 dark:text-zinc-500">
      <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
        <FolderOpen className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-500">Sem atividades</p>
    </div>
  );
}

export function PerformanceBlock() {
  return (
    <div className="rounded-xl p-5 bg-card border border-border/30">
      <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Desempenho</h3>
      <div className="rounded-xl p-3 bg-zinc-100/50 dark:bg-zinc-800">
        <PerformanceContent />
      </div>
    </div>
  );
}


