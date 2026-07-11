import type { UserPreferences } from '../../shared/types';

export type SoundCue =
  | 'splash'
  | 'focusStart'
  | 'focusEnd'
  | 'breakEnd'
  | 'idlePause'
  | 'buttonPlay'
  | 'buttonPause'
  | 'buttonStop'
  | 'error';

export function isCueEnabled(snapshot: Pick<UserPreferences, 'soundEnabled'> & Partial<Pick<UserPreferences, 'soundSplash' | 'soundFocusStart' | 'soundFocusEnd' | 'soundBreakEnd' | 'soundIdlePause'>>, cue: SoundCue): boolean {
  if (!snapshot.soundEnabled) return false;
  switch (cue) {
    case 'splash':
      return snapshot.soundSplash ?? true;
    case 'focusStart':
      return snapshot.soundFocusStart ?? true;
    case 'focusEnd':
      return snapshot.soundFocusEnd ?? true;
    case 'breakEnd':
      return snapshot.soundBreakEnd ?? true;
    case 'idlePause':
      return snapshot.soundIdlePause ?? true;
    case 'buttonPlay':
    case 'buttonPause':
    case 'buttonStop':
      return true;
    case 'error':
      return true;
  }
}

export async function playCue(context: AudioContext, cue: SoundCue): Promise<void> {
  const now = context.currentTime + 0.03;
  const pattern =
    cue === 'focusStart'
      ? [
          { f: 523.25, t: 0, d: 0.16, v: 0.16 },
          { f: 659.25, t: 0.1, d: 0.16, v: 0.16 },
          { f: 783.99, t: 0.2, d: 0.2, v: 0.18 },
        ]
      : cue === 'focusEnd'
        ? [
            { f: 783.99, t: 0, d: 0.16, v: 0.18 },
            { f: 659.25, t: 0.12, d: 0.18, v: 0.16 },
            { f: 523.25, t: 0.24, d: 0.22, v: 0.14 },
          ]
        : cue === 'breakEnd'
          ? [
              { f: 440, t: 0, d: 0.16, v: 0.14 },
              { f: 554.37, t: 0.12, d: 0.18, v: 0.16 },
              { f: 659.25, t: 0.24, d: 0.2, v: 0.18 },
            ]
          : cue === 'idlePause'
            ? [{ f: 220, t: 0, d: 0.34, v: 0.12 }]
    : cue === 'buttonPlay'
      ? [
          { f: 523.25, t: 0, d: 0.1, v: 0.15 },
          { f: 659.25, t: 0.08, d: 0.12, v: 0.16 },
        ]
      : cue === 'buttonPause'
        ? [{ f: 392, t: 0, d: 0.18, v: 0.14 }]
        : cue === 'buttonStop'
          ? [{ f: 247, t: 0, d: 0.22, v: 0.14 }]
          : cue === 'error'
              ? [
                  { f: 196, t: 0, d: 0.18, v: 0.18 },
                  { f: 164.81, t: 0.14, d: 0.22, v: 0.16 },
                ]
              : [
                  { f: 523.25, t: 0, d: 0.16, v: 0.16 },
                  { f: 659.25, t: 0.12, d: 0.16, v: 0.16 },
                  { f: 783.99, t: 0.24, d: 0.2, v: 0.18 },
                ];

  for (const note of pattern) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = cue === 'idlePause' || cue === 'error' ? 'sine' : 'triangle';
    oscillator.frequency.value = note.f;
    gain.gain.setValueAtTime(0.0001, now + note.t);
    gain.gain.exponentialRampToValueAtTime(note.v, now + note.t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.t + note.d);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + note.t);
    oscillator.stop(now + note.t + note.d + 0.04);
  }

  await new Promise<void>((resolve) => window.setTimeout(resolve, 420));
}

export async function getAudioContext(existing: AudioContext | null): Promise<AudioContext | null> {
  if (existing) return existing;
  const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const context = new Ctor();
  await context.resume().catch(() => undefined);
  return context;
}

export async function unlockAudioContext(existing: AudioContext | null): Promise<AudioContext | null> {
  const context = await getAudioContext(existing);
  if (!context) return null;
  await context.resume().catch(() => undefined);
  return context;
}
