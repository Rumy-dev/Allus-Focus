import type { IpcInvokeMap } from '../shared/ipc-contract';
import { toast } from './toast';

// Wrapper pra chamadas de mutação disparadas por onClick/onSubmit: captura
// qualquer erro (rejeição de IPC, exceção no main process) e mostra um
// toast em vez de falhar silenciosamente.
export async function invokeAction<K extends keyof IpcInvokeMap>(
  channel: K,
  args: Parameters<IpcInvokeMap[K]>[0],
): Promise<ReturnType<IpcInvokeMap[K]> | undefined> {
  try {
    return await window.allus.invoke(channel, args);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Ocorreu um erro inesperado.');
    return undefined;
  }
}

// Wrapper fino sobre window.confirm — centralizado aqui pra trocar por um
// modal customizado no futuro sem precisar mudar os call sites.
export function confirmDialog(message: string): boolean {
  return window.confirm(message);
}
