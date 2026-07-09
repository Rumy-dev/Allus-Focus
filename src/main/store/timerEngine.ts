import { supabase } from '../supabase/client';
import { appStore } from './appStore';
import { authManager } from '../auth/authManager';
import { notify } from '../notifications';
import { savePrefs } from './prefsStore';
import * as taskStore from './taskStore';
import { AVULSO_PROJECT_ID } from './taskStore';
import { POMO_MODES, displayPath } from '../../shared/types';
import type { PomoMode, PomoSession, PomoTaskLog } from '../../shared/types';

const FLUSH_INTERVAL_TICKS = 15;

let tickHandle: ReturnType<typeof setInterval> | null = null;
let ticksSinceFlush = 0;
let pendingCarryOverTitle: { taskId: string | null; subtaskId: string | null; title: string } | null = null;

function currentUserId(): string {
  const state = authManager.getState();
  if (state.status !== 'signedIn') throw new Error('Usuário não autenticado.');
  return state.profile.id;
}

function currentDisplayLabel(session: PomoSession, logs: PomoTaskLog[]): string {
  if (session.cycleKind === 'Foco') {
    const active = logs.find((l) => l.id === session.activeTaskLogId);
    if (active) return active.taskTitle;
  }
  return session.cycleKind === 'Foco' ? 'Bloco de foco' : `Pausa - ${POMO_MODES[session.mode].title}`;
}

function startTicker(): void {
  stopTicker();
  ticksSinceFlush = 0;
  tickHandle = setInterval(tick, 1000);
}

