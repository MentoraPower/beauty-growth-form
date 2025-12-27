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
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Mail className="h-4 w-4 text-slate-500" />
        </div>
        <span className="text-sm text-slate-700 truncate">{email || "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Phone className="h-4 w-4 text-slate-500" />
        </div>
        <span className="text-sm text-slate-700">{phone || "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Calendar className="h-4 w-4 text-slate-500" />
        </div>
        <span className="text-sm text-slate-700">
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
    <div className="bg-gray-100 rounded-xl p-5 border border-gray-200/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Contato</h3>
      <ContactContent email={email} phone={phone} createdAt={createdAt} />
    </div>
  );
}
