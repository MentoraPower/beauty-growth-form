import { KanbanBoard } from "@/components/crm/KanbanBoard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export default function CRM() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <KanbanBoard />
      </div>
    </DashboardLayout>
  );
}
