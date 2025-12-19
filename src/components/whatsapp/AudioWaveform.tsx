import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause } from "lucide-react";

interface AudioWaveformProps {
  src: string;
  sent?: boolean;
  renderFooter?: (audioDuration: string) => React.ReactNode;
}

export const AudioWaveform = ({ src, sent = false, renderFooter }: AudioWaveformProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const playbackRates = [1, 1.5, 2];

  const cyclePlaybackRate = () => {
    const currentIndex = playbackRates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % playbackRates.length;
    const newRate = playbackRates[nextIndex];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  // Generate waveform data from audio
  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);

    const generateWaveform = async () => {
      try {
        if (!src) return;

        const response = await fetch(src);
        if (!response.ok) {
          console.error("[AudioWaveform] Failed to fetch audio:", response.status);
          // Use fallback waveform
          if (!cancelled) {
            setWaveformData(Array.from({ length: 40 }, () => Math.random() * 0.5 + 0.2));
            setIsLoaded(true);
          }
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();

        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const rawData = audioBuffer.getChannelData(0);
          const samples = 40;
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

          const maxVal = Math.max(...filteredData);
          const normalizedData = maxVal > 0 
            ? filteredData.map((n) => n / maxVal) 
            : filteredData;

          if (!cancelled) {
            setWaveformData(normalizedData);
            setIsLoaded(true);
          }
        } finally {
          audioContext.close();
        }
      } catch (err) {
        console.error("[AudioWaveform] Error generating waveform:", err);
        if (!cancelled) {
          setWaveformData(Array.from({ length: 40 }, () => Math.random() * 0.5 + 0.2));
          setIsLoaded(true);
        }
      }
    };

    generateWaveform();
    return () => { cancelled = true; };
  }, [src]);

  // Draw waveform with animation frame for smooth progress
  const drawWaveform = useCallback((progressOverride?: number) => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = 3;
    const gap = 2;
    const progress =
      typeof progressOverride === "number" ? progressOverride : duration > 0 ? currentTime / duration : 0;

    // Use design tokens (HSL) for colors
    const playedColor = sent ? "hsl(var(--primary-dark))" : "hsl(var(--primary))";
    const unplayedColor = "hsl(var(--muted-foreground) / 0.35)";

    ctx.clearRect(0, 0, width, height);

    waveformData.forEach((value, index) => {
      const x = index * (barWidth + gap);
      const barHeight = Math.max(4, value * height * 0.8);
      const y = (height - barHeight) / 2;

      const progressIndex = progress * waveformData.length;
      ctx.fillStyle = index < progressIndex ? playedColor : unplayedColor;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    });
  }, [waveformData, currentTime, duration, sent]);

  // Redraw on state changes
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Animation loop for smooth progress during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let rafId: number;

    const updateProgress = () => {
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
        rafId = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isPlaying]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      // Reset to the "normal" state like WhatsApp
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      drawWaveform(0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    if (audio.duration && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [src, drawWaveform]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("[AudioWaveform] Play error:", err);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
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

  // Show loading state while waveform loads
  if (!isLoaded && src) {
    return (
      <div className="flex items-center gap-3 min-w-[200px] py-1">
        <div className="w-9 h-9 rounded-full bg-muted animate-pulse flex-shrink-0" />
        <div className="flex-1 h-8 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  // Error state - no src
  if (!src) {
    return (
      <div className="flex items-center gap-2 min-w-[200px] py-2 px-3 bg-muted/30 rounded-xl">
        <span className="text-xs text-muted-foreground">Áudio indisponível</span>
      </div>
    );
  }

  const audioDuration = isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration);

  return (
    <div className="flex flex-col min-w-[260px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Player Row */}
      <div className="flex items-center gap-3">
        {/* Play Button */}
        <button
          onClick={togglePlay}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 shadow-sm"
          aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
          type="button"
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>

        {/* Waveform */}
        <canvas
          ref={canvasRef}
          width={180}
          height={36}
          className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleCanvasClick}
        />

        {/* Playback Speed Button */}
        <button
          onClick={cyclePlaybackRate}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold transition-all duration-200 bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
          type="button"
          title="Velocidade de reprodução"
        >
          {playbackRate}x
        </button>
      </div>

      {/* Footer - either custom or default time */}
      {renderFooter ? (
        renderFooter(audioDuration)
      ) : (
        <span className="text-[10px] text-muted-foreground tabular-nums mt-1 ml-2">
          {audioDuration}
        </span>
      )}
    </div>
  );
};
