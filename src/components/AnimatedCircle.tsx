import { useEffect, useState, CSSProperties } from 'react';

interface AnimatedCircleProps {
  className?: string;
  style?: CSSProperties;
}

export function AnimatedCircle({ className = '', style }: AnimatedCircleProps) {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    fetch('/circle-animado.svg')
      .then(res => res.text())
      .then(svg => setSvgContent(svg))
      .catch(err => console.error('Error loading SVG:', err));
  }, []);

  return (
    <div 
      className={`animated-circle ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
