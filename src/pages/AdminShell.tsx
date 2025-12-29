import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet } from "react-router-dom";
import { StatusBanner } from "@/components/StatusBanner";
import { TopNavbar } from "@/components/TopNavbar";

export default function AdminShell() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopNavbar />
      <div className="flex-1 relative pt-12">
        <StatusBanner />
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </div>
    </div>
  );
}
