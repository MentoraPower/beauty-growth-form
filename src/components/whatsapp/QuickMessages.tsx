import { useState, useEffect, useRef } from "react";
import { Plus, X, Zap, Trash2, Edit2, Check, Search, Mic, Square, Play, Pause, Type, Volume2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QuickMessagesProps {
  onSelect: (message: string) => void;
  onSelectAudio?: (audioBase64: string) => void;
}

interface QuickMessage {
  id: string;
  name: string;
  text: string;
  type: "text" | "audio";
  audioData?: string; // base64 encoded audio
  audioDuration?: number; // duration in seconds
}

export function QuickMessages({ onSelect, onSelectAudio }: QuickMessagesProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addingType, setAddingType] = useState<"text" | "audio">("text");
  const [newName, setNewName] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch messages from database
  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("quick_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setMessages(
        (data || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          text: m.text,
          type: m.type as "text" | "audio",
          audioData: m.audio_data,
          audioDuration: m.audio_duration,
        }))
      );
    } catch (error) {
      console.error("Error fetching quick messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAddText = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from("quick_messages")
        .insert({
          name: newName.trim() || newMessage.slice(0, 30),
          text: newMessage.trim(),
          type: "text",
        })
        .select()
        .single();

      if (error) throw error;

      const msg: QuickMessage = {
        id: data.id,
        name: data.name,
        text: data.text,
        type: "text",
      };
      
      setMessages((prev) => [msg, ...prev]);
      toast({ title: "Mensagem salva!" });
      resetAddForm();
    } catch (error) {
      console.error("Error adding quick message:", error);
      toast({ title: "Erro ao salvar mensagem", variant: "destructive" });
    }
  };

  const handleAddAudio = async () => {
    if (!audioBlob || !newName.trim()) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        
        const { data, error } = await supabase
          .from("quick_messages")
          .insert({
            name: newName.trim(),
            text: "🎵 Áudio",
            type: "audio",
            audio_data: base64,
            audio_duration: recordingTime,
          })
          .select()
          .single();

        if (error) throw error;

        const msg: QuickMessage = {
          id: data.id,
          name: data.name,
          text: data.text,
          type: "audio",
          audioData: data.audio_data,
          audioDuration: data.audio_duration,
        };
        
        setMessages((prev) => [msg, ...prev]);
        toast({ title: "Áudio salvo!" });
        resetAddForm();
      } catch (error) {
        console.error("Error adding audio message:", error);
        toast({ title: "Erro ao salvar áudio", variant: "destructive" });
      }
    };
    reader.readAsDataURL(audioBlob);
  };

  const resetAddForm = () => {
    setNewName("");
    setNewMessage("");
    setIsAdding(false);
    setAddingType("text");
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("quick_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      toast({ title: "Mensagem removida!" });
    } catch (error) {
      console.error("Error deleting quick message:", error);
      toast({ title: "Erro ao remover mensagem", variant: "destructive" });
    }
  };

  const handleStartEdit = (msg: QuickMessage) => {
    if (msg.type === "audio") return; // Can't edit audio content
    setEditingId(msg.id);
    setEditName(msg.name);
    setEditText(msg.text);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || !editingId) return;
    
    try {
      const { error } = await supabase
        .from("quick_messages")
        .update({
          name: editName.trim() || editText.slice(0, 30),
          text: editText.trim(),
        })
        .eq("id", editingId);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) => (m.id === editingId ? { 
          ...m, 
          name: editName.trim() || editText.slice(0, 30),
          text: editText.trim() 
        } : m))
      );
      toast({ title: "Mensagem atualizada!" });
      setEditingId(null);
      setEditName("");
      setEditText("");
    } catch (error) {
      console.error("Error updating quick message:", error);
      toast({ title: "Erro ao atualizar mensagem", variant: "destructive" });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditText("");
  };

  const handleSelectMessage = (msg: QuickMessage) => {
    if (msg.type === "audio" && msg.audioData && onSelectAudio) {
      onSelectAudio(msg.audioData);
    } else {
      onSelect(msg.text);
    }
  };

  const playAudio = (msg: QuickMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!msg.audioData) return;

    if (playingId === msg.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(msg.audioData);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.play();
    setPlayingId(msg.id);
  };

  const filteredMessages = messages.filter((msg) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      msg.name.toLowerCase().includes(query) ||
      msg.text.toLowerCase().includes(query)
    );
  });

  return (
    <div className="w-[380px] bg-card rounded-xl border border-border overflow-hidden shadow-xl" style={{ backgroundColor: 'hsl(var(--card))' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-foreground">Mensagens Rápidas</span>
        </div>
        <button
          onClick={() => {
            if (isAdding) {
              resetAddForm();
            } else {
              setIsAdding(true);
            }
          }}
          className={cn(
            "p-1 rounded transition-colors",
            isAdding ? "bg-destructive/10 text-destructive" : "hover:bg-muted/50 text-muted-foreground"
          )}
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {/* Search */}
      {messages.length > 0 && !isAdding && (
        <div className="px-3 py-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm bg-background pl-8"
            />
          </div>
        </div>
      )}

      {/* Add new message */}
      {isAdding && (
        <div className="p-3 border-b border-border bg-muted/20 space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAddingType("text");
                cancelRecording();
              }}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                addingType === "text"
                  ? "bg-emerald-500 text-white"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              <Type className="w-4 h-4" />
              Texto
            </button>
            <button
              onClick={() => setAddingType("audio")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                addingType === "audio"
                  ? "bg-emerald-500 text-white"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              <Volume2 className="w-4 h-4" />
              Áudio
            </button>
          </div>

          <Input
            placeholder="Nome da mensagem (ex: Saudação)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-9 text-sm bg-background"
            autoFocus
          />

          {addingType === "text" ? (
            <>
              <Textarea
                placeholder="Digite o conteúdo da mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="text-sm bg-background min-h-[80px] resize-none"
              />
              <button
                onClick={handleAddText}
                disabled={!newMessage.trim()}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Salvar Mensagem
              </button>
            </>
          ) : (
            <>
              {/* Audio Recording UI */}
              <div className="bg-background rounded-lg p-3 border border-border/50">
                {!audioBlob ? (
                  <div className="flex items-center justify-center gap-4">
                    {isRecording ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
                        </div>
                        <button
                          onClick={stopRecording}
                          className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                        >
                          <Square className="w-5 h-5" />
                        </button>
                        <button
                          onClick={cancelRecording}
                          className="p-2 hover:bg-muted rounded-full transition-colors"
                        >
                          <X className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={startRecording}
                        className="p-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-colors"
                      >
                        <Mic className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const audio = new Audio(audioUrl!);
                        audio.play();
                      }}
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <div className="flex-1 h-1 bg-muted rounded-full">
                      <div className="h-full w-full bg-emerald-500/30 rounded-full" />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTime(recordingTime)}</span>
                    <button
                      onClick={cancelRecording}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleAddAudio}
                disabled={!audioBlob || !newName.trim()}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Salvar Áudio
              </button>
            </>
          )}
        </div>
      )}

      {/* Messages list - Two column layout */}
      <ScrollArea className="max-h-[400px]">
        <div className="p-2">
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Carregando...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center">
              <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhuma mensagem rápida salva
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Clique em + para adicionar
              </p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="py-6 text-center">
              <Search className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhuma mensagem encontrada
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMessages.map((msg) => (
                <div key={msg.id} className="group">
                  {editingId === msg.id ? (
                    <div className="space-y-2 p-2 bg-muted/30 rounded-lg">
                      <Input
                        placeholder="Nome"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 text-sm bg-background"
                        autoFocus
                      />
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        className="text-sm bg-background min-h-[60px] resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm transition-colors flex items-center justify-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-md text-sm transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleSelectMessage(msg)}
                      className="flex items-stretch cursor-pointer hover:bg-muted/40 rounded-lg transition-colors overflow-hidden"
                    >
                      {/* Left side - Name */}
                      <div className={cn(
                        "w-28 shrink-0 px-3 py-2.5 flex items-center border-r",
                        msg.type === "audio" 
                          ? "bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/20"
                          : "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/20"
                      )}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {msg.type === "audio" && (
                            <Volume2 className="w-3 h-3 text-purple-500 shrink-0" />
                          )}
                          <p className={cn(
                            "text-xs font-semibold truncate",
                            msg.type === "audio" 
                              ? "text-purple-700 dark:text-purple-400"
                              : "text-emerald-700 dark:text-emerald-400"
                          )}>{msg.name}</p>
                        </div>
                      </div>
                      
                      {/* Right side - Message/Audio */}
                      <div className="flex-1 px-3 py-2 bg-muted/20 relative flex items-center">
                        {msg.type === "audio" ? (
                          <div className="flex items-center gap-2 pr-14">
                            <button
                              onClick={(e) => playAudio(msg, e)}
                              className={cn(
                                "p-1.5 rounded-full transition-colors",
                                playingId === msg.id 
                                  ? "bg-purple-500 text-white" 
                                  : "bg-purple-500/20 text-purple-500 hover:bg-purple-500/30"
                              )}
                            >
                              {playingId === msg.id ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </button>
                            <div className="flex-1 h-1 bg-purple-500/20 rounded-full min-w-[60px]">
                              <div className={cn(
                                "h-full bg-purple-500 rounded-full transition-all",
                                playingId === msg.id ? "w-full animate-pulse" : "w-0"
                              )} />
                            </div>
                            {msg.audioDuration && (
                              <span className="text-xs text-muted-foreground">
                                {formatTime(msg.audioDuration)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-2 pr-14">{msg.text}</p>
                        )}
                        
                        {/* Action buttons */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {msg.type === "text" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(msg);
                              }}
                              className="p-1.5 hover:bg-muted rounded transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(msg.id);
                            }}
                            className="p-1.5 hover:bg-destructive/20 rounded transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
