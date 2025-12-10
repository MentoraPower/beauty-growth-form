import { useState, useRef, useEffect, useCallback } from "react";
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

// Global state to persist hover across re-renders
let globalIsHovered = false;

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(globalIsHovered);
  const sidebarRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Sync with global state on mount
  useEffect(() => {
    setIsHovered(globalIsHovered);
  }, [location.pathname]);

  const handleMouseEnter = useCallback(() => {
    globalIsHovered = true;
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    globalIsHovered = false;
    setIsHovered(false);
  }, []);

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
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed top-4 left-4 bottom-4 bg-neutral-950 border border-neutral-800 rounded-2xl z-40 transform transition-all duration-300 ease-in-out shadow-sm overflow-hidden",
          "lg:translate-x-0",
          isHovered ? "w-52" : "w-[72px]",
          sidebarOpen ? "translate-x-0 w-52" : "max-lg:-translate-x-[calc(100%+2rem)]"
        )}
      >
        <div className="flex flex-col h-full py-3">
          {/* Logo */}
          <div className="h-11 flex items-center px-[10px] mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">SB</span>
            </div>
            <div className={cn(
              "overflow-hidden transition-all duration-300",
              isHovered || sidebarOpen ? "w-24 ml-3" : "w-0 ml-0"
            )}>
              <span className="text-lg font-bold text-white whitespace-nowrap">
                SCALE
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-[10px]">
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
                    "flex items-center h-10 rounded-xl transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className={cn(
                    "overflow-hidden transition-all duration-300",
                    isHovered || sidebarOpen ? "w-28" : "w-0"
                  )}>
                    <span className="font-medium text-sm whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="pt-2 border-t border-neutral-800 mt-2 px-[10px]">
            <Link
              to="/"
              className="flex items-center h-10 rounded-xl text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <LogOut className="h-5 w-5" />
              </div>
              <div className={cn(
                "overflow-hidden transition-all duration-300",
                isHovered || sidebarOpen ? "w-28" : "w-0"
              )}>
                <span className="font-medium text-sm whitespace-nowrap">
                  Voltar ao Site
                </span>
              </div>
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
