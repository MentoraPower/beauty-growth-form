import { useRef, useLayoutEffect, useState, memo, ReactNode, useEffect } from "react";
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
import { GripVertical, X } from "lucide-react";

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

const STORAGE_KEY = "crm-tabs-config";

interface TabConfig {
  order: CRMView[];
  hidden: CRMView[];
}

function loadTabConfig(): TabConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        order: parsed.order || defaultTabs.map(t => t.id),
        hidden: parsed.hidden || [],
      };
    }
  } catch (e) {
    console.error("Failed to load tab config:", e);
  }
  return { order: defaultTabs.map(t => t.id), hidden: [] };
}

function saveTabConfig(config: TabConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save tab config:", e);
  }
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
        <div
          ref={setNodeRef}
          style={style}
          className="relative flex items-center group"
        >
          {/* Drag handle - appears on hover */}
          <div
            {...attributes}
            {...listeners}
            className="absolute -left-4 opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
          
          <button
            ref={setTabRef}
            onClick={() => onViewChange(tab.id)}
            onMouseEnter={() => onTabHover?.(tab.id)}
            className={cn(
              "relative text-[13px] font-semibold tracking-wide transition-colors duration-150 pb-0.5",
              isActive 
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {tab.label}
          </button>
        </div>
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
  const [tabConfig, setTabConfig] = useState<TabConfig>(loadTabConfig);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Get visible tabs in order
  const visibleTabs = tabConfig.order
    .filter(id => !tabConfig.hidden.includes(id))
    .map(id => defaultTabs.find(t => t.id === id))
    .filter((t): t is TabItem => t !== undefined);

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
  }, [activeView, visibleTabs]);

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
      saveTabConfig(newConfig);
    }
  };

  const handleHideTab = (id: CRMView) => {
    const newHidden = [...tabConfig.hidden, id];
    const newConfig = { ...tabConfig, hidden: newHidden };
    
    setTabConfig(newConfig);
    saveTabConfig(newConfig);
    
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
    saveTabConfig(newConfig);
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
