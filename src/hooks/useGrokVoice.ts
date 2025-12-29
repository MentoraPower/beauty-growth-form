import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

export type VoiceState = "idle" | "connecting" | "listening" | "processing" | "speaking";

interface GrokVoiceOptions {
  systemPrompt?: string;
  voice?: string;
  onTranscript?: (text: string, isFinal: boolean, role: "user" | "assistant") => void;
  onStateChange?: (state: VoiceState) => void;
}

interface AudioChunk {
  data: Uint8Array;
}

const WEBSOCKET_URL = "wss://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/grok-voice-realtime";

export function useGrokVoice(options: GrokVoiceOptions = {}) {
  const { systemPrompt, voice = "Cove", onTranscript, onStateChange } = options;
  
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [assistantTranscript, setAssistantTranscript] = useState("");
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const updateState = useCallback((newState: VoiceState) => {
    setVoiceState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Encode Float32 to PCM16 base64
  const encodeAudioToBase64 = (float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    }
    
    const uint8Array = new Uint8Array(int16Array.buffer);
    let binary = "";
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  };

  // Decode base64 PCM16 to Uint8Array
  const decodeBase64ToPCM = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Create WAV from PCM data
  const createWavFromPCM = (pcmData: Uint8Array): ArrayBuffer => {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmData.length;
    const headerSize = 44;
    
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);
    
    // RIFF header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);
    
    // Copy PCM data
    const dataView = new Uint8Array(buffer, headerSize);
    dataView.set(pcmData);
    
    return buffer;
  };

  // Play audio chunk
  const playAudioChunk = useCallback(async (audioData: Uint8Array) => {
    if (!audioContextRef.current) return;
    
    audioQueueRef.current.push({ data: audioData });
    
    if (isPlayingRef.current) return;
    
    const playNext = async () => {
      if (audioQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        return;
      }
      
      isPlayingRef.current = true;
      const chunk = audioQueueRef.current.shift()!;
      
      try {
        const wavBuffer = createWavFromPCM(chunk.data);
        const audioBuffer = await audioContextRef.current!.decodeAudioData(wavBuffer);
        
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current!.destination);
        currentSourceRef.current = source;
        
        source.onended = () => {
          currentSourceRef.current = null;
          playNext();
        };
        
        source.start(0);
      } catch (error) {
        console.error("[GrokVoice] Error playing audio:", error);
        playNext();
      }
    };
    
    playNext();
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log("[GrokVoice] Received:", data.type);
      
      switch (data.type) {
        case "session.created":
          console.log("[GrokVoice] Session created");
          updateState("listening");
          break;
          
        case "session.updated":
          console.log("[GrokVoice] Session updated");
          break;
          
        case "input_audio_buffer.speech_started":
          updateState("listening");
          break;
          
        case "input_audio_buffer.speech_stopped":
          updateState("processing");
          break;
          
        case "conversation.item.input_audio_transcription.completed":
          const userText = data.transcript || "";
          setUserTranscript(userText);
          onTranscript?.(userText, true, "user");
          break;
          
        case "response.audio_transcript.delta":
          setAssistantTranscript(prev => prev + (data.delta || ""));
          onTranscript?.(data.delta || "", false, "assistant");
          break;
          
        case "response.audio_transcript.done":
          onTranscript?.(data.transcript || "", true, "assistant");
          break;
          
        case "response.audio.delta":
          updateState("speaking");
          if (data.delta) {
            const audioData = decodeBase64ToPCM(data.delta);
            playAudioChunk(audioData);
          }
          break;
          
        case "response.audio.done":
          // Audio finished, wait for next input
          setTimeout(() => {
            if (voiceState === "speaking") {
              updateState("listening");
            }
          }, 500);
          break;
          
        case "response.done":
          setAssistantTranscript("");
          updateState("listening");
          break;
          
        case "error":
          console.error("[GrokVoice] Error from API:", data);
          toast.error("Erro na conexão de voz");
          break;
          
        case "xai_disconnected":
          toast.error("Conexão com IA desconectada");
          disconnect();
          break;
      }
    } catch (error) {
      console.error("[GrokVoice] Error parsing message:", error);
    }
  }, [onTranscript, playAudioChunk, updateState, voiceState]);

  // Start recording and sending audio
  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64Audio = encodeAudioToBase64(new Float32Array(inputData));
          
          wsRef.current.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64Audio
          }));
        }
      };
      
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      console.log("[GrokVoice] Audio capture started");
    } catch (error) {
      console.error("[GrokVoice] Error starting audio capture:", error);
      toast.error("Erro ao acessar microfone. Permita o acesso.");
      throw error;
    }
  }, []);

  // Stop audio capture
  const stopAudioCapture = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    console.log("[GrokVoice] Audio capture stopped");
  }, []);

  // Connect to voice API
  const connect = useCallback(async () => {
    if (wsRef.current) {
      console.log("[GrokVoice] Already connected");
      return;
    }
    
    updateState("connecting");
    
    try {
      // Build WebSocket URL with params
      const params = new URLSearchParams();
      if (systemPrompt) params.set("systemPrompt", systemPrompt);
      if (voice) params.set("voice", voice);
      
      const wsUrl = `${WEBSOCKET_URL}?${params.toString()}`;
      console.log("[GrokVoice] Connecting to:", wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = async () => {
        console.log("[GrokVoice] WebSocket connected");
        setIsConnected(true);
        
        // Start audio capture after connection
        await startAudioCapture();
      };
      
      wsRef.current.onmessage = handleMessage;
      
      wsRef.current.onerror = (error) => {
        console.error("[GrokVoice] WebSocket error:", error);
        toast.error("Erro na conexão de voz");
        updateState("idle");
      };
      
      wsRef.current.onclose = () => {
        console.log("[GrokVoice] WebSocket closed");
        setIsConnected(false);
        stopAudioCapture();
        updateState("idle");
        wsRef.current = null;
      };
      
    } catch (error) {
      console.error("[GrokVoice] Connection error:", error);
      toast.error("Erro ao conectar");
      updateState("idle");
    }
  }, [systemPrompt, voice, handleMessage, startAudioCapture, stopAudioCapture, updateState]);

  // Disconnect from voice API
  const disconnect = useCallback(() => {
    // Stop any playing audio
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    stopAudioCapture();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsConnected(false);
    setUserTranscript("");
    setAssistantTranscript("");
    updateState("idle");
    
    console.log("[GrokVoice] Disconnected");
  }, [stopAudioCapture, updateState]);

  // Toggle connection
  const toggle = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    voiceState,
    isConnected,
    userTranscript,
    assistantTranscript,
    connect,
    disconnect,
    toggle
  };
}
