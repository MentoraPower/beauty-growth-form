import { Suspense } from "react";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

function KanbanLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-9 w-full max-w-md" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex gap-4 overflow-x-auto flex-1 pb-0 min-h-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-72 bg-muted/40 rounded-xl p-3 min-h-0">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CRM() {
  const { isLoading: authLoading } = useAuth("/auth");

  if (authLoading) {
    return <KanbanLoading />;
  }

  return (
    <Suspense fallback={<KanbanLoading />}>
      <KanbanBoard />
    </Suspense>
  );
}
