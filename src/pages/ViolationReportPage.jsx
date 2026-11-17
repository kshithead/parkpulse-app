import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Upload, Car, CheckCircle2, X, Send, Camera, FileWarning } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useParking } from '../context/ParkingContext';
import { useToast } from '../context/ToastContext';
import { PlateBadge } from '../components/violations/PlateBadge';
import { ViolationCard } from '../components/violations/ViolationCard';
import { PageHeader, EmptyState, Spinner } from '../components/common/Feedback';
import { api } from '../services/api';
import { compressImage } from '../utils/image';
import { cleanPlateInput } from '../utils/format';

const CATEGORIES = ['Unauthorized Parking', 'Wrong Parking', 'Blocked Parking', 'Reserved Space Infringement', 'No QR Check-In'];
const QUICK_PHRASES = ['Blocking the driveway exit', 'Parked diagonally across two bays', 'Occupying an accessible bay without a permit', 'Parked in a fire lane', 'Standing in a bay that shows as available'];
const URGENCIES = [
  { id: 'low', label: 'Low · general infraction' },
  { id: 'medium', label: 'Medium · improper bay use' },
  { id: 'high', label: 'High · blocking traffic / reserved bay' },
  { id: 'critical', label: 'Critical · fire lane / emergency access' }
];
const input = 'w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 bg-white';

