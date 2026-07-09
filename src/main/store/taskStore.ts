import { supabase } from '../supabase/client';
import { appStore } from './appStore';
import type { Client, Project, Task, TeamMember } from '../../shared/types';
import { AVULSO_PROJECT_NAME } from '../../shared/types';
import { authManager } from '../auth/authManager';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const AVULSO_PROJECT_ID = '00000000-0000-0000-0000-000000000002';

let realtimeChannel: RealtimeChannel | null = null;

function currentUserId(): string {
  const state = authManager.getState();
  if (state.status !== 'signedIn') throw new Error('Usuário não autenticado.');
  return state.profile.id;
}

export async function hydrateTaxonomy(): Promise<void> {
  const [clientsRes, projectsRes, tasksRes, profilesRes] = await Promise.all([
    supabase.from('clients').select('id, name, created_by, created_at').order('name'),
    supabase.from('projects').select('id, client_id, name, type, budget_hours, created_by, created_at').order('name'),
    supabase.from('tasks').select('id, project_id, parent_task_id, title, is_done, created_by, created_at').order('created_at'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ]);

  appStore.patch({
    clients: (clientsRes.data ?? []).map(mapClient),
    projects: (projectsRes.data ?? []).map(mapProject),
    tasks: (tasksRes.data ?? []).map(mapTask),
    profiles: (profilesRes.data ?? []).map(mapTeamMember),
  });
}

export function subscribeRealtime(): void {
  if (realtimeChannel) return; // já inscrito — evita erro "cannot add callbacks after subscribe()"
  realtimeChannel = supabase
    .channel('taxonomy-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => hydrateTaxonomy())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => hydrateTaxonomy())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => hydrateTaxonomy())
    .subscribe((status) => {
      appStore.patch({ online: status === 'SUBSCRIBED' });
    });
}

export async function unsubscribeRealtime(): Promise<void> {
  if (!realtimeChannel) return;
  await supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
}

export async function addProject(clientName: string, projectName: string, type = ''): Promise<void> {
  const userId = currentUserId();
  const trimmedClient = clientName.trim() || AVULSO_PROJECT_NAME;

  let clientId = appStore.getSnapshot().clients.find(
    (c) => c.name.toLowerCase() === trimmedClient.toLowerCase(),
  )?.id;

  if (!clientId) {
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: trimmedClient, created_by: userId })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Falha ao criar cliente.');
    clientId = data.id;
  }

  const { error } = await supabase
    .from('projects')
    .insert({ client_id: clientId, name: projectName.trim() || 'Sem nome', type: type.trim(), created_by: userId });
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

export async function updateProject(projectId: string, clientName: string, projectName: string, type = ''): Promise<void> {
  const userId = currentUserId();
  const trimmedClient = clientName.trim() || AVULSO_PROJECT_NAME;
  let clientId = appStore.getSnapshot().clients.find(
    (c) => c.name.toLowerCase() === trimmedClient.toLowerCase(),
  )?.id;
  if (!clientId) {
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: trimmedClient, created_by: userId })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Falha ao criar cliente.');
    clientId = data.id;
  }
  const { error } = await supabase
    .from('projects')
    .update({ client_id: clientId, name: projectName.trim() || 'Sem nome', type: type.trim() })
    .eq('id', projectId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
  const remaining = appStore.getSnapshot().projects.filter((p) => p.id !== projectId);
  if (appStore.getSnapshot().selectedProjectId === projectId) {
    appStore.patch({ selectedProjectId: remaining[0]?.id ?? null });
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  const snapshot = appStore.getSnapshot();
  const clientProjects = snapshot.projects.filter((p) => p.clientId === clientId);

  // Deleta todos os projetos do cliente primeiro (por causa das dependências)
  for (const project of clientProjects) {
    await deleteProject(project.id);
  }

  // Agora deleta o cliente
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

export async function addTaskNode(projectId: string, parentTaskId: string | null, title: string): Promise<Task> {
  const userId = currentUserId();
  const { data, error } = await supabase
    .from('tasks')
    .insert({ project_id: projectId, parent_task_id: parentTaskId, title: title.trim(), created_by: userId })
    .select('id, project_id, parent_task_id, title, is_done, created_by, created_at')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Falha ao criar tarefa.');
  await hydrateTaxonomy();
  return mapTask(data);
}

export async function renameTaskNode(taskId: string, title: string): Promise<void> {
  const { error } = await supabase.from('tasks').update({ title: title.trim() }).eq('id', taskId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

export async function toggleTaskNodeDone(taskId: string): Promise<void> {
  const task = appStore.getSnapshot().tasks.find((t) => t.id === taskId);
  if (!task) return;
  const { error } = await supabase.from('tasks').update({ is_done: !task.isDone }).eq('id', taskId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

export async function setTaskNodeDone(taskId: string, isDone: boolean): Promise<void> {
  const { error } = await supabase.from('tasks').update({ is_done: isDone }).eq('id', taskId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

export async function deleteTaskNode(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

export async function moveTaskNode(taskId: string, targetProjectId: string): Promise<void> {
  // Preserva o ID original ao mover (correção em relação ao app original —
  // ver seção 14, item 1 do handoff).
  const { error } = await supabase
    .from('tasks')
    .update({ project_id: targetProjectId })
    .eq('id', taskId);
  if (error) throw new Error(error.message);
  await hydrateTaxonomy();
}

function mapClient(row: any): Client {
  return { id: row.id, name: row.name, createdBy: row.created_by, createdAt: row.created_at };
}

function mapTeamMember(row: any): TeamMember {
  return { id: row.id, fullName: row.full_name };
}

function mapProject(row: any): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    type: row.type ?? '',
    budgetHours: row.budget_hours ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapTask(row: any): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentTaskId: row.parent_task_id,
    title: row.title,
    isDone: row.is_done,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
