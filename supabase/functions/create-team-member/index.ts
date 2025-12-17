import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, password, role } = await req.json();

    console.log("[create-team-member] Creating user:", { name, email, role });

    // Validate input
    if (!name || !email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ["admin", "suporte", "gestor_trafego", "closer", "sdr"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Função inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create user using admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      console.error("[create-team-member] Error creating user:", createError);
      
      if (createError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Este e-mail já está cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userData.user) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-team-member] User created:", userData.user.id);

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userData.user.id,
        name,
        email,
      });

    if (profileError) {
      console.error("[create-team-member] Error creating profile:", profileError);
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userData.user.id,
        role,
      });

    if (roleError) {
      console.error("[create-team-member] Error assigning role:", roleError);
      return new Response(
        JSON.stringify({ error: "Erro ao atribuir função" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create default permissions for non-admin users
    if (role !== "admin") {
      const { error: permError } = await supabaseAdmin
        .from("user_permissions")
        .insert({
          user_id: userData.user.id,
          can_access_whatsapp: false,
          allowed_origin_ids: [],
          allowed_sub_origin_ids: [],
        });

      if (permError) {
        console.error("[create-team-member] Error creating permissions:", permError);
      }
    }

    console.log("[create-team-member] Team member created successfully");

    return new Response(
      JSON.stringify({ success: true, user_id: userData.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[create-team-member] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
