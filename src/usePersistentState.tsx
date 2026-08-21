import { useEffect, useMemo, useState } from "react";

export function usePersistentState<T>(key: string, initial: T) {
  const storageKey = useMemo(() => key, [key]);

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [storageKey, state]);

  return [state, setState] as const;
}
