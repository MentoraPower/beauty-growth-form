import { useEffect, useRef } from "react";

const LightBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const drawLightRays = () => {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Light source position (top-left corner, slightly inside)
      const sourceX = canvas.width * 0.15;
      const sourceY = canvas.height * 0.05;

      // Draw multiple light rays
      const rayCount = 12;
      
      for (let i = 0; i < rayCount; i++) {
        const baseAngle = (Math.PI / 3) + (i / rayCount) * (Math.PI / 2.5);
        const angleOffset = Math.sin(time * 0.3 + i * 0.5) * 0.03;
        const angle = baseAngle + angleOffset;
        
        const rayLength = Math.max(canvas.width, canvas.height) * 1.8;
        const rayWidth = 80 + Math.sin(time * 0.5 + i) * 20;
        
        const endX = sourceX + Math.cos(angle) * rayLength;
        const endY = sourceY + Math.sin(angle) * rayLength;

        // Create gradient for each ray
        const gradient = ctx.createLinearGradient(sourceX, sourceY, endX, endY);
        const opacity = 0.08 + Math.sin(time * 0.4 + i * 0.8) * 0.03;
        
        gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 2})`);
        gradient.addColorStop(0.3, `rgba(255, 255, 255, ${opacity})`);
        gradient.addColorStop(0.7, `rgba(255, 255, 255, ${opacity * 0.3})`);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY);
        
        // Calculate perpendicular offset for ray width
        const perpX = Math.cos(angle + Math.PI / 2) * rayWidth;
        const perpY = Math.sin(angle + Math.PI / 2) * rayWidth;
        
        ctx.lineTo(endX + perpX, endY + perpY);
        ctx.lineTo(endX - perpX, endY - perpY);
        ctx.closePath();
        
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
      }

      // Add soft glow at source
      const glowGradient = ctx.createRadialGradient(
        sourceX, sourceY, 0,
        sourceX, sourceY, 300
      );
      glowGradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
      glowGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
      glowGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle noise/grain effect
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 8;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
      
      ctx.putImageData(imageData, 0, 0);

      time += 0.016;
      animationId = requestAnimationFrame(drawLightRays);
    };

    drawLightRays();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: -1 }}
    />
  );
};

export default LightBackground;
