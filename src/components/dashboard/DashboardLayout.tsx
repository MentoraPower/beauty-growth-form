import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import scaleLogo from "@/assets/scale-logo.png";

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

  const shouldBeExpanded = isHovered || sidebarOpen;

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
      <motion.aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={false}
        animate={{ 
          width: shouldBeExpanded ? 224 : 72
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 my-2 ml-2 h-[calc(100vh-1rem)] rounded-3xl border border-[#ffffff15] bg-black overflow-hidden z-50"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="pt-[30px] pb-4 px-4 flex justify-start">
            <motion.div
              initial={false}
              animate={{ 
                width: shouldBeExpanded ? 100 : 40,
                opacity: 1
              }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center"
            >
              <img src={scaleLogo} alt="Scale Beauty" className="w-full h-auto" />
            </motion.div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
                      isActive
                        ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                    <motion.span
                      initial={false}
                      animate={{ 
                        opacity: shouldBeExpanded ? 1 : 0,
                        width: shouldBeExpanded ? 'auto' : 0
                      }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-white/10 p-3">
            <Link
              to="/"
              className="relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3 text-white/60 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
              <motion.span
                initial={false}
                animate={{ 
                  opacity: shouldBeExpanded ? 1 : 0,
                  width: shouldBeExpanded ? 'auto' : 0
                }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="text-sm font-medium whitespace-nowrap overflow-hidden"
              >
                Voltar ao Site
              </motion.span>
            </Link>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-4 left-4 bottom-4 bg-black border border-[#ffffff15] rounded-2xl z-40 transform transition-all duration-300 ease-in-out shadow-sm overflow-hidden w-52",
          sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+2rem)]"
        )}
      >
        <div className="flex flex-col h-full py-3">
          <div className="flex items-center px-4 py-4 mb-4">
            <img src={scaleLogo} alt="Scale" className="w-20" />
          </div>

          <nav className="flex-1 px-2">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
                      isActive
                        ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm font-medium whitespace-nowrap">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-white/10 p-3">
            <Link
              to="/"
              className="relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3 text-white/60 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-medium whitespace-nowrap">
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
      <main className="lg:ml-[4.75rem] pt-20 lg:pt-0 min-h-[calc(100vh-2rem)] p-3">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
