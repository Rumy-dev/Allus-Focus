-- Allus Focus — schema Postgres/Supabase
-- Rode este arquivo inteiro uma vez no SQL Editor do painel do Supabase
-- (Project → SQL Editor → New query → colar → Run).

create extension if not exists pgcrypto;

-- ============================================================
-- PROFILES — espelha auth.users, 1 linha por pessoa do time
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- cria automaticamente um profile quando o admin adiciona um usuário em
-- Authentication → Users (ou via signup, se algum dia for aberto)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TAXONOMIA COMPARTILHADA — Cliente → Projeto → Tarefa → Subtarefa
-- ============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index on public.projects (client_id);
create index on public.tasks (project_id);
create index on public.tasks (parent_task_id);

-- Cliente/Projeto sentinela "Avulso", compartilhado pelo time inteiro
-- (equivalente ao projeto "Avulso" do app original, seção 2.8 do handoff)
insert into public.clients (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Avulso');

insert into public.projects (id, client_id, name)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Avulso'
);

-- ============================================================
-- SESSÕES E LOGS DE TEMPO — pessoais, mas legíveis pelo time p/ relatório
-- ============================================================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task text not null default '',
  mode text not null check (mode in ('classic', 'deskTime', 'deepWork')),
  cycle_kind text not null check (cycle_kind in ('Foco', 'Pausa')),
  planned_seconds integer not null,
  elapsed_seconds integer not null default 0,
  status text not null check (status in ('Ativo', 'Pausado', 'Concluído', 'Interrompido')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  active_task_log_id uuid
);

create table public.task_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_title text not null default '',
  elapsed_seconds integer not null default 0,
  is_done boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.sessions
  add constraint sessions_active_task_log_fk
  foreign key (active_task_log_id) references public.task_logs (id) on delete set null;

create index on public.sessions (user_id, started_at desc);
create index on public.task_logs (session_id);
create index on public.task_logs (user_id, started_at desc);
create index on public.task_logs (client_id);
create index on public.task_logs (project_id);
create index on public.task_logs (task_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.sessions enable row level security;
alter table public.task_logs enable row level security;

-- profiles: qualquer autenticado pode ler (mostrar nomes no relatório);
-- só o dono edita o próprio.
create policy "profiles são legíveis por qualquer autenticado"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles só são editáveis pelo dono"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- clients/projects/tasks: taxonomia compartilhada, time único e confiável
-- entre si — qualquer autenticado lê e escreve.
create policy "clients: CRUD liberado pro time"
  on public.clients for all
  to authenticated
  using (true)
  with check (true);

create policy "projects: CRUD liberado pro time"
  on public.projects for all
  to authenticated
  using (true)
  with check (true);

create policy "tasks: CRUD liberado pro time"
  on public.tasks for all
  to authenticated
  using (true)
  with check (true);

-- sessions: bloco de foco é pessoal — só o dono lê e escreve.
create policy "sessions só são visíveis pro dono"
  on public.sessions for select
  to authenticated
  using (user_id = auth.uid());

create policy "sessions só são gravadas pelo dono"
  on public.sessions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "sessions só são atualizadas pelo dono"
  on public.sessions for update
  to authenticated
  using (user_id = auth.uid());

-- task_logs: leitura liberada pro time (alimenta o relatório consolidado),
-- escrita só pelo dono.
create policy "task_logs são legíveis por qualquer autenticado"
  on public.task_logs for select
  to authenticated
  using (true);

create policy "task_logs só são gravados pelo dono"
  on public.task_logs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "task_logs só são atualizados pelo dono"
  on public.task_logs for update
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- REALTIME — mantém a árvore Cliente/Projeto/Tarefa sincronizada ao vivo
-- ============================================================
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.tasks;
