import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import Index from "./pages/Index";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import Auth from "./pages/Auth";
import Atendimento from "./pages/Atendimento";
import AdminShell from "./pages/AdminShell";
import Settings from "./pages/Settings";
import OnboardingForm from "./pages/OnboardingForm";
import CalendarPage from "./pages/CalendarPage";
import Analizer from "./pages/Analizer";
import Equipe from "./pages/Equipe";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RealtimeProvider>
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
              <Route index element={<Navigate to="/admin/crm" replace />} />
              <Route path="crm" element={<CRM />} />
              <Route path="crm/:id" element={<LeadDetail />} />
              <Route path="atendimento" element={<Atendimento />} />
              <Route path="whatsapp" element={<Navigate to="/admin/atendimento?tab=whatsapp" replace />} />
              <Route path="instagram" element={<Navigate to="/admin/atendimento?tab=instagram" replace />} />
              <Route path="calendario" element={<CalendarPage />} />
              <Route path="agenda" element={<CalendarPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="equipe" element={<Equipe />} />
              <Route path="analizer" element={<Analizer />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </RealtimeProvider>
  </QueryClientProvider>
);

export default App;
