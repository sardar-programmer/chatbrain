import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
  duration?: number;
  undoAction?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { ...item, id };
      setToasts(prev => [...prev, newToast]);

      const duration = item.duration ?? 4000;
      setTimeout(() => {
        dismissToast(id);
      }, duration);

      return id;
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {/* Top-center fixed container: never covers the bottom composer */}
      <div
        aria-live="polite"
        className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2 pointer-events-none w-full max-w-sm px-4"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-white/70 dark:border-white/10 bg-surface/85 dark:bg-surface/85 backdrop-blur-2xl px-4 py-2.5 text-xs sm:text-sm text-text-primary shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-200 animate-in fade-in slide-in-from-top-2"
          >
            <span className="leading-snug">{t.message}</span>
            {t.undoAction && (
              <button
                type="button"
                onClick={() => {
                  t.undoAction?.onClick();
                  dismissToast(t.id);
                }}
                className="shrink-0 font-medium text-accent hover:text-accent-hover underline underline-offset-2 transition-colors ml-2"
              >
                {t.undoAction.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
