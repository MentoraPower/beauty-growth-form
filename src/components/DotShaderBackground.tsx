import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DotShaderBackgroundProps {
  rotation?: number;
  gridSize?: number;
  dotOpacity?: number;
  dotColor?: string;
  bgColor?: string;
}

const DotShaderBackground = ({
  rotation = 0,
  gridSize = 100,
  dotOpacity = 0.08,
  dotColor = '#FFFFFF',
  bgColor = '#121212'
}: DotShaderBackgroundProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mountedRef.current) return;
    mountedRef.current = true;

    const DPR = Math.min(2, window.devicePixelRatio || 1);

    // Basic scene setup
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const scene = new THREE.Scene();
    const geom = new THREE.PlaneGeometry(2, 2);

    // Mouse trail via offscreen canvas
    const trailSize = 512;
    const trailCanvas = document.createElement('canvas');
    trailCanvas.width = trailCanvas.height = trailSize;
    const trailCtx = trailCanvas.getContext('2d')!;
    trailCtx.fillStyle = 'rgba(0,0,0,1)';
    trailCtx.fillRect(0, 0, trailSize, trailSize);

    const trailTex = new THREE.Texture(trailCanvas);
    trailTex.minFilter = THREE.LinearFilter;
    trailTex.magFilter = THREE.LinearFilter;
    trailTex.wrapS = trailTex.wrapT = THREE.ClampToEdgeWrapping;
    trailTex.needsUpdate = true;

    // Fade trail each frame
    const fadeTrail = () => {
      trailCtx.fillStyle = 'rgba(0,0,0,0.06)';
      trailCtx.fillRect(0, 0, trailSize, trailSize);
    };

    // Add circular splat to trail
    const addTrailAt = (normX: number, normY: number) => {
      const x = normX * trailSize;
      const y = normY * trailSize;
      const r = Math.max(8, trailSize * 0.04);
      const grad = trailCtx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0.0)');
      trailCtx.globalCompositeOperation = 'lighter';
      trailCtx.fillStyle = grad;
      trailCtx.beginPath();
      trailCtx.arc(x, y, r, 0, Math.PI * 2);
      trailCtx.fill();
      trailCtx.globalCompositeOperation = 'source-over';
      trailTex.needsUpdate = true;
    };

    // Convert pointer coordinates to normalized UV
    const pointerToUV = (clientX: number, clientY: number) => {
      const rect = host.getBoundingClientRect();
      let x = (clientX - rect.left) / rect.width;
      let y = (clientY - rect.top) / rect.height;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      return { x, y };
    };

    // Pointer events
    const onMouseMove = (e: MouseEvent) => {
      const u = pointerToUV(e.clientX, e.clientY);
      addTrailAt(u.x, u.y);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!e.targetTouches || !e.targetTouches.length) return;
      for (let i = 0; i < e.targetTouches.length; i++) {
        const t = e.targetTouches[i];
        const u = pointerToUV(t.clientX, t.clientY);
        addTrailAt(u.x, u.y);
      }
    };

    host.addEventListener('mousemove', onMouseMove, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: true });

    // Shaders
    const vertexShader = `
      void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform float time;
      uniform vec2 resolution;
      uniform vec3 dotColor;
      uniform vec3 bgColor;
      uniform sampler2D mouseTrail;
      uniform float rotation;
      uniform float gridSize;
      uniform float dotOpacity;

      vec2 rotate(vec2 uv, float angle) {
        float s = sin(angle);
        float c = cos(angle);
        mat2 m = mat2(c, -s, s, c);
        return m * (uv - 0.5) + 0.5;
      }

      vec2 coverUv(vec2 uv) {
        vec2 s = resolution.xy / max(resolution.x, resolution.y);
        vec2 newUv = (uv - 0.5) * s + 0.5;
        return clamp(newUv, 0.0, 1.0);
      }

      float sdfCircle(vec2 p, float r) {
        return length(p - 0.5) - r;
      }

      void main() {
        vec2 screenUv = gl_FragCoord.xy / resolution;
        vec2 uv = coverUv(screenUv);

        vec2 rotatedUv = rotate(uv, rotation);

        // grid
        vec2 gridUv = fract(rotatedUv * gridSize);
        vec2 gridCenter = rotate((floor(rotatedUv * gridSize) + 0.5) / gridSize, -rotation);

        // base circle SDF in each cell
        float baseDot = sdfCircle(gridUv, 0.25);

        // masks
        float screenMask = smoothstep(0.0, 1.0, 1.0 - uv.y);
        vec2 centerDisplace = vec2(0.7, 1.1);
        float circleMaskCenter = length(uv - centerDisplace);
        float circleMaskFromCenter = smoothstep(0.5, 1.0, circleMaskCenter);
        float combinedMask = screenMask * circleMaskFromCenter;
        float circleAnimatedMask = sin(time * 2.0 + circleMaskCenter * 10.0);

        // mouse trail sampled at each cell center
        float mouseInfluence = texture2D(mouseTrail, gridCenter).r;
        float scaleInfluence = max(mouseInfluence * 0.5, circleAnimatedMask * 0.3);

        float dotSize = min(pow(circleMaskCenter, 2.0) * 0.3, 0.3);
        float sdfDot = sdfCircle(gridUv, dotSize * (1.0 + scaleInfluence * 0.5));
        float smoothDot = smoothstep(0.05, 0.0, sdfDot);

        float opacityInfluence = max(mouseInfluence * 50.0, circleAnimatedMask * 0.5);

        vec3 comp = mix(bgColor, dotColor, smoothDot * combinedMask * dotOpacity * (1.0 + opacityInfluence));
        gl_FragColor = vec4(comp, 1.0);
      }
    `;

    const uniforms = {
      time: { value: 0.0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      dotColor: { value: new THREE.Color(dotColor) },
      bgColor: { value: new THREE.Color(bgColor) },
      mouseTrail: { value: trailTex },
      rotation: { value: rotation },
      gridSize: { value: gridSize },
      dotOpacity: { value: dotOpacity }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader
    });

    const mesh = new THREE.Mesh(geom, material);
    scene.add(mesh);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(DPR);
    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);

    // Resize
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      uniforms.resolution.value.set(renderer.domElement.width, renderer.domElement.height);
    };

    let ro: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(resize);
      ro.observe(host);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Animation loop
    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      fadeTrail();
      uniforms.time.value += 0.016;
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      host.removeEventListener('mousemove', onMouseMove);
      host.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', resize);
      geom.dispose();
      material.dispose();
      renderer.dispose();
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      mountedRef.current = false;
    };
  }, [rotation, gridSize, dotOpacity, dotColor, bgColor]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    />
  );
};

export default DotShaderBackground;
