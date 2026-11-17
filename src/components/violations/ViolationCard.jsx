import React, { useState } from 'react';
import { AlertTriangle, Clock, MapPin, Eye, ChevronDown, ImageOff } from 'lucide-react';
import { Badge } from '../common/Badge';
import { PlateBadge } from './PlateBadge';
import { Modal } from '../common/Modal';
import { Spinner } from '../common/Feedback';
import { useToast } from '../../context/ToastContext';
import { formatDateTime, statusLabel, timeAgo } from '../../utils/format';

const URGENCY = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  critical: 'bg-rose-100 text-rose-700'
};

// What an officer can do from each state, with a sensible default note.
const ACTIONS = {
  investigating: { label: 'Verify on site', tone: 'blue', note: 'Patrol unit dispatched for on-site verification.', required: false },
  warning_issued: { label: 'Issue notice', tone: 'rose', note: 'Verified. Official violation notice issued to the vehicle owner.', required: false },
  resolved: { label: 'Mark resolved', tone: 'emerald', note: 'Violation cleared and bay recovered.', required: false },
  dismissed: { label: 'Dismiss', tone: 'slate', note: '', required: true }
};
const NEXT = { pending: ['investigating', 'warning_issued', 'resolved', 'dismissed'], investigating: ['warning_issued', 'resolved', 'dismissed'], warning_issued: ['resolved', 'dismissed'], resolved: [], dismissed: [] };
const TONE = {
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
  rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200',
  emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
  slate: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-transparent'
};

export const ViolationCard = ({ violation: v, onStatusUpdate, isAdmin = false }) => {
  const toast = useToast();
  const [imageOpen, setImageOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const begin = (status) => {
    setAction(status);
    setNote(ACTIONS[status].note);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (ACTIONS[action].required && !note.trim()) {
      toast.error('Please record a reason for this decision.');
      return;
    }
    setBusy(true);
    try {
      await onStatusUpdate(v.id, action, note.trim());
      toast.success(`${v.id} marked "${statusLabel(action)}".`);
      setAction(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const next = isAdmin && onStatusUpdate ? NEXT[v.status] : [];

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-mono text-xs font-bold text-slate-500">{v.id}</span>
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {v.category}
              </span>
            </div>
            <Badge variant={v.status} size="xs">{statusLabel(v.status)}</Badge>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <PlateBadge plateNumber={v.vehicleNumber} size="md" />
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{v.zone}</span>
              {v.location && <span className="font-mono font-semibold text-slate-700">· {v.location}</span>}
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">{v.description}</p>

          {v.imageUrl ? (
            <button type="button" className="relative group rounded-xl overflow-hidden border border-slate-200 h-36 bg-slate-100 w-full" onClick={() => setImageOpen(true)} aria-label="View photo evidence">
              <img src={v.imageUrl} alt="Violation evidence" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              <span className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold">
                <Eye className="w-4 h-4" /> View photo evidence
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2 border border-dashed border-slate-200">
              <ImageOff className="w-3.5 h-3.5" /> No photo attached
            </div>
          )}

          {v.adminNotes && (
            <div className="text-[11px] bg-slate-100 p-2.5 rounded-lg text-slate-600 border border-slate-200/80">
              <span className="font-bold text-slate-800">Officer note:</span> {v.adminNotes}
            </div>
          )}

          {v.history?.length > 1 && (
            <div>
              <button type="button" onClick={() => setHistoryOpen((o) => !o)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1" aria-expanded={historyOpen}>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                Case timeline ({v.history.length})
              </button>
              {historyOpen && (
                <ol className="mt-3 ml-1.5 border-l-2 border-slate-200 space-y-3">
                  {v.history.map((h, i) => (
                    <li key={i} className="pl-4 relative">
                      <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-white border-2 border-emerald-500" />
                      <p className="text-[11px] font-bold text-slate-700">{statusLabel(h.status)}</p>
                      <p className="text-[11px] text-slate-500">{h.note}</p>
                      <p className="text-[10px] text-slate-400">{h.by} · {formatDateTime(h.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 gap-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatDateTime(v.timestamp)} · {timeAgo(v.timestamp)}
            </span>
            <span className={`px-1.5 py-0.5 rounded font-semibold uppercase text-[10px] ${URGENCY[v.urgency]}`}>{v.urgency}</span>
          </div>
          {isAdmin && <p className="text-[11px] text-slate-400 truncate">Reported by {v.reporterName}</p>}

          {next.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {next.map((s) => (
                <button key={s} onClick={() => begin(s)} className={`${s === 'dismissed' ? 'px-2.5' : 'flex-1'} py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors ${TONE[ACTIONS[s].tone]}`}>
                  {ACTIONS[s].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={imageOpen} onClose={() => setImageOpen(false)} title={`Evidence · ${v.id}`} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
            <img src={v.imageUrl} alt="Violation evidence" className="w-full max-h-[60vh] object-contain mx-auto" />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 gap-3 flex-wrap">
            <span><strong className="text-slate-800">Vehicle:</strong> <span className="font-mono">{v.vehicleNumber}</span></span>
            <span><strong className="text-slate-800">Location:</strong> {v.zone}{v.location ? ` (${v.location})` : ''}</span>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(action)} onClose={() => !busy && setAction(null)} title={action ? `${ACTIONS[action].label} · ${v.id}` : ''} maxWidth="max-w-md">
        {action && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs text-slate-500">
              This will move the case to <strong className="text-slate-800">{statusLabel(action)}</strong> and notify the reporter{action === 'warning_issued' ? ' and the registered owner of the vehicle' : ''}.
            </p>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">Officer note {ACTIONS[action].required ? <span className="text-rose-500">*</span> : '(optional)'}</span>
              <textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setAction(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2">
                {busy && <Spinner className="w-3.5 h-3.5" />} Confirm
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
};
