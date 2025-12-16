import { useState, useCallback, useEffect, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, Kanban, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import scaleLogo from "@/assets/scale-logo-new.png";
import { CRMOriginsPanel } from "./CRMOriginsPanel";
import { PageTransition } from "./PageTransition";
import { LoadingBar } from "@/components/LoadingBar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type ActivePanel = 'none' | 'crm' | 'whatsapp';

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
    if (saved === 'crm' || saved === 'whatsapp') {
      return saved;
    }
  }
  return 'crm'; // Default to CRM
};

let globalActivePanel: ActivePanel = getInitialPanelState();

const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(globalActivePanel);
  const location = useLocation();
  const navigate = useNavigate();

  const isCRMActive = location.pathname.startsWith("/admin/crm") || location.pathname === "/admin";
  const isWhatsAppActive = location.pathname === "/admin/whatsapp";

  // Sync with global state and localStorage
  useEffect(() => {
    globalActivePanel = activePanel;
    localStorage.setItem('active_panel', activePanel);
  }, [activePanel]);

  // Submenu stays open, just switches content
  const handleNavClick = (panelId: ActivePanel) => {
    setActivePanel(panelId);
  };

  const handleSubItemClick = (href: string) => {
    navigate(href);
  };

  // Fixed sidebar width (always collapsed) - wider to extend under submenu
  const sidebarWidth = 88;
  const submenuWidth = 256; // w-64 = 256px - unified width

  // Check if submenu should be visible (only for CRM, not WhatsApp)
  const isSubmenuVisible = activePanel === 'crm';

  // Margin changes based on whether submenu is visible
  const getMainContentMargin = () => {
    const outerPadding = 8; // p-2 = 8px
    if (isSubmenuVisible) {
      return sidebarWidth - 8 + submenuWidth + 8 + outerPadding;
    }
    // When WhatsApp is active, content extends to sidebar edge
    return sidebarWidth + outerPadding;
  };

  const mainContentMargin = getMainContentMargin();

  // Navigate to WhatsApp when panel changes to whatsapp
  useEffect(() => {
    if (activePanel === 'whatsapp' && location.pathname !== '/admin/whatsapp') {
      navigate('/admin/whatsapp');
    }
  }, [activePanel, location.pathname, navigate]);

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
        style={{ width: sidebarWidth + 2 }}
        className="hidden lg:flex flex-col fixed left-2 top-2 h-[calc(100vh-1rem)] bg-white overflow-hidden z-40 rounded-l-2xl"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="pt-6 pb-4 flex justify-center items-center">
            <div className="w-10 flex items-center justify-center">
              <img src={scaleLogo} alt="Scale Beauty" className="w-full h-auto" />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto overflow-x-hidden pl-2 pr-6 py-2">
            <div className="flex flex-col gap-2">
              {/* CRM Button */}
              <button
                onClick={() => handleNavClick('crm')}
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200",
                  activePanel === 'crm'
                    ? "bg-[#2d2d3a] text-white before:absolute before:-left-2 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                    : "bg-[#f8f8fa] text-neutral-500 hover:bg-[#ededf0] hover:text-neutral-700"
                )}
              >
                <Kanban className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
              </button>
              
              {/* WhatsApp */}
              {bottomNavItems.map((item) => {
                const isSelected = activePanel === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200",
                      isSelected
                        ? "bg-[#2d2d3a] text-white before:absolute before:-left-2 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                        : "bg-[#f8f8fa] text-neutral-500 hover:bg-[#ededf0] hover:text-neutral-700"
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
              className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 bg-[#f8f8fa] text-neutral-500 hover:bg-[#ededf0] hover:text-neutral-700"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Unified Submenu Panel - Only visible for CRM */}
      <div
        style={{ 
          left: sidebarWidth - 8, 
          width: submenuWidth,
          opacity: isSubmenuVisible ? 1 : 0,
          transform: isSubmenuVisible ? 'translateX(0)' : 'translateX(-20px)',
          pointerEvents: isSubmenuVisible ? 'auto' : 'none'
        }}
        className="hidden lg:block fixed top-2 h-[calc(100vh-1rem)] rounded-2xl bg-[#0f0f12] z-50 overflow-hidden pl-4 transition-all duration-300 ease-out"
      >
        {/* CRM Content */}
        {activePanel === 'crm' && (
          <CRMOriginsPanel 
            isOpen={true} 
            onClose={() => {}}
            sidebarWidth={sidebarWidth}
            embedded={true}
          />
        )}
      </div>

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
