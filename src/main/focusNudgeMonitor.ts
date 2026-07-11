import { authManager } from './auth/authManager';
import { notify } from './notifications';
import { supabase } from './supabase/client';
import { queryPulse } from './store/pulseBuilder';

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const CUTOFF_HOUR = 11;

let handle: ReturnType<typeof setInterval> | null = null;
let lastPersonalNudgeKey: string | null = null;
let lastAdminAlertKey: string | null = null;

export function startFocusNudgeMonitor(): void {
  if (handle) return;
  handle = setInterval(() => {
    void checkFocusNudges();
  }, POLL_INTERVAL_MS);
  void checkFocusNudges();
}

export function stopFocusNudgeMonitor(): void {
  if (handle) clearInterval(handle);
  handle = null;
  lastPersonalNudgeKey = null;
  lastAdminAlertKey = null;
}

async function checkFocusNudges(): Promise<void> {
  const auth = authManager.getState();
  if (auth.status !== 'signedIn') return;

  const now = new Date();
  if (now.getHours() < CUTOFF_HOUR) return;

  const dayKey = localDateKey(now);
  await maybeNotifyPersonalNudge(auth.profile.id, dayKey);

  if (auth.profile.role === 'admin') {
    await maybeNotifyAdminAlert(dayKey);
  }
}

async function maybeNotifyPersonalNudge(userId: string, dayKey: string): Promise<void> {
  const key = `${userId}:${dayKey}`;
  if (lastPersonalNudgeKey === key) return;

  const { data, error } = await supabase
    .from('task_logs')
    .select('id')
    .eq('user_id', userId)
    .gte('started_at', startOfLocalDayIso())
    .lte('started_at', endOfLocalDayIso())
    .limit(1);

  if (error) {
    console.error('[focusNudgeMonitor] falha ao checar foco pessoal', error);
    return;
  }
  if ((data ?? []).length > 0) return;

  lastPersonalNudgeKey = key;
  notify('Hora de iniciar o foco', 'Voce ainda nao registrou nenhum foco hoje.');
}

async function maybeNotifyAdminAlert(dayKey: string): Promise<void> {
  if (lastAdminAlertKey === dayKey) return;

  try {
    const pulse = await queryPulse();
    const noFocusIds = pulse.insights.noFocusMemberIds;
    if (noFocusIds.length === 0) return;

    const names = pulse.teamMembers
      .filter((member) => noFocusIds.includes(member.userId))
      .map((member) => member.fullName);
    const preview = names.slice(0, 4).join(', ');
    const suffix = names.length > 4 ? ` e mais ${names.length - 4}` : '';

    lastAdminAlertKey = dayKey;
    notify(
      'Time sem foco registrado',
      `${names.length} pessoa${names.length === 1 ? '' : 's'} ainda sem foco hoje: ${preview}${suffix}.`,
    );
  } catch (err) {
    console.error('[focusNudgeMonitor] falha ao checar alerta do Pulse', err);
  }
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function endOfLocalDayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
}
