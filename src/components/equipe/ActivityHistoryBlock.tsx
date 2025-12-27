import { FolderOpen } from "lucide-react";

function ActivityHistoryContent() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <FolderOpen className="w-7 h-7 text-slate-300" />
      </div>
      <p className="text-sm font-medium text-slate-500">Sem atividades registradas</p>
      <p className="text-xs mt-1 text-slate-400">As atividades do membro aparecerão aqui</p>
    </div>
  );
}

export function ActivityHistoryBlock() {
  return (
    <div className="bg-gray-100 rounded-xl p-5 border border-gray-200/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Histórico de Atividades</h3>
      <ActivityHistoryContent />
    </div>
  );
}
