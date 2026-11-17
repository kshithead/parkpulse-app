import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Clock, AlertTriangle, Plus, RefreshCw, Layers, TrendingUp, MapPin, LocateFixed, ShieldAlert, FileText, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useParking } from '../context/ParkingContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { StatCard } from '../components/common/StatCard';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Spinner } from '../components/common/Feedback';
import { OverviewTab, SlotsTab, ZonesTab, SessionsTab, ViolationsTab, AuditTab } from '../components/admin/AdminTabs';
import { cleanPlateInput, normalizePlate, nextSlotCode } from '../utils/format';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Layers },
  { id: 'slots', label: 'Bays', icon: Car },
  { id: 'zones', label: 'Zones', icon: MapPin },
  { id: 'sessions', label: 'Sessions', icon: Clock },
  { id: 'violations', label: 'Violations', icon: ShieldAlert },
  { id: 'audit', label: 'Audit trail', icon: FileText }
];

const field = 'w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 bg-white';
const Label = ({ children }) => <span className="block font-bold text-slate-800 mb-1 text-xs">{children}</span>;

const emptyZone = { name: '', zone: '', address: '', lat: '', lng: '', level: 'Ground Level', securityLevel: 'Campus Patrol', isCovered: false, totalSlots: 6, evSlots: 0, accessibleSlots: 1 };

