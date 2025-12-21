import { useState, useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/whatsapp-utils";

type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended" | "error";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string | null;
  onInitiateCall: () => Promise<void>;
}

const CallModal = ({
  isOpen,
  onClose,
  contactName,
  contactPhone,
  contactAvatar,
  onInitiateCall,
}: CallModalProps) => {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startCall = async () => {
    setCallStatus("calling");
    setErrorMessage("");
    try {
      await onInitiateCall();
      setCallStatus("ringing");
      // Simulate call being answered after 3 seconds (in real scenario, this would come from Twilio webhook)
      setTimeout(() => {
        setCallStatus("connected");
      }, 3000);
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("configuration") || msg.includes("secrets")) {
        setErrorMessage("Configuração da Infobip incompleta. Verifique os secrets.");
      } else {
        setErrorMessage(msg || "Erro ao iniciar chamada. Tente novamente.");
      }
      setCallStatus("error");
    }
  };

  const endCall = () => {
    setCallStatus("ended");
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Start timer when connected
  useEffect(() => {
    if (callStatus === "connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);

  // Auto-start call when modal opens
  useEffect(() => {
    if (isOpen && callStatus === "idle") {
      startCall();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCallStatus("idle");
      setIsMuted(false);
      setCallDuration(0);
      setErrorMessage("");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getStatusText = () => {
    switch (callStatus) {
      case "calling":
        return "Conectando...";
      case "ringing":
        return "Chamando...";
      case "connected":
        return formatDuration(callDuration);
      case "ended":
        return "Chamada encerrada";
      case "error":
        return "Erro na chamada";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-[320px] overflow-hidden">
        {/* Header */}
        {callStatus === "error" ? (
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 text-center text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Erro na Chamada</h3>
            <p className="text-sm text-white/90 leading-relaxed">{errorMessage}</p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-center text-white">
          <button
            onClick={endCall}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Avatar */}
          <div className="mx-auto mb-4">
            {contactAvatar ? (
              <img
                src={contactAvatar}
                alt={contactName}
                className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-white/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto text-2xl font-semibold border-4 border-white/30">
                {getInitials(contactName)}
              </div>
            )}
          </div>

          {/* Contact Info */}
          <h3 className="text-lg font-semibold">{contactName}</h3>
          <p className="text-sm text-white/80">{contactPhone}</p>

          {/* Status */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {(callStatus === "calling" || callStatus === "ringing") && (
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          </div>
        </>
        )}

        {/* Controls */}
        {callStatus !== "error" && (
          <div className="p-6 bg-card">
            <div className="flex items-center justify-center gap-6">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                disabled={callStatus !== "connected"}
                className={cn(
                  "p-4 rounded-full transition-all",
                  callStatus !== "connected" && "opacity-50 cursor-not-allowed",
                  isMuted
                    ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                )}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              {/* End Call Button */}
              <button
                onClick={endCall}
                disabled={callStatus === "ended"}
                className={cn(
                  "p-5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all shadow-lg",
                  callStatus === "ended" && "opacity-50 cursor-not-allowed"
                )}
              >
                <PhoneOff className="w-7 h-7" />
              </button>

              {/* Speaker/Answer Button (placeholder for future) */}
              <button
                disabled={callStatus !== "connected"}
                className={cn(
                  "p-4 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-all",
                  callStatus !== "connected" && "opacity-50 cursor-not-allowed"
                )}
              >
                <Phone className="w-6 h-6" />
              </button>
            </div>

            {/* Status Labels */}
            <div className="flex items-center justify-center gap-8 mt-4 text-xs text-muted-foreground">
              <span>Silenciar</span>
              <span>Desligar</span>
              <span>Alto-falante</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallModal;
