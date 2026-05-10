import { useState, useCallback, useRef } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'success', duration = 3200) => {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      setToasts(prev => {
        // Max 3 toasts visible at once — drop oldest
        const trimmed = prev.length >= 3 ? prev.slice(1) : prev;
        return [...trimmed, { id, message, type }];
      });
      timers.current[id] = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        delete timers.current[id];
      }, duration);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}