export const ViolationReportPage = () => {
  const { isAdmin } = useAuth();
  const { violations, zones, slots, reportViolation, updateViolationStatus } = useParking();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'history' ? 'HISTORY' : 'SUBMIT';
  const setTab = (t) => setSearchParams(t === 'HISTORY' ? { tab: 'history' } : {}, { replace: true });

  const [category, setCategory] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [zone, setZone] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null); // { dataUrl }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filed, setFiled] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const fileRef = useRef(null);

  const zoneKey = zone || zones[0]?.zone || '';
  const zoneBays = useMemo(() => slots.filter((s) => s.zone === zoneKey).map((s) => s.code), [slots, zoneKey]);
  const accessibleBays = useMemo(() => slots.filter((s) => s.isAccessible).map((s) => s.code), [slots]);
  const evBays = useMemo(() => slots.filter((s) => s.isEV).map((s) => s.code), [slots]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto({ dataUrl: await compressImage(file) });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!category) return setError('Choose a violation category.');
    if (vehicleNumber.replace(/[^A-Z0-9]/gi, '').length < 4) return setError('Enter the offending vehicle plate.');
    if (description.trim().length < 10) return setError('Add a short description (at least 10 characters).');

    setBusy(true);
    try {
      let imageUrl = null;
      if (photo) ({ url: imageUrl } = await api.uploadEvidence(photo.dataUrl));
      const report = await reportViolation({ category, vehicleNumber, zone: zoneKey, location, description: description.trim(), urgency, imageUrl });
      setFiled(report);
      toast.success(`Report ${report.id} sent to campus security.`);
      setCategory('');
      setVehicleNumber('');
      setLocation('');
      setDescription('');
      setPhoto(null);
      setUrgency('medium');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const shown = violations.filter((v) => statusFilter === 'ALL' || v.status === statusFilter);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Campus traffic safety"
        eyebrowTone="text-rose-600"
        title={isAdmin ? 'Patrol reports' : 'Report a violation'}
        subtitle={isAdmin ? 'File reports from your patrol and review every case on record.' : 'Report blocked exits, double parking or misused bays. Campus security is notified instantly and you can follow each case.'}
        actions={
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            {[
              ['SUBMIT', 'New report'],
              ['HISTORY', isAdmin ? 'All reports' : 'My reports']
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {label}
                {id === 'HISTORY' && <span className="text-[10px] font-mono px-1.5 rounded-full bg-rose-500 text-white">{violations.length}</span>}
              </button>
            ))}
          </div>
        }
      />

      {filed && tab === 'SUBMIT' && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Case {filed.id} logged</p>
              <p className="text-[11px] text-emerald-700">
                Report for {filed.vehicleNumber} is with campus security.{' '}
                <button onClick={() => setTab('HISTORY')} className="underline font-semibold">Track its status</button>
              </p>
            </div>
          </div>
          <button onClick={() => setFiled(null)} className="text-emerald-700 hover:text-emerald-900 p-1" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tab === 'SUBMIT' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <form data-tour="report-form" onSubmit={handleSubmit} className="xl:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" /> File an incident report
            </h2>

            {error && <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>}

            <fieldset>
              <legend className="block text-xs font-bold text-slate-800 mb-2">Violation category <span className="text-rose-500">*</span></legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`p-3 rounded-xl text-xs font-semibold border text-left transition-all ${category === c ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5 min-h-[24px]">
                  <label htmlFor="plate" className="block text-xs font-bold text-slate-800">Offending vehicle plate <span className="text-rose-500">*</span></label>
                  {vehicleNumber.length > 5 && <PlateBadge plateNumber={vehicleNumber} size="sm" />}
                </div>
                <div className="relative">
                  <Car className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input id="plate" value={vehicleNumber} onChange={(e) => setVehicleNumber(cleanPlateInput(e.target.value))} placeholder="e.g. MH-12-AB-1234" className={`${input} pl-10 font-mono tracking-wider uppercase`} />
                </div>
              </div>

              <div>
                <label htmlFor="zone" className="block text-xs font-bold text-slate-800 mb-1.5">Campus zone</label>
                <select id="zone" value={zoneKey} onChange={(e) => { setZone(e.target.value); setLocation(''); }} className={input}>
                  {zones.map((z) => (
                    <option key={z.zone} value={z.zone}>{z.zone} — {z.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="loc" className="block text-xs font-bold text-slate-800 mb-1.5">Bay or landmark <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="loc" list="bay-list" value={location} onChange={(e) => setLocation(e.target.value.toUpperCase())} maxLength={60} placeholder="e.g. P003 or Ramp entrance" className={`${input} font-mono uppercase text-xs`} />
                <datalist id="bay-list">{zoneBays.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label htmlFor="urg" className="block text-xs font-bold text-slate-800 mb-1.5">Urgency</label>
                <select id="urg" value={urgency} onChange={(e) => setUrgency(e.target.value)} className={input}>
                  {URGENCIES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="desc" className="block text-xs font-bold text-slate-800 mb-1.5">What happened? <span className="text-rose-500">*</span></label>
              <textarea id="desc" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the vehicle's position, what it is blocking, or the permit issue…" className={`${input} text-xs`} />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-400">Quick add:</span>
                {QUICK_PHRASES.map((p) => (
                  <button key={p} type="button" onClick={() => setDescription((d) => (d ? `${d.replace(/\s+$/, '')} ${p}.` : `${p}.`))} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                    + {p}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-slate-400">{description.length}/500</span>
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-800 mb-2">Photo evidence <span className="font-normal text-slate-400">(recommended — make sure the plate is legible)</span></span>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
              {photo ? (
                <div className="relative max-w-sm h-48 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
                  <img src={photo.dataUrl} alt="Evidence preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhoto(null)} className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 transition-colors" aria-label="Remove photo">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full max-w-sm border-2 border-dashed border-slate-300 hover:border-rose-300 hover:bg-rose-50/40 rounded-2xl p-6 text-center transition-colors">
                  <span className="flex items-center justify-center gap-3 text-slate-400">
                    <Camera className="w-6 h-6" /> <Upload className="w-6 h-6" />
                  </span>
                  <span className="block text-xs font-semibold text-slate-700 mt-2">Take or upload a photo</span>
                  <span className="block text-[11px] text-slate-400">JPG or PNG · compressed automatically</span>
                </button>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-slate-400">Your name is shared only with campus security.</p>
              <button type="submit" disabled={busy} className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-60">
                {busy ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>{busy ? 'Sending report…' : 'Submit report'}</span>
              </button>
            </div>
          </form>

          <aside className="xl:col-span-4 space-y-4">
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-mono">Campus parking rules</h3>
              <div className="space-y-3 text-xs">
                <Rule title="Stay inside the lines" text="Vehicles straddling bay markings receive a formal violation notice." />
                <Rule title="Keep emergency access clear" text="Anything blocking a fire lane, hydrant or ramp is escalated immediately and may be towed." />
                {accessibleBays.length > 0 && <Rule title="Accessible bays" text={`A valid disability permit is required for ${accessibleBays.join(', ')}.`} />}
                {evBays.length > 0 && <Rule title="EV bays" text={`Reserved for vehicles that are charging: ${evBays.join(', ')}.`} />}
              </div>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 text-xs text-slate-600 space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-2"><FileWarning className="w-4 h-4 text-amber-500" /> What happens next</p>
              <ol className="list-decimal ml-4 space-y-1 text-slate-500">
                <li>An officer reviews and verifies the report.</li>
                <li>A notice is issued to the registered owner, or the case is dismissed.</li>
                <li>You're notified at every step — no fines, only warnings and towing for emergencies.</li>
              </ol>
            </div>
          </aside>
        </div>
      )}

      {tab === 'HISTORY' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {['ALL', 'pending', 'investigating', 'warning_issued', 'resolved', 'dismissed'].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {s === 'ALL' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button onClick={() => setTab('SUBMIT')} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold self-start sm:self-auto">
              + New report
            </button>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={AlertTriangle} title={violations.length ? 'No reports with this status' : 'No reports yet'} message={violations.length ? 'Try another status filter.' : isAdmin ? 'Reports filed by drivers will appear here.' : "You haven't reported anything. Spot a problem? File your first report."} action={!violations.length && <button onClick={() => setTab('SUBMIT')} className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold">File a report</button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {shown.map((v) => (
                <ViolationCard key={v.id} violation={v} isAdmin={isAdmin} onStatusUpdate={updateViolationStatus} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Rule = ({ title, text }) => (
  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
    <span className="font-bold text-white block">{title}</span>
    <p className="text-slate-400 text-[11px]">{text}</p>
  </div>
);
