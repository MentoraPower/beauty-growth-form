import { useState } from "react";
import { Link } from "react-router-dom";
import { countries, beautyAreas, revenueRanges, Country } from "@/data/countries";
import CountrySelect from "@/components/CountrySelect";
import ProgressBar from "@/components/ProgressBar";
import ArrowRight from "@/components/icons/ArrowRight";
import Mail from "@/components/icons/Mail";
import Phone from "@/components/icons/Phone";
import Instagram from "@/components/icons/Instagram";
import Building from "@/components/icons/Building";
import DollarSign from "@/components/icons/DollarSign";
import Users from "@/components/icons/Users";
import Home from "@/components/icons/Home";
import Calendar from "@/components/icons/Calendar";
import Sparkles from "@/components/icons/Sparkles";
import ChevronDown from "@/components/icons/ChevronDown";

interface FormData {
  name: string;
  email: string;
  phone: string;
  country: Country;
  instagram: string;
  beautyArea: string;
  revenue: string;
  weeklyAppointments: string;
  hasPhysicalSpace: boolean | null;
  yearsOfExperience: string;
}

const Index = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    country: countries[0],
    instagram: "",
    beautyArea: "",
    revenue: "",
    weeklyAppointments: "",
    hasPhysicalSpace: null,
    yearsOfExperience: "",
  });

  const totalSteps = 10;

  const updateFormData = (field: keyof FormData, value: string | boolean | Country | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.name.trim().length >= 1;
      case 2:
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 3:
        return formData.phone.trim().length >= 8;
      case 4:
        return formData.instagram.trim().length >= 1;
      case 5:
        return formData.beautyArea !== "";
      case 6:
        return formData.revenue !== "";
      case 7:
        return formData.weeklyAppointments.trim().length >= 1;
      case 8:
        return formData.hasPhysicalSpace !== null;
      case 9:
        return formData.yearsOfExperience.trim().length >= 1;
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Escalando seu </span>
              <span className="font-bold">negocio</span>
              <span className="font-light"> no mundo </span>
              <span className="font-bold">Beauty</span>
            </h1>
            <p className="form-subtitle mt-4 mb-8">Como posso te chamar?</p>
            <div className="space-y-4">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData("name", e.target.value)}
                placeholder="Seu nome"
                className="form-input"
                autoFocus
              />
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Prosseguir
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <p className="legal-text mt-6">
              Ao clicar em PROSSEGUIR voce automaticamente concorda com os{" "}
              <Link to="/termos" className="legal-link">
                termos de uso
              </Link>{" "}
              e{" "}
              <Link to="/privacidade" className="legal-link">
                politica de privacidade
              </Link>
            </p>
            <p className="copyright">© Copyright 2025 Scale Beauty</p>
          </div>
        );

      case 2:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Qual o seu melhor e-mail?</h1>
            <p className="form-subtitle mt-2 mb-8">Para enviarmos informacoes importantes</p>
            <div className="space-y-4">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="seu@email.com"
                className="form-input"
                autoFocus
              />
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Qual o seu WhatsApp?</h1>
            <p className="form-subtitle mt-2 mb-8">Para entrarmos em contato com voce</p>
            <div className="space-y-4">
              <div className="flex gap-2">
                <CountrySelect
                  value={formData.country}
                  onChange={(country) => updateFormData("country", country)}
                />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value.replace(/\D/g, ""))}
                  placeholder="00 00000-0000"
                  className="form-input flex-1"
                  autoFocus
                />
              </div>
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Instagram className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Qual o seu Instagram?</h1>
            <p className="form-subtitle mt-2 mb-8">Para conhecermos seu trabalho</p>
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => updateFormData("instagram", e.target.value.replace("@", ""))}
                  placeholder="seuinstagram"
                  className="form-input pl-9"
                  autoFocus
                />
              </div>
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Building className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Qual a sua area de atuacao?</h1>
            <p className="form-subtitle mt-2 mb-8">Selecione a area da sua Clinica/Studio</p>
            <div className="space-y-4">
              <div className="relative">
                <select
                  value={formData.beautyArea}
                  onChange={(e) => updateFormData("beautyArea", e.target.value)}
                  className="form-select pr-12"
                >
                  <option value="">Selecione uma area</option>
                  {beautyAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              </div>
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Qual o faturamento mensal atual?</h1>
            <p className="form-subtitle mt-2 mb-8">Da sua Clinica/Studio</p>
            <div className="space-y-4">
              <div className="relative">
                <select
                  value={formData.revenue}
                  onChange={(e) => updateFormData("revenue", e.target.value)}
                  className="form-select pr-12"
                >
                  <option value="">Selecione uma faixa</option>
                  {revenueRanges.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              </div>
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Quantos atendimentos por semana?</h1>
            <p className="form-subtitle mt-2 mb-8">Em media na sua Clinica/Studio</p>
            <div className="space-y-4">
              <input
                type="number"
                value={formData.weeklyAppointments}
                onChange={(e) => updateFormData("weeklyAppointments", e.target.value)}
                placeholder="Ex: 30"
                className="form-input"
                min="0"
                autoFocus
              />
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Home className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Voce possui espaco fisico?</h1>
            <p className="form-subtitle mt-2 mb-8">Ou atende em domicilio/casa</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => updateFormData("hasPhysicalSpace", true)}
                className={`option-card ${formData.hasPhysicalSpace === true ? "selected" : ""}`}
              >
                <span className="option-card-text">Sim, possuo espaco fisico</span>
              </button>
              <button
                type="button"
                onClick={() => updateFormData("hasPhysicalSpace", false)}
                className={`option-card ${formData.hasPhysicalSpace === false ? "selected" : ""}`}
              >
                <span className="option-card-text">Nao, atendo em casa/domicilio</span>
              </button>
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2 mt-4"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="form-card">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h1 className="form-title">Quantos anos de profissao?</h1>
            <p className="form-subtitle mt-2 mb-8">Sua experiencia na area da beleza</p>
            <div className="space-y-4">
              <input
                type="number"
                value={formData.yearsOfExperience}
                onChange={(e) => updateFormData("yearsOfExperience", e.target.value)}
                placeholder="Ex: 5"
                className="form-input"
                min="0"
                autoFocus
              />
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      case 10:
        return (
          <div className="form-card text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <h1 className="form-title">Parabens, {formData.name}!</h1>
            <p className="text-base text-muted-foreground mt-4 mb-8 leading-relaxed">
              Voce ganhou uma consultoria exclusiva com o time da Scale Beauty para saber mais sobre nossos servicos e como podemos escalar seu negocio.
            </p>
            <button
              onClick={() => {
                console.log("Form submitted:", formData);
              }}
              className="btn-primary flex items-center justify-center gap-2"
            >
              Finalizar
            </button>
            <p className="text-sm text-muted-foreground mt-6">
              Em breve vamos entrar em contato pelo seu WhatsApp!
            </p>
            <p className="copyright">© Copyright 2025 Scale Beauty</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="form-container">
      {step > 1 && step < 10 && <ProgressBar currentStep={step - 1} totalSteps={totalSteps - 2} />}
      {renderStep()}
    </div>
  );
};

export default Index;
