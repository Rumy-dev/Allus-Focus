import { createClient } from 'npm:@supabase/supabase-js@2';

type InviteBody = {
  fullName?: string;
  email?: string;
};

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ ok: false, error: 'Variáveis de ambiente do Supabase ausentes.' }, { status: 500 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return json({ ok: false, error: 'Acesso negado: apenas admins podem convidar membros.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as InviteBody;
  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!fullName || !email) {
    return json({ ok: false, error: 'Nome e e-mail são obrigatórios.' }, { status: 400 });
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
    },
  });

  if (inviteError) {
    return json({ ok: false, error: inviteError.message }, { status: 400 });
  }

  return json({
    ok: true,
    userId: inviteData.user?.id ?? null,
    email,
    fullName,
  });
});
