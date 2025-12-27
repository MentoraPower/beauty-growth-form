import { useRef, useLayoutEffect, useState, memo, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CRMView = "overview" | "quadro" | "lista" | "calendario" | "email";

interface ViewTabsProps {
  activeView: CRMView;
  onViewChange: (view: CRMView) => void;
  onSettingsClick: () => void;
  extraActions?: ReactNode;
  onTabHover?: (view: CRMView) => void;
}

const tabs: { id: CRMView; label: string }[] = [
  { id: "overview", label: "OverView" },
  { id: "quadro", label: "Quadro" },
  { id: "lista", label: "List" },
  { id: "calendario", label: "Calendário" },
];

export const ViewTabs = memo(function ViewTabs({ activeView, onViewChange, onSettingsClick, extraActions, onTabHover }: ViewTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<CRMView, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  // Update indicator position when active view changes
  useLayoutEffect(() => {
    const activeTab = tabRefs.current.get(activeView);
    const container = containerRef.current;
    
    if (activeTab && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    }
  }, [activeView]);

  const setTabRef = (id: CRMView) => (el: HTMLButtonElement | null) => {
    if (el) {
      tabRefs.current.set(id, el);
    } else {
      tabRefs.current.delete(id);
    }
  };

  return (
    <div className="w-full mb-4">
      <div className="w-full flex items-center justify-between bg-white rounded-lg px-4 py-2.5" style={{ border: '1px solid #00000010' }}>
        <div ref={containerRef} className="relative inline-flex items-center gap-5">
          {/* Animated gradient indicator */}
          <div 
            className="absolute -bottom-1 h-[2px] rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
            style={{
              left: indicator.left,
              width: indicator.width,
              transition: "left 200ms cubic-bezier(0.4, 0, 0.2, 1), width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
          
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={setTabRef(tab.id)}
              onClick={() => onViewChange(tab.id)}
              onMouseEnter={() => onTabHover?.(tab.id)}
              className={cn(
                "relative text-[13px] font-semibold tracking-wide transition-colors duration-150 pb-0.5",
                activeView === tab.id 
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              {tab.label}
            </button>
          ))}
          
          {/* Separator */}
          <div className="w-px h-4 bg-border mx-1" />
          
          <button
            ref={setTabRef("email")}
            onClick={() => onViewChange("email")}
            onMouseEnter={() => onTabHover?.("email")}
            className={cn(
              "relative text-[13px] font-semibold tracking-wide transition-colors duration-150 pb-0.5",
              activeView === "email" 
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            Automations
          </button>
        </div>

        {/* Extra Actions + Settings Icon */}
        <div className="flex items-center gap-2">
          {extraActions}
          <button 
            onClick={onSettingsClick}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});
