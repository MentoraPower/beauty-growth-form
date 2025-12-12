import { useState, useCallback, useEffect, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Menu, X, LogOut, Kanban } from "lucide-react";
import { cn } from "@/lib/utils";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import scaleLogo from "@/assets/scale-logo.png";
import { CRMOriginsPanel } from "./CRMOriginsPanel";
import { PageTransition } from "./PageTransition";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
];

const bottomNavItems = [
  { href: "/admin/whatsapp", icon: WhatsAppIcon, label: "WhatsApp" },
];

// Global hover state to persist across navigations
let globalHoverState = false;

// Load panel state from localStorage
const getInitialPanelState = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('crm_panel_open');
    return saved === 'true';
  }
  return false;
};

// Global panel state to persist across re-renders
let globalCrmPanelOpen = getInitialPanelState();

const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(globalHoverState);
  const [crmPanelOpen, setCrmPanelOpen] = useState(globalCrmPanelOpen);
  const location = useLocation();

  const isCRMActive = location.pathname.startsWith("/admin/crm");

  // Sync with global state on mount and route change
  useEffect(() => {
    setIsHovered(globalHoverState);
  }, [location.pathname]);

  // Keep global state and localStorage in sync
  useEffect(() => {
    globalCrmPanelOpen = crmPanelOpen;
    localStorage.setItem('crm_panel_open', String(crmPanelOpen));
  }, [crmPanelOpen]);

  const handleMouseEnter = useCallback(() => {
    globalHoverState = true;
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    globalHoverState = false;
    setIsHovered(false);
  }, []);

  const shouldBeExpanded = isHovered || sidebarOpen;
  const sidebarWidth = shouldBeExpanded ? 224 : 72;

  const handleCRMClick = () => {
    setCrmPanelOpen(!crmPanelOpen);
  };

  // Calculate main content margin based on panel state
  const mainContentMargin = crmPanelOpen ? sidebarWidth + 272 : 88; // 272 = panel width (256) + gap (16)

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-50 flex items-center justify-between px-4">
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

      {/* Desktop Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ width: sidebarWidth }}
        className="hidden lg:flex flex-col fixed left-0 top-0 my-2 ml-2 h-[calc(100vh-1rem)] rounded-3xl border border-[#ffffff15] bg-black overflow-hidden z-50 transition-[width] duration-200 ease-out"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="pt-[30px] pb-4 px-4 flex justify-start">
            <div
              style={{ width: shouldBeExpanded ? 100 : 40 }}
              className="flex items-center transition-[width] duration-200 ease-out"
            >
              <img src={scaleLogo} alt="Scale Beauty" className="w-full h-auto" />
            </div>
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
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap transition-opacity duration-200",
                        shouldBeExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
              
              {/* CRM Button */}
              <button
                onClick={handleCRMClick}
                className={cn(
                  "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
                  isCRMActive
                    ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <Kanban className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap transition-opacity duration-200",
                    shouldBeExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  )}
                >
                  CRM
                </span>
              </button>
              
              {/* WhatsApp and other bottom nav items */}
              {bottomNavItems.map((item) => {
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
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap transition-opacity duration-200",
                        shouldBeExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                      )}
                    >
                      {item.label}
                    </span>
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
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap transition-opacity duration-200",
                  shouldBeExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                )}
              >
                Voltar ao Site
              </span>
            </Link>
          </div>
        </div>
      </aside>

      {/* CRM Origins Panel - Desktop */}
      <CRMOriginsPanel 
        isOpen={crmPanelOpen} 
        onClose={() => setCrmPanelOpen(false)}
        sidebarWidth={sidebarWidth}
      />

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-14 left-0 bottom-0 w-64 bg-black border-r border-[#ffffff15] z-40 transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full py-4">
          <div className="flex items-center px-4 py-4 mb-4">
            <img src={scaleLogo} alt="Scale" className="w-20" />
          </div>

          <nav className="flex-1 px-2 overflow-y-auto">
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
              
              {/* CRM Button - Mobile */}
              <button
                onClick={() => {
                  setCrmPanelOpen(!crmPanelOpen);
                }}
                className={cn(
                  "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
                  isCRMActive
                    ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <Kanban className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-medium whitespace-nowrap">
                  CRM
                </span>
              </button>
              
              {/* WhatsApp and other bottom nav items - Mobile */}
              {bottomNavItems.map((item) => {
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
                    <item.icon className="h-5 w-5 flex-shrink-0" />
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

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main 
        style={{ marginLeft: `${mainContentMargin}px` }}
        className="hidden lg:block pt-6 min-h-screen p-6 transition-[margin-left] duration-300 ease-out"
      >
        <PageTransition>
          {children}
        </PageTransition>
      </main>
      
      {/* Mobile Main Content */}
      <main className="lg:hidden pt-14 min-h-screen p-4">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  );
});

export default DashboardLayout;
