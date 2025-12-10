import { useState, useRef, useEffect } from "react";
import { countries, Country, getFlagUrl } from "@/data/countries";
import ChevronDown from "./icons/ChevronDown";

interface CountrySelectProps {
  value: Country;
  onChange: (country: Country) => void;
}

const CountrySelect = ({ value, onChange }: CountrySelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.dialCode.includes(search)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-14 px-3 rounded-l-xl border border-r-0 border-border bg-card transition-colors focus:outline-none"
      >
        <img 
          src={getFlagUrl(value.code)} 
          alt={value.name}
          className="w-6 h-4 object-cover rounded-sm"
        />
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-2 w-72 max-h-80 overflow-hidden rounded-xl border border-border bg-white dark:bg-neutral-900 shadow-lg">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Buscar país..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onChange(country);
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors ${
                  value.code === country.code ? "bg-primary/5" : ""
                }`}
              >
                <img 
                  src={getFlagUrl(country.code)} 
                  alt={country.name}
                  className="w-6 h-4 object-cover rounded-sm"
                />
                <span className="text-sm text-foreground flex-1">{country.name}</span>
                <span className="text-sm text-muted-foreground">{country.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountrySelect;
