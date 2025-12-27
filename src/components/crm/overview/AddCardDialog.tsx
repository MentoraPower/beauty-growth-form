import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { CARD_TEMPLATES, CardTemplate } from "./types";
import { cn } from "@/lib/utils";

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onAddCard: (template: CardTemplate) => void;
}

const CATEGORIES = [
  { id: "featured", label: "Destaques" },
  { id: "charts", label: "Gráficos" },
  { id: "metrics", label: "Métricas" },
  { id: "lists", label: "Listas" },
];

// Mini chart previews for each chart type
const ChartPreview = ({ type }: { type: string }) => {
  switch (type) {
    case "pie":
      return (
        <svg viewBox="0 0 64 64" className="w-full h-full">
          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle 
            cx="32" cy="32" r="28" 
            fill="none" 
            stroke="hsl(var(--primary))" 
            strokeWidth="8"
            strokeDasharray="110 176"
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
          <circle 
            cx="32" cy="32" r="28" 
            fill="none" 
            stroke="hsl(var(--chart-2))" 
            strokeWidth="8"
            strokeDasharray="44 176"
            strokeDashoffset="-110"
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
        </svg>
      );
    case "area":
      return (
        <svg viewBox="0 0 80 40" className="w-full h-full">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path 
            d="M0,35 Q10,30 20,28 T40,20 T60,25 T80,15 L80,40 L0,40 Z" 
            fill="url(#areaGrad)"
          />
          <path 
            d="M0,35 Q10,30 20,28 T40,20 T60,25 T80,15" 
            fill="none" 
            stroke="hsl(var(--primary))" 
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "bar":
      return (
        <svg viewBox="0 0 64 40" className="w-full h-full">
          <rect x="4" y="22" width="10" height="18" rx="2" fill="hsl(var(--primary))" opacity="0.6" />
          <rect x="18" y="10" width="10" height="30" rx="2" fill="hsl(var(--primary))" />
          <rect x="32" y="16" width="10" height="24" rx="2" fill="hsl(var(--primary))" opacity="0.8" />
          <rect x="46" y="26" width="10" height="14" rx="2" fill="hsl(var(--primary))" opacity="0.5" />
        </svg>
      );
    case "number":
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-2xl font-bold text-foreground">247</span>
          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
              <path d="M6 2L10 7H2L6 2Z" />
            </svg>
            <span>12%</span>
          </div>
        </div>
      );
    case "list":
      return (
        <div className="flex flex-col gap-1.5 px-2 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20" />
              <div className="flex-1 h-2 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      );
    case "funnel":
      return (
        <svg viewBox="0 0 64 48" className="w-full h-full">
          <rect x="4" y="4" width="56" height="10" rx="2" fill="hsl(var(--primary))" />
          <rect x="10" y="18" width="44" height="10" rx="2" fill="hsl(var(--chart-2))" />
          <rect x="18" y="32" width="28" height="10" rx="2" fill="hsl(var(--chart-3))" />
        </svg>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-lg bg-muted" />
      );
  }
};

export function AddCardDialog({ open, onClose, onAddCard }: AddCardDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("featured");

  const filteredTemplates = CARD_TEMPLATES.filter((template) => {
    const matchesSearch = 
      template.title.toLowerCase().includes(search.toLowerCase()) ||
      template.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddCard = (template: CardTemplate) => {
    onAddCard(template);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-4xl max-h-[85vh] h-auto p-0 gap-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-lg font-semibold">Adicionar cartão</DialogTitle>
        </DialogHeader>
        
        <div className="flex h-[520px] max-h-[calc(85vh-60px)]">
          {/* Sidebar */}
          <div className="w-48 border-r border-border p-3 flex flex-col gap-0.5">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-all text-left",
                  selectedCategory === category.id
                    ? "bg-foreground/5 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar cartões..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-muted/30 border-transparent focus:border-border"
                />
              </div>
            </div>

            {/* Cards Grid */}
            <ScrollArea className="flex-1 p-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleAddCard(template)}
                    className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 hover:shadow-lg transition-all text-left"
                  >
                    {/* Preview Area */}
                    <div className="h-28 bg-muted/30 flex items-center justify-center p-4">
                      <div className="w-full h-full flex items-center justify-center">
                        <ChartPreview type={template.chartType} />
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="p-3 border-t border-border/50">
                      <h4 className="font-medium text-sm text-foreground">{template.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {template.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              
              {filteredTemplates.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Nenhum cartão encontrado</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
