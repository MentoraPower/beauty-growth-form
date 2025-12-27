import { useState, useCallback, useEffect, memo, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, LayoutGrid, Settings, ChevronDown, User, Inbox, ChevronsLeft, ChevronsRight, SquareUser } from "lucide-react";
import { cn } from "@/lib/utils";
import scaleLogo from "@/assets/scale-logo-menu.png";
import scaleLogoFull from "@/assets/scale-logo-full.png";
import analizerLogo from "@/assets/analizer-logo.png";
import { CRMOriginsPanel } from "./CRMOriginsPanel";
import { PageTransition } from "./PageTransition";
import { LoadingBar } from "@/components/LoadingBar";
import { ConnectionStatus } from "@/components/realtime/ConnectionStatus";
import { supabase } from "@/integrations/supabase/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type ActivePanel = 'none' | 'crm' | 'atendimento' | 'settings' | 'analizer' | 'equipe';

// Load panel state from localStorage
const getInitialPanelState = (): ActivePanel => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('active_panel');
    if (saved === 'crm' || saved === 'atendimento') {
      return saved as ActivePanel;
    }
  }
  return 'crm'; // Default to CRM
};

let globalActivePanel: ActivePanel = getInitialPanelState();

const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(globalActivePanel);
  const [canAccessWhatsapp, setCanAccessWhatsapp] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLElement>(null);

  const isCRMActive = location.pathname.startsWith("/admin/crm") || location.pathname === "/admin";
  const isAtendimentoActive = location.pathname.startsWith("/admin/atendimento");
  const isSettingsActive = location.pathname === "/admin/settings";
  const isAnalizerActive = location.pathname === "/admin/analizer";
  const isEquipeActive = location.pathname === "/admin/equipe";

  // Initialize CRM submenu state from localStorage
  const [crmSubmenuOpen, setCrmSubmenuOpen] = useState(() => {
    const saved = localStorage.getItem('crm_submenu_open');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default: open if on CRM routes
    return location.pathname.startsWith("/admin/crm") || location.pathname === "/admin";
  });

  // Mount/unmount submenu content with a small delay so the open animation stays smooth
  const [crmSubmenuContentMounted, setCrmSubmenuContentMounted] = useState(() => {
    const saved = localStorage.getItem('crm_submenu_open');
    if (saved !== null) {
      return saved === 'true';
    }
    return location.pathname.startsWith("/admin/crm") || location.pathname === "/admin";
  });

  useEffect(() => {
    if (crmSubmenuOpen) {
      const t = window.setTimeout(() => setCrmSubmenuContentMounted(true), 140);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => setCrmSubmenuContentMounted(false), 240);
    return () => window.clearTimeout(t);
  }, [crmSubmenuOpen]);

  // Persist submenu state to localStorage
  useEffect(() => {
    localStorage.setItem('crm_submenu_open', String(crmSubmenuOpen));
  }, [crmSubmenuOpen]);

  // Sync activePanel with current route (without forcing submenu open)
  useEffect(() => {
    if (isEquipeActive && activePanel !== 'equipe') {
      setActivePanel('equipe');
    } else if (isAnalizerActive && activePanel !== 'analizer') {
      setActivePanel('analizer');
    } else if (isAtendimentoActive && activePanel !== 'atendimento') {
      setActivePanel('atendimento');
    } else if (isSettingsActive && activePanel !== 'settings') {
      setActivePanel('settings');
    } else if (isCRMActive && activePanel !== 'crm') {
      setActivePanel('crm');
    }
  }, [location.pathname, isCRMActive, isAtendimentoActive, isSettingsActive, isAnalizerActive, isEquipeActive]);

  // Fetch user permissions for WhatsApp access and user info
  useEffect(() => {
    const fetchPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Set user email
      setUserEmail(user.email || "");
      
      // Fetch profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      
      setUserName(profile?.name || user.email?.split('@')[0] || "Usuário");

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
  const navItems = [
    ...(canAccessWhatsapp ? [{ 
      id: 'atendimento' as ActivePanel, 
      href: "/admin/atendimento", 
      icon: Inbox, 
      label: "Atendimento",
    }] : []),
  ];

  // Sync with global state and localStorage (without affecting submenu)
  useEffect(() => {
    globalActivePanel = activePanel;
    localStorage.setItem('active_panel', activePanel);
  }, [activePanel]);

  // Navigate to CRM immediately; load the first origin in the background only if needed
  const handleNavClick = (panelId: ActivePanel) => {
    setActivePanel(panelId);

    if (panelId === 'crm') {
      setCrmSubmenuOpen(true);

      // Navigate instantly (don't await DB calls)
      const alreadyOnCrm = location.pathname.startsWith('/admin/crm');
      if (!alreadyOnCrm) {
        navigate('/admin/crm');
      }

      // If there's already an origin in the URL, keep it
      const originParam = new URLSearchParams(location.search).get('origin');
      if (originParam) return;

      // Otherwise, resolve the default origin asynchronously and replace the URL
      void (async () => {
        const { data: origins } = await supabase
          .from('crm_origins')
          .select('id')
          .order('ordem')
          .limit(1);

        if (!origins || origins.length === 0) return;

        const { data: subOrigins } = await supabase
          .from('crm_sub_origins')
          .select('id')
          .eq('origin_id', origins[0].id)
          .order('ordem')
          .limit(1);

        if (subOrigins && subOrigins.length > 0) {
          navigate(`/admin/crm?origin=${subOrigins[0].id}`, { replace: true });
        }
      })();

      return;
    }

    setCrmSubmenuOpen(false);
  };

  // Navigate when panel changes
  useEffect(() => {
    if (activePanel === 'atendimento' && !location.pathname.startsWith('/admin/atendimento')) {
      navigate('/admin/atendimento');
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

  // Main content margin - sidebar is overlay, but CRM origins panel pushes content
  const contentGap = 4;
  const getMainContentMargin = () => {
    if (crmSubmenuOpen) {
      return sidebarCollapsedWidth + 12 + submenuWidth + contentGap;
    }
    return sidebarCollapsedWidth + 12 + contentGap;
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

        {/* Desktop Sidebar - Black background, collapsible on hover, overlay mode */}
        <aside
          ref={sidebarRef}
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
          style={{ 
            width: currentSidebarWidth,
            left: 12,
            top: 12,
            height: 'calc(100vh - 1.5rem)',
            transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)',
            borderRight: '1px solid rgba(255, 255, 255, 0.125)',
          }}
          className="hidden lg:flex flex-col fixed bg-[#0f0f12] overflow-hidden z-50 rounded-2xl"
        >
          <div className="flex flex-col h-full relative">
            {/* Logo */}
            <div className="h-14 flex items-center justify-center relative overflow-hidden">
              {/* Icon logo - visible when collapsed */}
              <div 
                className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
                style={{
                  opacity: sidebarExpanded ? 0 : 1,
                  visibility: sidebarExpanded ? 'hidden' : 'visible',
                  transitionDelay: sidebarExpanded ? '0ms' : '100ms',
                }}
              >
                <img 
                  src={scaleLogo} 
                  alt="Scale Beauty" 
                  className="object-contain"
                  style={{ width: 28, height: 28 }}
                />
              </div>
              
              {/* Full logo - visible when expanded */}
              <div 
                className="absolute inset-0 flex items-center pl-3 transition-all duration-500 ease-in-out"
                style={{
                  opacity: sidebarExpanded ? 1 : 0,
                  visibility: sidebarExpanded ? 'visible' : 'hidden',
                  transitionDelay: sidebarExpanded ? '100ms' : '0ms',
                }}
              >
                <img 
                  src={scaleLogoFull} 
                  alt="Scale Beauty" 
                  className="object-contain"
                  style={{ height: 28 }}
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
              <div className="flex flex-col gap-2">
                {/* CRM Button */}
                <button
                  onClick={() => handleNavClick('crm')}
                  className={cn(
                    "relative flex items-center h-10 rounded-lg transition-all duration-200",
                    activePanel === 'crm'
                      ? "bg-white/10 text-white before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
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
                    Espaços
                  </span>
                </button>

                {/* Equipe Button */}
                <button
                  onClick={() => {
                    setActivePanel('equipe');
                    setCrmSubmenuOpen(false);
                    navigate('/admin/equipe');
                  }}
                  className={cn(
                    "relative flex items-center h-10 rounded-lg transition-all duration-200",
                    activePanel === 'equipe'
                      ? "bg-white/10 text-white before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="w-10 flex items-center justify-center flex-shrink-0">
                    <SquareUser className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <span 
                    className={cn(
                      "text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden",
                      sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                    )}
                  >
                    Equipe
                  </span>
                </button>

                {/* Atendimento */}
                {navItems.map((item) => {
                  const isSelected = activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        "relative flex items-center h-10 rounded-lg transition-all duration-200",
                        isSelected
                          ? "bg-white/10 text-white before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
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

                {/* Separator */}
                <div className="my-2 border-t border-white/10" />

                {/* Analizer */}
                <button
                  onClick={() => {
                    setActivePanel('analizer');
                    setCrmSubmenuOpen(false);
                    navigate('/admin/analizer');
                  }}
                  className={cn(
                    "relative flex items-center h-10 rounded-lg transition-all duration-200",
                    activePanel === 'analizer'
                      ? "bg-white/10 text-white before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
                      : "text-white/50 hover:bg-white/5 hover:text-white/70"
                  )}
                >
                  <div className="w-10 flex items-center justify-center flex-shrink-0">
                    <img 
                      src={analizerLogo} 
                      alt="Analizer" 
                      className="w-5 h-5 object-contain"
                      style={{ opacity: activePanel === 'analizer' ? 1 : 0.5 }}
                    />
                  </div>
                  <span 
                    className={cn(
                      "text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden",
                      sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                    )}
                  >
                    Analizer
                  </span>
                </button>
              </div>
            </nav>

            {/* Profile Section with Dropdown */}
            <div className="border-t border-white/10 px-3 py-3">
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className={cn(
                    "relative flex items-center w-full rounded-lg transition-all duration-200",
                    profileMenuOpen 
                      ? "bg-white/20 text-white" 
                      : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  )}
                  style={{ height: profileMenuOpen ? 'auto' : 40 }}
                >
                  <div className="flex items-center w-full py-2">
                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="h-4 w-4 text-white" strokeWidth={1.5} />
                      </div>
                    </div>
                    <div 
                      className={cn(
                        "flex-1 flex items-center justify-between transition-all duration-200 overflow-hidden pr-2",
                        sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                      )}
                    >
                      <span className="text-sm font-medium whitespace-nowrap truncate max-w-[80px]">
                        {userName}
                      </span>
                      <ChevronDown 
                        className={cn(
                          "h-4 w-4 transition-transform duration-200 flex-shrink-0",
                          profileMenuOpen && "rotate-180"
                        )} 
                      />
                    </div>
                  </div>
                </button>
                
                {/* Dropdown Menu */}
                <div 
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    profileMenuOpen ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"
                  )}
                >
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/admin/settings');
                    }}
                    className="flex items-center w-full h-10 rounded-lg transition-all duration-200 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white mb-1"
                  >
                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                      <Settings className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <span 
                      className={cn(
                        "text-sm font-medium whitespace-nowrap transition-all duration-200 overflow-hidden",
                        sidebarExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
                      )}
                    >
                      Configurações
                    </span>
                  </button>
                  
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate("/auth");
                    }}
                    className="flex items-center w-full h-10 rounded-lg transition-all duration-200 bg-white/5 text-white/70 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <div className="w-10 flex items-center justify-center flex-shrink-0">
                      <LogOut className="h-4 w-4" strokeWidth={1.5} />
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
            </div>
          </div>
        </aside>

        {/* CRM Submenu Panel - pushes content (via mainContentMargin) */}
        <div
          style={{
            left: sidebarCollapsedWidth + 12,
            width: submenuWidth,
            transform: crmSubmenuOpen ? 'translateX(0)' : `translateX(-${submenuWidth + 16}px)`,
            opacity: crmSubmenuOpen ? 1 : 0,
            zIndex: 39,
            pointerEvents: crmSubmenuOpen ? 'auto' : 'none',
            willChange: 'transform, opacity',
          }}
          className="hidden lg:block fixed top-[24px] bottom-[24px] rounded-r-2xl bg-zinc-900 overflow-hidden transition-[transform,opacity] duration-300 ease-out"
        >
          <div
            className="h-full pl-4 pr-2"
            style={{
              width: submenuWidth,
              minWidth: submenuWidth,
            }}
          >
            {crmSubmenuContentMounted ? (
              <CRMOriginsPanel
                isOpen={crmSubmenuOpen}
                onClose={() => setCrmSubmenuOpen(false)}
                sidebarWidth={sidebarCollapsedWidth}
                embedded={true}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="text-sm text-white/60">Carregando…</span>
              </div>
            )}
          </div>
        </div>

        {/* Floating button to reopen submenu when closed */}
        {isCRMActive && !crmSubmenuOpen && (
          <button
            onClick={() => setCrmSubmenuOpen(true)}
            style={{ 
              left: sidebarCollapsedWidth + 12 - 16,
              zIndex: 40,
            }}
            className="hidden lg:flex fixed top-1/2 -translate-y-1/2 w-8 h-16 items-center justify-center bg-zinc-900 rounded-r-xl hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <ChevronsRight className="w-4 h-4 text-white" />
          </button>
        )}

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
                      ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <LayoutGrid className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-sm font-medium whitespace-nowrap">
                    CRM
                  </span>
                </button>
                
                {/* Atendimento - Mobile */}
                {navItems.map((item) => {
                  const isActive = activePanel === item.id;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
                        isActive
                          ? "bg-white/10 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[70%] before:w-1.5 before:rounded-r-full before:bg-gradient-to-b before:from-orange-500 before:to-amber-500"
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

            {/* Profile Section - Mobile */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-3 px-4 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-white" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{userName}</p>
                  <p className="text-xs text-white/50 truncate">{userEmail}</p>
                </div>
              </div>
              
              <Link
                to="/admin/settings"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3",
                  isSettingsActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <Settings className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-medium whitespace-nowrap">
                  Configurações
                </span>
              </Link>
              
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/auth");
                }}
                className="relative flex items-center w-full rounded-xl transition-colors duration-200 px-4 py-3 gap-3 text-white/60 hover:bg-red-500/20 hover:text-red-400"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-sm font-medium whitespace-nowrap">
                  Sair
                </span>
              </button>
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

        {/* Main Content - CRM origins panel pushes content */}
        <main 
          style={{ 
            left: `${mainContentMargin}px`,
            top: 12,
            right: 0,
            bottom: 12,
            transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)'
          }}
          className="hidden lg:block fixed"
        >
          <div className="h-full overflow-hidden relative bg-card rounded-l-2xl py-4 px-6 shadow-sm flex flex-col">
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
