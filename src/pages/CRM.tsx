import { Suspense } from "react";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { useAuth } from "@/hooks/useAuth";

function CRMLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export default function CRM() {
  const { isLoading: authLoading } = useAuth("/auth");

  if (authLoading) {
    return <CRMLoading />;
  }

  return (
    <Suspense fallback={<CRMLoading />}>
      <KanbanBoard />
    </Suspense>
  );
}
