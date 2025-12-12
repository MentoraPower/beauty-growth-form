import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Lock } from "lucide-react";
import { z } from "zod";
const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(128, "Senha muito longa")
});
const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/admin");
      }
      setIsCheckingAuth(false);
    };
    checkAuth();

    // Listen for auth changes
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/admin");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    const validation = loginSchema.safeParse({
      email,
      password
    });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setIsLoading(true);
    try {
      const {
        error
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Email não confirmado. Verifique sua caixa de entrada.");
        } else {
          toast.error("Erro ao fazer login. Tente novamente.");
        }
        return;
      }
      toast.success("Login realizado com sucesso!");
      navigate("/admin");
    } catch (err) {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };
  if (isCheckingAuth) {
    return <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Modern Glass Card Container */}
        <div className="relative">
          <div className="relative bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-white tracking-tight">Admin Scale Beauty</h1>
              <p className="text-neutral-400 mt-2 text-sm">Acesse sua conta para continuar</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300 text-sm font-medium">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="seu@email.com" 
                  className="bg-neutral-800/50 border-neutral-700/50 text-white placeholder:text-neutral-500 focus:border-[#F40000]/50 focus:ring-[#F40000]/20 h-12 rounded-xl transition-all duration-200" 
                  disabled={isLoading} 
                  autoComplete="email" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-300 text-sm font-medium">Senha</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="bg-neutral-800/50 border-neutral-700/50 text-white placeholder:text-neutral-500 focus:border-[#F40000]/50 focus:ring-[#F40000]/20 h-12 rounded-xl pr-12 transition-all duration-200" 
                    disabled={isLoading} 
                    autoComplete="current-password" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading} 
                className="w-full bg-gradient-to-r from-[#F40000] to-[#A10000] hover:from-[#D60000] hover:to-[#8A0000] text-white font-medium h-12 rounded-xl shadow-lg shadow-[#F40000]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#F40000]/30 mt-2"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <p className="text-center text-neutral-500 text-xs mt-8">
              © 2025 Scale Beauty - Área Restrita
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Auth;