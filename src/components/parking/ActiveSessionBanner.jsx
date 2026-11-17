import React, { useState } from 'react';
import { Clock, Car, StopCircle, CheckCircle2 } from 'lucide-react';
import { useParking } from '../../context/ParkingContext';
import { useToast } from '../../context/ToastContext';
import { useNow } from '../../hooks/hooks';
import { formatClock, formatDuration, formatTime } from '../../utils/format';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const ActiveSessionBanner = () => {
  const { activeSession, endParking } = useParking();
  const toast = useToast();
  const now = useNow(1000);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);

  if (!activeSession && !result) return null;

  const elapsedSec = activeSession ? Math.max(0, Math.floor((now - new Date(activeSession.startTime).getTime()) / 1000)) : 0;

  const handleEnd = async () => {
    try {
      const done = await endParking(activeSession.sessionId);
      setResult(done);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  return (
    <>
      {activeSession && (
        <div className="bg-gradient-to-r from-slate-900 via-[#0B132B] to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Parking session in progress</span>
              </div>

              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-3xl font-extrabold font-mono tracking-tight">Bay {activeSession.slotCode}</h3>
                <span className="text-sm px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{activeSession.zone}</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-mono">
                  <Car className="w-4 h-4 text-emerald-400" />
                  <strong className="text-white">{activeSession.vehicleNumber}</strong>
                </span>
                <span className="text-slate-400">Checked in at {formatTime(activeSession.startTime)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6">
              <div className="text-left sm:text-right">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center sm:justify-end gap-1">
                  <Clock className="w-3 h-3" /> Time parked
                </p>
                <p className="text-3xl font-bold font-mono text-emerald-400 tabular-nums">{formatClock(elapsedSec)}</p>
              </div>
              <button onClick={() => setConfirmOpen(true)} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-semibold text-sm shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 transition-all">
                <StopCircle className="w-4 h-4" />
                End parking
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSession && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleEnd}
          title="End this parking session?"
          message={`Bay ${activeSession.slotCode} will be released immediately for other drivers. You've been parked for ${formatDuration(Math.ceil(elapsedSec / 60))}.`}
          confirmLabel="End & vacate"
          tone="neutral"
        />
      )}

      <Modal isOpen={Boolean(result)} onClose={() => setResult(null)} title="Parking session completed" maxWidth="max-w-md">
        {result && (
          <div className="space-y-5 text-slate-700">
            <div className="text-center py-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Bay released</h4>
              <p className="text-xs text-slate-500">Bay {result.slotCode} is available for the next driver.</p>
            </div>
            <div className="space-y-2.5 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Vehicle</span>
                <span className="font-mono font-bold text-slate-900">{result.vehicleNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Bay &amp; zone</span>
                <span className="font-semibold text-slate-900">{result.slotCode} · {result.zone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Time</span>
                <span className="font-semibold text-slate-900">{formatTime(result.startTime)} – {formatTime(result.endTime)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-sm font-bold text-slate-900">
                <span>Total duration</span>
                <span className="text-emerald-600 font-mono">{formatDuration(result.durationMin)}</span>
              </div>
            </div>
            <button onClick={() => setResult(null)} className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors">
              Done
            </button>
          </div>
        )}
      </Modal>
    </>
  );
};
