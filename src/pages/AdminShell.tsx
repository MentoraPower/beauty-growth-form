import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet } from "react-router-dom";

export default function AdminShell() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
