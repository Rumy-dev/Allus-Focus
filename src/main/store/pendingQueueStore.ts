import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface PendingInsert {
  type: 'session' | 'task_log';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

function filePath(): string {
  return path.join(app.getPath('userData'), 'pending-inserts.json');
}

let cache: PendingInsert[] | null = null;

export function loadPendingQueue(): PendingInsert[] {
  if (cache !== null) return cache;
  try {
    const raw = fs.readFileSync(filePath(), 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache = JSON.parse(raw) as any[];
  } catch {
    cache = [];
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return cache!;
}

export function savePendingQueue(queue: PendingInsert[]): void {
  cache = queue;
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  // Atomic-ish write: temp file + rename to avoid corruption on crash mid-write
  const tmp = filePath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(queue, null, 2));
  fs.renameSync(tmp, filePath());
}
