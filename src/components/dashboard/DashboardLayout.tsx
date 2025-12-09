import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/leads", icon: Users, label: "Leads" },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-4 left-4 right-4 h-14 bg-card border border-border rounded-2xl z-50 flex items-center justify-between px-4 shadow-sm">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-muted rounded-xl transition-colors"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5 text-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-foreground" />
          )}
        </button>
        <span className="text-base font-bold text-foreground">SCALE BEAUTY</span>
        <div className="w-9" />
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-4 left-4 bottom-4 w-64 bg-card border border-border rounded-2xl z-40 transform transition-transform duration-200 ease-in-out shadow-sm",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+2rem)]"
        )}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="h-14 flex items-center px-4 mb-2">
            <Link to="/admin" className="text-xl font-bold text-foreground">
              SCALE BEAUTY
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                    isActive
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="pt-4 border-t border-border mt-4">
            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Voltar ao Site</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-72 pt-20 lg:pt-0 min-h-[calc(100vh-3rem)]">
        <div className="bg-card border border-border rounded-2xl p-6 lg:p-8 min-h-full shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
