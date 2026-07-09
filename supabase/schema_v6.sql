-- Allus Clock — incremento v6
-- Otimização de Supabase Free Tier: sessão única por usuário, índices, RPC atômica.
-- Rode no SQL Editor do Supabase (uma vez), depois do schema_v5.sql.

-- 1. Coluna synced_at para o Pulse calcular tempo ao vivo entre polls
alter table public.sessions
  add column synced_at timestamptz null;

-- Preenche synced_at com started_at para sessões existentes (aproximação razoável)
update public.sessions set synced_at = started_at where synced_at is null;

-- 2. Limpeza: garante no máximo uma sessão ativo/pausado por usuário
--    Interrompe as mais antigas, mantendo apenas a mais recente por usuário.
update public.sessions s
set status = 'Interrompido', ended_at = now()
where s.status in ('Ativo', 'Pausado')
  and s.id <> (
    select id from public.sessions s2
    where s2.user_id = s.user_id and s2.status in ('Ativo', 'Pausado')
    order by s2.started_at desc
    limit 1
  );

-- 3. Índices para suportar os padrões reais de query
-- Serve: pulseBuilder.queryPulse filtrando por status sem user_id
create index sessions_active_status on public.sessions (status)
  where status in ('Ativo', 'Pausado');

-- Serve: a constraint de unicidade (uma sessão ativa/pausada por usuário)
create unique index sessions_one_active_per_user on public.sessions (user_id)
  where status in ('Ativo', 'Pausado');

-- Serve: pulseBuilder queries de hoje/ontem/mês/semana filtrando só por data, sem user_id
create index task_logs_started_at on public.task_logs (started_at);

-- 4. RPC atômica para iniciar foco (evita corrida de 2 dispositivos/abas)
create or replace function public.start_focus_session(
  p_user_id uuid,
  p_mode text,
  p_cycle_kind text,
  p_planned_seconds integer,
  p_task text
)
returns json
language plpgsql
as $$
declare
  v_old_session_id uuid;
  v_new_session record;
begin
  -- Encontra a sessão ativa/pausada mais recente deste usuário (se houver)
  select id into v_old_session_id
  from public.sessions
  where user_id = p_user_id and status in ('Ativo', 'Pausado')
  order by started_at desc
  limit 1;

  -- Interrompe a antiga (se houver)
  if v_old_session_id is not null then
    update public.sessions
    set status = 'Interrompido', ended_at = now()
    where id = v_old_session_id;
  end if;

  -- Insere a nova sessão
  insert into public.sessions (
    user_id, mode, cycle_kind, planned_seconds, status, task, started_at, synced_at
  )
  values (
    p_user_id, p_mode, p_cycle_kind, p_planned_seconds, 'Ativo', p_task, now(), now()
  )
  returning * into v_new_session;

  -- Retorna como JSON para compatibilidade com client
  return json_build_object(
    'id', v_new_session.id,
    'user_id', v_new_session.user_id,
    'task', v_new_session.task,
    'mode', v_new_session.mode,
    'cycle_kind', v_new_session.cycle_kind,
    'planned_seconds', v_new_session.planned_seconds,
    'elapsed_seconds', v_new_session.elapsed_seconds,
    'status', v_new_session.status,
    'started_at', v_new_session.started_at,
    'ended_at', v_new_session.ended_at,
    'active_task_log_id', v_new_session.active_task_log_id,
    'synced_at', v_new_session.synced_at
  );
end;
$$;

-- Grantz de segurança: usuário autenticado pode chamar a função (RLS é enforçada pelo campo user_id)
grant execute on function public.start_focus_session(uuid, text, text, integer, text) to authenticated;
