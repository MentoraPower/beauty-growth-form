import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet } from "react-router-dom";
import { StatusBanner } from "@/components/StatusBanner";
import { WorkspaceDropdown } from "@/components/workspace/WorkspaceDropdown";

function TopNavbar() {
  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 h-[45px] bg-background flex items-center"
      style={{ borderBottom: '1px solid #00000010' }}
    >
      <WorkspaceDropdown />
    </div>
  );
}

export default function AdminShell() {
  return (
    <>
      <TopNavbar />
      <div className="pt-[45px]">
        <StatusBanner />
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </div>
    </>
  );
}
