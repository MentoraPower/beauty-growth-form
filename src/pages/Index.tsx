import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { countries, beautyAreas, revenueRanges, Country } from "@/data/countries";
import scaleBeautyBanner from "@/assets/scale-beauty-banner.png";
import scaleBeautyMobile from "@/assets/scale-beauty-mobile.png";
import quemSomosImage from "@/assets/quem-somos.webp";
import CountrySelect from "@/components/CountrySelect";
import FormContainer from "@/components/FormContainer";
import CustomSelect from "@/components/CustomSelect";
import ProgressBar from "@/components/ProgressBar";
import ShimmerButton from "@/components/ShimmerButton";
import ArrowRight from "@/components/icons/ArrowRight";
import ArrowLeft from "@/components/icons/ArrowLeft";
import Mail from "@/components/icons/Mail";
import WhatsApp from "@/components/icons/WhatsApp";
import Instagram from "@/components/icons/Instagram";
import { ScrollVelocityContainer, ScrollVelocityRow } from "@/components/ScrollVelocity";
import Building from "@/components/icons/Building";
import DollarSign from "@/components/icons/DollarSign";
import Users from "@/components/icons/Users";
import Home from "@/components/icons/Home";
import { FeatureCard } from "@/components/ui/grid-feature-cards";
import { motion, useReducedMotion } from "framer-motion";
import { Target, FileText, Rocket, Handshake, BadgeCheck } from "lucide-react";
import Calendar from "@/components/icons/Calendar";
import { toast } from "sonner";
import HamburgerMenu from "@/components/HamburgerMenu";
import { supabase } from "@/integrations/supabase/client";
import SplashScreen from "@/components/SplashScreen";

interface FormData {
  name: string;
  email: string;
  phone: string;
  country: Country;
  instagram: string;
  beautyArea: string;
  revenue: string;
  weeklyAppointments: string;
  averageTicket: string;
  hasPhysicalSpace: boolean | null;
  yearsOfExperience: string;
  canAfford: string | null;
  wantsMoreInfo: boolean | null;
}

// Format currency as user types
const formatCurrency = (value: string): string => {
  // Remove non-digits
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  
  // Convert to number (cents)
  const cents = parseInt(digits, 10);
  
  // Format as BRL
  const reais = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return `R$ ${reais}`;
};

// Parse currency string to number
const parseCurrency = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

