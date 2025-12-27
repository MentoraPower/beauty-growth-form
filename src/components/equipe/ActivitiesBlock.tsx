import { FolderOpen } from "lucide-react";

function ActivitiesContent() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100%-32px)] text-slate-400">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <FolderOpen className="w-6 h-6 text-slate-300" />
      </div>
      <p className="text-xs text-slate-400">Sem atividades</p>
    </div>
  );
}

export function ActivitiesBlock() {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #00000010' }}>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Atividades</h3>
      <div className="rounded-xl p-3" style={{ backgroundColor: '#F8F8F8' }}>
        <ActivitiesContent />
      </div>
    </div>
  );
}
