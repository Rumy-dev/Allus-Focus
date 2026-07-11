-- Allus Clock — incremento v8
-- Rode no SQL Editor do Supabase (uma vez), depois do schema_v7.sql.
-- Dá mais estrutura ao Task Center: status e prioridade nas tarefas, e
-- arquivamento (soft-delete) de clientes/projetos/tarefas em vez de exclusão
-- definitiva — preserva o histórico de relatórios/sessões que referenciam
-- itens antigos.

alter table public.tasks
  add column status text not null default 'Pendente'
    check (status in ('Pendente', 'Em andamento', 'Bloqueado', 'Concluído'));

alter table public.tasks
  add column priority text not null default 'Média'
    check (priority in ('Alta', 'Média', 'Baixa'));

alter table public.tasks add column archived_at timestamptz null;
alter table public.projects add column archived_at timestamptz null;
alter table public.clients add column archived_at timestamptz null;

-- Nenhuma mudança de RLS necessária — arquivar é só um UPDATE, já coberto
-- pelas policies "CRUD liberado pro time" existentes em clients/projects/tasks.