export const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const { slots, zones, sessions, violations, stats, rev, updateSlotStatus, endParking, addSlot, removeSlot, addZone, updateZone, resetData, detectUserLocation, isDetectingLocation } = useParking();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview';
  const goTab = useCallback((id) => setParams(id === 'overview' ? {} : { tab: id }), [setParams]);

  // Analytics refresh whenever server state changes (debounced).
  const [analytics, setAnalytics] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => api.analytics().then(setAnalytics).catch(() => {}), analytics ? 800 : 0);
    return () => clearTimeout(t);
  }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dialog state
  const [slotModal, setSlotModal] = useState(false);
  const [slotForm, setSlotForm] = useState({ code: '', zone: '', type: 'Standard', level: '' });
  const [zoneModal, setZoneModal] = useState(null); // null | { mode:'add'|'edit', zone? }
  const [zoneForm, setZoneForm] = useState(emptyZone);
  const [occupy, setOccupy] = useState(null);
  const [plate, setPlate] = useState('');
  const [release, setRelease] = useState(null); // session
  const [releaseSlot, setReleaseSlot] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeCount = sessions.filter((s) => s.status === 'active').length;
  const openViolations = stats.openViolations;

  // ---- handlers -------------------------------------------------------
  const handleSetStatus = (slot, status) => {
    if (status === 'occupied') {
      setPlate('');
      setOccupy(slot);
    } else if (slot.status === 'occupied') {
      setReleaseSlot(slot);
    } else {
      updateSlotStatus(slot.id, status).then(() => toast.success(`Bay ${slot.code} set to ${status}.`)).catch((e) => toast.error(e.message));
    }
  };

  const submit = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openAddSlot = () => {
    setSlotForm({ code: nextSlotCode(slots), zone: zones[0]?.zone || '', type: 'Standard', level: '' });
    setSlotModal(true);
  };

  const openAddZone = () => {
    setZoneForm({ ...emptyZone, lat: zones[0]?.lat ?? '', lng: zones[0]?.lng ?? '' });
    setZoneModal({ mode: 'add' });
  };

  const openEditZone = (z) => {
    setZoneForm({ ...z, totalSlots: z.totalSlots });
    setZoneModal({ mode: 'edit', zone: z.zone });
  };

  const capturePin = async () => {
    try {
      const loc = await detectUserLocation();
      setZoneForm((f) => ({ ...f, lat: loc.lat.toFixed(6), lng: loc.lng.toFixed(6) }));
      toast.success('GPS pin captured from your device.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const setZ = (k) => (e) => setZoneForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 text-white p-5 sm:p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">OPERATIONS CONSOLE</span>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight pt-1 sm:pt-2">Parking command center</h1>
          <p className="text-xs text-slate-400">
            Signed in as <strong className="text-slate-200">{currentUser.name}</strong> · Badge <span className="font-mono">{currentUser.badgeId}</span>
          </p>
        </div>
        <div data-tour="admin-actions" className="relative z-10 grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <button onClick={openAddZone} className="px-3 sm:px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95">
            <MapPin className="w-4 h-4" /> Add hub
          </button>
          <button onClick={openAddSlot} className="px-3 sm:px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95">
            <Plus className="w-4 h-4" /> Add bay
          </button>
          <button onClick={() => setResetOpen(true)} className="px-3 sm:px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors" title="Reset dataset">
            <RefreshCw className="w-3.5 h-3.5" /> Reset<span className="hidden sm:inline">&nbsp;data</span>
          </button>
        </div>
      </div>

      <div data-tour="stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Campus capacity" value={`${stats.totalSlots} bays`} subtitle={`Across ${stats.zoneCount} zones`} icon={Car} />
        <StatCard title="Occupancy" value={`${stats.occupancyPercentage}%`} subtitle={`${stats.occupiedSlots} occupied · ${stats.availableSlots} free`} icon={TrendingUp} variant={stats.occupancyPercentage > 80 ? 'red' : stats.occupancyPercentage > 55 ? 'amber' : 'green'} trend={stats.occupancyPercentage > 80 ? 'High demand' : stats.occupancyPercentage > 55 ? 'Busy' : 'Healthy'} />
        <StatCard title="Active sessions" value={activeCount} subtitle="Vehicles checked in" icon={Clock} variant="blue" onClick={() => goTab('sessions')} />
        <StatCard title="Open violations" value={openViolations} subtitle="Awaiting officer action" icon={AlertTriangle} variant={openViolations > 0 ? 'amber' : 'green'} trend={openViolations > 0 ? 'Needs review' : 'All clear'} onClick={() => goTab('violations')} />
      </div>

      <div role="tablist" aria-label="Console sections" data-tour="admin-tabs" className="sticky top-[57px] z-20 -mx-4 px-4 sm:mx-0 sm:px-0 pt-2 flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none bg-slate-50/95 backdrop-blur">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count = t.id === 'slots' ? slots.length : t.id === 'zones' ? zones.length : t.id === 'sessions' ? activeCount : t.id === 'violations' ? violations.length : null;
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => goTab(t.id)} className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
              {count != null && <span className={`text-[10px] font-mono px-1.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-slate-200 text-slate-600'}`}>{count}</span>}
              {t.id === 'violations' && openViolations > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
            </button>
          );
        })}
      </div>

      <div key={tab} data-tour="admin-content" className="page-enter">
        {tab === 'overview' && <OverviewTab analytics={analytics} onNavigate={goTab} onRelease={setRelease} />}
        {tab === 'slots' && <SlotsTab onSetStatus={handleSetStatus} onPlacard={(s) => navigate(`/admin/placards?code=${s.code}`)} onDelete={setRemoving} />}
        {tab === 'zones' && <ZonesTab onAdd={openAddZone} onEdit={openEditZone} />}
        {tab === 'sessions' && <SessionsTab onRelease={setRelease} />}
        {tab === 'violations' && <ViolationsTab />}
        {tab === 'audit' && <AuditTab />}
      </div>

      {/* ---- Add bay ---- */}
      <Modal isOpen={slotModal} onClose={() => setSlotModal(false)} title="Commission a new bay" maxWidth="max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await submit(() => addSlot(slotForm), `Bay ${slotForm.code} commissioned.`)) setSlotModal(false);
          }}
          className="space-y-4"
        >
          <label className="block">
            <Label>Bay code</Label>
            <input value={slotForm.code} onChange={(e) => setSlotForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className={`${field} font-mono uppercase text-sm`} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Zone</Label>
              <select value={slotForm.zone} onChange={(e) => setSlotForm((f) => ({ ...f, zone: e.target.value }))} className={field}>
                {zones.map((z) => <option key={z.zone} value={z.zone}>{z.zone} — {z.name}</option>)}
              </select>
            </label>
            <label className="block">
              <Label>Bay type</Label>
              <select value={slotForm.type} onChange={(e) => setSlotForm((f) => ({ ...f, type: e.target.value }))} className={field}>
                <option>Standard</option>
                <option>EV Charging</option>
                <option>Accessible</option>
              </select>
            </label>
          </div>
          <label className="block">
            <Label>Level (optional — defaults to the zone's level)</Label>
            <input value={slotForm.level} onChange={(e) => setSlotForm((f) => ({ ...f, level: e.target.value }))} maxLength={40} className={field} />
          </label>
          <FormButtons busy={busy} onCancel={() => setSlotModal(false)} label="Commission bay" tone="emerald" />
        </form>
      </Modal>

      {/* ---- Add / edit hub ---- */}
      <Modal isOpen={Boolean(zoneModal)} onClose={() => setZoneModal(null)} title={zoneModal?.mode === 'edit' ? `Edit ${zoneModal.zone}` : 'Add a parking hub'} maxWidth="max-w-xl">
        {zoneModal && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await submit(
                () => (zoneModal.mode === 'edit' ? updateZone(zoneModal.zone, zoneForm) : addZone(zoneForm)),
                zoneModal.mode === 'edit' ? 'Hub updated.' : `Hub "${zoneForm.name}" created with ${zoneForm.totalSlots} bays.`
              );
              if (ok) setZoneModal(null);
            }}
            className="space-y-4"
          >
            {zoneModal.mode === 'add' && <p className="text-[11px] text-slate-500">Bays are created automatically with sequential codes and QR identifiers.</p>}
            <label className="block">
              <Label>Facility name</Label>
              <input required minLength={3} maxLength={70} value={zoneForm.name} onChange={setZ('name')} placeholder="e.g. Faculty Residence Lot" className={field} />
            </label>
            <label className="block">
              <Label>Address / landmark</Label>
              <input maxLength={140} value={zoneForm.address} onChange={setZ('address')} className={field} />
            </label>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-600" /> GPS coordinates</span>
                <button type="button" onClick={capturePin} disabled={isDetectingLocation} className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                  <LocateFixed className={`w-3 h-3 ${isDetectingLocation ? 'animate-spin' : ''}`} /> {isDetectingLocation ? 'Locating…' : 'Use my location'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-[10px] font-mono text-slate-500">Latitude</span><input required inputMode="decimal" value={zoneForm.lat} onChange={setZ('lat')} className={`${field} font-mono`} /></label>
                <label className="block"><span className="text-[10px] font-mono text-slate-500">Longitude</span><input required inputMode="decimal" value={zoneForm.lng} onChange={setZ('lng')} className={`${field} font-mono`} /></label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block"><Label>Level / surface</Label><input maxLength={40} value={zoneForm.level} onChange={setZ('level')} className={field} /></label>
              <label className="block"><Label>Security</Label><input maxLength={40} value={zoneForm.securityLevel} onChange={setZ('securityLevel')} className={field} /></label>
            </div>

            {zoneModal.mode === 'add' && (
              <div className="grid grid-cols-3 gap-3">
                <label className="block"><Label>Total bays</Label><input type="number" min={1} max={40} value={zoneForm.totalSlots} onChange={setZ('totalSlots')} className={`${field} font-mono`} /></label>
                <label className="block"><Label>EV bays</Label><input type="number" min={0} max={zoneForm.totalSlots} value={zoneForm.evSlots} onChange={setZ('evSlots')} className={`${field} font-mono`} /></label>
                <label className="block"><Label>Accessible</Label><input type="number" min={0} max={zoneForm.totalSlots} value={zoneForm.accessibleSlots} onChange={setZ('accessibleSlots')} className={`${field} font-mono`} /></label>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={Boolean(zoneForm.isCovered)} onChange={setZ('isCovered')} className="rounded border-slate-300 text-indigo-600" /> Covered structure
            </label>
            <FormButtons busy={busy} onCancel={() => setZoneModal(null)} label={zoneModal.mode === 'edit' ? 'Save changes' : 'Create hub & bays'} tone="indigo" />
          </form>
        )}
      </Modal>

      {/* ---- Mark occupied ---- */}
      <Modal isOpen={Boolean(occupy)} onClose={() => setOccupy(null)} title={occupy ? `Mark bay ${occupy.code} occupied` : ''} maxWidth="max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const p = normalizePlate(plate);
            if (!p) return toast.error('Enter a valid plate, for example MH-12-AB-1234.');
            if (await submit(() => updateSlotStatus(occupy.id, 'occupied', p), `Bay ${occupy.code} recorded as occupied by ${p}.`)) setOccupy(null);
          }}
          className="space-y-4"
        >
          <p className="text-xs text-slate-500">Use this when a vehicle is parked without a check-in (for example a walk-in or staff vehicle). A session is recorded against the plate.</p>
          <label className="block">
            <Label>Vehicle plate</Label>
            <input value={plate} onChange={(e) => setPlate(cleanPlateInput(e.target.value))} placeholder="MH-12-AB-1234" className={`${field} font-mono uppercase text-sm`} required />
          </label>
          <FormButtons busy={busy} onCancel={() => setOccupy(null)} label="Record occupancy" tone="rose" />
        </form>
      </Modal>

      {/* ---- Confirmations ---- */}
      <ConfirmDialog
        isOpen={Boolean(release)}
        onClose={() => setRelease(null)}
        title="Release this bay?"
        message={release ? `End the active session for ${release.vehicleNumber} at bay ${release.slotCode}. The driver will be notified.` : ''}
        confirmLabel="Release bay"
        onConfirm={() => endParking(release.sessionId).then(() => toast.success(`Bay ${release.slotCode} released.`)).catch((e) => { toast.error(e.message); throw e; })}
      />
      <ConfirmDialog
        isOpen={Boolean(releaseSlot)}
        onClose={() => setReleaseSlot(null)}
        title="Release the vehicle?"
        message={releaseSlot ? `Bay ${releaseSlot.code} is occupied${releaseSlot.occupiedBy?.vehicleNumber ? ` by ${releaseSlot.occupiedBy.vehicleNumber}` : ''}. Releasing it ends their session and frees the bay.` : ''}
        confirmLabel="Release bay"
        onConfirm={() => updateSlotStatus(releaseSlot.id, 'available').then(() => toast.success(`Bay ${releaseSlot.code} released.`)).catch((e) => { toast.error(e.message); throw e; })}
      />
      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Decommission this bay?"
        message={removing ? `Bay ${removing.code} (${removing.zone}) will be permanently removed. Its printed QR placard will stop working.` : ''}
        confirmLabel="Decommission"
        onConfirm={() => removeSlot(removing.id).then(() => toast.success(`Bay ${removing.code} removed.`)).catch((e) => { toast.error(e.message); throw e; })}
      />

      <Modal isOpen={resetOpen} onClose={() => !busy && setResetOpen(false)} title="Reset campus data" maxWidth="max-w-md">
        <div className="space-y-4 text-xs text-slate-600">
          <p>This replaces <strong>all</strong> sessions, violations and registered drivers. Zones and bays are restored to the default campus layout. This cannot be undone.</p>
          {[
            ['demo', 'Reload demo dataset', 'Sample drivers, a week of parking history and a few violation cases. Best for presentations.', Database],
            ['clean', 'Start with an empty campus', 'Only your officer account and the bays — a clean slate for real use.', RefreshCw]
          ].map(([mode, title, desc, Icon]) => (
            <button
              key={mode}
              disabled={busy}
              onClick={async () => {
                if (await submit(() => resetData(mode), mode === 'demo' ? 'Demo dataset loaded.' : 'Campus reset to an empty state.')) setResetOpen(false);
              }}
              className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors flex items-start gap-3 disabled:opacity-60"
            >
              <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
              <span>
                <span className="block text-sm font-bold text-slate-900">{title}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};

const FormButtons = ({ busy, onCancel, label, tone }) => (
  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
    <button type="button" onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
    <button type="submit" disabled={busy} className={`px-5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60 flex items-center gap-2 ${tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : tone === 'rose' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
      {busy && <Spinner className="w-3.5 h-3.5" />} {label}
    </button>
  </div>
);
