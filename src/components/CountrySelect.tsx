import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { countries, Country, getFlagUrl } from "@/data/countries";
import ChevronDown from "./icons/ChevronDown";

interface CountrySelectProps {
  value: Country;
  onChange: (country: Country) => void;
}

const CountrySelect = ({ value, onChange }: CountrySelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
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
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX
      });
    }
  }, [isOpen]);

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.dialCode.includes(search)
  );

  const dropdown = isOpen ? createPortal(
    <div 
      ref={dropdownRef}
      className="fixed w-72 max-h-80 overflow-hidden rounded-xl border border-gray-200 shadow-xl"
      style={{ 
        top: position.top,
        left: position.left,
        backgroundColor: '#ffffff',
        zIndex: 99999
      }}
    >
      <div 
        className="p-2 border-b border-gray-200"
        style={{ backgroundColor: '#ffffff' }}
      >
        <input
          type="text"
          placeholder="Buscar país..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none"
          style={{ 
            backgroundColor: '#f5f5f5', 
            color: '#000000'
          }}
        />
      </div>
      <div 
        className="max-h-60 overflow-y-auto"
        style={{ backgroundColor: '#ffffff' }}
      >
        {filteredCountries.map((country) => (
          <button
            key={country.code}
            type="button"
            onClick={() => {
              onChange(country);
              setIsOpen(false);
              setSearch("");
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-100"
            style={{ 
              backgroundColor: value.code === country.code ? '#f5f5f5' : '#ffffff',
              color: '#000000'
            }}
          >
            <img 
              src={getFlagUrl(country.code)} 
              alt={country.name}
              className="w-6 h-4 object-cover rounded-sm"
            />
            <span className="text-sm flex-1" style={{ color: '#000000' }}>{country.name}</span>
            <span className="text-sm" style={{ color: '#666666' }}>{country.dialCode}</span>
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
        className="flex items-center gap-2 h-14 px-3 rounded-l-xl border border-r-0 border-border transition-colors focus:outline-none"
        style={{ backgroundColor: '#ffffff' }}
      >
        <img 
          src={getFlagUrl(value.code)} 
          alt={value.name}
          className="w-6 h-4 object-cover rounded-sm"
        />
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
      {dropdown}
    </div>
  );
};

export default CountrySelect;
