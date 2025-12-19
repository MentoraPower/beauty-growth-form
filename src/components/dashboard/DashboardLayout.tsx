import { useState, useCallback, useEffect, memo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import WhatsAppIcon from "@/components/icons/WhatsApp";
import scaleLogo from "@/assets/scale-logo-white.png";
import { CRMOriginsPanel } from "./CRMOriginsPanel";
import { PageTransition } from "./PageTransition";
import { LoadingBar } from "@/components/LoadingBar";
import { supabase } from "@/integrations/supabase/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type ActivePanel = 'none' | 'crm' | 'whatsapp' | 'settings';

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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(globalActivePanel);
  const [crmSubmenuOpen, setCrmSubmenuOpen] = useState(activePanel === 'crm');
  const [canAccessWhatsapp, setCanAccessWhatsapp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLElement>(null);

  const isCRMActive = location.pathname.startsWith("/admin/crm") || location.pathname === "/admin";
  const isWhatsAppActive = location.pathname === "/admin/whatsapp";
  const isSettingsActive = location.pathname === "/admin/settings";

  // Sync activePanel with current route
  useEffect(() => {
    if (isWhatsAppActive && activePanel !== 'whatsapp') {
      setActivePanel('whatsapp');
      setCrmSubmenuOpen(false);
    } else if (isSettingsActive && activePanel !== 'settings') {
      setActivePanel('settings');
      setCrmSubmenuOpen(false);
    } else if (isCRMActive && activePanel !== 'crm') {
      setActivePanel('crm');
      setCrmSubmenuOpen(true);
    }
  }, [location.pathname, isCRMActive, isWhatsAppActive, isSettingsActive]);

  // Fetch user permissions for WhatsApp access
  useEffect(() => {
    const fetchPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin first
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData?.role === 'admin') {
        setCanAccessWhatsapp(true);
        return;
      }

      // Check user_permissions
      const { data: permissions } = await supabase
        .from('user_permissions')
        .select('can_access_whatsapp')
        .eq('user_id', user.id)
        .single();

      setCanAccessWhatsapp(permissions?.can_access_whatsapp ?? false);
    };

    fetchPermissions();
  }, []);

  // Build nav items based on permissions
  const bottomNavItems = [
    ...(canAccessWhatsapp ? [{ 
      id: 'whatsapp' as ActivePanel, 
      href: "/admin/whatsapp", 
      icon: WhatsAppIcon, 
      label: "WhatsApp",
    }] : []),
    { 
      id: 'settings' as ActivePanel, 
      href: "/admin/settings", 
      icon: Settings, 
      label: "Configurações",
    },
  ];

  // Sync with global state and localStorage
  useEffect(() => {
    globalActivePanel = activePanel;
    localStorage.setItem('active_panel', activePanel);
    
    // Open/close CRM submenu based on active panel
    setCrmSubmenuOpen(activePanel === 'crm');
  }, [activePanel]);

  // Navigate to first origin overview when CRM is clicked
  const handleNavClick = async (panelId: ActivePanel) => {
    setActivePanel(panelId);
    
    if (panelId === 'crm') {
      setCrmSubmenuOpen(true);
      if (!location.pathname.startsWith('/admin/crm')) {
        // Fetch first origin and navigate to its overview
        const { data: origins } = await supabase
          .from('crm_origins')
          .select('id')
          .order('ordem')
          .limit(1);
        
        if (origins && origins.length > 0) {
          navigate(`/admin/crm/overview?origin=${origins[0].id}`);
        }
      }
    } else {
      setCrmSubmenuOpen(false);
    }
  };

  // Navigate when panel changes
  useEffect(() => {
    if (activePanel === 'whatsapp' && location.pathname !== '/admin/whatsapp') {
      navigate('/admin/whatsapp');
    }
    if (activePanel === 'settings' && location.pathname !== '/admin/settings') {
      navigate('/admin/settings');
    }
  }, [activePanel, location.pathname, navigate]);

  // Sidebar dimensions
  const sidebarCollapsedWidth = 64;
  const sidebarExpandedWidth = 180;
  const submenuWidth = 256;

  // Current sidebar width based on expanded state
  const currentSidebarWidth = sidebarExpanded ? sidebarExpandedWidth : sidebarCollapsedWidth;

  // Calculate main content margin
  const getMainContentMargin = () => {
    if (crmSubmenuOpen) {
      return currentSidebarWidth + 4 + submenuWidth + 12;
    }
    return currentSidebarWidth + 24;
  };

  const mainContentMargin = getMainContentMargin();

  return (
    <div className="min-h-screen bg-card p-3">
      <div className="min-h-[calc(100vh-1.5rem)] relative">
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

        {/* Desktop Sidebar - Black background, collapsible on hover */}
        <aside
          ref={sidebarRef}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
          style={{ 
            width: currentSidebarWidth,
            left: 12,
            top: 12,
            height: 'calc(100vh - 1.5rem)',
            transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)'
          }}
          className="hidden lg:flex flex-col fixed bg-[#0f0f12] overflow-hidden z-40 rounded-2xl"
        >
          <div className="flex flex-col h-full relative">
            {/* Logo - Fixed at top left corner */}
            <div className="h-14 flex items-center pl-[18px]">
              <img src={scaleLogo} alt="Scale Beauty" className="w-7 h-auto opacity-50" />
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
              <div className="flex flex-col gap-2">
                {/* CRM Button */}
                <button
                  onClick={() => handleNavClick('crm')}
                  className={cn(
                    "relative flex items-center h-10 rounded-lg transition-all duration-200",
                    activePanel === 'crm'
                      ? "bg-white text-[#0f0f12] before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                      : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  )}
                >
                  <div className="w-10 flex items-center justify-center flex-shrink-0">
                    <LayoutGrid className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <span 
                    className={cn(
                      "text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden",
                      sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                    )}
                  >
                    CRM
                  </span>
                </button>
                
                {/* WhatsApp */}
                {bottomNavItems.map((item) => {
                  const isSelected = activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        "relative flex items-center h-10 rounded-lg transition-all duration-200",
                        isSelected
                          ? "bg-white text-[#0f0f12] before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#F40000] before:to-[#A10000]"
                          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                      )}
                    >
                      <div className="w-10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span 
                        className={cn(
                          "text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden",
                          sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Footer */}
            <div className="border-t border-white/10 px-3 py-3">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/auth");
                }}
                className="relative flex items-center h-10 w-full rounded-lg transition-all duration-200 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              >
                <div className="w-10 flex items-center justify-center flex-shrink-0">
                  <LogOut className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <span 
                  className={cn(
                    "text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden",
                    sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                  )}
                >
                  Sair
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* CRM Submenu Panel - appears below fixed menu */}
        <div
          style={{ 
            left: currentSidebarWidth + 4,
            width: crmSubmenuOpen ? submenuWidth : 0,
            opacity: crmSubmenuOpen ? 1 : 0,
            zIndex: 39,
            pointerEvents: crmSubmenuOpen ? 'auto' : 'none',
            transition: "width 400ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease-out, left 300ms cubic-bezier(0.4,0,0.2,1)",
          }}
          className="hidden lg:block fixed top-[18px] h-[calc(100vh-1.5rem-6px)] rounded-r-2xl bg-[#ebebed] overflow-hidden"
        >
          <div className="h-full pl-4 pr-2" style={{ width: submenuWidth, minWidth: submenuWidth }}>
            <CRMOriginsPanel 
              isOpen={true} 
              onClose={() => {}}
              sidebarWidth={currentSidebarWidth}
              embedded={true}
            />
          </div>
        </div>

        {/* Mobile Sidebar */}
        <aside
          className={cn(
            "lg:hidden fixed top-14 left-0 bottom-0 w-64 bg-[#0f0f12] border-r border-white/10 z-40 transform transition-transform duration-300 ease-in-out",
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
                  <LayoutGrid className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-sm font-medium whitespace-nowrap">
                    CRM
                  </span>
                </button>
                
                {/* WhatsApp & Settings - Mobile */}
                {bottomNavItems.map((item) => {
                  const isActive = item.id === 'whatsapp' ? isWhatsAppActive : item.id === 'settings' ? isSettingsActive : false;
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
          style={{ 
            left: `${mainContentMargin}px`,
            top: 12,
            right: 12,
            bottom: 12,
            transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)'
          }}
          className="hidden lg:block fixed"
        >
          <div className="h-full overflow-auto relative bg-card rounded-2xl p-6 border border-black/5">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
        
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
