import React, { useState } from 'react';
import { Modal } from './Modal';

/**
 * Replaces window.confirm. `onConfirm` may be async; the dialog shows a busy state
 * and closes itself when the promise resolves (stays open on failure so the caller can toast).
 */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  children
}) => {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      /* caller surfaces the error */
    } finally {
      setBusy(false);
    }
  };

  const toneClass = tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-900 hover:bg-slate-800';

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        {message && <p className="text-sm text-slate-600 leading-relaxed">{message}</p>}
        {children}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={handle} data-autofocus className={`px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-colors ${toneClass}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
