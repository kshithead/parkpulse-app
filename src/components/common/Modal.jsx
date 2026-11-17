import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

let openModals = 0;

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg', footer }) => {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    openModals += 1;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);

    // Move focus into the dialog (prefer the first form field).
    const t = setTimeout(() => {
      const target = dialogRef.current?.querySelector('[data-autofocus], input, select, textarea') || dialogRef.current;
      target?.focus?.();
    }, 30);

    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      openModals -= 1;
      if (openModals <= 0) document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 print:hidden">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm backdrop-enter" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 modal-enter focus:outline-none flex flex-col max-h-[92vh]`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} aria-label="Close dialog" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};
