import { useState, useRef, useEffect } from "react";
import ChevronDown from "./icons/ChevronDown";

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}

const CustomSelect = ({ value, onChange, options, placeholder }: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-14 px-4 rounded-xl border border-border bg-card text-left flex items-center justify-between transition-colors focus:outline-none"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div 
          className="absolute z-[9999] top-full left-0 right-0 mt-2 max-h-64 overflow-hidden rounded-xl border border-border shadow-xl"
          style={{ 
            backgroundColor: '#ffffff',
            background: '#ffffff',
            opacity: 1
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
                className="w-full px-4 py-3 text-left text-sm transition-colors"
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
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
