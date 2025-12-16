import { useRef, useEffect, useState } from "react";
import { Play, Pause, AlertCircle } from "lucide-react";

interface AudioWaveformProps {
  src: string;
  sent?: boolean;
}

export const AudioWaveform = ({ src, sent = false }: AudioWaveformProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [error, setError] = useState(false);
  const animationRef = useRef<number>();

  // Generate waveform data from audio
  useEffect(() => {
    let cancelled = false;

    // Important: reset error whenever the src changes.
    setError(false);

    const generateWaveform = async () => {
      try {
        if (!src) {
          setError(true);
          return;
        }

        const response = await fetch(src);
        if (!response.ok) {
          console.error("[AudioWaveform] Failed to fetch audio:", response.status);
          setError(true);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();

        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          const rawData = audioBuffer.getChannelData(0);
          const samples = 40; // Number of bars
          const blockSize = Math.floor(rawData.length / samples);
          const filteredData: number[] = [];

          for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
              sum += Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(sum / blockSize);
          }

          // Normalize
          const multiplier = Math.pow(Math.max(...filteredData), -1);
          const normalizedData = filteredData.map((n) => n * multiplier);

          if (!cancelled) {
            setWaveformData(normalizedData);
            setError(false);
          }
        } finally {
          audioContext.close();
        }
      } catch (err) {
        console.error("[AudioWaveform] Error generating waveform:", err);

        // Fallback waveform if the browser can't decode this audio format.
        const fallback = Array.from({ length: 40 }, () => Math.random() * 0.5 + 0.2);
        if (!cancelled) {
          setWaveformData(fallback);
          setError(false);
        }
      }
    };

    generateWaveform();

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = 3;
      const gap = 2;
      const progress = duration > 0 ? currentTime / duration : 0;
      
      ctx.clearRect(0, 0, width, height);
      
      waveformData.forEach((value, index) => {
        const x = index * (barWidth + gap);
        const barHeight = Math.max(4, value * height * 0.8);
        const y = (height - barHeight) / 2;
        
        // Color based on progress and sent/received
        const progressIndex = progress * waveformData.length;
        if (index < progressIndex) {
          ctx.fillStyle = sent ? "#075e54" : "#128c7e";
        } else {
          ctx.fillStyle = sent ? "#b3d4d1" : "#a8d8d3";
        }
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1.5);
        ctx.fill();
      });
    };
    
    draw();
  }, [waveformData, currentTime, duration, sent]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    audio.currentTime = progress * duration;
    setCurrentTime(audio.currentTime);
  };

  // Show error state if audio URL is missing or failed to load
  if (error || !src) {
    return (
      <div className="flex items-center gap-2 min-w-[200px] p-2 bg-muted/30 rounded-lg">
        <AlertCircle size={18} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Áudio indisponível</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio 
        ref={audioRef} 
        src={src} 
        preload="metadata" 
        onError={() => setError(true)}
      />
      
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          sent ? "bg-[#075e54] text-white" : "bg-[#128c7e] text-white"
        }`}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col gap-1">
        <canvas
          ref={canvasRef}
          width={200}
          height={32}
          className="cursor-pointer"
          onClick={handleCanvasClick}
        />
        <span className="text-[11px] text-muted-foreground">
          {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
};
