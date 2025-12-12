import { useState, useEffect } from "react";
import { AnimatedCircle } from "@/components/AnimatedCircle";
import { Link } from "react-router-dom";
import { countries, beautyAreas, revenueRanges, Country } from "@/data/countries";
import scaleBeautyBanner from "@/assets/scale-beauty-banner-new.webp";
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
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Target, FileText, Rocket, Handshake, BadgeCheck, Sparkles, Zap } from "lucide-react";
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
  clinicName: string;
  beautyArea: string;
  revenue: string;
  weeklyAppointments: string;
  averageTicket: string;
  hasPhysicalSpace: boolean | null;
  yearsOfExperience: string;
  canAfford: string | null;
  wantsMoreInfo: boolean | null;
}

// Format currency for display (from database value in reais)
const formatCurrencyDisplay = (value: string | number): string => {
  if (!value && value !== 0) return '';

  // If it's a number, format directly
  const number = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(number)) return '';

  // Format as BRL
  const formatted = number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `R$ ${formatted}`;
};

// Handle currency input - ATM-style formatting (digits entered from right to left)
const handleCurrencyInput = (value: string): string => {
  // Remove everything except digits
  const digits = value.replace(/\D/g, '');

  // If empty, return empty placeholder
  if (!digits) return '';

  // Convert to cents (pad with leading zeros if needed)
  const cents = parseInt(digits, 10);

  // Convert cents to reais (divide by 100)
  const reais = cents / 100;

  // Format as BRL currency
  const formatted = reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `R$ ${formatted}`;
};

