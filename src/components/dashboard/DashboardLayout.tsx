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
  const [isHovered, setIsHovered] = useState(false);
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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed top-4 left-4 bottom-4 bg-neutral-900 border border-neutral-800 rounded-2xl z-40 transform transition-all duration-300 ease-in-out shadow-sm overflow-hidden",
          "lg:translate-x-0",
          isHovered ? "w-56" : "w-16",
          sidebarOpen ? "translate-x-0 w-56" : "max-lg:-translate-x-[calc(100%+2rem)]"
        )}
      >
        <div className="flex flex-col h-full p-2">
          {/* Logo */}
          <div className="h-10 flex items-center justify-center mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">SB</span>
            </div>
            <span className={cn(
              "text-lg font-bold text-white ml-3 whitespace-nowrap transition-opacity duration-300",
              isHovered || sidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"
            )}>
              SCALE
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={(e) => {
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className={cn(
                    "font-medium text-sm whitespace-nowrap transition-opacity duration-300",
                    isHovered || sidebarOpen ? "opacity-100" : "opacity-0"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="pt-2 border-t border-neutral-800 mt-2">
            <Link
              to="/"
              className="flex items-center gap-3 px-2 py-2.5 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <LogOut className="h-5 w-5" />
              </div>
              <span className={cn(
                "font-medium text-sm whitespace-nowrap transition-opacity duration-300",
                isHovered || sidebarOpen ? "opacity-100" : "opacity-0"
              )}>
                Voltar ao Site
              </span>
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
      <main className="lg:ml-[5.5rem] pt-20 lg:pt-0 min-h-[calc(100vh-3rem)]">
        <div className="bg-card border border-border rounded-2xl p-6 lg:p-8 min-h-full shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
