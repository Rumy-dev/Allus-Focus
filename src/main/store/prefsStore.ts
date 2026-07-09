import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// Só o que faz sentido guardar por máquina (não por conta) — a última
// seleção de "destino" nesse dispositivo. Som/modo padrão/minimizável e
// notificações moraram aqui antes, mas agora vivem em profiles.preferences
// (Supabase), pra seguir a pessoa entre dispositivos — ver authManager.ts.
export interface Prefs {
  selectedProjectId: string | null;
}

const DEFAULT_PREFS: Prefs = {
  selectedProjectId: null,
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
