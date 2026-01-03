import { FolderOpen } from "lucide-react";

function PerformanceContent() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100%-32px)] text-slate-400 dark:text-zinc-500">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
        <FolderOpen className="w-6 h-6 text-slate-300 dark:text-zinc-500" />
      </div>
      <p className="text-xs text-slate-400 dark:text-zinc-500">Sem atividades</p>
    </div>
  );
}

export function PerformanceBlock() {
  return (
    <div className="rounded-xl p-5 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Desempenho</h3>
      <div className="rounded-xl p-3 bg-zinc-100/50 dark:bg-zinc-800">
        <PerformanceContent />
      </div>
    </div>
  );
}
