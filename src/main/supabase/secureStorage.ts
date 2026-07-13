import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// Armazena a sessão do Supabase (access/refresh token) criptografada via
// keychain do SO (Electron safeStorage), para o usuário não precisar
// logar toda vez que abrir o app.

function filePath(): string {
  return path.join(app.getPath('userData'), 'auth-session.enc');
}

// Log temporário de depuração — grava em arquivo porque o processo
// empacotado nem sempre mantém stdout ligado ao Terminal. Remover depois de
// identificar a causa do erro de sessão só reproduzível no Mac.
function debugLog(label: string, data: unknown): void {
  try {
    const line = `[${new Date().toISOString()}] [secureStorage] ${label} ${JSON.stringify(data)}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'debug-auth.log'), line);
  } catch {
    // ignora falha de log
  }
}

function readAll(): Record<string, string> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      debugLog('readAll: encryption indisponível', {});
      return {};
    }
    const raw = fs.readFileSync(filePath());
    const decrypted = safeStorage.decryptString(raw);
    return JSON.parse(decrypted);
  } catch (err) {
    debugLog('readAll falhou', { message: err instanceof Error ? err.message : String(err) });
    return {};
  }
}

function writeAll(data: Record<string, string>): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      debugLog('writeAll: encryption indisponível, sessão não persistida', {});
      return;
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(data));
    fs.mkdirSync(path.dirname(filePath()), { recursive: true });
    fs.writeFileSync(filePath(), encrypted);
  } catch (err) {
    // Se o Keychain/DPAPI falhar (ex.: assinatura de código instável no
    // Mac invalidando o ACL do Keychain), não deixamos isso derrubar o
    // fluxo de login — a sessão só não fica salva pra próxima abertura.
    debugLog('writeAll falhou', { message: err instanceof Error ? err.message : String(err) });
  }
}

// Implementa a interface de storage assíncrono esperada pelo supabase-js
// (getItem/setItem/removeItem), já que o processo main não tem localStorage.
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const value = readAll()[key] ?? null;
    debugLog('getItem', { key, found: value !== null });
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    debugLog('setItem', { key, valueLength: value.length });
    const data = readAll();
    data[key] = value;
    writeAll(data);
  },
  async removeItem(key: string): Promise<void> {
    const data = readAll();
    delete data[key];
    writeAll(data);
  },
};
