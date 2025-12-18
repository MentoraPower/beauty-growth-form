import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, X, User, Phone, Mail, Instagram } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { countries, Country, getFlagUrl } from "@/data/countries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface InlineAddContactProps {
  pipelineId: string;
  subOriginId: string | null;
}

export function InlineAddContact({ pipelineId, subOriginId }: InlineAddContactProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find(c => c.code === "BR") || countries[0]
  );
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryButtonRef = useRef<HTMLButtonElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Close country dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        countryButtonRef.current &&
        !countryButtonRef.current.contains(e.target as Node) &&
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update dropdown position
  useEffect(() => {
    if (showCountryDropdown && countryButtonRef.current) {
      const rect = countryButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showCountryDropdown]);

  const filteredCountries = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dialCode.includes(countrySearch)
  );

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setInstagram("");
    setSelectedCountry(countries.find(c => c.code === "BR") || countries[0]);
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: name.trim(),
        whatsapp: phone.trim(),
        country_code: selectedCountry.dialCode,
        email: email.trim() || "sem@email.com",
        instagram: instagram.trim() || "@",
        service_area: "Outro",
        monthly_billing: "Não informado",
        weekly_attendance: "0",
        workspace_type: "Não informado",
        years_experience: "0",
        pipeline_id: pipelineId,
        sub_origin_id: subOriginId,
        ordem: 0,
      });

      if (error) throw error;

      toast.success("Contato adicionado!");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["crm-leads", subOriginId] });
      queryClient.invalidateQueries({ queryKey: ["lead-counts"] });
    } catch (error) {
      console.error("Erro ao adicionar contato:", error);
      toast.error("Erro ao adicionar contato");
    } finally {
      setIsSubmitting(false);
    }
  };

  const countryDropdown = showCountryDropdown
    ? createPortal(
        <div
          ref={countryDropdownRef}
          className="fixed w-64 max-h-64 overflow-hidden rounded-lg border bg-popover shadow-xl"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 99999,
          }}
        >
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar país..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  setSelectedCountry(country);
                  setShowCountryDropdown(false);
                  setCountrySearch("");
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted",
                  selectedCountry.code === country.code && "bg-muted"
                )}
              >
                <img
                  src={getFlagUrl(country.code)}
                  alt={country.name}
                  className="w-5 h-3.5 object-cover rounded-sm"
                />
                <span className="flex-1 truncate">{country.name}</span>
                <span className="text-muted-foreground">{country.dialCode}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Adicionar contato</span>
      </button>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Novo contato</span>
        <button
          onClick={resetForm}
          className="p-1 hover:bg-muted rounded"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Name */}
      <div className="relative">
        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 pl-8 text-xs"
          autoFocus
        />
      </div>

      {/* Phone with country code */}
      <div className="flex">
        <button
          ref={countryButtonRef}
          type="button"
          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
          className="flex items-center gap-1 h-8 px-2 border border-r-0 rounded-l-md bg-muted/50 hover:bg-muted"
        >
          <img
            src={getFlagUrl(selectedCountry.code)}
            alt={selectedCountry.name}
            className="w-4 h-3 object-cover rounded-sm"
          />
          <span className="text-[10px] text-muted-foreground">{selectedCountry.dialCode}</span>
        </button>
        <div className="relative flex-1">
          <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 pl-8 text-xs rounded-l-none"
          />
        </div>
      </div>
      {countryDropdown}

      {/* Email */}
      <div className="relative">
        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Instagram */}
      <div className="relative">
        <Instagram className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="@instagram"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || !name.trim()}
        className="w-full h-8 text-xs bg-gradient-to-r from-[#F40000] to-[#A10000] hover:opacity-90"
      >
        {isSubmitting ? "Salvando..." : "Adicionar"}
      </Button>
    </div>
  );
}
