import { FolderOpen } from "lucide-react";

function PerformanceContent() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100%-32px)] text-slate-400">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <FolderOpen className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-xs text-slate-400">Sem atividades</p>
    </div>
  );
}

export function PerformanceBlock() {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Desempenho</h3>
      <PerformanceContent />
    </div>
  );
}
