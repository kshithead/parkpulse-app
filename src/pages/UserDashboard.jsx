import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, CheckCircle2, Clock, QrCode, MapPin, AlertTriangle, ArrowRight, Activity, ChevronRight, Compass, History, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useParking } from '../context/ParkingContext';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/common/StatCard';
import { PageHeader, EmptyState, Spinner } from '../components/common/Feedback';
import { ActiveSessionBanner } from '../components/parking/ActiveSessionBanner';
import { SlotGrid } from '../components/parking/SlotGrid';
import { PlateBadge } from '../components/violations/PlateBadge';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { cleanPlateInput, normalizePlate, formatDuration, formatDateTime, timeAgo, statusLabel } from '../utils/format';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const UserDashboard = () => {
  const { currentUser } = useAuth();
  const { slots, zones, stats, activeSession, sessions, activityHistory, notices, startParking } = useParking();
  const toast = useToast();
  const navigate = useNavigate();

  const [pending, setPending] = useState(null);
  const [vehicleInput, setVehicleInput] = useState('');
  const [starting, setStarting] = useState(false);

  const mine = useMemo(() => sessions.filter((s) => s.userId === currentUser.id), [sessions, currentUser.id]);
  const week = useMemo(() => {
    const cutoff = Date.now() - WEEK;
    const recent = mine.filter((s) => new Date(s.startTime).getTime() >= cutoff);
    const done = recent.filter((s) => s.status === 'completed');
    return { count: recent.length, minutes: done.reduce((a, s) => a + (s.durationMin || 0), 0) };
  }, [mine]);

  const freePct = stats.totalSlots ? Math.round((stats.availableSlots / stats.totalSlots) * 100) : 0;
  const hottest = useMemo(() => [...zones].filter((z) => z.availableSlots > 0).sort((a, b) => b.availableSlots / b.totalSlots - a.availableSlots / a.totalSlots)[0], [zones]);

  const openCheckIn = (slot) => {
    if (slot.status === 'available') {
      if (activeSession) {
        toast.info(`You're already parked at ${activeSession.slotCode}. End that session first.`);
        return;
      }
      setVehicleInput(currentUser.vehicleNumber || '');
      setPending(slot);
    } else if (slot.occupiedBy?.isMine) {
      navigate(`/qr-parking?code=${slot.code}`);
    } else {
      toast.info(`Bay ${slot.code} is ${slot.status === 'occupied' ? 'in use' : slot.status}.`);
    }
  };

  const confirmPark = async () => {
    const plate = normalizePlate(vehicleInput);
    if (!plate) {
      toast.error('Enter a valid registration plate, for example KA-03-HA-8820.');
      return;
    }
    setStarting(true);
    try {
      await startParking({ slotCode: pending.code, vehicleNumber: plate });
      toast.success(`Checked in to bay ${pending.code}. Your session has started.`);
      setPending(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Driver portal"
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle="Live availability across every campus zone. Scan a bay placard or tap a green bay below to check in."
        actions={
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <PlateBadge plateNumber={currentUser.vehicleNumber} size="sm" />
              <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[180px]">{currentUser.vehicleModel || 'Registered vehicle'}</p>
            </div>
          </div>
        }
      />

      {notices.length > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 space-y-3" role="alert">
          <div className="flex items-center gap-2 text-rose-800">
            <ShieldAlert className="w-5 h-5" />
            <h2 className="text-sm font-bold">Campus security notice for your vehicle</h2>
          </div>
          {notices.map((n) => (
            <div key={n.id} className="text-xs text-rose-900 bg-white/70 rounded-xl border border-rose-100 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-mono font-bold">{n.id}</span> · {n.category} at {n.zone}
                <p className="text-rose-700 mt-0.5">{n.adminNotes}</p>
              </div>
              <Badge variant={n.status} size="xs">{statusLabel(n.status)}</Badge>
            </div>
          ))}
          <p className="text-[11px] text-rose-700">Please keep your vehicle within marked bays. Repeated notices may restrict campus parking access.</p>
        </div>
      )}

      <ActiveSessionBanner />

      <div data-tour="stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Free bays now" value={stats.availableSlots} subtitle={hottest ? `Most space in ${hottest.zone}` : 'All zones are full'} icon={CheckCircle2} variant={stats.availableSlots > 0 ? 'green' : 'red'} trend={`${freePct}% free`} />
        <StatCard title="Campus occupancy" value={`${stats.occupancyPercentage}%`} subtitle={`${stats.occupiedSlots} of ${stats.totalSlots} bays in use`} icon={Car} variant={stats.occupancyPercentage > 80 ? 'red' : stats.occupancyPercentage > 55 ? 'amber' : 'default'} />
        <StatCard title="Your sessions · 7 days" value={week.count} subtitle={week.count ? 'Check-ins this week' : 'No check-ins yet'} icon={History} variant="blue" />
        <StatCard title="Time parked · 7 days" value={formatDuration(week.minutes)} subtitle={activeSession ? `Currently at ${activeSession.slotCode}` : 'Completed sessions'} icon={Clock} variant={activeSession ? 'green' : 'default'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/qr-parking', icon: QrCode, title: 'Scan QR to park', text: 'Camera check-in', tone: 'emerald', box: 'bg-emerald-500 text-slate-950 shadow-emerald-500/20', card: 'from-emerald-500/10 to-teal-500/5 hover:from-emerald-500/20 border-emerald-500/30', arrow: 'text-emerald-600' },
          { to: '/nearby', icon: MapPin, title: 'Campus map', text: 'Find the closest free zone', tone: 'blue', box: 'bg-blue-600 text-white shadow-blue-500/20', card: 'from-blue-500/10 to-indigo-500/5 hover:from-blue-500/20 border-blue-500/30', arrow: 'text-blue-600' },
          { to: '/report-violation', icon: AlertTriangle, title: 'Report a violation', text: 'Blocked or misused bays', tone: 'rose', box: 'bg-rose-500 text-white shadow-rose-500/20', card: 'from-rose-500/10 to-amber-500/5 hover:from-rose-500/20 border-rose-500/30', arrow: 'text-rose-600' }
        ].map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to} className={`group bg-gradient-to-br ${a.card} p-5 rounded-2xl border shadow-sm transition-all flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:scale-105 transition-transform ${a.box}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                  <p className="text-xs text-slate-500">{a.text}</p>
                </div>
              </div>
              <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${a.arrow}`} />
            </Link>
          );
        })}
      </div>

      <section data-tour="slot-grid" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Live bay visualiser
            </h2>
            <p className="text-xs text-slate-500">Updates the moment anyone checks in or out. Tap a green bay to check in.</p>
          </div>
          <Link to="/qr-parking" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 self-start sm:self-auto py-2">
            Open scanner <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <SlotGrid slots={slots} onSelectSlot={openCheckIn} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Your recent activity
            </h3>
            <span className="text-xs text-slate-400">{activityHistory.length} events</span>
          </div>

          {activityHistory.length === 0 ? (
            <EmptyState icon={Car} title="No activity yet" message="Your parking sessions and violation reports will show up here." />
          ) : (
            <div className="space-y-2.5">
              {activityHistory.slice(0, 6).map((act) => (
                <div key={act.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${act.type === 'session_started' ? 'bg-emerald-100 text-emerald-700' : act.type === 'session_completed' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                      {act.type === 'violation_reported' ? <AlertTriangle className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {act.type === 'session_started' && `Parked at ${act.slotCode}`}
                        {act.type === 'session_completed' && `Parked at ${act.slotCode} · ${formatDuration(act.durationMin)}`}
                        {act.type === 'violation_reported' && `Reported: ${act.category}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {act.zone ? `${act.zone} · ` : ''}
                        {formatDateTime(act.time)} · {timeAgo(act.time)}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-medium whitespace-nowrap ml-2">
                    {act.type === 'session_started' ? 'Active' : act.type === 'session_completed' ? 'Completed' : statusLabel(act.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600" />
                Zone availability
              </h3>
              <Link to="/nearby" className="text-xs text-emerald-600 font-semibold hover:underline py-2 px-1">
                View map
              </Link>
            </div>
            <div className="space-y-2.5 pt-3">
              {zones.map((z) => {
                const used = z.totalSlots ? ((z.totalSlots - z.availableSlots) / z.totalSlots) * 100 : 0;
                return (
                  <button key={z.zone} onClick={() => navigate('/nearby')} className="w-full text-left p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-300 transition-colors group">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">{z.name}</h4>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">{z.zone}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px]">
                      <span className={`font-bold px-2 py-0.5 rounded-md border ${z.availableSlots === 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                        {z.availableSlots} of {z.totalSlots} free
                      </span>
                      <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${used > 85 ? 'bg-rose-500' : used > 60 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${used}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <Link to="/nearby" className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors mt-4">
            <span>Open campus map</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <Modal isOpen={Boolean(pending)} onClose={() => !starting && setPending(null)} title={pending ? `Check in to bay ${pending.code}` : ''}>
        {pending && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmPark();
            }}
            className="space-y-4"
          >
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xl font-extrabold">{pending.code}</span>
                <Badge variant="available">AVAILABLE</Badge>
              </div>
              <p className="text-xs text-emerald-700 font-medium">{pending.zone} · {pending.zoneName} · {pending.level}</p>
              <p className="text-xs text-emerald-800 font-medium">Bay type: {pending.type}</p>
            </div>

            <label className="block space-y-2">
              <span className="block text-xs font-semibold text-slate-700">Vehicle registration number</span>
              <input value={vehicleInput} onChange={(e) => setVehicleInput(cleanPlateInput(e.target.value))} placeholder="KA-03-HA-8820" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" />
              <span className="block text-[11px] text-slate-400">Defaults to your registered vehicle. Your timer starts as soon as you confirm.</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPending(null)} disabled={starting} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={starting} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2">
                {starting && <Spinner className="w-3.5 h-3.5" />}
                {starting ? 'Checking in…' : 'Start parking'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