// Get minimum revenue value from range string
const getMinRevenueFromRange = (range: string): number => {
  // Parse strings like "Até R$ 5.000", "R$ 5.000 a R$ 10.000", "Acima de R$ 50.000"
  const cleanRange = range.replace(/\./g, '').replace(',', '.');
  
  if (range.toLowerCase().includes('até')) {
    return 0;
  }
  
  if (range.toLowerCase().includes('acima')) {
    const match = cleanRange.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  const match = cleanRange.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// Check if person can likely afford the service
const checkAffordability = (revenue: string, weeklyAppointments: string, averageTicket: string): boolean => {
  const minRevenue = getMinRevenueFromRange(revenue);
  const appointments = parseInt(weeklyAppointments, 10) || 0;
  const ticket = parseCurrency(averageTicket);
  
  // Calculate estimated monthly revenue
  const estimatedMonthly = appointments * 4 * ticket;
  
  // Service costs R$ 2,800/month
  // Consider affordable if revenue >= 2800 and estimated monthly is reasonable
  return minRevenue >= 2800 || estimatedMonthly >= 2800;
};

const Index = () => {
  const [showSplash, setShowSplash] = useState(true);
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
    averageTicket: "",
    hasPhysicalSpace: null,
    yearsOfExperience: "",
    canAfford: null,
    wantsMoreInfo: null
  });
  
  // Track if affordability question should be shown
  const [showAffordabilityQuestion, setShowAffordabilityQuestion] = useState(false);

  // Track page view on mount (only once per real visitor, filter bots)
  useEffect(() => {
    const trackPageView = async () => {
      const STORAGE_KEY = "scale_beauty_visited";

      // Check localStorage
      const hasVisitedLS = localStorage.getItem(STORAGE_KEY);

      // Check cookies
      const hasVisitedCookie = document.cookie.includes(`${STORAGE_KEY}=true`);

      // If already visited, don't track again
      if (hasVisitedLS || hasVisitedCookie) {
        return;
      }

      // Bot detection
      const userAgent = navigator.userAgent.toLowerCase();
      const botPatterns = ['bot', 'crawl', 'spider', 'slurp', 'googlebot', 'bingbot', 'yandex', 'baidu', 'duckduck', 'facebookexternalhit', 'facebook', 'twitter', 'linkedin', 'pinterest', 'whatsapp', 'telegram', 'headless', 'phantom', 'selenium', 'puppeteer', 'playwright', 'curl', 'wget', 'python', 'java', 'ruby', 'perl', 'go-http', 'apache', 'node-fetch', 'axios', 'postman', 'insomnia'];
      const isBot = botPatterns.some(pattern => userAgent.includes(pattern));

      // Check for headless browser indicators
      const isHeadless = !navigator.languages || navigator.languages.length === 0;
      const hasWebdriver = navigator.webdriver === true;
      if (isBot || isHeadless || hasWebdriver) {
        return;
      }

      // Wait 2 seconds to ensure real user (bots usually leave immediately)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify user is still on page
      if (document.hidden) {
        return;
      }
      try {
        await supabase.from("page_views").insert({
          page_path: "/"
        });

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, "true");

        // Save to cookies (expires in 1 year)
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        document.cookie = `${STORAGE_KEY}=true; expires=${expires.toUTCString()}; path=/`;
      } catch (error) {
        console.error("Error tracking page view:", error);
      }
    };
    trackPageView();
  }, []);

  // Content protection - disable right-click, keyboard shortcuts, and dev tools
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's'))
      ) {
        e.preventDefault();
        return false;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  const totalSteps = 12; // Added ticket médio and affordability steps
  const updateFormData = (field: keyof FormData, value: string | boolean | Country | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const getValidationMessage = () => {
    switch (step) {
      case 1:
        return "Por favor, preencha seu nome";
      case 2:
        return "Por favor, preencha um e-mail válido";
      case 3:
        return "Por favor, preencha seu WhatsApp";
      case 4:
        return "Por favor, preencha seu Instagram";
      case 5:
        return "Por favor, selecione sua área de atuação";
      case 6:
        return "Por favor, selecione seu faturamento";
      case 7:
        return "Por favor, preencha a quantidade de atendimentos";
      case 8:
        return "Por favor, preencha o valor do ticket médio";
      case 9:
        return "Por favor, selecione uma opção";
      case 10:
        return "Por favor, preencha seus anos de experiência";
      case 11:
        return "Por favor, selecione uma opção";
      default:
        return "Por favor, preencha o campo";
    }
  };
  const handleNext = () => {
    if (canProceed()) {
      if (step < totalSteps) {
        // After ticket médio step, check affordability
        if (step === 8) {
          const canAfford = checkAffordability(formData.revenue, formData.weeklyAppointments, formData.averageTicket);
          setShowAffordabilityQuestion(!canAfford);
        }
        setStep(step + 1);
      }
    } else {
      toast.error(getValidationMessage());
    }
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
        return formData.averageTicket.trim().length >= 1 && parseCurrency(formData.averageTicket) > 0;
      case 9:
        return formData.hasPhysicalSpace !== null;
      case 10:
        return formData.yearsOfExperience.trim().length >= 1;
      case 11:
        return formData.canAfford !== null;
      default:
        return true;
    }
  };
  const renderStep = () => {
    switch (step) {
      case 1:
        return <div className="form-card">
            <h1 className="form-title max-w-[280px] md:max-w-none">
              <span className="font-light">Escalando seu negócio no </span>
              <span className="font-bold">mundo Beauty</span>
            </h1>
            <p className="form-subtitle mt-4 mb-8">Como posso te chamar?</p>
            <div className="space-y-4">
              <input type="text" value={formData.name} onChange={e => updateFormData("name", e.target.value)} placeholder="Seu nome" className="form-input" autoFocus />
              <ShimmerButton onClick={handleNext}>
                Prosseguir
                <ArrowRight className="w-5 h-5" />
              </ShimmerButton>
            </div>
          </div>;
      case 2:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o seu </span>
              <span className="font-bold">melhor e-mail?</span>
            </h1>
            <p className="form-subtitle">Para enviarmos informações importantes</p>
            <div className="space-y-4">
              <input type="email" value={formData.email} onChange={e => updateFormData("email", e.target.value)} placeholder="seu@email.com" className="form-input" autoFocus />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 3:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o seu </span>
              <span className="font-bold">WhatsApp?</span>
            </h1>
            <p className="form-subtitle">Para entrarmos em contato com você</p>
            <div className="space-y-4">
              <div className="flex">
                <CountrySelect value={formData.country} onChange={country => updateFormData("country", country)} />
                <input type="tel" value={formData.phone} onChange={e => updateFormData("phone", e.target.value.replace(/\D/g, ""))} placeholder="00 00000-0000" className="form-input flex-1 rounded-l-none border-l-0" autoFocus />
              </div>
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 4:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o seu </span>
              <span className="font-bold">Instagram?</span>
            </h1>
            <p className="form-subtitle">Para conhecermos seu trabalho</p>
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <input type="text" value={formData.instagram} onChange={e => updateFormData("instagram", e.target.value.replace("@", ""))} placeholder="seuinstagram" className="form-input pl-9" autoFocus />
              </div>
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 5:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual a sua </span>
              <span className="font-bold">área de atuação?</span>
            </h1>
            <p className="form-subtitle">Selecione a área da sua Clínica/Studio</p>
            <div className="space-y-4">
              <CustomSelect value={formData.beautyArea} onChange={value => updateFormData("beautyArea", value)} options={beautyAreas} placeholder="Selecione uma área" />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 6:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o </span>
              <span className="font-bold">faturamento mensal?</span>
            </h1>
            <p className="form-subtitle">Da sua Clínica/Studio</p>
            <div className="space-y-4">
              <CustomSelect value={formData.revenue} onChange={value => updateFormData("revenue", value)} options={revenueRanges} placeholder="Selecione uma faixa" />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 7:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Quantos </span>
              <span className="font-bold">atendimentos por semana?</span>
            </h1>
            <p className="form-subtitle">Em média na sua Clínica/Studio</p>
            <div className="space-y-4">
              <input type="number" value={formData.weeklyAppointments} onChange={e => updateFormData("weeklyAppointments", e.target.value)} placeholder="Ex: 30" className="form-input" min="0" autoFocus />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 8:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o </span>
              <span className="font-bold">ticket médio?</span>
            </h1>
            <p className="form-subtitle">Valor médio do seu procedimento</p>
            <div className="space-y-4">
              <input 
                type="text" 
                value={formData.averageTicket} 
                onChange={e => {
                  const formatted = formatCurrency(e.target.value);
                  updateFormData("averageTicket", formatted);
                }} 
                placeholder="R$ 0,00" 
                className="form-input" 
                autoFocus 
              />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 9:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Você possui </span>
              <span className="font-bold">espaço físico?</span>
            </h1>
            <p className="form-subtitle">Ou atende em domicílio/casa</p>
            <div className="space-y-3">
              <button type="button" onClick={() => updateFormData("hasPhysicalSpace", true)} className={`option-card ${formData.hasPhysicalSpace === true ? "selected" : ""}`}>
                <span className="option-card-text">Sim, possuo espaço físico</span>
              </button>
              <button type="button" onClick={() => updateFormData("hasPhysicalSpace", false)} className={`option-card ${formData.hasPhysicalSpace === false ? "selected" : ""}`}>
                <span className="option-card-text">Não, atendo em casa/domicílio</span>
              </button>
              <div className="flex gap-3 mt-4">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 10:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Quantos anos de </span>
              <span className="font-bold">profissão?</span>
            </h1>
            <p className="form-subtitle">Sua experiência na área da beleza</p>
            <div className="space-y-4">
              <input type="number" value={formData.yearsOfExperience} onChange={e => updateFormData("yearsOfExperience", e.target.value)} placeholder="Ex: 5" className="form-input" min="0" autoFocus />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1">
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 11:
        // Affordability check step
        if (formData.canAfford === "no" && formData.wantsMoreInfo === null) {
          // Show "want to know more?" question
          return <div className="form-card">
              <h1 className="form-title !text-center">
                <span className="font-bold">Deseja saber mais?</span>
              </h1>
              <p className="text-base text-muted-foreground mt-4 mb-8 leading-relaxed text-center">
                Mesmo assim, gostaria de conhecer mais sobre nossos serviços e como podemos ajudar seu negócio?
              </p>
              <div className="space-y-3">
                <button 
                  type="button" 
                  onClick={() => {
                    updateFormData("wantsMoreInfo", true);
                    nextStep();
                  }} 
                  className="option-card"
                >
                  <span className="option-card-text">Sim, quero saber mais</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    updateFormData("wantsMoreInfo", false);
                    nextStep();
                  }} 
                  className="option-card"
                >
                  <span className="option-card-text">Não, obrigada</span>
                </button>
              </div>
            </div>;
        }
        
        return <div className="form-card">
            <h1 className="form-title !text-center">
              <span className="font-bold">Investimento</span>
            </h1>
            <p className="text-base text-muted-foreground mt-4 mb-8 leading-relaxed text-center">
              Hoje, nosso serviço mais acessível custa <span className="font-bold text-foreground">R$ 2.800,00 por mês</span>. Você tem condição de investir esse valor no crescimento do seu negócio?
            </p>
            <div className="space-y-3">
              <button 
                type="button" 
                onClick={() => {
                  updateFormData("canAfford", "yes");
                  nextStep();
                }} 
                className={`option-card ${formData.canAfford === "yes" ? "selected" : ""}`}
              >
                <span className="option-card-text">Sim, consigo investir</span>
              </button>
              <button 
                type="button" 
                onClick={() => {
                  updateFormData("canAfford", "no");
                }} 
                className={`option-card ${formData.canAfford === "no" ? "selected" : ""}`}
              >
                <span className="option-card-text">Não no momento</span>
              </button>
              <div className="flex gap-3 mt-4">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
              </div>
            </div>
          </div>;
      case 12:
        return <div className="form-card text-center">
            {isLoading ? <>
                <h1 className="form-title !text-center">Redirecionando...</h1>
                <p className="text-base text-muted-foreground mt-4 mb-8">
                  Aguarde um momento
                </p>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full gradient-primary animate-loading-bar" />
                </div>
              </> : <>
                <h1 className="form-title !text-center">Parabéns, {formData.name}!</h1>
                <p className="text-base text-muted-foreground mt-4 mb-8 leading-relaxed">
                  Você ganhou uma consultoria exclusiva com o time da Scale Beauty para saber mais sobre nossos serviços e como podemos escalar seu negócio.
                </p>
                <ShimmerButton onClick={async () => {
              setIsLoading(true);
              try {
                // Get Base pipeline id
                const {
                  data: basePipeline
                } = await supabase.from("pipelines").select("id").eq("nome", "Base").maybeSingle();
                const {
                  error
                } = await supabase.from("leads").insert({
                  name: formData.name,
                  email: formData.email,
                  whatsapp: formData.phone,
                  country_code: formData.country.dialCode,
                  instagram: formData.instagram,
                  service_area: formData.beautyArea,
                  monthly_billing: formData.revenue,
                  weekly_attendance: formData.weeklyAppointments,
                  workspace_type: formData.hasPhysicalSpace ? "physical" : "home",
                  years_experience: formData.yearsOfExperience,
                  average_ticket: parseCurrency(formData.averageTicket),
                  can_afford: formData.canAfford,
                  wants_more_info: formData.wantsMoreInfo,
                  pipeline_id: basePipeline?.id || null
                });
                if (error) {
                  console.error("Error saving lead:", error);
                  toast.error("Erro ao salvar dados. Tente novamente.");
                  setIsLoading(false);
                  return;
                }
                setTimeout(() => {
                  window.location.href = "https://www.instagram.com/scalebeautyy/";
                }, 2000);
              } catch (err) {
                console.error("Error:", err);
                toast.error("Erro ao salvar dados. Tente novamente.");
                setIsLoading(false);
              }
            }}>
                  Finalizar
                </ShimmerButton>
                <p className="text-sm text-muted-foreground mt-6">
                  Em breve vamos entrar em contato pelo seu WhatsApp!
                </p>
                <p className="copyright">© Copyright 2025 Scale Beauty</p>
              </>}
          </div>;
      default:
        return null;
    }
  };
  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: showSplash ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen bg-background flex flex-col"
      >
      <HamburgerMenu />
      {step > 1 && step < 12 && <ProgressBar currentStep={step - 1} totalSteps={totalSteps - 2} />}
      
      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col min-h-screen relative">
        {/* Banner image on top with rounded bottom */}
        <div className="w-full flex-shrink-0">
          <img src={scaleBeautyMobile} alt="Scale Beauty" className="w-full h-[260px] object-cover rounded-b-3xl" loading="eager" decoding="async" />
        </div>
        {/* Form overlapping the image */}
        <div className="flex-1 flex flex-col justify-start px-4 -mt-6 relative z-10">
          <FormContainer>
            {renderStep()}
          </FormContainer>
          
          {/* Scroll Velocity - Mobile */}
          <div className="relative flex w-full flex-col items-center justify-center overflow-hidden -mx-4 mt-4 gap-1" style={{
          width: 'calc(100% + 2rem)'
        }}>
            <ScrollVelocityContainer className="text-[10px] uppercase tracking-[0.2em] text-foreground/30">
              <ScrollVelocityRow baseVelocity={1} direction={1}>
                <span className="mx-3 font-light">SCALE BEAUTY • ESCALANDO SEU NEGÓCIO NO MUNDO BEAUTY • SUA ASSESSORIA DE MARKETING •</span>
              </ScrollVelocityRow>
            </ScrollVelocityContainer>
            <ScrollVelocityContainer className="text-[10px] uppercase tracking-[0.2em] text-foreground/30">
              <ScrollVelocityRow baseVelocity={1} direction={-1}>
                <span className="mx-3 font-bold">SCALE BEAUTY • ESCALANDO SEU NEGÓCIO NO MUNDO BEAUTY • SUA ASSESSORIA DE MARKETING •</span>
              </ScrollVelocityRow>
            </ScrollVelocityContainer>
            <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r"></div>
            <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l"></div>
          </div>

          {/* Feature Cards Section - Mobile */}
          <FeaturesSection />
          
          {/* Quem Somos Section - Mobile */}
          <QuemSomosSection />
          
          {/* Mobile footer with terms - only on step 1 */}
          {step === 1 && <div className="pb-4 pt-2 bg-background">
              <div className="w-full h-px bg-border mb-4" />
              <div className="text-center px-[1.25em]">
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
            </div>}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-col min-h-screen">
        {/* Banner image on top with rounded bottom */}
        <div className="w-full flex-shrink-0">
          <img src={scaleBeautyBanner} alt="Scale Beauty" className="w-full h-[320px] object-cover rounded-b-3xl" loading="eager" decoding="async" />
        </div>
        
        {/* Form overlapping the image */}
        <div className="flex-1 flex items-start justify-center px-8 -mt-12 relative z-10">
          <FormContainer>
            {renderStep()}
          </FormContainer>
        </div>

        {/* Scroll Velocity */}
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-3 gap-1" style={{
        marginTop: '15px'
      }}>
          <ScrollVelocityContainer className="text-sm uppercase tracking-[0.2em] text-foreground/30">
            <ScrollVelocityRow baseVelocity={1} direction={1}>
              <span className="mx-4 font-light">SCALE BEAUTY • ESCALANDO SEU NEGÓCIO NO MUNDO BEAUTY • SUA ASSESSORIA DE MARKETING •</span>
            </ScrollVelocityRow>
          </ScrollVelocityContainer>
          <ScrollVelocityContainer className="text-sm uppercase tracking-[0.2em] text-foreground/30">
            <ScrollVelocityRow baseVelocity={1} direction={-1}>
              <span className="mx-4 font-bold">SCALE BEAUTY • ESCALANDO SEU NEGÓCIO NO MUNDO BEAUTY • SUA ASSESSORIA DE MARKETING •</span>
            </ScrollVelocityRow>
          </ScrollVelocityContainer>
          <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r"></div>
          <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l"></div>
        </div>

        {/* Feature Cards Section */}
        <FeaturesSection />

        {/* Quem Somos Section - Desktop */}
        <QuemSomosSection />

        {/* Desktop footer with terms - only on step 1 */}
        {step === 1 && <div className="pb-6 pt-4 bg-background">
            <div className="w-full h-px bg-border mb-4" />
            <div className="text-center px-8">
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
          </div>}
      </div>
      </motion.div>
    </>
  );
};
const features = [{
  title: 'Tráfego Pago',
  icon: Target,
  description: 'Atraia clientes qualificados para seu negócio com campanhas estratégicas de anúncios.'
}, {
  title: 'Páginas de Vendas',
  icon: FileText,
  description: 'Landing pages de alta conversão que transformam visitantes em clientes fiéis.'
}, {
  title: 'Consultoria de Aceleração',
  icon: Rocket,
  description: 'Mentoria personalizada para escalar seu faturamento de forma rápida e sustentável.'
}, {
  title: 'Co-Produção',
  icon: Handshake,
  description: 'Parceria estratégica onde cuidamos do marketing enquanto você foca no seu talento.'
}];
type ViewAnimationProps = {
  delay?: number;
  className?: React.ComponentProps<typeof motion.div>['className'];
  children: React.ReactNode;
};
function AnimatedContainer({
  className,
  delay = 0.1,
  children
}: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) {
    return <>{children}</>;
  }
  return <motion.div initial={{
    filter: 'blur(4px)',
    translateY: -8,
    opacity: 0
  }} whileInView={{
    filter: 'blur(0px)',
    translateY: 0,
    opacity: 1
  }} viewport={{
    once: true
  }} transition={{
    delay,
    duration: 0.8
  }} className={className}>
      {children}
    </motion.div>;
}
function FeaturesSection() {
  return <section className="py-16 md:py-32">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 md:px-4">
        <AnimatedContainer className="mx-auto max-w-4xl text-center px-2">
          <h2 className="text-2xl font-bold tracking-tight text-balance md:text-3xl lg:text-4xl xl:font-extrabold mx-0">
            ​Como a Scale pode te ajudar?                    
          </h2>
          
        </AnimatedContainer>

        <AnimatedContainer delay={0.4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {features.slice(0, 3).map((feature, i) => <div key={i} className="border border-dashed">
              <FeatureCard feature={feature} />
            </div>)}
        </AnimatedContainer>
        
        {/* Co-Produção full width */}
        <AnimatedContainer delay={0.5} className="border border-dashed">
          <FeatureCard feature={features[3]} className="w-full" />
        </AnimatedContainer>
      </div>
    </section>;
}
function QuemSomosSection() {
  return <section className="w-[calc(100%+2rem)] -mx-4 md:mx-0 md:w-full relative">
      {/* Curved top transition */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] md:w-[50%] h-8 md:h-12 bg-background rounded-b-[50px] z-10" />
      
      {/* Red background with padding for the curve */}
      <div className="bg-gradient-to-r from-[#F40000] to-[#A10000] pt-8 md:pt-12 pb-16 md:pb-24">
        <div className="mx-auto w-full max-w-6xl px-8 md:px-8 pt-8 md:pt-12">
          <AnimatedContainer className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Image */}
            <div className="w-full md:w-1/2">
              <img src={quemSomosImage} alt="Quem Somos - Scale Beauty" className="w-full h-auto rounded-2xl" loading="lazy" decoding="async" />
            </div>
            
            {/* Text Content */}
            <div className="w-full md:w-1/2 text-white">
              <h2 className="text-4xl md:text-3xl lg:text-4xl font-bold mb-6">
                Quem somos
              </h2>
              <p className="text-base md:text-lg leading-relaxed opacity-95">
                Somos mais que uma assessoria de marketing, somos um ecossistema completo para a área da beleza.
              </p>
              <p className="text-base md:text-lg leading-relaxed opacity-95 mt-4">
                Não acreditamos em fórmulas prontas! A nossa experiência com a área da beleza nos mostra que cada clínica, cada studio em seu modelo criativo é único e que as nossas estratégias também serão únicas.
              </p>
              
              {/* CEO Attribution Cards */}
              <div className="mt-8 flex gap-2 md:gap-3">
                <div className="inline-flex items-center gap-2 md:gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 md:px-4 py-2 md:py-3">
                  <div className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0">
                    <Building className="w-3 h-3 md:w-4 md:h-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-semibold text-[10px] md:text-xs tracking-wide">EMILLY BITETI</span>
                    <span className="text-white/70 text-[8px] md:text-[10px] tracking-wider">CEO DA BITETI BEAUTY</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 md:gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 md:px-4 py-2 md:py-3">
                  <div className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0">
                    <BadgeCheck className="w-3 h-3 md:w-4 md:h-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-semibold text-[10px] md:text-xs tracking-wide">BITETI & CO.</span>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedContainer>
        </div>
      </div>
    </section>;
}
export default Index;