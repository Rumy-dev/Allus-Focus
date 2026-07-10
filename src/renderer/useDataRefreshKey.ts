import type { AppSnapshot } from '../shared/ipc-contract';

// Gera uma chave estável para recarregar consultas quando os dados mudam
// de verdade, sem reagir a ticks do timer que atualizam elapsedSeconds
// a cada segundo.
export function useDataRefreshKey(snapshot: AppSnapshot | null): string {
  if (!snapshot) return 'no-snapshot';

  const authId = snapshot.auth.profile?.id ?? 'signed-out';
  const sessionId = snapshot.activeSession?.id ?? 'none';
  const sessionStatus = snapshot.activeSession?.status ?? 'none';

  return [
    authId,
    sessionId,
    sessionStatus,
    snapshot.clients.length,
    snapshot.projects.length,
    snapshot.tasks.length,
    snapshot.profiles.length,
    snapshot.recentSessions.length,
    snapshot.recentTasks.length,
    snapshot.selectedProjectId ?? 'none',
  ].join('|');
}
