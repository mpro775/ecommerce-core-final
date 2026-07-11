import { useCallback, useState } from 'react';

export type PanelMessageType = 'info' | 'success' | 'error' | 'warning';

export interface PanelMessage {
  text: string;
  type: PanelMessageType;
}

const emptyMessage: PanelMessage = { text: '', type: 'info' };

export function usePanelMessage(initialMessage: PanelMessage = emptyMessage) {
  const [message, setMessage] = useState<PanelMessage>(initialMessage);

  const clearMessage = useCallback(() => setMessage(emptyMessage), []);

  const showMessage = useCallback((text: string, type: PanelMessageType = 'info') => {
    setMessage({ text, type });
  }, []);

  return { message, setMessage, showMessage, clearMessage };
}
