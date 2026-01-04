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
        <div className="w-8 h-8 rounded-lg bg-zinc-100/70 dark:bg-zinc-800 flex items-center justify-center">
          <Mail className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        </div>
        <span className="text-sm text-foreground/80 truncate">{email || "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-100/70 dark:bg-zinc-800 flex items-center justify-center">
          <Phone className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        </div>
        <span className="text-sm text-foreground/80">{phone || "—"}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-100/70 dark:bg-zinc-800 flex items-center justify-center">
          <Calendar className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        </div>
        <span className="text-sm text-foreground/80">
          {createdAt ? format(new Date(createdAt), "dd/MM/yyyy", { locale: ptBR }) : "—"}
        </span>
      </div>
    </div>
  );
}

export function ContactBlock({ email, phone, createdAt }: ContactBlockProps) {
  return (
    <div className="rounded-xl p-5 bg-card border border-border/30">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Contato</h3>
      <div className="rounded-xl p-3 bg-zinc-100/50 dark:bg-zinc-800">
        <ContactContent email={email} phone={phone} createdAt={createdAt} />
      </div>
    </div>
  );
}


