import { useState, useCallback, useEffect, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Menu, X, LogOut, Kanban, ChevronRight, BarChart3, Users, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import scaleLogo from "@/assets/scale-logo-new.png";
import { CRMOriginsPanel } from "./CRMOriginsPanel";
import { PageTransition } from "./PageTransition";
import { LoadingBar } from "@/components/LoadingBar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type ActivePanel = 'none' | 'dashboard' | 'crm' | 'whatsapp';

const navItems = [
  { 
    id: 'dashboard' as ActivePanel, 
    href: "/admin", 
    icon: LayoutDashboard, 
    label: "Dashboard",
    subItems: [
      { href: "/admin", icon: BarChart3, label: "Visão Geral" },
    ]
  },
];

const bottomNavItems = [
  { 
    id: 'whatsapp' as ActivePanel, 
    href: "/admin/whatsapp", 
    icon: WhatsAppIcon, 
    label: "WhatsApp",
    subItems: [
      { href: "/admin/whatsapp", icon: WhatsAppIcon, label: "Conversas" },
    ]
  },
];

// Load panel state from localStorage
const getInitialPanelState = (): ActivePanel => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('active_panel');
    if (saved === 'dashboard' || saved === 'crm' || saved === 'whatsapp') {
      return saved;
    }
  }
  return 'none';
};

let globalActivePanel: ActivePanel = getInitialPanelState();

const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(globalActivePanel);
  const location = useLocation();
  const navigate = useNavigate();

  const isCRMActive = location.pathname.startsWith("/admin/crm");
  const isDashboardActive = location.pathname === "/admin";
  const isWhatsAppActive = location.pathname === "/admin/whatsapp";

  // Sync with global state and localStorage
  useEffect(() => {
    globalActivePanel = activePanel;
    localStorage.setItem('active_panel', activePanel);
  }, [activePanel]);

  const handleNavClick = (panelId: ActivePanel) => {
    if (activePanel === panelId) {
      setActivePanel('none');
    } else {
      setActivePanel(panelId);
    }
  };

  const handleSubItemClick = (href: string) => {
    navigate(href);
  };

  // Fixed sidebar width (always collapsed) - wider to extend under submenu
  const sidebarWidth = 88;

  // Calculate main content margin based on panel state (accounting for outer padding)
  const getMainContentMargin = () => {
    const outerPadding = 8; // p-2 = 8px
    // Panels now start at sidebarWidth - 8, so we account for that
    if (activePanel === 'crm') return sidebarWidth - 8 + 256 + 8 + outerPadding; // w-64 = 256px
    if (activePanel === 'dashboard' || activePanel === 'whatsapp') return sidebarWidth - 8 + 224 + 8 + outerPadding; // w-56 = 224px
    return sidebarWidth + outerPadding;
  };

  const mainContentMargin = getMainContentMargin();

  return (
    <div className="min-h-screen bg-card p-2">
      <div className="min-h-[calc(100vh-1rem)] bg-[#0f0f12] rounded-2xl relative">
      <LoadingBar />
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

      {/* Desktop Sidebar - Fixed Collapsed */}
      <aside
        style={{ width: sidebarWidth }}
        className="hidden lg:flex flex-col fixed left-2 top-2 h-[calc(100vh-1rem)] bg-card overflow-hidden z-40 rounded-l-2xl"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="pt-6 pb-4 pl-2 pr-6 flex justify-start">
            <div className="w-10 flex items-center">
              <img src={scaleLogo} alt="Scale Beauty" className="w-full h-auto" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden pl-2 pr-6 py-2">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = item.id === 'dashboard' ? isDashboardActive : false;
                const isPanelOpen = activePanel === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "relative flex items-center justify-center w-full rounded-xl transition-colors duration-200 p-2.5",
                      isActive || isPanelOpen
                        ? "bg-muted text-foreground before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                  </button>
                );
              })}
              
              {/* CRM Button */}
              <button
                onClick={() => handleNavClick('crm')}
                className={cn(
                  "relative flex items-center justify-center w-full rounded-xl transition-colors duration-200 p-2.5",
                  isCRMActive || activePanel === 'crm'
                    ? "bg-muted text-foreground before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Kanban className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
              </button>
              
              {/* WhatsApp */}
              {bottomNavItems.map((item) => {
                const isActive = item.id === 'whatsapp' ? isWhatsAppActive : false;
                const isPanelOpen = activePanel === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "relative flex items-center justify-center w-full rounded-xl transition-colors duration-200 p-2.5",
                      isActive || isPanelOpen
                        ? "bg-muted text-foreground before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-border pl-2 pr-6 py-3">
            <Link
              to="/"
              className="relative flex items-center justify-center w-full rounded-xl transition-colors duration-200 p-2.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Dashboard Submenu Panel */}
      <div
        style={{ left: sidebarWidth - 8 }}
        className={cn(
          "hidden lg:block fixed top-2 h-[calc(100vh-1rem)] w-56 rounded-2xl bg-[#0f0f12] z-50 transition-all duration-300 ease-out overflow-hidden pl-4",
          activePanel === 'dashboard' ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        <div className="p-4 pl-0 h-full flex flex-col">
          <h2 className="text-white font-semibold text-sm mb-4 px-2">Dashboard</h2>
          <div className="flex flex-col gap-1">
            {navItems[0].subItems.map((subItem) => {
              const isActive = location.pathname === subItem.href;
              return (
                <button
                  key={subItem.href}
                  onClick={() => handleSubItemClick(subItem.href)}
                  className={cn(
                    "flex items-center gap-3 w-full py-2.5 px-3 rounded-xl transition-all duration-200 text-sm",
                    isActive 
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <subItem.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{subItem.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* WhatsApp Submenu Panel */}
      <div
        style={{ left: sidebarWidth - 8 }}
        className={cn(
          "hidden lg:block fixed top-2 h-[calc(100vh-1rem)] w-56 rounded-2xl bg-[#0f0f12] z-50 transition-all duration-300 ease-out overflow-hidden pl-4",
          activePanel === 'whatsapp' ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        <div className="p-4 pl-0 h-full flex flex-col">
          <h2 className="text-white font-semibold text-sm mb-4 px-2">WhatsApp</h2>
          <div className="flex flex-col gap-1">
            {bottomNavItems[0].subItems.map((subItem) => {
              const isActive = location.pathname === subItem.href;
              return (
                <button
                  key={subItem.href}
                  onClick={() => handleSubItemClick(subItem.href)}
                  className={cn(
                    "flex items-center gap-3 w-full py-2.5 px-3 rounded-xl transition-all duration-200 text-sm",
                    isActive 
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <subItem.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{subItem.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CRM Origins Panel - Desktop */}
      <CRMOriginsPanel 
        isOpen={activePanel === 'crm'} 
        onClose={() => setActivePanel('none')}
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
                const isActive = item.id === 'dashboard' ? isDashboardActive : false;
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
                  handleNavClick('crm');
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
                const isActive = item.id === 'whatsapp' ? isWhatsAppActive : false;
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

      {/* Main Content with rounded corners */}
      <main 
        style={{ left: `${mainContentMargin}px` }}
        className="hidden lg:block fixed top-2 right-2 bottom-2 transition-[left] duration-300 ease-out"
      >
        <div className="bg-[#0f0f12] rounded-2xl h-full p-2">
          <div className="bg-card rounded-xl h-full p-6 overflow-auto relative">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </div>
      </main>
      
      {/* Mobile Main Content */}
      {/* Mobile Main Content */}
      <main className="lg:hidden pt-14 min-h-screen p-4">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
      </div>
    </div>
  );
});

export default DashboardLayout;
