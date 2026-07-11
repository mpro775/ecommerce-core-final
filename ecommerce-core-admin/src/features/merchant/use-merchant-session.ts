import { useEffect, useState } from 'react';
import { readStoredSession, writeStoredSession } from './session-storage';
import type { MerchantSession } from './types';

export function useMerchantSession() {
  const [session, setSession] = useState<MerchantSession | null>(() => readStoredSession());

  useEffect(() => {
    writeStoredSession(session);
  }, [session]);

  return [session, setSession] as const;
}
