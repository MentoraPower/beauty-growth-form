import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceChatButtonProps {
  onTranscript?: (text: string) => void;
  className?: string;
}

export function VoiceChatButton({ onTranscript, className }: VoiceChatButtonProps) {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/mp4";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(250);
      setIsActive(true);
      setRecordingTime(0);

      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success("Gravando... Clique novamente para enviar");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao acessar microfone. Permita o acesso.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !streamRef.current) return;

    setIsProcessing(true);

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        // Stop all tracks
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          
          // For now, just show a message that voice was recorded
          // The transcription would require Whisper API
          toast.info(`Áudio gravado (${recordingTime}s). Transcrição em breve.`);
          
          onTranscript?.(`[Mensagem de voz - ${recordingTime}s]`);
          
          setIsActive(false);
          setIsProcessing(false);
          setRecordingTime(0);
          resolve();
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current!.stop();
    });
  }, [recordingTime, onTranscript]);

  const handleClick = useCallback(() => {
    if (isProcessing) return;
    
    if (isActive) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isActive, isProcessing, startRecording, stopRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={isProcessing}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300",
        isActive 
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30" 
          : isProcessing
          ? "bg-amber-500 text-white"
          : "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30",
        className
      )}
      whileTap={{ scale: 0.95 }}
    >
      <AnimatePresence mode="wait">
        {isProcessing ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Loader2 className="w-5 h-5 animate-spin" />
          </motion.div>
        ) : isActive ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <PhoneOff className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <Phone className="w-5 h-5" />
            <span className="text-sm font-medium">Chamada IA</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulse animation when recording */}
      {isActive && (
        <motion.span
          className="absolute inset-0 rounded-full bg-red-500"
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}
