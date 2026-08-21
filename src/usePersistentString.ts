import { useEffect, useState } from "react";

export function usePersistentString(key: string, fallback: string) {
  const [val, setVal] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ?? fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, val);
    } catch {}
  }, [key, val]);

  return [val, setVal] as const;
}
