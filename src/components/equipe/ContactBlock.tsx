import { Mail, Phone, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContactBlockProps {
  email: string | null;
  phone: string | null;
  createdAt: string | null;
}

function ContactContent({ email, phone, createdAt }: ContactBlockProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center">
          <Mail className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
        </div>
        <span className="text-sm text-slate-700 dark:text-zinc-300 truncate">{email || "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center">
          <Phone className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
        </div>
        <span className="text-sm text-slate-700 dark:text-zinc-300">{phone || "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center">
          <Calendar className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
        </div>
        <span className="text-sm text-slate-700 dark:text-zinc-300">
          {createdAt 
            ? format(new Date(createdAt), "dd/MM/yyyy", { locale: ptBR })
            : "—"
          }
        </span>
      </div>
    </div>
  );
}

export function ContactBlock({ email, phone, createdAt }: ContactBlockProps) {
  return (
    <div className="rounded-xl p-5 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Contato</h3>
      <div className="rounded-xl p-3 bg-zinc-100/50 dark:bg-zinc-800">
        <ContactContent email={email} phone={phone} createdAt={createdAt} />
      </div>
    </div>
  );
}
