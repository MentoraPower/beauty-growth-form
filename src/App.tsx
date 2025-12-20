import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import Auth from "./pages/Auth";
import WhatsApp from "./pages/WhatsApp";
import OriginOverview from "./pages/OriginOverview";
import AdminShell from "./pages/AdminShell";
import Settings from "./pages/Settings";
import OnboardingForm from "./pages/OnboardingForm";
import CalendarPage from "./pages/CalendarPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/termos" element={<TermsOfUse />} />
          <Route path="/privacidade" element={<PrivacyPolicy />} />
          <Route path="/form/:slug" element={<OnboardingForm />} />
          <Route path="/auth" element={<Auth />} />

          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<Dashboard />} />
            <Route path="crm" element={<CRM />} />
            <Route path="crm/overview" element={<OriginOverview />} />
            <Route path="crm/:id" element={<LeadDetail />} />
            <Route path="whatsapp" element={<WhatsApp />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="agenda" element={<CalendarPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
