import React, { useRef } from "react";

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const RippleButton: React.FC<RippleButtonProps> = ({ children, className = "", onClick, ...props }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  const updatePosition = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    const fill = fillRef.current;
    if (!button || !fill) return;

    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    fill.style.left = `${x}px`;
    fill.style.top = `${y}px`;
  };

  return (
    <button
      ref={buttonRef}
      className={`ripple-button ${className}`}
      onClick={onClick}
      onMouseMove={updatePosition}
      {...props}
    >
      <span ref={fillRef} className="ripple-fill" />
      <span className="ripple-button-content">
        {children}
      </span>
    </button>
  );
};

export default RippleButton;