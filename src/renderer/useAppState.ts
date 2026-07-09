import { useEffect, useState } from 'react';
import type { AppSnapshot } from '../shared/ipc-contract';

export function useAppState(): AppSnapshot | null {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);

  useEffect(() => {
    // Evita depender só do broadcast (que pode ter acontecido antes desta
    // janela terminar de carregar) — busca o snapshot atual ativamente
    // assim que monta, além de continuar ouvindo atualizações futuras.
    let cancelled = false;
    window.allus.invoke('state:get', undefined).then((current) => {
      if (!cancelled) setSnapshot(current);
    });
    const unsubscribe = window.allus.onState(setSnapshot);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return snapshot;
}
