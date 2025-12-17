import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "admin" | "suporte" | "gestor_trafego" | "closer" | "sdr";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCaller(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { userId: null, error: "Não autenticado" };

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data.user) return { userId: null, error: "Sessão inválida" };

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    name: (data.user.user_metadata as any)?.name ?? null,
    error: null,
  };
}

async function ensureBootstrapAdmin(supabaseAdmin: any, callerUserId: string, callerEmail: string | null, callerName: string | null) {
  const { data: anyAdmin } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);

  if (anyAdmin && anyAdmin.length > 0) return { bootstrapped: false };

  await supabaseAdmin.from("user_roles").insert({ user_id: callerUserId, role: "admin" });
  await supabaseAdmin.from("profiles").upsert({ id: callerUserId, email: callerEmail, name: callerName });

  return { bootstrapped: true };
}

async function isCallerAdmin(supabaseAdmin: any, callerUserId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", callerUserId)
    .eq("role", "admin")
    .limit(1);
  return !!(data && data.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const caller = await getCaller(req);
    if (!caller.userId) return json(401, { error: caller.error || "Não autenticado" });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await ensureBootstrapAdmin(supabaseAdmin, caller.userId, caller.email ?? null, caller.name ?? null);
    const callerIsAdmin = await isCallerAdmin(supabaseAdmin, caller.userId);
    if (!callerIsAdmin) return json(403, { error: "Apenas administradores podem ver a equipe" });

    const members: Array<{
      user_id: string;
      email: string | null;
      name: string | null;
      role: AppRole | null;
      permissions: {
        can_access_whatsapp: boolean;
        allowed_origin_ids: string[];
        allowed_sub_origin_ids: string[];
      } | null;
    }> = [];

    // List users from auth
    const perPage = 1000;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) return json(500, { error: error.message });

      const users = data?.users ?? [];
      if (users.length === 0) break;

      const ids = users.map((u: any) => u.id);

      const [{ data: profiles }, { data: roles }, { data: perms }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, name, email").in("id", ids),
        supabaseAdmin.from("user_roles").select("user_id, role, created_at").in("user_id", ids),
        supabaseAdmin.from("user_permissions").select("user_id, can_access_whatsapp, allowed_origin_ids, allowed_sub_origin_ids").in("user_id", ids),
      ]);

      const roleByUser = new Map<string, AppRole>();
      (roles ?? [])
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
        .forEach((r: any) => {
          if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);
        });

      const permByUser = new Map<string, any>();
      (perms ?? []).forEach((p: any) => permByUser.set(p.user_id, p));

      const profileByUser = new Map<string, any>();
      (profiles ?? []).forEach((p: any) => profileByUser.set(p.id, p));

      for (const u of users) {
        const profile = profileByUser.get(u.id);
        const role = roleByUser.get(u.id) ?? null;
        const perm = permByUser.get(u.id) ?? null;

        members.push({
          user_id: u.id,
          email: profile?.email ?? u.email ?? null,
          name: profile?.name ?? (u.user_metadata as any)?.name ?? null,
          role,
          permissions: perm
            ? {
                can_access_whatsapp: !!perm.can_access_whatsapp,
                allowed_origin_ids: perm.allowed_origin_ids ?? [],
                allowed_sub_origin_ids: perm.allowed_sub_origin_ids ?? [],
              }
            : null,
        });
      }

      if (users.length < perPage) break;
    }

    // sort by name/email for UI stability
    members.sort((a, b) => {
      const an = (a.name || a.email || "").toLowerCase();
      const bn = (b.name || b.email || "").toLowerCase();
      return an.localeCompare(bn);
    });

    return json(200, { members });
  } catch (error) {
    console.error("[list-team-members] Error:", error);
    return json(500, { error: "Erro interno do servidor" });
  }
});
