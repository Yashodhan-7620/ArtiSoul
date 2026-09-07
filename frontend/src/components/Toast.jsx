import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, tone = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-none absolute inset-x-4 bottom-24 z-40 animate-fade-up"
        >
          <div
            className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-medium
                        text-cream-100 shadow-lift
                        ${toast.tone === 'error' ? 'bg-clay-700' : 'bg-ink-800'}`}
          >
            <Icon
              name={toast.tone === 'error' ? 'alert' : 'check'}
              className="h-4 w-4 shrink-0"
              strokeWidth={2.2}
            />
            <span className="min-w-0">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
