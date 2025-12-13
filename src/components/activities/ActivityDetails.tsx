import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Plus, Check, X, ClipboardList, ListChecks, Bold, Italic, List as ListIcon, ListOrdered, Quote, ChevronDown, Heading1, Heading2, Pilcrow, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import { LeadActivity } from "@/hooks/use-lead-activities";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface ActivityDetailsProps {
  activity: LeadActivity | null;
  leadId: string;
  onSaveNotes: (activityId: string, notes: string) => void;
}

export const ActivityDetails = memo(function ActivityDetails({
  activity,
  leadId,
  onSaveNotes,
}: ActivityDetailsProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSavedStatus = useCallback(() => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const resetToolbarTimeout = useCallback(() => {
    if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
    toolbarTimeoutRef.current = setTimeout(() => setShowToolbar(false), 10000);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true, allowBase64: true }),
      TiptapLink.configure({
        openOnClick: true,
        HTMLAttributes: { class: 'text-primary underline hover:text-primary/80 cursor-pointer', target: '_blank' },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      resetToolbarTimeout();
      setSaveStatus('saving');
      if (saveNotesTimeoutRef.current) clearTimeout(saveNotesTimeoutRef.current);
      if (activity) {
        saveNotesTimeoutRef.current = setTimeout(() => {
          onSaveNotes(activity.id, editor.getHTML());
          showSavedStatus();
        }, 800);
      }
    },
    onFocus: () => { 
      setShowToolbar(true); 
      resetToolbarTimeout(); 
    },
  });

  useEffect(() => {
    if (!activity) return;
    setSaveStatus('idle');
    if (activity.tipo === 'checklist') {
      try {
        const items = activity.notas ? JSON.parse(activity.notas) : [];
        setChecklistItems(Array.isArray(items) ? items : []);
      } catch { 
        setChecklistItems([]); 
      }
    } else {
      if (editor && editor.getHTML() !== (activity.notas || "")) {
        editor.commands.setContent(activity.notas || "");
      }
    }
    setShowToolbar(false);
  }, [activity?.id, activity?.tipo, editor]);

  const saveChecklist = useCallback(async (items: ChecklistItem[]) => {
    if (!activity) return;
    setSaveStatus('saving');
    await supabase
      .from("lead_activities")
      .update({ notas: JSON.stringify(items) })
      .eq("id", activity.id);
    showSavedStatus();
  }, [activity, showSavedStatus]);

  const handleAddChecklistItem = useCallback(() => {
    if (!newChecklistItem.trim()) return;
    const newItems = [...checklistItems, { id: crypto.randomUUID(), text: newChecklistItem.trim(), completed: false }];
    setChecklistItems(newItems);
    setNewChecklistItem("");
    saveChecklist(newItems);
  }, [newChecklistItem, checklistItems, saveChecklist]);

  const handleToggleChecklistItem = useCallback((id: string) => {
    const newItems = checklistItems.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setChecklistItems(newItems);
    saveChecklist(newItems);
  }, [checklistItems, saveChecklist]);

  const handleRemoveChecklistItem = useCallback((id: string) => {
    const newItems = checklistItems.filter(item => item.id !== id);
    setChecklistItems(newItems);
    saveChecklist(newItems);
  }, [checklistItems, saveChecklist]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor || !activity || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo inválido (máx 10MB, apenas imagens)');
      return;
    }
    setIsUploadingImage(true);
    try {
      const fileName = `${leadId}/activities/${activity.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('lead_files').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('lead_files').getPublicUrl(fileName);
      editor.chain().focus().setImage({ src: publicUrl }).run();
      toast.success('Imagem adicionada');
    } catch (error) { 
      console.error('Upload error:', error);
      toast.error('Erro ao enviar imagem'); 
    } finally { 
      setIsUploadingImage(false); 
    }
  }, [editor, activity, leadId]);

  if (!activity) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Selecione uma atividade para ver os detalhes
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-black/5">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {activity.tipo === 'tarefas' ? <ClipboardList className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{activity.titulo}</h3>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" />Salvando...</>}
          {saveStatus === 'saved' && <><CheckCircle2 className="h-3 w-3 text-green-500" />Salvo</>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 mt-3 overflow-hidden">
        {activity.tipo === 'checklist' ? (
          <div className="space-y-3 h-full flex flex-col">
            {/* Progress bar */}
            {checklistItems.length > 0 && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300" 
                  style={{ width: `${(checklistItems.filter(i => i.completed).length / checklistItems.length) * 100}%` }} 
                />
              </div>
            )}

            {/* Items list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {checklistItems.map((item, index) => (
                <div key={item.id} className="group flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <button 
                    onClick={() => handleToggleChecklistItem(item.id)} 
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-medium transition-colors", 
                      item.completed ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.completed ? <Check className="h-4 w-4" /> : index + 1}
                  </button>
                  <span className={cn("flex-1 text-sm", item.completed && "line-through text-muted-foreground")}>
                    {item.text}
                  </span>
                  <button 
                    onClick={() => handleRemoveChecklistItem(item.id)} 
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-destructive transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="pt-2 border-t border-black/5">
              {isAddingChecklistItem ? (
                <div className="flex items-center gap-2">
                  <Input 
                    value={newChecklistItem} 
                    onChange={(e) => setNewChecklistItem(e.target.value)} 
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter') { 
                        handleAddChecklistItem(); 
                        setIsAddingChecklistItem(false); 
                      } 
                      if (e.key === 'Escape') {
                        setIsAddingChecklistItem(false);
                        setNewChecklistItem("");
                      }
                    }} 
                    placeholder="Digite o item..." 
                    className="h-9 text-sm" 
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    onClick={() => { 
                      handleAddChecklistItem(); 
                      setIsAddingChecklistItem(false); 
                    }}
                    disabled={!newChecklistItem.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsAddingChecklistItem(true)} 
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Adicionar item
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Toolbar - only visible when active */}
            <div className={cn(
              "flex items-center gap-1 pb-2 border-b border-black/5 transition-all duration-300",
              showToolbar ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden pb-0 border-b-0"
            )}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                    {editor?.isActive("heading", { level: 1 }) ? (
                      <><Heading1 className="h-3.5 w-3.5" />Título 1</>
                    ) : editor?.isActive("heading", { level: 2 }) ? (
                      <><Heading2 className="h-3.5 w-3.5" />Título 2</>
                    ) : (
                      <><Pilcrow className="h-3.5 w-3.5" />Parágrafo</>
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                    <Heading1 className="h-4 w-4 mr-2" />Título 1
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                    <Heading2 className="h-4 w-4 mr-2" />Título 2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor?.chain().focus().setParagraph().run()}>
                    <Pilcrow className="h-4 w-4 mr-2" />Parágrafo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("bold") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("italic") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("bulletList") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("orderedList") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>

              <Separator orientation="vertical" className="h-5 mx-1" />

              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8", editor?.isActive("blockquote") && "bg-muted")}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <Quote className="h-4 w-4" />
              </Button>

              <input 
                type="file" 
                ref={imageInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} 
              />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => imageInputRef.current?.click()} 
                disabled={isUploadingImage} 
                className="h-8 w-8"
              >
                {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </Button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto mt-2">
              <EditorContent 
                editor={editor} 
                className="prose prose-sm max-w-none h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:p-2" 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
