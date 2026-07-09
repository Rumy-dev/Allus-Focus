export interface Toast {
  id: number;
  message: string;
  kind: 'error' | 'success';
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function push(message: string, kind: Toast['kind']): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4500);
}

export const toast = {
  error(message: string): void {
    push(message, 'error');
  },
  success(message: string): void {
    push(message, 'success');
  },
};
