-- Allus Clock — incremento v5
-- Rode no SQL Editor do Supabase (uma vez), depois do schema_v4.sql.
-- Adiciona sistema de roles (admin vs member), orçamento de projetos,
-- e políticas de RLS para que admins vejam sessões de qualquer pessoa.

alter table public.profiles
  add column role text not null default 'member' check (role in ('member', 'admin'));

alter table public.projects
  add column budget_hours numeric null;

-- Permite que admins leiam as sessões de qualquer pessoa (além da própria).
create policy "sessions_select_admin" on public.sessions
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- NOTA: Depois de rodar este script, execute manualmente no Supabase:
-- update public.profiles set role = 'admin' where id = '<seu-user-id>';
-- (Substitua com o ID de um perfil já criado que deve ser admin)
