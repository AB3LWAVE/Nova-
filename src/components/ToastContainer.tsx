import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useNovaStore } from '../stores/useNovaStore';

export const ToastContainer: React.FC = () => {
  const toasts = useNovaStore((s) => s.toasts);
  const dismissToast = useNovaStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-700/80 bg-[#0D1322]/95 backdrop-blur-md p-3.5 shadow-xl"
        >
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-400" />}
            {toast.type === 'warning' && <AlertCircle className="h-4 w-4 text-amber-400" />}
            {toast.type === 'info' && <Info className="h-4 w-4 text-cyan-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-100">{toast.title}</p>
            {toast.detail && (
              <p className="mt-0.5 text-xs text-slate-400 break-words">{toast.detail}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label={`Dismiss ${toast.title}`}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
