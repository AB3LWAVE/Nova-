import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useNovaStore } from '../stores/useNovaStore';

export const ConfirmDialog: React.FC = () => {
  const confirmModal = useNovaStore((s) => s.confirmModal);
  const closeConfirm = useNovaStore((s) => s.closeConfirm);

  if (!confirmModal || !confirmModal.open) return null;

  const handleConfirm = async () => {
    const fn = confirmModal.onConfirm;
    closeConfirm();
    await fn();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700/80 bg-[#0D1322] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                confirmModal.destructive
                  ? 'bg-rose-500/15 text-rose-400'
                  : 'bg-indigo-500/15 text-indigo-400'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-100">
              {confirmModal.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeConfirm}
            aria-label="Close confirmation dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {confirmModal.description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeConfirm}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              confirmModal.destructive
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {confirmModal.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
