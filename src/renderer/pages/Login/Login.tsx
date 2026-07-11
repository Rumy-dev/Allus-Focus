import { useState } from 'react';
import allusFocusIcon from '../../assets/allus-focus-icon.svg';
import allusWatermark from '../../assets/allus-focus-watermark.svg';

type LoginMode = 'signIn' | 'forgotRequest' | 'forgotConfirm';

export function Login() {
  const [mode, setMode] = useState<LoginMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await window.allus.invoke('auth:signIn', { email, password });
    setLoading(false);
    if (!result.ok) setError(result.error);
  }

  function goTo(next: LoginMode) {
    setError(null);
    setInfo(null);
    setMode(next);
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await window.allus.invoke('auth:requestPasswordReset', { email });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInfo(`Código enviado pra ${email}. Confira sua caixa de entrada (e spam).`);
    setMode('forgotConfirm');
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const result = await window.allus.invoke('auth:confirmPasswordReset', { email, code: code.trim(), newPassword });
    setLoading(false);
    if (!result.ok) setError(result.error);
    // Sucesso: a janela troca sozinha pra MainWindow assim que o estado de auth mudar.
  }

  return (
    <div
      className="allus-app-bg allus-titlebar allus-watermark"
      style={
        {
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          '--allus-watermark-image': `url(${allusWatermark})`,
        } as React.CSSProperties
      }
    >
      <form
        onSubmit={mode === 'signIn' ? handleSubmit : mode === 'forgotRequest' ? handleRequestReset : handleConfirmReset}
        className="allus-glass allus-no-drag"
        style={{ width: 300, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <img
            src={allusFocusIcon}
            alt="Allus Focus"
            style={{ width: 48, height: 48, marginBottom: 8 }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              backgroundImage: 'var(--allus-gradient)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              letterSpacing: 1,
            }}
          >
            ALLUS FOCUS
          </div>
          <div style={{ fontSize: 12, color: 'var(--allus-text-secondary)', marginTop: 4 }}>
            {mode === 'signIn' && 'Entre com sua conta do time'}
            {mode === 'forgotRequest' && 'Digite seu e-mail pra receber um código de redefinição'}
            {mode === 'forgotConfirm' && 'Digite o código recebido e a nova senha'}
          </div>
        </div>

        {mode === 'signIn' && (
          <>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => goTo('forgotRequest')}
              style={linkButtonStyle}
            >
              Esqueci minha senha
            </button>
          </>
        )}

        {mode === 'forgotRequest' && (
          <>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <button type="button" onClick={() => goTo('signIn')} style={linkButtonStyle}>
              ← Voltar pro login
            </button>
          </>
        )}

        {mode === 'forgotConfirm' && (
          <>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={inputStyle}
            />
            <button type="button" onClick={() => goTo('forgotRequest')} style={linkButtonStyle}>
              ← Pedir novo código
            </button>
          </>
        )}

        {info && <div style={{ color: 'var(--allus-yellow)', fontSize: 12 }}>{info}</div>}
        {error && <div style={{ color: 'var(--allus-status-interrompido)', fontSize: 12 }}>{error}</div>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading
            ? '...'
            : mode === 'signIn'
              ? 'Entrar'
              : mode === 'forgotRequest'
                ? 'Enviar código'
                : 'Redefinir senha'}
        </button>
      </form>
    </div>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--allus-text-muted)',
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid var(--allus-glass-border)',
  borderRadius: 10,
  padding: '10px 12px',
  color: 'var(--allus-text-primary)',
  outline: 'none',
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 6,
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  backgroundImage: 'var(--allus-gradient)',
  color: '#000001',
  fontWeight: 700,
  fontSize: 14,
};
