import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet } from "react-router-dom";
import { StatusBanner } from "@/components/StatusBanner";

function TopNavbar() {
  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 h-[50px] bg-background"
      style={{ borderBottom: '1px solid #00000010' }}
    />
  );
}

export default function AdminShell() {
  return (
    <>
      <TopNavbar />
      <div className="pt-[50px]">
        <StatusBanner />
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </div>
    </>
  );
}
