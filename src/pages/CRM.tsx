import { KanbanBoard } from "@/components/crm/KanbanBoard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

export default function CRM() {
  const { isLoading } = useAuth("/auth");
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <KanbanBoard />
      </div>
    </DashboardLayout>
  );
}
