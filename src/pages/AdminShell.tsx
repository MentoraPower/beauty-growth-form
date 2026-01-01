import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet } from "react-router-dom";
import { StatusBanner } from "@/components/StatusBanner";

export default function AdminShell() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Fixed top navbar */}
      <nav className="h-[70px] w-full border-b border-[#00000010] bg-background shrink-0" />
      
      <StatusBanner />
      <div className="flex-1 flex flex-col">
        <DashboardLayout>
          <Outlet />
        </DashboardLayout>
      </div>
    </div>
  );
}
