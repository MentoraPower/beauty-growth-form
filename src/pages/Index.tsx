import { useState } from "react";
import { Link } from "react-router-dom";
import { countries, beautyAreas, revenueRanges, Country } from "@/data/countries";
import scaleBeautyBanner from "@/assets/scale-beauty-banner.png";
import scaleBeautyMobile from "@/assets/scale-beauty-mobile.png";
import CountrySelect from "@/components/CountrySelect";
import FormContainer from "@/components/FormContainer";
import CustomSelect from "@/components/CustomSelect";
import ProgressBar from "@/components/ProgressBar";
import RippleButton from "@/components/RippleButton";
import ArrowRight from "@/components/icons/ArrowRight";
import ArrowLeft from "@/components/icons/ArrowLeft";
import Mail from "@/components/icons/Mail";
import WhatsApp from "@/components/icons/WhatsApp";
import Instagram from "@/components/icons/Instagram";
import Building from "@/components/icons/Building";
import DollarSign from "@/components/icons/DollarSign";
import Users from "@/components/icons/Users";
import Home from "@/components/icons/Home";
import Calendar from "@/components/icons/Calendar";

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
  const [isLoading, setIsLoading] = useState(false);
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

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
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
            <h1 className="form-title max-w-[280px] md:max-w-none">
              <span className="font-light">Escalando seu negócio no </span>
              <span className="font-bold">mundo Beauty</span>
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
              <RippleButton
                onClick={nextStep}
                disabled={!canProceed()}
              >
                Prosseguir
                <ArrowRight className="w-5 h-5" />
              </RippleButton>
            </div>
            {/* Desktop: terms inline */}
            <div className="hidden md:block">
              <p className="legal-text mt-6">
                Ao clicar em PROSSEGUIR você automaticamente concorda com os{" "}
                <Link to="/termos" className="legal-link">
                  termos de uso
                </Link>{" "}
                e{" "}
                <Link to="/privacidade" className="legal-link">
                  política de privacidade
                </Link>
              </p>
              <p className="copyright">© Copyright 2025 Scale Beauty</p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o seu </span>
              <span className="font-bold">melhor e-mail?</span>
            </h1>
            <p className="form-subtitle">Para enviarmos informações importantes</p>
            <div className="space-y-4">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="seu@email.com"
                className="form-input"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o seu </span>
              <span className="font-bold">WhatsApp?</span>
            </h1>
            <p className="form-subtitle">Para entrarmos em contato com você</p>
            <div className="space-y-4">
              <div className="flex">
                <CountrySelect
                  value={formData.country}
                  onChange={(country) => updateFormData("country", country)}
                />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData("phone", e.target.value.replace(/\D/g, ""))}
                  placeholder="00 00000-0000"
                  className="form-input flex-1 rounded-l-none border-l-0"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o seu </span>
              <span className="font-bold">Instagram?</span>
            </h1>
            <p className="form-subtitle">Para conhecermos seu trabalho</p>
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
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual a sua </span>
              <span className="font-bold">área de atuação?</span>
            </h1>
            <p className="form-subtitle">Selecione a área da sua Clínica/Studio</p>
            <div className="space-y-4">
              <CustomSelect
                value={formData.beautyArea}
                onChange={(value) => updateFormData("beautyArea", value)}
                options={beautyAreas}
                placeholder="Selecione uma área"
              />
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o </span>
              <span className="font-bold">faturamento mensal?</span>
            </h1>
            <p className="form-subtitle">Da sua Clínica/Studio</p>
            <div className="space-y-4">
              <CustomSelect
                value={formData.revenue}
                onChange={(value) => updateFormData("revenue", value)}
                options={revenueRanges}
                placeholder="Selecione uma faixa"
              />
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Quantos </span>
              <span className="font-bold">atendimentos por semana?</span>
            </h1>
            <p className="form-subtitle">Em média na sua Clínica/Studio</p>
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
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Você possui </span>
              <span className="font-bold">espaço físico?</span>
            </h1>
            <p className="form-subtitle">Ou atende em domicílio/casa</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => updateFormData("hasPhysicalSpace", true)}
                className={`option-card ${formData.hasPhysicalSpace === true ? "selected" : ""}`}
              >
                <span className="option-card-text">Sim, possuo espaço físico</span>
              </button>
              <button
                type="button"
                onClick={() => updateFormData("hasPhysicalSpace", false)}
                className={`option-card ${formData.hasPhysicalSpace === false ? "selected" : ""}`}
              >
                <span className="option-card-text">Não, atendo em casa/domicílio</span>
              </button>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Quantos anos de </span>
              <span className="font-bold">profissão?</span>
            </h1>
            <p className="form-subtitle">Sua experiência na área da beleza</p>
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
              <div className="flex gap-3">
                <button
                  onClick={prevStep}
                  className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <RippleButton
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </RippleButton>
              </div>
            </div>
          </div>
        );

      case 10:
        return (
          <div className="form-card text-center">
            {isLoading ? (
              <>
                <h1 className="form-title !text-center">Redirecionando...</h1>
                <p className="text-base text-muted-foreground mt-4 mb-8">
                  Aguarde um momento
                </p>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full gradient-primary animate-loading-bar" />
                </div>
              </>
            ) : (
              <>
                <h1 className="form-title !text-center">Parabéns, {formData.name}!</h1>
                <p className="text-base text-muted-foreground mt-4 mb-8 leading-relaxed">
                  Você ganhou uma consultoria exclusiva com o time da Scale Beauty para saber mais sobre nossos serviços e como podemos escalar seu negócio.
                </p>
                <RippleButton
                  onClick={() => {
                    setIsLoading(true);
                    console.log("Form submitted:", formData);
                    setTimeout(() => {
                      window.location.href = "https://www.instagram.com/scalebeautyy/";
                    }, 2000);
                  }}
                >
                  Finalizar
                </RippleButton>
                <p className="text-sm text-muted-foreground mt-6">
                  Em breve vamos entrar em contato pelo seu WhatsApp!
                </p>
                <p className="copyright">© Copyright 2025 Scale Beauty</p>
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {step > 1 && step < 10 && <ProgressBar currentStep={step - 1} totalSteps={totalSteps - 2} />}
      
      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col h-screen relative overflow-hidden">
        {/* Banner image on top with rounded bottom */}
        <div className="w-full flex-shrink-0">
          <img 
            src={scaleBeautyMobile} 
            alt="Scale Beauty" 
            className="w-full h-[220px] object-cover rounded-b-3xl"
          />
        </div>
        {/* Form overlapping the image */}
        <div className="flex-1 flex flex-col justify-start px-4 -mt-6 relative z-10 overflow-auto">
          <FormContainer>
            {renderStep()}
          </FormContainer>
          
          {/* Mobile footer with terms - only on step 1 */}
          {step === 1 && (
            <div className="mt-auto">
              <div className="w-full h-px bg-border mb-4" />
              <div className="pb-6 text-center px-[1.25em]">
                <p className="legal-text">
                  Ao clicar em PROSSEGUIR você automaticamente concorda com os{" "}
                  <Link to="/termos" className="legal-link">
                    termos de uso
                  </Link>{" "}
                  e{" "}
                  <Link to="/privacidade" className="legal-link">
                    política de privacidade
                  </Link>
                </p>
                <p className="copyright mt-4">© Copyright 2025 Scale Beauty</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-col min-h-screen">
        {/* Banner image on top */}
        <div className="w-full">
          <img 
            src={scaleBeautyBanner} 
            alt="Scale Beauty" 
            className="w-full h-auto object-cover"
          />
        </div>
        
        {/* Form centered */}
        <div className="flex-1 flex items-center justify-center p-8">
          <FormContainer>
            {renderStep()}
          </FormContainer>
        </div>
      </div>
    </div>
  );
};

export default Index;
