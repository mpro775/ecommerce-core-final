import { useEffect, useState } from 'react';

export function useLocalStorageState(key: string, initialValue: string) {
  const [value, setValue] = useState(() => readLocalStorageValue(key, initialValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      return;
    }
  }, [key, value]);

  return [value, setValue] as const;
}

function readLocalStorageValue(key: string, initialValue: string): string {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ?? initialValue;
  } catch {
    return initialValue;
  }
}
