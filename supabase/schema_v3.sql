-- Allus Clock — incremento v3
-- Rode no SQL Editor do Supabase (uma vez), depois do schema_v2.sql.
-- Adiciona preferências por conta (som, modo padrão, notificações etc),
-- sincronizadas entre dispositivos em vez de guardadas só na máquina.

alter table public.profiles
  add column preferences jsonb not null default '{}'::jsonb;
