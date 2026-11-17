import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QrCode, Camera, Search, CheckCircle2, AlertCircle, Play, StopCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useParking } from '../context/ParkingContext';
import { useToast } from '../context/ToastContext';
import { Badge } from '../components/common/Badge';
import { PageHeader, Spinner } from '../components/common/Feedback';
import { PlateBadge } from '../components/violations/PlateBadge';
import { ActiveSessionBanner } from '../components/parking/ActiveSessionBanner';
import { QRScanner } from '../components/parking/QRScanner';
import { cleanPlateInput, normalizePlate, parseBayCode, formatTime, formatDuration } from '../utils/format';

export const QRParkingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { slots, activeSession, startParking, endParking } = useParking();
  const toast = useToast();

  const [inputCode, setInputCode] = useState(searchParams.get('code')?.toUpperCase() || '');
  const [activeCode, setActiveCode] = useState(searchParams.get('code')?.toUpperCase() || '');
  const [vehicleNumber, setVehicleNumber] = useState(currentUser.vehicleNumber || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The slot is derived from live data, so it flips to "occupied" the moment anyone else checks in.
  const scannedSlot = useMemo(() => slots.find((s) => s.code === activeCode) || null, [slots, activeCode]);

  // Deep links such as /qr-parking?code=P007 (printed on placards) resolve immediately.
  useEffect(() => {
    if (activeCode && !scannedSlot && slots.length) setError(`Bay "${activeCode}" was not found. Check the code printed on the placard.`);
    else setError('');
  }, [activeCode, scannedSlot, slots.length]);

  const select = (code) => {
    const clean = code.trim().toUpperCase();
    setInputCode(clean);
    setActiveCode(clean);
    setSearchParams(clean ? { code: clean } : {}, { replace: true });
  };

  const handleScan = (payload) => {
    const code = parseBayCode(payload, slots);
    if (code && slots.some((s) => s.code === code)) {
      toast.success(`Placard recognised: bay ${code}`);
      select(code);
    } else {
      toast.error('That QR code is not a ParkPulse bay placard.');
    }
  };

  const quickPicks = useMemo(() => slots.filter((s) => s.status === 'available').slice(0, 8), [slots]);
  const isMine = Boolean(activeSession && scannedSlot && activeSession.slotCode === scannedSlot.code);

  const handleStart = async () => {
    const plate = normalizePlate(vehicleNumber);
    if (!plate) {
      setError('Enter a valid registration plate, for example KA-03-HA-8820.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await startParking({ slotCode: scannedSlot.code, vehicleNumber: plate });
      toast.success(`Checked in to bay ${scannedSlot.code}. Drive safe!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    setBusy(true);
    try {
      const done = await endParking(activeSession.sessionId);
      toast.success(`Session ended after ${formatDuration(done.durationMin)}. Bay ${done.slotCode} is free again.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Touchless QR check-in" title="Scan & park" subtitle="Scan the QR placard on your bay's pillar, or type the bay code printed beneath it, to start your parking session." />

      <ActiveSessionBanner />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div data-tour="scanner" className="xl:col-span-5 bg-slate-950 rounded-3xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-10 right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-800">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">QR scanner</span>
            </div>
            <QRScanner onResult={handleScan} />
            <p className="text-[10px] text-slate-500 text-center mt-4">Your phone's camera app also works — placards open this page directly.</p>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6">
          <div data-tour="bay-lookup" className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-600" />
                Enter bay code
              </h3>
              <span className="text-xs text-slate-400">Printed on the pillar placard</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                select(inputCode);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <QrCode className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  value={inputCode}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                    setInputCode(v);
                    if (slots.some((s) => s.code === v)) select(v);
                  }}
                  placeholder="e.g. P007"
                  aria-label="Bay code"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm tracking-wider uppercase focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                />
              </div>
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shrink-0">
                Look up
              </button>
            </form>

            {quickPicks.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Open bays right now</p>
                <div className="flex flex-wrap gap-2">
                  {quickPicks.map((s) => (
                    <button key={s.id} type="button" onClick={() => select(s.code)} className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${activeCode === s.code ? 'bg-slate-900 text-white border-slate-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'}`}>
                      {s.code} <span className="font-sans font-medium opacity-70">· {s.zone.replace('Zone ', '')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {scannedSlot ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6" key={scannedSlot.id}>
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-extrabold font-mono text-slate-900">Bay {scannedSlot.code}</h2>
                    <Badge variant={scannedSlot.status}>{isMine ? 'YOURS' : scannedSlot.status.toUpperCase()}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{scannedSlot.zone} · {scannedSlot.zoneName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <Info label="Level / floor" value={scannedSlot.level} />
                <Info label="Bay type" value={scannedSlot.type} />
                <Info label="Placard ID" value={<span className="flex items-center gap-1 text-emerald-600 font-mono"><ShieldCheck className="w-3.5 h-3.5" />{scannedSlot.qrPlacardId}</span>} />
              </div>

              {scannedSlot.status === 'occupied' && scannedSlot.occupiedBy && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-xs text-rose-700 flex items-center justify-between gap-3">
                  <span>{isMine ? 'Your vehicle is parked here' : 'Another vehicle is parked here'} since {formatTime(scannedSlot.occupiedBy.startTime)}.</span>
                  {isMine && <PlateBadge plateNumber={activeSession.vehicleNumber} size="sm" />}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 space-y-4">
                {scannedSlot.status === 'available' ? (
                  activeSession ? (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      You're already checked in at bay <strong>{activeSession.slotCode}</strong>. End that session before starting another.
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleStart();
                      }}
                      className="space-y-4"
                    >
                      <label className="block">
                        <span className="block text-xs font-semibold text-slate-700 mb-1.5">Vehicle licence plate</span>
                        <input value={vehicleNumber} onChange={(e) => setVehicleNumber(cleanPlateInput(e.target.value))} placeholder="KA-03-HA-8820" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
                      </label>
                      <button type="submit" disabled={busy} className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60">
                        {busy ? <Spinner /> : <Play className="w-4 h-4 fill-current" />}
                        <span>{busy ? 'Checking in…' : `Check in to bay ${scannedSlot.code}`}</span>
                      </button>
                    </form>
                  )
                ) : isMine ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> This is your active session. Tap below when you're leaving.
                    </div>
                    <button type="button" disabled={busy} onClick={handleEnd} className="w-full py-3.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60">
                      {busy ? <Spinner /> : <StopCircle className="w-4 h-4" />}
                      <span>{busy ? 'Ending session…' : 'End parking & vacate bay'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs text-center">
                    {scannedSlot.status === 'occupied' ? 'This bay is in use by another vehicle.' : scannedSlot.status === 'reserved' ? 'This bay is reserved for official use.' : 'This bay is closed for maintenance.'} Pick one of the open bays above.
                    {quickPicks[0] && (
                      <button onClick={() => select(quickPicks[0].code)} className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800">
                        Try bay {quickPicks[0].code} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            !error && (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
                <QrCode className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-slate-600 font-semibold text-sm mt-2">No bay selected yet</p>
                <p className="text-xs text-slate-400 mt-1">Scan a placard or enter a bay code to see its details.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
    <span className="text-slate-400 text-[10px] block">{label}</span>
    <span className="font-semibold text-slate-800">{value}</span>
  </div>
);
