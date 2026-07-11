import { useEffect, useRef } from 'react';
import { useAppState } from '../useAppState';
import { getAudioContext, isCueEnabled, playCue, unlockAudioContext, type SoundCue } from './soundUtils';

export function SoundBridge() {
  const snapshot = useAppState();
  const snapshotRef = useRef(snapshot);
  const queueRef = useRef<SoundCue[]>([]);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const unsubscribe = window.allus.on('sound:play', (payload) => {
      const cue = payload as SoundCue;
      queueRef.current.push(cue);
      void flushQueue();
    });

    const unlock = () => {
      void unlockAudioContext(contextRef.current).then((context) => {
        if (context) contextRef.current = context;
      });
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      void contextRef.current?.close().catch(() => undefined);
      contextRef.current = null;
    };
  }, []);

  useEffect(() => {
    void flushQueue();
  }, [snapshot?.soundEnabled, snapshot?.soundSplash, snapshot?.soundFocusStart, snapshot?.soundFocusEnd, snapshot?.soundBreakEnd, snapshot?.soundIdlePause]);

  async function flushQueue(): Promise<void> {
    const current = snapshotRef.current;
    if (!current?.soundEnabled) {
      queueRef.current = [];
      return;
    }

    const context = await getAudioContext(contextRef.current);
    if (!context) return;
    contextRef.current = context;

    while (queueRef.current.length > 0) {
      const cue = queueRef.current.shift()!;
      if (!isCueEnabled(current, cue)) continue;
      await playCue(context, cue);
    }
  }

  return null;
}
