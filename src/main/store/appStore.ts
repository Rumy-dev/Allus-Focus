import type { AppSnapshot } from '../../shared/ipc-contract';
import { loadPrefs } from './prefsStore';

type Listener = (snapshot: AppSnapshot) => void;

const prefs = loadPrefs();

let state: AppSnapshot = {
  auth: { status: 'signedOut', profile: null },
  online: true,
  selectedMode: prefs.selectedMode,
  selectedProjectId: prefs.selectedProjectId,
  activeSession: null,
  activeTaskLogs: [],
  recentSessions: [],
  clients: [],
  projects: [],
  tasks: [],
  soundEnabled: prefs.soundEnabled,
  floatingMinimizable: prefs.floatingMinimizable,
  recentTasks: [],
};

const listeners = new Set<Listener>();

export const appStore = {
  getSnapshot(): AppSnapshot {
    return state;
  },
  patch(partial: Partial<AppSnapshot>): void {
    state = { ...state, ...partial };
    for (const listener of listeners) listener(state);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
