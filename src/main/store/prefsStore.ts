import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { PomoMode } from '../../shared/types';
import { DEFAULT_MODE } from '../../shared/types';

export interface Prefs {
  selectedMode: PomoMode;
  selectedProjectId: string | null;
  soundEnabled: boolean;
  floatingMinimizable: boolean;
}

const DEFAULT_PREFS: Prefs = {
  selectedMode: DEFAULT_MODE,
  selectedProjectId: null,
  soundEnabled: true,
  floatingMinimizable: false,
};

function filePath(): string {
  return path.join(app.getPath('userData'), 'prefs.json');
}

let cache: Prefs | null = null;

export function loadPrefs(): Prefs {
  if (cache) return cache;
  let loaded: Prefs;
  try {
    const raw = fs.readFileSync(filePath(), 'utf-8');
    loaded = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    loaded = { ...DEFAULT_PREFS };
  }
  cache = loaded;
  return loaded;
}

export function savePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...loadPrefs(), ...patch };
  cache = next;
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(next, null, 2));
  return next;
}
