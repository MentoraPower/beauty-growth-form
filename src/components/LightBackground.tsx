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
      // White background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Light source position (top-left corner)
      const sourceX = canvas.width * 0.1;
      const sourceY = -canvas.height * 0.1;

      // Draw multiple light rays - dark/gray rays on white background
      const rayCount = 8;
      
      for (let i = 0; i < rayCount; i++) {
        const baseAngle = (Math.PI / 4) + (i / rayCount) * (Math.PI / 2);
        const angleOffset = Math.sin(time * 0.2 + i * 0.5) * 0.02;
        const angle = baseAngle + angleOffset;
        
        const rayLength = Math.max(canvas.width, canvas.height) * 2;
        const rayWidth = 120 + Math.sin(time * 0.3 + i) * 30 + i * 15;
        
        const endX = sourceX + Math.cos(angle) * rayLength;
        const endY = sourceY + Math.sin(angle) * rayLength;

        // Create gradient for each ray - subtle gray rays
        const gradient = ctx.createLinearGradient(sourceX, sourceY, endX, endY);
        const baseOpacity = 0.08 + Math.sin(time * 0.3 + i * 0.6) * 0.03;
        
        gradient.addColorStop(0, `rgba(0, 0, 0, ${baseOpacity * 1.2})`);
        gradient.addColorStop(0.2, `rgba(0, 0, 0, ${baseOpacity})`);
        gradient.addColorStop(0.5, `rgba(0, 0, 0, ${baseOpacity * 0.4})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

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

      // Add soft glow at source - light gray
      const glowGradient = ctx.createRadialGradient(
        sourceX, sourceY, 0,
        sourceX, sourceY, 500
      );
      glowGradient.addColorStop(0, "rgba(0, 0, 0, 0.12)");
      glowGradient.addColorStop(0.3, "rgba(0, 0, 0, 0.05)");
      glowGradient.addColorStop(0.6, "rgba(0, 0, 0, 0.02)");
      glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default LightBackground;
