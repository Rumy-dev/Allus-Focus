import { powerMonitor } from 'electron';
import { authManager } from './auth/authManager';
import { appStore } from './store/appStore';
import * as timerEngine from './store/timerEngine';
import * as windowManager from './windows/windowManager';
import { notify } from './notifications';

const POLL_INTERVAL_MS = 30000;

let handle: ReturnType<typeof setInterval> | null = null;
let lastPausedSessionId: string | null = null;

export function startIdleMonitor(): void {
  if (handle) return;
  handle = setInterval(() => {
    void checkIdle();
  }, POLL_INTERVAL_MS);
  void checkIdle();
}

export function stopIdleMonitor(): void {
  if (handle) clearInterval(handle);
  handle = null;
  lastPausedSessionId = null;
}

async function checkIdle(): Promise<void> {
  const auth = authManager.getState();
  if (auth.status !== 'signedIn') return;

  const thresholdMinutes = auth.profile.preferences.idleThresholdMinutes;
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) return;

  const { activeSession } = appStore.getSnapshot();
  if (!activeSession || activeSession.status !== 'Ativo' || activeSession.cycleKind !== 'Foco') {
    lastPausedSessionId = null;
    return;
  }

  const idleSeconds = powerMonitor.getSystemIdleTime();
  const thresholdSeconds = thresholdMinutes * 60;
  if (idleSeconds < thresholdSeconds || activeSession.id === lastPausedSessionId) return;

  lastPausedSessionId = activeSession.id;
  await timerEngine.pause();
  windowManager.playSoundCue('idlePause');
  notify(
    'Foco pausado por inatividade',
    `Pausamos seu foco porque voce ficou ${Math.round(idleSeconds / 60)} min inativo.`,
  );
}
