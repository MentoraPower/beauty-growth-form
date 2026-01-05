import { useRef, useLayoutEffect, useState, memo, ReactNode, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { X, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

type CRMView = "overview" | "quadro" | "lista" | "calendario" | "email";

interface ViewTabsProps {
  activeView: CRMView;
  onViewChange: (view: CRMView) => void;
  onSettingsClick: () => void;
  extraActions?: ReactNode;
  onTabHover?: (view: CRMView) => void;
}

interface TabItem {
  id: CRMView;
  label: string;
}

const defaultTabs: TabItem[] = [
  { id: "overview", label: "OverView" },
  { id: "quadro", label: "Quadro" },
  { id: "lista", label: "List" },
  { id: "calendario", label: "Calendário" },
];

const defaultOrder: CRMView[] = ["overview", "quadro", "lista", "calendario"];

interface TabConfig {
  order: CRMView[];
  hidden: CRMView[];
}

interface SortableTabProps {
  tab: TabItem;
  isActive: boolean;
  onViewChange: (view: CRMView) => void;
  onTabHover?: (view: CRMView) => void;
  onHide: (id: CRMView) => void;
  setTabRef: (el: HTMLButtonElement | null) => void;
}

function SortableTab({ tab, isActive, onViewChange, onTabHover, onHide, setTabRef }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={(el) => {
            setNodeRef(el);
            setTabRef(el);
          }}
          onClick={() => onViewChange(tab.id)}
          onMouseEnter={() => onTabHover?.(tab.id)}
          style={style}
          className={cn(
            "relative text-[13px] font-semibold tracking-wide transition-colors duration-150 pb-0.5 cursor-grab active:cursor-grabbing",
            isActive 
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/80"
          )}
          {...attributes}
          {...listeners}
        >
          {tab.label}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[160px]">
        <ContextMenuItem
          onClick={() => onHide(tab.id)}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <X className="w-4 h-4 mr-2" />
          Ocultar aba
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const ViewTabs = memo(function ViewTabs({ activeView, onViewChange, onSettingsClick, extraActions, onTabHover }: ViewTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<CRMView, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [tabConfig, setTabConfig] = useState<TabConfig>({ order: defaultOrder, hidden: [] });
  const [isLoading, setIsLoading] = useState(true);
  const { currentWorkspace } = useWorkspace();
  const saveTimeoutRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Load tab config from database
  useEffect(() => {
    if (!currentWorkspace?.id) {
      setIsLoading(false);
      return;
    }

    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('crm_tab_preferences')
          .select('tab_order, hidden_tabs')
          .eq('workspace_id', currentWorkspace.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading tab config:', error);
        } else if (data) {
          setTabConfig({
            order: (data.tab_order as CRMView[]) || defaultOrder,
            hidden: (data.hidden_tabs as CRMView[]) || [],
          });
        }
      } catch (e) {
        console.error('Failed to load tab config:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [currentWorkspace?.id]);

  // Save tab config to database (debounced)
  const saveConfig = useCallback((config: TabConfig) => {
    if (!currentWorkspace?.id) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid too many requests
    saveTimeoutRef.current = window.setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('crm_tab_preferences')
          .upsert({
            workspace_id: currentWorkspace.id,
            tab_order: config.order,
            hidden_tabs: config.hidden,
          }, {
            onConflict: 'workspace_id',
          });

        if (error) {
          console.error('Error saving tab config:', error);
        }
      } catch (e) {
        console.error('Failed to save tab config:', e);
      }
    }, 500);
  }, [currentWorkspace?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get visible tabs in order - memoized to avoid infinite loops
  const visibleTabs = useMemo(() => {
    return tabConfig.order
      .filter(id => !tabConfig.hidden.includes(id))
      .map(id => defaultTabs.find(t => t.id === id))
      .filter((t): t is TabItem => t !== undefined);
  }, [tabConfig.order, tabConfig.hidden]);

  // Stable key for visible tabs to use in dependencies
  const visibleTabsKey = visibleTabs.map(t => t.id).join(',');

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
  }, [activeView, visibleTabsKey]);

  const setTabRef = (id: CRMView) => (el: HTMLButtonElement | null) => {
    if (el) {
      tabRefs.current.set(id, el);
    } else {
      tabRefs.current.delete(id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = tabConfig.order.indexOf(active.id as CRMView);
      const newIndex = tabConfig.order.indexOf(over.id as CRMView);
      
      const newOrder = arrayMove(tabConfig.order, oldIndex, newIndex);
      const newConfig = { ...tabConfig, order: newOrder };
      
      setTabConfig(newConfig);
      saveConfig(newConfig);
    }
  };

  const handleHideTab = (id: CRMView) => {
    const newHidden = [...tabConfig.hidden, id];
    const newConfig = { ...tabConfig, hidden: newHidden };
    
    setTabConfig(newConfig);
    saveConfig(newConfig);
    
    // If hiding the active tab, switch to another visible tab
    if (id === activeView) {
      const remainingVisible = tabConfig.order.filter(
        tabId => !newHidden.includes(tabId) && defaultTabs.some(t => t.id === tabId)
      );
      if (remainingVisible.length > 0) {
        onViewChange(remainingVisible[0]);
      }
    }
  };

  // Show hidden tabs in context menu of the container
  const hiddenTabs = defaultTabs.filter(t => tabConfig.hidden.includes(t.id));

  const handleShowTab = (id: CRMView) => {
    const newHidden = tabConfig.hidden.filter(h => h !== id);
    const newConfig = { ...tabConfig, hidden: newHidden };
    
    setTabConfig(newConfig);
    saveConfig(newConfig);
  };

  return (
    <div className="w-full mb-2">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="w-full flex items-center justify-between bg-card rounded-lg px-4 py-2 border border-border">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div ref={containerRef} className="relative inline-flex items-center gap-5 pl-4">
                {/* Animated gradient indicator */}
                <div 
                  className="absolute -bottom-[9px] h-[1.5px] rounded-sm bg-gradient-to-r from-orange-400 to-orange-600"
                  style={{
                    left: indicator.left,
                    width: indicator.width,
                    transition: "left 200ms cubic-bezier(0.4, 0, 0.2, 1), width 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
                
                <SortableContext
                  items={visibleTabs.map(t => t.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {visibleTabs.map((tab) => (
                    <SortableTab
                      key={tab.id}
                      tab={tab}
                      isActive={activeView === tab.id}
                      onViewChange={onViewChange}
                      onTabHover={onTabHover}
                      onHide={handleHideTab}
                      setTabRef={setTabRef(tab.id)}
                    />
                  ))}
                </SortableContext>
                
                {/* Add view button - shows hidden tabs */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 hover:bg-muted text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar visualização
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[180px]">
                    {hiddenTabs.length > 0 ? (
                      hiddenTabs.map(tab => (
                        <DropdownMenuItem
                          key={tab.id}
                          onClick={() => handleShowTab(tab.id)}
                          className="cursor-pointer"
                        >
                          {tab.label}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Todas as visualizações já estão visíveis
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Separator */}
                <div className="w-px h-4 bg-border mx-1" />
                
                {/* Automations tab (not draggable/hideable) */}
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
            </DndContext>

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
        </ContextMenuTrigger>
        
        {/* Context menu to restore hidden tabs */}
        {hiddenTabs.length > 0 && (
          <ContextMenuContent className="min-w-[180px]">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Abas ocultas
            </div>
            {hiddenTabs.map(tab => (
              <ContextMenuItem
                key={tab.id}
                onClick={() => handleShowTab(tab.id)}
                className="cursor-pointer"
              >
                Mostrar "{tab.label}"
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        )}
      </ContextMenu>
    </div>
  );
});
