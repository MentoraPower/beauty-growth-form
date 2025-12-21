import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddWhatsAppAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ConnectionStatus = "idle" | "creating" | "waiting_scan" | "connected" | "error";

export function AddWhatsAppAccountDialog({ open, onOpenChange, onSuccess }: AddWhatsAppAccountDialogProps) {
  const { toast } = useToast();
  const [sessionName, setSessionName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = () => {
    setSessionName("");
    setPhoneNumber("");
    setStatus("idle");
    setQrCode(null);
    setSessionId(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const createSession = async () => {
    if (!sessionName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para identificar esta conta",
        variant: "destructive",
      });
      return;
    }

    setStatus("creating");
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "create-session",
          name: sessionName.trim(),
          phone_number: phoneNumber.trim() || undefined,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Erro ao criar sessão");
      }

      const newSessionId = data.data?.id;
      if (!newSessionId) {
        throw new Error("ID da sessão não retornado");
      }

      setSessionId(newSessionId);
      
      // Now connect the session to get QR code
      await connectSession(newSessionId);
    } catch (error: any) {
      console.error("Error creating session:", error);
      setStatus("error");
      setErrorMessage(error.message || "Erro ao criar sessão");
    }
  };

  const connectSession = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "connect-session",
          session_id: id,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Erro ao conectar sessão");
      }

      const sessionStatus = data.data?.status;
      
      if (sessionStatus === "NEED_SCAN" && data.data?.qrCode) {
        setQrCode(data.data.qrCode);
        setStatus("waiting_scan");
        // Start polling for connection status
        pollConnectionStatus(id);
      } else if (sessionStatus === "CONNECTED" || sessionStatus === "connected") {
        setStatus("connected");
        toast({
          title: "Conectado!",
          description: "Conta WhatsApp conectada com sucesso",
        });
        onSuccess?.();
      } else {
        // Try to get QR code directly
        await getQRCode(id);
      }
    } catch (error: any) {
      console.error("Error connecting session:", error);
      setStatus("error");
      setErrorMessage(error.message || "Erro ao conectar sessão");
    }
  };

  const getQRCode = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "get-qr-code",
          session_id: id,
        },
      });

      if (error) throw error;

      if (data?.success && data.data?.qrCode) {
        setQrCode(data.data.qrCode);
        setStatus("waiting_scan");
        pollConnectionStatus(id);
      } else {
        throw new Error("QR code não disponível");
      }
    } catch (error: any) {
      console.error("Error getting QR code:", error);
      setStatus("error");
      setErrorMessage(error.message || "Erro ao obter QR code");
    }
  };

  const pollConnectionStatus = (id: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes (2s interval)

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setStatus("error");
        setErrorMessage("Tempo esgotado. Tente novamente.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
          body: {
            action: "get-session-status",
            session_id: id,
          },
        });

        if (error) throw error;

        const sessionStatus = data?.data?.status?.toLowerCase();

        if (sessionStatus === "connected") {
          setStatus("connected");
          toast({
            title: "Conectado!",
            description: "Conta WhatsApp conectada com sucesso",
          });
          onSuccess?.();
          return;
        }

        if (sessionStatus === "failed" || sessionStatus === "error") {
          setStatus("error");
          setErrorMessage("Falha na conexão. Tente novamente.");
          return;
        }

        // Continue polling
        attempts++;
        setTimeout(poll, 2000);
      } catch (error) {
        console.error("Error polling status:", error);
        attempts++;
        setTimeout(poll, 2000);
      }
    };

    setTimeout(poll, 2000);
  };

  const refreshQRCode = async () => {
    if (!sessionId) return;
    setStatus("creating");
    setQrCode(null);
    await connectSession(sessionId);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Adicionar Conta WhatsApp
          </DialogTitle>
          <DialogDescription>
            Conecte uma nova conta WhatsApp escaneando o QR code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status === "idle" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="session-name">Nome da conta *</Label>
                <Input
                  id="session-name"
                  placeholder="Ex: Atendimento, Vendas..."
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone-number">Número (opcional)</Label>
                <Input
                  id="phone-number"
                  placeholder="+5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Informe o número que será conectado para referência
                </p>
              </div>
              <Button onClick={createSession} className="w-full">
                Gerar QR Code
              </Button>
            </>
          )}

          {status === "creating" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando QR code...</p>
            </div>
          )}

          {status === "waiting_scan" && qrCode && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={qrCode} size={200} level="M" />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Abra o WhatsApp no seu celular e escaneie este QR code
              </p>
              <Button variant="outline" size="sm" onClick={refreshQRCode}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar QR Code
              </Button>
            </div>
          )}

          {status === "connected" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium">Conectado com sucesso!</p>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
              <Button variant="outline" onClick={resetState}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
