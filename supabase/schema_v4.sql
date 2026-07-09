-- Allus Clock — incremento v4
-- Rode no SQL Editor do Supabase (uma vez), depois do schema_v3.sql.
-- Adiciona "tipo de projeto" (categoria livre, ex: Web, Design,
-- Consultoria), usado pelo Dashboard pra agrupar horas por tipo.

alter table public.projects
  add column type text not null default '';
