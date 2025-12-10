import React from "react";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const ShimmerButton: React.FC<ShimmerButtonProps> = ({ children, className = "", onClick, ...props }) => {
  return (
    <button
      className={`shimmer-button ${className}`}
      onClick={onClick}
      {...props}
    >
      <span className="shimmer-button-icon" />
      <span className="shimmer-button-content">
        {children}
      </span>
    </button>
  );
};

export default ShimmerButton;
