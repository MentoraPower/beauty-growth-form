import React, { useState, useRef } from "react";

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const RippleButton: React.FC<RippleButtonProps> = ({ children, className = "", onClick, ...props }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const getPosition = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setPosition({ x, y });
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLButtonElement>) => {
    getPosition(event);
    setIsHovered(true);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    getPosition(event);
    if (onClick) {
      onClick(event);
    }
  };

  return (
    <button
      ref={buttonRef}
      className={`ripple-button ${className}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <span 
        className={`ripple-fill ${isHovered ? 'active' : ''}`}
        style={{
          left: position.x,
          top: position.y,
        }}
      />
      <span className={`ripple-button-content ${isHovered ? 'hovered' : ''}`}>
        {children}
      </span>
    </button>
  );
};

export default RippleButton;