-- Allus Clock — incremento v2
-- Rode no SQL Editor do Supabase (uma vez), depois do schema.sql original.
-- Adiciona políticas de DELETE que faltavam para sessions/task_logs, usadas
-- pelos botões "Excluir" do histórico e das tarefas do bloco.

create policy "sessions só são apagadas pelo dono"
  on public.sessions for delete
  to authenticated
  using (user_id = auth.uid());

create policy "task_logs só são apagados pelo dono"
  on public.task_logs for delete
  to authenticated
  using (user_id = auth.uid());
