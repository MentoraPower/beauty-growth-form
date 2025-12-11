import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ChevronDown from "./icons/ChevronDown";

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}

const CustomSelect = ({ value, onChange, options, placeholder }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  const dropdown = isOpen ? createPortal(
    <div 
      ref={dropdownRef}
      className="fixed max-h-64 overflow-hidden rounded-xl border border-gray-200 shadow-xl"
      style={{ 
        top: position.top,
        left: position.left,
        width: position.width,
        backgroundColor: '#ffffff',
        zIndex: 99999
      }}
    >
      <div 
        className="max-h-64 overflow-y-auto"
        style={{ backgroundColor: '#ffffff' }}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onChange(option);
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-left text-sm transition-colors hover:bg-gray-100"
            style={{ 
              backgroundColor: value === option ? '#f5f5f5' : '#ffffff',
              color: '#000000',
              fontWeight: value === option ? 500 : 400
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-14 px-4 rounded-xl border border-border text-left flex items-center justify-between transition-colors focus:outline-none"
        style={{ backgroundColor: '#ffffff' }}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {dropdown}
    </div>
  );
};

export default CustomSelect;
