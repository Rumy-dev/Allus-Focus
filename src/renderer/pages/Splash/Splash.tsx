import { useEffect, useState } from 'react';
import { getAudioContext, isCueEnabled, playCue, unlockAudioContext } from '../../components/soundUtils';
import './Splash.css';

// Duração total da sequência (ver Splash.css para o roteiro de cada fase).
// Mantido em JS também para o main process poder agendar o fechamento da
// janela sem depender de um evento IPC vindo do renderer (mais robusto:
// nenhuma promessa que pode nunca resolver deixa a splash presa).
export const SPLASH_DURATION_MS = 8900;

export function Splash() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.allus
      .invoke('state:get', undefined)
      .then((state) => {
        if (!cancelled) setSoundEnabled(state.soundEnabled && state.soundSplash);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reducedMotion || !soundEnabled) return;

    let cancelled = false;
    void (async () => {
      const unlock = () => {
        void unlockAudioContext(null).catch(() => undefined);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });

      const state = await window.allus.invoke('state:get', undefined);
      if (cancelled || !isCueEnabled(state, 'splash')) return;
      const context = await getAudioContext(null);
      if (!context || cancelled) return;
      await playCue(context, 'splash');
    })();

    return () => {
      cancelled = true;
    };
  }, [reducedMotion, soundEnabled]);

  return (
    <div className={`splash ${reducedMotion ? 'splash--reduced' : ''}`}>
      <svg
        className="splash__logo"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
      >
        <defs>
          <linearGradient id="focusGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b8ac00" />
            <stop offset="52%" stopColor="#ecdc01" />
            <stop offset="100%" stopColor="#f5ec6b" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#focusGradient)" strokeWidth={38} strokeLinecap="round" strokeLinejoin="round">
          <path
            className="splash__arc-outer"
            pathLength={100}
            d="M 323.948 130.687 A 155 155 0 1 1 188.052 130.687"
          />
          <path
            className="splash__arc-inner"
            pathLength={100}
            d="M 305.328 199.553 A 86 86 0 1 1 206.672 199.553"
          />
        </g>
        <circle className="splash__dot" cx="256" cy="270" r="27" fill="url(#focusGradient)" />
      </svg>
      <div className="splash__wordmark">
        <span className="splash__wordmark-allus">Allus</span>{' '}
        <span className="splash__wordmark-focus">Focus</span>
      </div>
    </div>
  );
}
