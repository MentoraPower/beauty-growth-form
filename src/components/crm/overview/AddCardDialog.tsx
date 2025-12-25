import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  PieChart, 
  Users, 
  TrendingUp, 
  Target, 
  List, 
  Tag, 
  Filter,
  Star,
  BarChart3,
  Hash,
  ListOrdered
} from "lucide-react";
import { CARD_TEMPLATES, CardTemplate } from "./types";
import { cn } from "@/lib/utils";

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onAddCard: (template: CardTemplate) => void;
}

const CATEGORIES = [
  { id: "featured", label: "Destaques", icon: Star },
  { id: "charts", label: "Gráficos", icon: BarChart3 },
  { id: "metrics", label: "Métricas", icon: Hash },
  { id: "lists", label: "Listas", icon: ListOrdered },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PieChart,
  Users,
  TrendingUp,
  Target,
  List,
  Tag,
  Filter,
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
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg font-semibold">Adicionar cartão</DialogTitle>
        </DialogHeader>
        
        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-56 border-r border-border p-3 flex flex-col gap-1">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                    selectedCategory === category.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </button>
              );
            })}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Cards Grid */}
            <ScrollArea className="flex-1 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                {CATEGORIES.find(c => c.id === selectedCategory)?.label || "Todos"}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {filteredTemplates.map((template) => {
                  const Icon = ICON_MAP[template.icon] || PieChart;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleAddCard(template)}
                      className="group flex flex-col bg-white border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all text-left"
                    >
                      {/* Preview Area */}
                      <div className="h-32 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                      
                      {/* Info */}
                      <div className="p-3">
                        <h4 className="font-medium text-sm text-foreground">{template.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
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
