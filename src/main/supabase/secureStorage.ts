import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// Armazena a sessão do Supabase (access/refresh token) criptografada via
// keychain do SO (Electron safeStorage), para o usuário não precisar
// logar toda vez que abrir o app.

function filePath(): string {
  return path.join(app.getPath('userData'), 'auth-session.enc');
}

function readAll(): Record<string, string> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return {};
    const raw = fs.readFileSync(filePath());
    const decrypted = safeStorage.decryptString(raw);
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, string>): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encrypted = safeStorage.encryptString(JSON.stringify(data));
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), encrypted);
}

// Implementa a interface de storage assíncrono esperada pelo supabase-js
// (getItem/setItem/removeItem), já que o processo main não tem localStorage.
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return readAll()[key] ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
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
