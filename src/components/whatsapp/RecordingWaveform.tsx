import { useRef, useEffect, useState } from "react";

interface RecordingWaveformProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export const RecordingWaveform = ({ stream, isRecording }: RecordingWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [bars, setBars] = useState<number[]>(Array(30).fill(0.1));

  useEffect(() => {
    if (!stream || !isRecording) {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setBars(Array(30).fill(0.1));
      return;
    }

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyserRef.current = analyser;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const animate = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Create bars from frequency data
      const newBars: number[] = [];
      const barsCount = 30;
      const step = Math.floor(dataArray.length / barsCount);
      
      for (let i = 0; i < barsCount; i++) {
        const value = dataArray[i * step] / 255;
        newBars.push(Math.max(0.1, value));
      }
      
      setBars(newBars);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, isRecording]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = 3;
    const gap = 2;
    
    ctx.clearRect(0, 0, width, height);
    
    bars.forEach((value, index) => {
      const x = index * (barWidth + gap);
      const barHeight = Math.max(4, value * height * 0.9);
      const y = (height - barHeight) / 2;
      
      // Red gradient for recording
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, "#ef4444");
      gradient.addColorStop(1, "#dc2626");
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    });
  }, [bars]);

  return (
    <canvas
      ref={canvasRef}
      width={150}
      height={32}
      className="flex-shrink-0"
    />
  );
};
