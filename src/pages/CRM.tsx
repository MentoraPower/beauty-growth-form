import { KanbanBoard } from "@/components/crm/KanbanBoard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";

export default function CRM() {
  // Auth check happens in background, DashboardLayout handles redirect
  useAuth("/auth");
  
  return (
    <DashboardLayout>
      <KanbanBoard />
    </DashboardLayout>
  );
}
