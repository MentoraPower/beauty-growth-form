import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Outlet } from "react-router-dom";
import { StatusBanner } from "@/components/StatusBanner";

export default function AdminShell() {
  return (
    <>
      <StatusBanner />
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </>
  );
}