// Parse currency string to number (returns value in reais)
const parseCurrency = (value: string): number => {
  // Remove R$ and spaces
  let cleaned = value.replace(/R\$\s*/g, '').trim();
  // Replace dots (thousands separator) and comma (decimal)
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  const number = parseFloat(cleaned);
  return isNaN(number) ? 0 : number;
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCheckingLead, setIsCheckingLead] = useState(false);
  const [partialLeadId, setPartialLeadId] = useState<string | null>(null);
  const [existingLead, setExistingLead] = useState<{
    id: string;
    whatsapp: string;
    country_code: string;
    instagram: string;
    service_area: string;
    monthly_billing: string;
    weekly_attendance: string;
    workspace_type: string;
    years_experience: string;
    average_ticket: number | null;
  } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    estimatedRevenue?: number;
    revenueConsistent?: boolean;
    canAfford?: boolean;
    confidenceLevel?: string;
    analysis?: string;
  } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    country: countries[0],
    instagram: "",
    clinicName: "",
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

  // UTM parameters
  const [utmParams, setUtmParams] = useState({
    utm_source: null as string | null,
    utm_medium: null as string | null,
    utm_campaign: null as string | null,
    utm_term: null as string | null,
    utm_content: null as string | null
  });

  // Capture UTM params from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setUtmParams({
      utm_source: urlParams.get('utm_source'),
      utm_medium: urlParams.get('utm_medium'),
      utm_campaign: urlParams.get('utm_campaign'),
      utm_term: urlParams.get('utm_term'),
      utm_content: urlParams.get('utm_content')
    });
  }, []);
  // Function to mask phone number (show DDD and last 4 digits)
  const maskPhoneNumber = (phone: string, countryCode: string): string => {
    if (!phone || phone.length < 4) return phone;
    const ddd = phone.substring(0, 2);
    const lastFour = phone.slice(-4);
    const middleLength = phone.length - 6;
    const asterisks = '*'.repeat(Math.max(middleLength, 3));
    return `(${ddd}) ${asterisks}-${lastFour}`;
  };

  // Function to check if lead exists by email
  const checkExistingLead = async (email: string) => {
    setIsCheckingLead(true);
    try {
      const {
        data,
        error
      } = await supabase.from('leads').select('id, whatsapp, country_code, instagram, service_area, monthly_billing, weekly_attendance, workspace_type, years_experience, average_ticket').eq('email', email.toLowerCase().trim()).maybeSingle();
      if (error) {
        console.error("Error checking lead:", error);
        return null;
      }
      if (data) {
        console.log("Existing lead found:", data);
        setExistingLead(data);

        // Pre-fill form with existing data
        const country = countries.find(c => c.dialCode === data.country_code) || countries[0];
        setFormData(prev => ({
          ...prev,
          phone: data.whatsapp || "",
          country: country,
          instagram: data.instagram || "",
          beautyArea: data.service_area || "",
          revenue: data.monthly_billing || "",
          weeklyAppointments: data.weekly_attendance || "",
          hasPhysicalSpace: data.workspace_type === "physical" ? true : data.workspace_type === "home" ? false : null,
          yearsOfExperience: data.years_experience || "",
          averageTicket: data.average_ticket ? formatCurrencyDisplay(data.average_ticket) : ""
        }));
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error checking lead:", error);
      return null;
    } finally {
      setIsCheckingLead(false);
    }
  };

  // Function to analyze lead data with AI
  const analyzeLeadWithAI = async () => {
    setIsAnalyzing(true);
    try {
      const ticketValue = parseCurrency(formData.averageTicket);
      const response = await fetch('https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/analyze-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          revenue: formData.revenue,
          weeklyAppointments: formData.weeklyAppointments,
          averageTicket: ticketValue.toFixed(2)
        })
      });
      const data = await response.json();
      console.log("AI Analysis result:", data);
      setAiAnalysis(data);

      // Set affordability question based on AI analysis
      setShowAffordabilityQuestion(!data.canAfford);
      return data;
    } catch (error) {
      console.error("Error analyzing lead:", error);
      // Fallback to local calculation
      const canAfford = checkAffordability(formData.revenue, formData.weeklyAppointments, formData.averageTicket);
      setShowAffordabilityQuestion(!canAfford);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Function to save partial lead data progressively
  const savePartialLead = async (currentFormData: FormData, currentStep: number) => {
    try {
      // Build lead data with all required fields (use placeholders for incomplete data)
      const leadData: Record<string, unknown> = {
        name: currentFormData.name || "Incompleto",
        email: currentFormData.email || `incompleto_${Date.now()}@temp.com`,
        whatsapp: currentFormData.phone || "",
        country_code: currentFormData.country.dialCode,
        instagram: currentFormData.instagram || "",
        service_area: currentFormData.beautyArea || "",
        monthly_billing: currentFormData.revenue || "",
        weekly_attendance: currentFormData.weeklyAppointments || "",
        average_ticket: currentFormData.averageTicket ? parseCurrency(currentFormData.averageTicket) : null,
        workspace_type: currentFormData.hasPhysicalSpace === null ? "" : currentFormData.hasPhysicalSpace ? "physical" : "home",
        years_experience: currentFormData.yearsOfExperience || "",
        can_afford: currentFormData.canAfford,
        utm_source: utmParams.utm_source,
        utm_medium: utmParams.utm_medium,
        utm_campaign: utmParams.utm_campaign,
        utm_term: utmParams.utm_term,
        utm_content: utmParams.utm_content
      };

      // If we already have a lead ID (from existing lead or partial save), update it
      // Existing leads keep their current pipeline - don't change pipeline_id
      const leadIdToUpdate = existingLead?.id || partialLeadId;
      if (leadIdToUpdate) {
        // Update existing lead WITHOUT changing pipeline_id (preserves CRM position)
        await supabase.from("leads").update(leadData).eq("id", leadIdToUpdate);
      } else {
        // Create new lead with fixed pipeline "Novo" and sub-origin "Entrada"
        const PIPELINE_NOVO_ID = 'b62bdfc2-cfda-4cc2-9a72-f87f9ac1f724';
        const SUB_ORIGIN_ENTRADA_ID = '00000000-0000-0000-0000-000000000002';
        const {
          data,
          error
        } = await supabase.from("leads").insert({
          name: currentFormData.name || "Incompleto",
          email: currentFormData.email || `incompleto_${Date.now()}@temp.com`,
          whatsapp: currentFormData.phone || "",
          country_code: currentFormData.country.dialCode,
          instagram: currentFormData.instagram || "",
          service_area: currentFormData.beautyArea || "",
          monthly_billing: currentFormData.revenue || "",
          weekly_attendance: currentFormData.weeklyAppointments || "",
          average_ticket: currentFormData.averageTicket ? parseCurrency(currentFormData.averageTicket) : null,
          workspace_type: currentFormData.hasPhysicalSpace === null ? "" : currentFormData.hasPhysicalSpace ? "physical" : "home",
          years_experience: currentFormData.yearsOfExperience || "",
          can_afford: currentFormData.canAfford,
          pipeline_id: PIPELINE_NOVO_ID,
          sub_origin_id: SUB_ORIGIN_ENTRADA_ID,
          utm_source: utmParams.utm_source,
          utm_medium: utmParams.utm_medium,
          utm_campaign: utmParams.utm_campaign,
          utm_term: utmParams.utm_term,
          utm_content: utmParams.utm_content
        }).select("id").single();
        if (!error && data) {
          setPartialLeadId(data.id);
        }
      }
    } catch (error) {
      console.error("Error saving partial lead:", error);
    }
  };

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
      if (e.key === 'F12' || e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j') || e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's')) {
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

  // Save partial data when user leaves the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only save if user has started filling the form (at least has name or email)
      if ((formData.name || formData.email) && step > 1 && step < 12) {
        // Use navigator.sendBeacon for reliable saving on page close
        const leadIdToUpdate = existingLead?.id || partialLeadId;
        const leadData = {
          name: formData.name || "Incompleto",
          email: formData.email || `incompleto_${Date.now()}@temp.com`,
          whatsapp: formData.phone || "",
          country_code: formData.country.dialCode,
          instagram: formData.instagram || "",
          clinic_name: formData.clinicName || null,
          service_area: formData.beautyArea || "",
          monthly_billing: formData.revenue || "",
          weekly_attendance: formData.weeklyAppointments || "",
          average_ticket: formData.averageTicket ? parseCurrency(formData.averageTicket) : null,
          workspace_type: formData.hasPhysicalSpace === null ? "" : formData.hasPhysicalSpace ? "physical" : "home",
          years_experience: formData.yearsOfExperience || "",
          can_afford: formData.canAfford
        };
        if (leadIdToUpdate) {
          // Use fetch with keepalive for updates
          fetch(`https://ytdfwkchsumgdvcroaqg.supabase.co/rest/v1/leads?id=eq.${leadIdToUpdate}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZGZ3a2Noc3VtZ2R2Y3JvYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTkyOTUsImV4cCI6MjA4MDg3NTI5NX0.bbPtEz54fczTpjsxCaLW_VMHNm1tTutMJr_gpM6GE_M',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZGZ3a2Noc3VtZ2R2Y3JvYXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTkyOTUsImV4cCI6MjA4MDg3NTI5NX0.bbPtEz54fczTpjsxCaLW_VMHNm1tTutMJr_gpM6GE_M',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(leadData),
            keepalive: true
          }).catch(() => {});
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
      }
    });
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [formData, step, existingLead, partialLeadId]);
  const totalSteps = 13; // Added clinic name step
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
        return "Por favor, preencha o nome da clínica/studio";
      case 6:
        return "Por favor, selecione sua área de atuação";
      case 7:
        return "Por favor, selecione seu faturamento";
      case 8:
        return "Por favor, preencha a quantidade de atendimentos";
      case 9:
        return "Por favor, preencha o valor do ticket médio";
      case 10:
        return "Por favor, selecione uma opção";
      case 11:
        return "Por favor, preencha seus anos de experiência";
      case 12:
        return "Por favor, selecione uma opção";
      default:
        return "Por favor, preencha o campo";
    }
  };
  // Check if affordability question should be shown
  // Logic: service should be max 55% of revenue for it to be sustainable
  // If revenue < ~R$ 5,091, they likely can't afford R$ 2,800/month
  const shouldShowAffordabilityQuestion = (): boolean => {
    const SERVICE_COST = 2800;
    const MIN_REVENUE_RATIO = 0.55; // Service should be at most 55% of revenue
    const MIN_AFFORDABLE_REVENUE = Math.ceil(SERVICE_COST / MIN_REVENUE_RATIO); // ~R$ 5,091

    const appointments = parseInt(formData.weeklyAppointments) || 0;
    const ticket = parseCurrency(formData.averageTicket);
    const estimatedMonthly = appointments * 4 * ticket;
    // Show question if estimated revenue is below minimum affordable threshold
    return estimatedMonthly < MIN_AFFORDABLE_REVENUE;
  };
  const handleNext = async () => {
    if (canProceed()) {
      if (step < totalSteps) {
        // After email step, check if lead exists
        if (step === 2) {
          const existing = await checkExistingLead(formData.email);
          // If no existing lead, save partial data now (first save happens after email check)
          if (!existing) {
            await savePartialLead(formData, step);
          }
        } else if (step > 2 && step <= 12) {
          // Save partial data at each step AFTER email verification (step 2)
          // Don't save at step 1 - wait until we check for existing lead at step 2
          await savePartialLead(formData, step);
        }

        // After ticket médio step, analyze with AI
        if (step === 9) {
          await analyzeLeadWithAI();
        }

        // After years of experience step, check if we should skip affordability question
        if (step === 11) {
          if (!shouldShowAffordabilityQuestion()) {
            // Skip step 12, go directly to final step (13)
            setStep(13);
            return;
          }
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
      // If on final step and affordability was skipped, go back to step 11
      if (step === 13 && !shouldShowAffordabilityQuestion()) {
        setStep(11);
        return;
      }
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
        // Allow proceeding if existing lead has phone (confirmation mode)
        if (existingLead && existingLead.whatsapp) return true;
        return formData.phone.trim().length >= 8;
      case 4:
        return formData.instagram.trim().length >= 1;
      case 5:
        return formData.clinicName.trim().length >= 1;
      case 6:
        // Allow proceeding if existing lead has service area (confirmation mode)
        if (existingLead && existingLead.service_area) return true;
        return formData.beautyArea !== "";
      case 7:
        return formData.revenue !== "";
      case 8:
        return formData.weeklyAppointments.trim().length >= 1;
      case 9:
        return formData.averageTicket.trim().length >= 1 && parseCurrency(formData.averageTicket) > 0;
      case 10:
        return formData.hasPhysicalSpace !== null;
      case 11:
        return formData.yearsOfExperience.trim().length >= 1;
      case 12:
        return formData.canAfford !== null;
      default:
        return true;
    }
  };
  const renderStep = () => {
    switch (step) {
      case 1:
        return <div className="form-card">
            <h1 className="form-title max-w-[380px] md:max-w-none">
              <span className="font-light">A sua assessoria de marketing no <span className="font-bold">Mundo Beauty.</span></span>
              
            </h1>
            <p className="form-subtitle mt-4 mb-4">Você está prestes a tomar a melhor decisão para o seu negócio. Somos especialistas em escalar negócios de beleza através do Tráfego Pago.</p>
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
              <input type="email" value={formData.email} onChange={e => updateFormData("email", e.target.value)} placeholder="seu@email.com" className="form-input" autoFocus disabled={isCheckingLead} />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center" disabled={isCheckingLead}>
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1" disabled={isCheckingLead}>
                  {isCheckingLead ? "Verificando..." : "Continuar"}
                  {!isCheckingLead && <ArrowRight className="w-5 h-5" />}
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 3:
        // If existing lead found, show confirmation mode
        if (existingLead && existingLead.whatsapp) {
          const maskedPhone = maskPhoneNumber(existingLead.whatsapp, existingLead.country_code);
          return <div className="form-card">
              <h1 className="form-title">
                <span className="font-light">Confirme seu </span>
                <span className="font-bold">WhatsApp</span>
              </h1>
              <p className="form-subtitle">Este é o seu número?</p>
              <div className="space-y-4">
                <div className="form-input flex items-center justify-center text-lg font-medium">
                  {maskedPhone}
                </div>
                <div className="space-y-3">
                  <button type="button" onClick={handleNext} className="option-card">
                    <span className="option-card-text">Sim, este é meu número</span>
                  </button>
                  <button type="button" onClick={() => {
                  setExistingLead(null);
                  updateFormData("phone", "");
                }} className="option-card">
                    <span className="option-card-text">Não, quero informar outro</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                  </button>
                </div>
              </div>
            </div>;
        }
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
              <span className="font-light">Nome da sua </span>
              <span className="font-bold">Clínica/Studio</span>
            </h1>
            <p className="form-subtitle">Caso possua</p>
            <div className="space-y-4">
              <input type="text" value={formData.clinicName} onChange={e => updateFormData("clinicName", e.target.value)} placeholder="Ex: Studio Beleza" className="form-input" autoFocus />
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
        // If existing lead found, show confirmation mode
        if (existingLead && existingLead.service_area) {
          return <div className="form-card">
              <h1 className="form-title">
                <span className="font-light">Confirme sua </span>
                <span className="font-bold">área de atuação</span>
              </h1>
              <p className="form-subtitle">Esta é sua área?</p>
              <div className="space-y-4">
                <div className="form-input flex items-center justify-center text-lg font-medium">
                  {existingLead.service_area}
                </div>
                <div className="space-y-3">
                  <button type="button" onClick={handleNext} className="option-card">
                    <span className="option-card-text">Sim, esta é minha área</span>
                  </button>
                  <button type="button" onClick={() => {
                  setExistingLead(prev => prev ? {
                    ...prev,
                    service_area: ""
                  } : null);
                  updateFormData("beautyArea", "");
                }} className="option-card">
                    <span className="option-card-text">Não, quero alterar</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                  </button>
                </div>
              </div>
            </div>;
        }
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
      case 7:
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
      case 8:
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
      case 9:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Qual o </span>
              <span className="font-bold">ticket médio?</span>
            </h1>
            <p className="form-subtitle">Valor médio do seu procedimento</p>
            <div className="space-y-4">
              <input type="text" value={formData.averageTicket} onChange={e => {
              const formatted = handleCurrencyInput(e.target.value);
              updateFormData("averageTicket", formatted);
            }} placeholder="R$ 0,00" className="form-input" autoFocus disabled={isAnalyzing} />
              <div className="flex gap-3">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center" disabled={isAnalyzing}>
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <ShimmerButton onClick={handleNext} className="flex-1" disabled={isAnalyzing}>
                  {isAnalyzing ? "Analisando..." : "Continuar"}
                  {!isAnalyzing && <ArrowRight className="w-5 h-5" />}
                </ShimmerButton>
              </div>
            </div>
          </div>;
      case 10:
        return <div className="form-card">
            <h1 className="form-title">
              <span className="font-light">Você possui </span>
              <span className="font-bold">espaço físico?</span>
            </h1>
            <p className="form-subtitle">Ou atende em domicílio/casa</p>
            <div className="space-y-3">
              <button type="button" onClick={async () => {
              updateFormData("hasPhysicalSpace", true);
              // Save with the value we just set
              await savePartialLead({
                ...formData,
                hasPhysicalSpace: true
              }, step);
              setStep(step + 1);
            }} className={`option-card ${formData.hasPhysicalSpace === true ? "selected" : ""}`}>
                <span className="option-card-text">Sim, possuo espaço físico</span>
              </button>
              <button type="button" onClick={async () => {
              updateFormData("hasPhysicalSpace", false);
              // Save with the value we just set
              await savePartialLead({
                ...formData,
                hasPhysicalSpace: false
              }, step);
              setStep(step + 1);
            }} className={`option-card ${formData.hasPhysicalSpace === false ? "selected" : ""}`}>
                <span className="option-card-text">Não, atendo em casa/domicílio</span>
              </button>
              <div className="flex gap-3 mt-4">
                <button onClick={prevStep} className="h-14 px-4 rounded-xl border border-border bg-card flex items-center justify-center">
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
              </div>
            </div>
          </div>;
      case 11:
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
      case 12:
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
                <button type="button" onClick={() => {
                updateFormData("wantsMoreInfo", true);
                nextStep();
              }} className="option-card">
                  <span className="option-card-text">Sim, quero saber mais</span>
                </button>
                <button type="button" onClick={() => {
                updateFormData("wantsMoreInfo", false);
                nextStep();
              }} className="option-card">
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
              Hoje, nosso serviço mais acessível custa <span className="font-bold text-foreground">R$ 1.800,00 por mês</span>. Você está disposta a investir esse valor no crescimento do seu negócio?
            </p>
            <div className="space-y-3">
              <button type="button" onClick={() => {
              updateFormData("canAfford", "yes");
              nextStep();
            }} className={`option-card ${formData.canAfford === "yes" ? "selected" : ""}`}>
                <span className="option-card-text">Sim, consigo investir</span>
              </button>
              <button type="button" onClick={() => {
              updateFormData("canAfford", "no");
            }} className={`option-card ${formData.canAfford === "no" ? "selected" : ""}`}>
                <span className="option-card-text">Não no momento</span>
              </button>
            </div>
          </div>;
      case 13:
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
                const leadData = {
                  name: formData.name,
                  email: formData.email,
                  whatsapp: formData.phone,
                  country_code: formData.country.dialCode,
                  instagram: formData.instagram,
                  clinic_name: formData.clinicName || null,
                  service_area: formData.beautyArea,
                  monthly_billing: formData.revenue,
                  weekly_attendance: formData.weeklyAppointments,
                  workspace_type: formData.hasPhysicalSpace === null ? "" : formData.hasPhysicalSpace ? "physical" : "home",
                  years_experience: formData.yearsOfExperience || "",
                  average_ticket: parseCurrency(formData.averageTicket),
                  can_afford: formData.canAfford,
                  wants_more_info: formData.wantsMoreInfo,
                  estimated_revenue: aiAnalysis?.estimatedRevenue || null,
                  pipeline_id: basePipeline?.id || null,
                  utm_source: utmParams.utm_source,
                  utm_medium: utmParams.utm_medium,
                  utm_campaign: utmParams.utm_campaign,
                  utm_term: utmParams.utm_term,
                  utm_content: utmParams.utm_content
                };
                let error;

                // If existing lead or partial lead, update instead of insert
                const leadIdToUpdate = existingLead?.id || partialLeadId;
                if (leadIdToUpdate) {
                  const result = await supabase.from("leads").update(leadData).eq("id", leadIdToUpdate);
                  error = result.error;
                } else {
                  const result = await supabase.from("leads").insert(leadData);
                  error = result.error;
                }
                if (error) {
                  console.error("Error saving lead:", error);
                  toast.error("Erro ao salvar dados. Tente novamente.");
                  setIsLoading(false);
                  return;
                }

                // Send welcome email
                try {
                  const leadId = leadIdToUpdate || partialLeadId;
                  await fetch('https://ytdfwkchsumgdvcroaqg.supabase.co/functions/v1/send-email', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      leadId: leadId,
                      leadName: formData.name,
                      leadEmail: formData.email
                    })
                  });
                  console.log("Welcome email triggered");
                } catch (emailError) {
                  console.error("Error sending welcome email:", emailError);
                  // Don't block the flow if email fails
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
                <p className="copyright">© Copyright 2025 Scale Beauty - Desenvolvido por Scale Beauty</p>
              </>}
          </div>;
      default:
        return null;
    }
  };
  return <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: showSplash ? 0 : 1
    }} transition={{
      duration: 0.3
    }} className="min-h-screen bg-background flex flex-col relative">
      
      {/* Navbar - only on step 1, desktop only */}
      {step === 1 && <div className="hidden md:block"><HamburgerMenu /></div>}
      
      {/* Progress bar - steps 2-11 */}
      {step > 1 && step < 12 && <ProgressBar currentStep={step - 1} totalSteps={totalSteps - 2} />}
      
      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col min-h-screen relative">
        {/* Banner image on top with rounded bottom */}
        <div className="w-full flex-shrink-0">
          <img src={scaleBeautyBanner} alt="Scale Beauty" className="w-full h-[260px] object-cover object-top rounded-b-3xl" loading="eager" decoding="async" />
        </div>
        {/* Form overlapping the image */}
        <div className="flex-1 flex flex-col justify-start px-4 -mt-6 relative z-10">
          <FormContainer>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{
                opacity: 0,
                x: 15
              }} animate={{
                opacity: 1,
                x: 0
              }} exit={{
                opacity: 0,
                x: -15
              }} transition={{
                duration: 0.2,
                ease: "easeOut"
              }}>
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </FormContainer>
          
          {/* Sections only on step 1 */}
          {step === 1 && <>
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
              
              {/* Animated Circle Section - Mobile */}
              <AnimatedCircleSection />
              
              {/* Quem Somos Section - Mobile */}
              <QuemSomosSection />
              
              {/* Mobile footer with terms */}
              <div className="pb-4 pt-2 bg-background">
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
                  <p className="copyright mt-4">© Copyright 2025 Scale Beauty - Desenvolvido por Scale Beauty</p>
                </div>
              </div>
            </>}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-col min-h-screen relative">
        {/* Banner image on top with rounded bottom */}
        <div className="w-full flex-shrink-0">
          <img src={scaleBeautyBanner} alt="Scale Beauty" className="w-full h-auto object-contain rounded-b-[80px]" loading="eager" decoding="async" />
        </div>
        
        {/* Form overlapping the image */}
        <div className="flex-1 flex items-start justify-center px-8 -mt-12 relative z-10">
          <FormContainer>
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{
                opacity: 0,
                x: 15
              }} animate={{
                opacity: 1,
                x: 0
              }} exit={{
                opacity: 0,
                x: -15
              }} transition={{
                duration: 0.2,
                ease: "easeOut"
              }}>
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </FormContainer>
        </div>

        {/* Sections only on step 1 */}
        {step === 1 && <>
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
            
            {/* Animated Circle Section */}
            <AnimatedCircleSection />

            {/* Quem Somos Section - Desktop */}
            <QuemSomosSection />

            {/* Desktop footer with terms */}
            <div className="pb-6 pt-4 bg-background">
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
                <p className="copyright mt-4">© Copyright 2025 Scale Beauty - Desenvolvido por Scale Beauty</p>
              </div>
            </div>
          </>}
      </div>
      </motion.div>
    </>;
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
  title: 'Automações',
  icon: Zap,
  description: 'Automatize processos e ganhe tempo para focar no que realmente importa.'
}, {
  title: 'E em breve… Coprodução',
  icon: Handshake,
  description: 'Selecionaremos nossos melhores clientes para ter uma sociedade de coprodução dos seus cursos online. Em breve.'
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
  return <section id="servicos" className="py-16 md:py-20">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 md:px-8">
        <AnimatedContainer className="mx-auto max-w-4xl text-center px-2">
          <h2 className="text-2xl font-bold tracking-tight text-balance md:text-3xl lg:text-4xl xl:font-extrabold mx-0">
            ​Como a Scale pode te ajudar?                    
          </h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">
            Conheça nossos principais serviços⭣
          </p>
        </AnimatedContainer>

        <AnimatedContainer delay={0.4} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {features.map((feature, i) => <div key={i} className="border border-dashed min-h-[140px] md:min-h-[160px]">
              <FeatureCard feature={feature} className="h-full" />
            </div>)}
        </AnimatedContainer>
      </div>
    </section>;
}
function AnimatedCircleSection() {
  return <section className="pt-4 pb-16 md:py-8 overflow-visible">
      <div className="mx-auto w-full max-w-6xl px-6 md:px-8">
        {/* Title - Mobile only (above circle) */}
        <h2 className="lg:hidden text-xl md:text-2xl font-bold tracking-tighter text-foreground mb-4 text-center mx-auto max-w-sm" style={{
        letterSpacing: '-0.04em'
      }}>
          Montamos o marketing do seu negócio conforme a necessidade dele
        </h2>
        
        <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12">
          {/* Circle */}
          <div className="relative w-[65vw] h-[65vw] md:w-[450px] md:h-[450px] lg:w-[420px] lg:h-[420px] xl:w-[480px] xl:h-[480px] flex-shrink-0 my-8 md:my-0">
            {/* Passo 01 - Top */}
            <div className="absolute top-[5%] md:top-[8%] left-[50%] md:left-[42%] -translate-x-1/2 -translate-y-full text-center">
              <span className="text-[9px] md:text-xs text-muted-foreground">Passo 01</span>
              <p className="text-[10px] md:text-sm font-bold text-foreground">Analisa</p>
            </div>
            
            {/* Passo 02 - Upper right */}
            <div className="absolute top-[25%] md:top-[28%] left-[88%] md:left-[85%] text-left pl-2">
              <span className="text-[9px] md:text-xs text-muted-foreground">Passo 02</span>
              <p className="text-[10px] md:text-sm font-bold text-foreground">Segmenta</p>
            </div>
            
            {/* Passo 03 - Lower right */}
            <div className="absolute top-[73%] md:top-[72%] left-[82%] md:left-[80%] text-left pl-2">
              <span className="text-[9px] md:text-xs text-muted-foreground">Passo 03</span>
              <p className="text-[10px] md:text-sm font-bold text-foreground">Anuncia</p>
            </div>
            
            {/* Passo 04 - Bottom */}
            <div className="absolute top-[92%] md:top-[88%] left-[35%] md:left-[35%] -translate-x-1/2 text-center">
              <span className="text-[9px] md:text-xs text-muted-foreground">Passo 04</span>
              <p className="text-[10px] md:text-sm font-bold text-foreground">Converte</p>
            </div>
            
            {/* Passo 05 - Left */}
            <div className="absolute top-[45%] md:top-[44%] right-[88%] md:right-[90%] text-right pr-2 whitespace-nowrap">
              <span className="text-[9px] md:text-xs text-muted-foreground">Passo 05</span>
              <p className="text-[10px] md:text-sm font-bold text-foreground">Escala</p>
            </div>
            
            <AnimatedCircle className="w-full h-full" />
          </div>

          {/* Content */}
          <div className="flex-1 text-center lg:text-left">
            {/* Title - Desktop only */}
            <h2 className="hidden lg:block text-lg lg:text-3xl font-bold tracking-tighter text-foreground mb-8 lg:text-left max-w-xs lg:max-w-sm" style={{
            letterSpacing: '-0.04em'
          }}>
              Montamos o marketing do seu negócio conforme a necessidade dele
            </h2>
            
            <div className="space-y-3 text-left">
              {/* CRIATIVOS */}
              <div className="group relative p-4 lg:p-3 rounded-xl bg-gradient-to-br from-background to-muted/50 border border-border/30 hover:border-primary/30 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg border-2 border-[#F40000] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#F40000] font-bold text-xs">01</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground text-base lg:text-sm tracking-tight flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-[#F40000]" />
                      Criativos
                    </h3>
                    <p className="text-sm lg:text-xs text-muted-foreground mt-1 leading-relaxed">
                      Anúncios criados por copywriters e designers com foco em conversão
                    </p>
                  </div>
                </div>
              </div>

              {/* TRÁFEGO */}
              <div className="group relative p-4 lg:p-3 rounded-xl bg-gradient-to-br from-background to-muted/50 border border-border/30 hover:border-primary/30 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg border-2 border-[#F40000] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#F40000] font-bold text-xs">02</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground text-base lg:text-sm tracking-tight flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-[#F40000]" />
                      Tráfego
                    </h3>
                    <p className="text-sm lg:text-xs text-muted-foreground mt-1 leading-relaxed">
                      Campanhas estratégicas para atrair clientes qualificados para o seu negócio
                    </p>
                  </div>
                </div>
              </div>

              {/* PÁGINAS DE VENDA */}
              <div className="group relative p-4 lg:p-3 rounded-xl bg-gradient-to-br from-background to-muted/50 border border-border/30 hover:border-primary/30 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 lg:w-8 lg:h-8 rounded-lg border-2 border-[#F40000] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#F40000] font-bold text-xs">03</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground text-base lg:text-sm tracking-tight flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-[#F40000]" />
                      Páginas de Venda
                    </h3>
                    <p className="text-sm lg:text-xs text-muted-foreground mt-1 leading-relaxed">
                      Landing pages com as melhores práticas do mercado digital
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>;
}
function QuemSomosSection() {
  return <section id="quem-somos" className="w-[calc(100%+2rem)] -mx-4 md:mx-0 md:w-full relative">
      {/* Curved top transition */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] md:w-[50%] h-8 md:h-12 bg-background rounded-b-[50px] z-10" />
      
      {/* Red background with padding for the curve */}
      <div className="bg-gradient-to-r from-[#F40000] to-[#A10000] pt-8 md:pt-12 pb-16 md:pb-24">
        <div className="mx-auto w-full max-w-6xl px-6 md:px-8 pt-8 md:pt-12">
          <AnimatedContainer className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Image */}
            <div className="w-full md:w-1/2 flex-shrink-0">
              <img src={quemSomosImage} alt="Quem Somos - Scale Beauty" className="w-full h-auto rounded-2xl" loading="lazy" decoding="async" />
            </div>
            
            {/* Text Content */}
            <div className="w-full md:w-1/2 text-white text-left">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Quem somos
              </h2>
              <p className="text-base md:text-lg leading-relaxed opacity-95">
                Somos mais que uma assessoria de marketing, somos um ecossistema completo para a área da beleza.
              </p>
              <p className="text-base md:text-lg leading-relaxed opacity-95 mt-3">
                Não acreditamos em fórmulas prontas! A nossa experiência com a área da beleza nos mostra que cada clínica e cada profissional em seu modelo criativo é único e por isso nossas estratégias também serão únicas e personalizadas.
              </p>
              <blockquote className="text-base md:text-lg leading-relaxed opacity-95 mt-4 italic border-l-2 border-white/40 pl-4">
                "Nosso propósito é evoluir cada vez mais o mercado da beleza, quando uma cresce, outras crescem junto. E fazer cada uma de nossas clientes estar em constante escala de crescimento é, e sempre será nossa prioridade"
              </blockquote>
              <p className="text-sm md:text-base opacity-80 mt-2">
                — Frase de nossa CEO, Biteti.
              </p>
              
              {/* CEO Attribution Cards */}
              <div className="mt-8 flex flex-wrap justify-start gap-2 md:gap-3">
                <div className="inline-flex items-center gap-2 md:gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 md:px-4 py-2 md:py-3 border border-[#FFFFFF15]">
                  <div className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-white/40 flex items-center justify-center flex-shrink-0">
                    <Building className="w-3 h-3 md:w-4 md:h-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-semibold text-[10px] md:text-xs tracking-wide">EMILLY BITETI</span>
                    <span className="text-white/70 text-[8px] md:text-[10px] tracking-wider">CEO DA BITETI BEAUTY</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 md:gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 md:px-4 py-2 md:py-3 border border-[#FFFFFF15]">
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