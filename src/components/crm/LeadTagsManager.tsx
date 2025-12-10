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
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTags();
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

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

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
    <div className="flex flex-col gap-2">
      {/* Tags display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      )}

      {/* Add tag button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-[#00000010] bg-transparent hover:bg-muted/50 transition-all duration-200 w-fit"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span
              className={`overflow-hidden transition-all duration-200 ${
                isHovered || isOpen ? "max-w-[100px] ml-1 opacity-100" : "max-w-0 opacity-0"
              }`}
            >
              Adicionar tag
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
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

            {/* Color picker */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Cor</p>
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

            {/* Preview */}
            {newTagName && (
              <div className="pt-2 border-t border-black/5">
                <p className="text-xs text-muted-foreground mb-1">Preview</p>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: selectedColor }}
                >
                  {newTagName}
                </span>
              </div>
            )}

            <Button
              onClick={handleAddTag}
              disabled={!newTagName.trim() || isLoading}
              className="w-full h-8 text-sm"
            >
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
