import { useEffect, useState } from 'react';

interface AnimatedCircleProps {
  className?: string;
}

export function AnimatedCircle({ className = '' }: AnimatedCircleProps) {
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
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
