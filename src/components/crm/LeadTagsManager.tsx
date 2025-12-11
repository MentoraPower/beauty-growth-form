import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Tag {
  id: string;
  name: string;
  color: string;
  lead_id: string;
}

interface LeadTagsManagerProps {
  leadId: string;
}

const TAG_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

export function LeadTagsManager({ leadId }: LeadTagsManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<{name: string; color: string}[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    fetchTags();
    fetchAllTags();
  }, [leadId]);

  const fetchTags = async () => {
    const { data, error } = await supabase
      .from("lead_tags")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching tags:", error);
      return;
    }

    setTags(data || []);
  };

  const fetchAllTags = async () => {
    const { data, error } = await supabase
      .from("lead_tags")
      .select("name, color")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching all tags:", error);
      return;
    }

    // Get unique tags by name
    const uniqueTags = data?.reduce((acc: {name: string; color: string}[], tag) => {
      if (!acc.find(t => t.name.toLowerCase() === tag.name.toLowerCase())) {
        acc.push({ name: tag.name, color: tag.color });
      }
      return acc;
    }, []) || [];

    setAllTags(uniqueTags);
  };

  // Filter suggestions based on input - show all matching tags
  const suggestions = newTagName.trim()
    ? allTags.filter(tag => 
        tag.name.toLowerCase().includes(newTagName.toLowerCase())
      ).map(tag => ({
        ...tag,
        alreadyAdded: !!tags.find(t => t.name.toLowerCase() === tag.name.toLowerCase())
      }))
    : [];

  const handleSelectSuggestion = (suggestion: {name: string; color: string; alreadyAdded: boolean}) => {
    if (suggestion.alreadyAdded) {
      toast.info("Essa tag já está adicionada neste lead");
      return;
    }
    setNewTagName(suggestion.name);
    setSelectedColor(suggestion.color);
    setShowColorPicker(true);
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    // Check if tag with same name already exists on this lead
    const existingTag = tags.find(
      t => t.name.toLowerCase() === newTagName.trim().toLowerCase()
    );
    if (existingTag) {
      toast.error("Essa tag já existe neste lead");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("lead_tags")
      .insert({
        lead_id: leadId,
        name: newTagName.trim(),
        color: selectedColor,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding tag:", error);
      toast.error("Erro ao adicionar tag");
      setIsLoading(false);
      return;
    }

    setTags([...tags, data]);
    setNewTagName("");
    setSelectedColor(TAG_COLORS[0]);
    setShowColorPicker(false);
    setIsOpen(false);
    setIsLoading(false);
    toast.success("Tag adicionada");
  };

  const handleRemoveTag = async (tagId: string) => {
    const { error } = await supabase
      .from("lead_tags")
      .delete()
      .eq("id", tagId);

    if (error) {
      console.error("Error removing tag:", error);
      toast.error("Erro ao remover tag");
      return;
    }

    setTags(tags.filter((t) => t.id !== tagId));
    toast.success("Tag removida");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="hover:opacity-70 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {/* Add tag button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-5 px-1.5 text-[10px] border-[#00000010] bg-transparent hover:bg-muted/50 transition-all duration-300 w-fit"
            onMouseEnter={() => setTimeout(() => setIsHovered(true), 150)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Plus className="h-3 w-3" />
            <span
              className={`overflow-hidden transition-all duration-300 ${
                isHovered || isOpen ? "max-w-[100px] ml-1 opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              Adicionar tag
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Nome</p>
              <Input
                placeholder="Nome da tag"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddTag();
                  }
                }}
              />
              
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-2 border border-black/10 rounded-md overflow-hidden">
                  {suggestions.slice(0, 5).map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm transition-colors text-left ${
                        suggestion.alreadyAdded 
                          ? "bg-muted/30 text-muted-foreground cursor-default" 
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: suggestion.color }}
                      />
                      <span className="flex-1">{suggestion.name}</span>
                      {suggestion.alreadyAdded && (
                        <span className="text-xs text-muted-foreground">já adicionada</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preview - only show when no suggestions match OR after selecting a suggestion */}
            {newTagName.trim() && (suggestions.length === 0 || showColorPicker) && (
              <div className="pt-2 border-t border-black/5">
                <p className="text-xs text-muted-foreground mb-1">
                  {showColorPicker ? "Selecione a cor" : "Clique para escolher a cor"}
                </p>
                <button
                  type="button"
                  onClick={() => setShowColorPicker(true)}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: selectedColor }}
                >
                  {newTagName}
                </button>
              </div>
            )}

            {/* Color picker - only show after clicking preview */}
            {newTagName.trim() && showColorPicker && (
              <div>
                <div className="grid grid-cols-8 gap-1.5">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                        selectedColor === color
                          ? "ring-2 ring-offset-2 ring-black/20"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleAddTag}
              disabled={!newTagName.trim() || isLoading}
              className="w-full h-8 text-sm bg-gradient-to-r from-[#F40000] to-[#A10000] hover:opacity-90 text-white"
            >
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
