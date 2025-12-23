import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Chat } from "./useWhatsAppChats";

interface UseWhatsAppRecordingOptions {
  selectedChat: Chat | null;
  selectedAccountId: string | null;
  whatsappAccounts: Array<{ id: string; api_key?: string }>;
  onMessageSent: (tempId: string, insertedMsg: any, publicUrl: string) => void;
  onUpdateChat: (chatId: string, lastMessage: string, timestamp: string) => void;
}

export function useWhatsAppRecording({
  selectedChat,
  selectedAccountId,
  whatsappAccounts,
  onMessageSent,
  onUpdateChat,
}: UseWhatsAppRecordingOptions) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPresenceRef = useRef<{ phone: string; type: string; time: number } | null>(null);

  const sendPresenceUpdate = useCallback(async (presenceType: "composing" | "recording") => {
    if (!selectedChat) return;
    
    const now = Date.now();
    if (lastPresenceRef.current && 
        lastPresenceRef.current.phone === selectedChat.phone &&
        lastPresenceRef.current.type === presenceType &&
        now - lastPresenceRef.current.time < 3000) {
      return;
    }
    
    lastPresenceRef.current = { phone: selectedChat.phone, type: presenceType, time: now };
    
    try {
      await supabase.functions.invoke("wasender-whatsapp", {
        body: {
          action: "send-presence",
          phone: selectedChat.phone,
          presenceType,
          delayMs: 3000,
        },
      });
    } catch (error) {
      console.log("[WhatsApp] Presence update failed:", error);
    }
  }, [selectedChat]);

  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    return output;
  };

  const transcodeToMp3 = async (inputBlob: Blob): Promise<Blob> => {
    if (!(window as any).lamejs?.Mp3Encoder) throw new Error("MP3 encoder não carregou");

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) throw new Error("AudioContext not supported");

    const ctx = new AudioContextClass();
    try {
      const arrayBuffer = await inputBlob.arrayBuffer();
      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        const p = (ctx as any).decodeAudioData(arrayBuffer, resolve, reject);
        if (p?.then) p.then(resolve).catch(reject);
      });

      const sampleRate = audioBuffer.sampleRate;
      const length = audioBuffer.length;

      const ch0 = audioBuffer.getChannelData(0);
      let mono: Float32Array;
      if (audioBuffer.numberOfChannels > 1) {
        const ch1 = audioBuffer.getChannelData(1);
        mono = new Float32Array(length);
        for (let i = 0; i < length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
      } else {
        mono = ch0;
      }

      const encoder = new (window as any).lamejs.Mp3Encoder(1, sampleRate, 128);
      const mp3Chunks: Uint8Array[] = [];
      const blockSize = 1152;

      for (let i = 0; i < mono.length; i += blockSize) {
        const slice = mono.subarray(i, i + blockSize);
        const mp3buf = encoder.encodeBuffer(floatTo16BitPCM(slice)) as any;
        if (mp3buf && mp3buf.length) mp3Chunks.push(new Uint8Array(mp3buf));
      }

      const end = encoder.flush() as any;
      if (end && end.length) mp3Chunks.push(new Uint8Array(end));

      const parts = mp3Chunks as unknown as BlobPart[];
      return new Blob(parts, { type: "audio/mpeg" });
    } finally {
      try {
        await (ctx as any).close?.();
      } catch {
        // ignore
      }
    }
  };

  const sendAudioMessage = async (audioBlob: Blob, mimeType: string = 'audio/webm') => {
    if (!selectedChat) return;

    setIsSendingAudio(true);

    try {
      let finalBlob = audioBlob;
      let finalMimeType = mimeType;

      const needsMp3Transcode = /webm|mp4/.test(mimeType);
      if (needsMp3Transcode) {
        finalBlob = await transcodeToMp3(audioBlob);
        finalMimeType = "audio/mpeg";
      } else if (mimeType.includes("ogg")) {
        finalMimeType = "audio/ogg";
      }

      let ext = "ogg";
      if (finalMimeType.includes("mpeg")) ext = "mp3";
      else if (finalMimeType.includes("ogg")) ext = "ogg";
      else if (finalMimeType.includes("mp4") || finalMimeType.includes("aac")) ext = "m4a";

      const uploadContentType =
        ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : "audio/mp4";

      const timestamp = Date.now();
      const filename = `${selectedChat.phone}_${timestamp}.${ext}`;
      const filePath = `audios/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, finalBlob, {
          contentType: uploadContentType,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      const tempId = `temp-${Date.now()}`;
      
      const selectedAccount = whatsappAccounts.find(acc => acc.id === selectedAccountId);
      const sessionId = selectedAccount?.api_key || null;

      const { data, error } = await supabase.functions.invoke("wasender-whatsapp", {
        body: { 
          action: "send-audio",
          phone: selectedChat.phone, 
          mediaUrl: publicUrl,
          sessionId,
        },
      });

      if (error) throw error;

      const { data: insertedMsg } = await supabase.from("whatsapp_messages").insert({
        chat_id: selectedChat.id,
        phone: selectedChat.phone,
        text: "",
        from_me: true,
        status: "SENT",
        media_url: publicUrl,
        media_type: "audio",
        message_id: data?.messageId,
        whatsapp_key_id: data?.whatsappKeyId || null,
        created_at: new Date().toISOString(),
        session_id: sessionId,
      }).select().single();

      if (insertedMsg) {
        onMessageSent(tempId, insertedMsg, publicUrl);
      }

      const newTimestamp = new Date().toISOString();
      
      await supabase.from("whatsapp_chats").update({
        last_message: "🎵 Áudio",
        last_message_time: newTimestamp,
        last_message_status: "SENT",
        last_message_from_me: true,
      }).eq("id", selectedChat.id);

      onUpdateChat(selectedChat.id, "🎵 Áudio", newTimestamp);

    } catch (error: any) {
      console.error("Error sending audio:", error);
      toast({
        title: "Erro ao enviar áudio",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingAudio(false);
      setRecordingTime(0);
    }
  };

  const startRecording = async () => {
    if (!selectedChat) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
      
      let mimeType = "";

      if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        mimeType = "audio/ogg;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2")) {
        mimeType = "audio/mp4;codecs=mp4a.40.2";
      }

      if (!mimeType) {
        toast({
          title: "Navegador incompatível",
          description: "Seu navegador não suporta gravação de áudio.",
          variant: "destructive",
        });
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecordingStream(null);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await sendAudioMessage(audioBlob, mimeType);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      sendPresenceUpdate("recording");

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
        sendPresenceUpdate("recording");
      }, 1000);

    } catch (error: any) {
      console.error("Error starting recording:", error);
      toast({
        title: "Erro ao gravar",
        description: "Permita o acesso ao microfone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    setRecordingStream(null);
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    recordingTime,
    recordingStream,
    isSendingAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    formatRecordingTime,
    sendAudioMessage,
    sendPresenceUpdate,
  };
}