function stopTicker(): void {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

async function persistSession(session: PomoSession, opts: { immediate?: boolean } = {}): Promise<void> {
  ticksSinceFlush += 1;
  if (!opts.immediate && ticksSinceFlush < FLUSH_INTERVAL_TICKS) return;
  ticksSinceFlush = 0;
  await supabase
    .from('sessions')
    .update({
      elapsed_seconds: session.elapsedSeconds,
      status: session.status,
      ended_at: session.endedAt,
      active_task_log_id: session.activeTaskLogId,
    })
    .eq('id', session.id);
}

async function persistActiveLog(log: PomoTaskLog, opts: { immediate?: boolean } = {}): Promise<void> {
  if (!opts.immediate && ticksSinceFlush !== 0) return; // acompanha o mesmo ritmo da sessão
  await supabase
    .from('task_logs')
    .update({
      elapsed_seconds: log.elapsedSeconds,
      is_done: log.isDone,
      completed_at: log.completedAt,
    })
    .eq('id', log.id);
}

async function insertSession(partial: {
  mode: PomoMode;
  cycleKind: PomoSession['cycleKind'];
  plannedSeconds: number;
  status: PomoSession['status'];
  task: string;
}): Promise<PomoSession> {
  const userId = currentUserId();
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      task: partial.task,
      mode: partial.mode,
      cycle_kind: partial.cycleKind,
      planned_seconds: partial.plannedSeconds,
      elapsed_seconds: 0,
      status: partial.status,
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Falha ao criar sessão.');
  return mapSession(data);
}

async function insertTaskLog(sessionId: string, args: {
  taskId: string | null;
  projectId: string | null;
  clientId: string | null;
  title: string;
}): Promise<PomoTaskLog> {
  const userId = currentUserId();
  const { data, error } = await supabase
    .from('task_logs')
    .insert({
      session_id: sessionId,
      task_id: args.taskId,
      project_id: args.projectId,
      client_id: args.clientId,
      user_id: userId,
      task_title: args.title,
      elapsed_seconds: 0,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Falha ao criar log de tarefa.');
  return mapTaskLog(data);
}

export async function startFocus(taskTitle: string, mode?: PomoMode): Promise<void> {
  const current = appStore.getSnapshot();
  const useMode = mode ?? current.selectedMode;

  if (current.activeSession && current.activeSession.status !== 'Concluído' && current.activeSession.status !== 'Interrompido') {
    await supabase.from('sessions').update({ status: 'Interrompido', ended_at: new Date().toISOString() }).eq('id', current.activeSession.id);
  }

  const session = await insertSession({
    mode: useMode,
    cycleKind: 'Foco',
    plannedSeconds: POMO_MODES[useMode].focusSeconds,
    status: 'Ativo',
    task: taskTitle,
  });

  savePrefs({ selectedMode: useMode });
  appStore.patch({ selectedMode: useMode, activeSession: session, activeTaskLogs: [] });
  startTicker();
  notify('Bloco iniciado', `${POMO_MODES[useMode].title}: timer mestre em andamento.`);

  if (pendingCarryOverTitle) {
    const carry = pendingCarryOverTitle;
    pendingCarryOverTitle = null;
    await focusTask(carry.taskId, carry.subtaskId, carry.title);
  }
}

export async function playPause(): Promise<void> {
  const { activeSession } = appStore.getSnapshot();
  if (!activeSession || activeSession.status === 'Concluído' || activeSession.status === 'Interrompido') {
    await startFocus('Bloco de foco');
    return;
  }
  if (activeSession.status === 'Ativo') await pause();
  else await resume();
}

export async function pause(): Promise<void> {
  const { activeSession } = appStore.getSnapshot();
  if (!activeSession) return;
  const next = { ...activeSession, status: 'Pausado' as const };
  appStore.patch({ activeSession: next });
  stopTicker();
  await persistSession(next, { immediate: true });
}

export async function resume(): Promise<void> {
  const { activeSession } = appStore.getSnapshot();
  if (!activeSession) return;
  const next = { ...activeSession, status: 'Ativo' as const };
  appStore.patch({ activeSession: next, selectedMode: next.mode });
  startTicker();
  await persistSession(next, { immediate: true });
}

export async function stop(): Promise<void> {
  const { activeSession } = appStore.getSnapshot();
  if (!activeSession) return;
  pendingCarryOverTitle = null;
  const next = { ...activeSession, status: 'Interrompido' as const, endedAt: new Date().toISOString(), activeTaskLogId: null };
  appStore.patch({ activeSession: next });
  stopTicker();
  await persistSession(next, { immediate: true });
}

async function tick(): Promise<void> {
  const state = appStore.getSnapshot();
  const session = state.activeSession;
  if (!session || session.status !== 'Ativo') return;

  const elapsedSeconds = session.elapsedSeconds + 1;
  let logs = state.activeTaskLogs;
  let displaySession = { ...session, elapsedSeconds };

  if (session.cycleKind === 'Foco' && session.activeTaskLogId) {
    logs = logs.map((l) =>
      l.id === session.activeTaskLogId ? { ...l, elapsedSeconds: l.elapsedSeconds + 1 } : l,
    );
  }

  appStore.patch({ activeSession: displaySession, activeTaskLogs: logs });

  const activeLog = logs.find((l) => l.id === session.activeTaskLogId);
  await persistSession(displaySession);
  if (activeLog) await persistActiveLog(activeLog);

  if (elapsedSeconds >= session.plannedSeconds) {
    await completeSession();
  }
}

export async function completeSession(): Promise<void> {
  const state = appStore.getSnapshot();
  const session = state.activeSession;
  if (!session) return;
  stopTicker();

  if (session.cycleKind === 'Foco') {
    const active = state.activeTaskLogs.find((l) => l.id === session.activeTaskLogId) ?? state.activeTaskLogs[state.activeTaskLogs.length - 1];
    if (active) {
      pendingCarryOverTitle = { taskId: active.taskId, subtaskId: null, title: active.taskTitle };
    }
  }

  const endedSession = { ...session, status: 'Concluído' as const, endedAt: new Date().toISOString(), activeTaskLogId: null };
  appStore.patch({ activeSession: endedSession, activeTaskLogs: [] });
  await persistSession(endedSession, { immediate: true });

  if (session.cycleKind === 'Foco') {
    notify('Foco concluido', `Hora da pausa de ${Math.round(POMO_MODES[session.mode].breakSeconds / 60)}m.`);
    const breakSession = await insertSession({
      mode: session.mode,
      cycleKind: 'Pausa',
      plannedSeconds: POMO_MODES[session.mode].breakSeconds,
      status: 'Ativo',
      task: `Pausa - ${POMO_MODES[session.mode].title}`,
    });
    appStore.patch({ activeSession: breakSession, activeTaskLogs: [] });
    startTicker();
  } else {
    notify('Pausa concluída', 'Novo bloco de foco aguardando. Pressione play para iniciar.');
    const nextFocus = await insertSession({
      mode: session.mode,
      cycleKind: 'Foco',
      plannedSeconds: POMO_MODES[session.mode].focusSeconds,
      status: 'Pausado',
      task: 'Bloco de foco',
    });
    appStore.patch({ activeSession: nextFocus, activeTaskLogs: [] });
    if (pendingCarryOverTitle) {
      const carry = pendingCarryOverTitle;
      pendingCarryOverTitle = null;
      await focusTask(carry.taskId, carry.subtaskId, carry.title);
    }
  }
}

export async function skipToBreak(): Promise<void> {
  const state = appStore.getSnapshot();
  const session = state.activeSession;
  if (!session || session.cycleKind !== 'Foco') return;
  stopTicker();
  const active = state.activeTaskLogs.find((l) => l.id === session.activeTaskLogId) ?? state.activeTaskLogs[state.activeTaskLogs.length - 1];
  if (active) pendingCarryOverTitle = { taskId: active.taskId, subtaskId: null, title: active.taskTitle };

  const interrupted = { ...session, status: 'Interrompido' as const, endedAt: new Date().toISOString(), activeTaskLogId: null };
  await persistSession(interrupted, { immediate: true });

  const breakSession = await insertSession({
    mode: session.mode,
    cycleKind: 'Pausa',
    plannedSeconds: POMO_MODES[session.mode].breakSeconds,
    status: 'Ativo',
    task: `Pausa - ${POMO_MODES[session.mode].title}`,
  });
  appStore.patch({ activeSession: breakSession, activeTaskLogs: [] });
  startTicker();
}

export async function skipToFocus(): Promise<void> {
  const state = appStore.getSnapshot();
  const session = state.activeSession;
  if (!session || session.cycleKind !== 'Pausa') return;
  stopTicker();
  const interrupted = { ...session, status: 'Interrompido' as const, endedAt: new Date().toISOString() };
  await persistSession(interrupted, { immediate: true });

  await startFocus('Bloco de foco', session.mode);
}

export async function restart(sessionId: string): Promise<void> {
  const { data } = await supabase.from('sessions').select('mode').eq('id', sessionId).single();
  const mode = (data?.mode as PomoMode) ?? appStore.getSnapshot().selectedMode;
  await startFocus('Bloco de foco', mode);
}

export async function deleteTaskLog(taskLogId: string): Promise<void> {
  const state = appStore.getSnapshot();
  appStore.patch({ activeTaskLogs: state.activeTaskLogs.filter((l) => l.id !== taskLogId) });
  if (state.activeSession?.activeTaskLogId === taskLogId) {
    appStore.patch({ activeSession: { ...appStore.getSnapshot().activeSession!, activeTaskLogId: null } });
  }
  const { error } = await supabase.from('task_logs').delete().eq('id', taskLogId);
  if (error) throw new Error(error.message);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { activeSession } = appStore.getSnapshot();
  if (activeSession?.id === sessionId) {
    // Evita ficar com um "fantasma" no painel flutuante/principal — para o
    // ticker e limpa o estado ativo antes de apagar (seção 14, item 5).
    stopTicker();
    appStore.patch({ activeSession: null, activeTaskLogs: [] });
  }
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
  if (error) throw new Error(error.message);
}

export async function setMode(mode: PomoMode): Promise<void> {
  savePrefs({ selectedMode: mode });
  appStore.patch({ selectedMode: mode });
}

// Garante que existe um bloco de foco (cria pausado se necessário), depois
// reutiliza ou cria o PomoTaskLog para (taskId, título) — seção 6 do handoff.
export async function focusTask(taskId: string | null, _subtaskId: string | null, title: string): Promise<void> {
  let state = appStore.getSnapshot();
  if (!state.activeSession || state.activeSession.status === 'Concluído' || state.activeSession.status === 'Interrompido') {
    const nextFocus = await insertSession({
      mode: state.selectedMode,
      cycleKind: 'Foco',
      plannedSeconds: POMO_MODES[state.selectedMode].focusSeconds,
      status: 'Pausado',
      task: 'Bloco de foco',
    });
    appStore.patch({ activeSession: nextFocus, activeTaskLogs: [] });
    state = appStore.getSnapshot();
  }

  const session = state.activeSession!;
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;
  const project = task ? state.projects.find((p) => p.id === task.projectId) : null;

  const existing = state.activeTaskLogs.find((l) => l.taskId === taskId && l.taskTitle === title);
  let log: PomoTaskLog;
  if (existing) {
    log = existing;
  } else {
    log = await insertTaskLog(session.id, {
      taskId,
      projectId: project?.id ?? null,
      clientId: project?.clientId ?? null,
      title,
    });
    appStore.patch({ activeTaskLogs: [...appStore.getSnapshot().activeTaskLogs, log] });
  }

  const nextSession = { ...appStore.getSnapshot().activeSession!, activeTaskLogId: log.id };
  appStore.patch({
    activeSession: nextSession,
    recentTasks: dedupeRecent([log, ...appStore.getSnapshot().recentTasks]),
  });
  await persistSession(nextSession, { immediate: true });
}

export async function quickAdd(title: string, avulsa: boolean): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  const state = appStore.getSnapshot();
  const currentLog = state.activeSession
    ? state.activeTaskLogs.find((l) => l.id === state.activeSession!.activeTaskLogId)
    : null;

  if (avulsa || state.projects.length === 0) {
    const task = await taskStore.addTaskNode(AVULSO_PROJECT_ID, null, trimmed);
    await focusTask(task.id, null, task.title);
    return;
  }

  if (currentLog?.taskId) {
    const task = await taskStore.addTaskNode(currentLog.projectId ?? AVULSO_PROJECT_ID, currentLog.taskId, trimmed);
    await focusTask(task.id, null, displayPath([currentLog.taskTitle, task.title]));
    return;
  }

  const targetProjectId = state.selectedProjectId ?? state.projects[0]?.id ?? AVULSO_PROJECT_ID;
  const task = await taskStore.addTaskNode(targetProjectId, null, trimmed);
  await focusTask(task.id, null, task.title);
}

function dedupeRecent(logs: PomoTaskLog[]): PomoTaskLog[] {
  const seen = new Set<string>();
  const out: PomoTaskLog[] = [];
  for (const log of logs) {
    if (seen.has(log.taskTitle)) continue;
    seen.add(log.taskTitle);
    out.push(log);
    if (out.length >= 3) break;
  }
  return out;
}

export function mapSession(row: any): PomoSession {
  return {
    id: row.id,
    userId: row.user_id,
    task: row.task,
    mode: row.mode,
    cycleKind: row.cycle_kind,
    plannedSeconds: row.planned_seconds,
    elapsedSeconds: row.elapsed_seconds,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    activeTaskLogId: row.active_task_log_id,
  };
}

export function mapTaskLog(row: any): PomoTaskLog {
  return {
    id: row.id,
    sessionId: row.session_id,
    taskId: row.task_id,
    projectId: row.project_id,
    clientId: row.client_id,
    userId: row.user_id,
    taskTitle: row.task_title,
    elapsedSeconds: row.elapsed_seconds,
    isDone: row.is_done,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export { currentDisplayLabel };
