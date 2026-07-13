import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { supabase } from '../supabase/client';
import type { Profile, UserPreferences } from '../../shared/types';
import { DEFAULT_PREFERENCES } from '../../shared/types';

// Log temporário pra depurar um erro de login só reproduzível no Mac que
// não aparece no stdout do Terminal (o app se destaca do processo pai).
// Remover depois de identificar a causa.
function debugLog(label: string, data: unknown): void {
  try {
    const line = `[${new Date().toISOString()}] ${label} ${JSON.stringify(data)}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'debug-auth.log'), line);
  } catch {
    // ignora falha de log
  }
}

export type AuthState =
  | { status: 'signedOut' }
  | { status: 'signedIn'; profile: Profile };

class AuthManager extends EventEmitter {
  private state: AuthState = { status: 'signedOut' };

  getState(): AuthState {
    return this.state;
  }

  async init(): Promise<AuthState> {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await this.hydrateProfile(data.session.user.id);
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await this.hydrateProfile(session.user.id);
      } else {
        this.setState({ status: 'signedOut' });
      }
    });
    return this.state;
  }

  async signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    debugLog('signIn result', { hasSession: Boolean(data.session), userId: data.session?.user.id, error: error?.message });
    if (error || !data.session) {
      return { ok: false, error: traduzErro(error?.message) };
    }
    const profileError = await this.hydrateProfile(data.session.user.id);
    if (profileError) {
      await supabase.auth.signOut();
      return { ok: false, error: `Login ok, mas falha ao carregar perfil: ${profileError}` };
    }
    return { ok: true };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.setState({ status: 'signedOut' });
  }

  async changePassword(newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: traduzErro(error.message) };
    return { ok: true };
  }

  async requestPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { ok: false, error: traduzErro(error.message) };
    return { ok: true };
  }

  // Troca o código OTP (recebido por e-mail) por uma sessão válida e já
  // define a nova senha — evita depender de deep-link/protocolo customizado,
  // que exigiria tratamento nativo separado no Windows e no macOS.
  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (verifyError) return { ok: false, error: traduzErro(verifyError.message) };
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return { ok: false, error: traduzErro(updateError.message) };
    return { ok: true };
  }

  async updateFullName(fullName: string): Promise<void> {
    if (this.state.status !== 'signedIn') return;
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', this.state.profile.id);
    if (error) throw new Error(error.message);
    this.setState({ status: 'signedIn', profile: { ...this.state.profile, fullName } });
  }

  async updatePreferences(partial: Partial<UserPreferences>): Promise<void> {
    if (this.state.status !== 'signedIn') return;
    const next = { ...this.state.profile.preferences, ...partial };
    const { error } = await supabase.from('profiles').update({ preferences: next }).eq('id', this.state.profile.id);
    if (error) throw new Error(error.message);
    this.setState({ status: 'signedIn', profile: { ...this.state.profile, preferences: next } });
  }

  // Retorna null em caso de sucesso, ou uma mensagem de erro.
  private async hydrateProfile(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, created_at, preferences, role')
      .eq('id', userId)
      .single();
    debugLog('hydrateProfile query', { userId, hasData: Boolean(data), error });
    if (error || !data) {
      this.setState({ status: 'signedOut' });
      return error?.message ?? 'perfil não encontrado.';
    }
    this.setState({
      status: 'signedIn',
      profile: {
        id: data.id,
        fullName: data.full_name,
        createdAt: data.created_at,
        preferences: { ...DEFAULT_PREFERENCES, ...(data.preferences ?? {}) },
        role: data.role ?? 'member',
      },
    });
    return null;
  }

  private setState(next: AuthState): void {
    this.state = next;
    this.emit('change', next);
  }
}

function traduzErro(message?: string): string {
  if (!message) return 'Não foi possível entrar. Tente novamente.';
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado.';
  if (message.includes('Token has expired or is invalid')) return 'Código inválido ou expirado. Solicite um novo.';
  return message;
}

export const authManager = new AuthManager();
