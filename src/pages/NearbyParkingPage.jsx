import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Search, Zap, Shield, ChevronRight, Compass, LocateFixed, ExternalLink, AlertCircle, Accessibility, SearchX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useParking } from '../context/ParkingContext';
import { useToast } from '../context/ToastContext';
import ZoneMap from '../components/parking/ZoneMap';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { PageHeader, EmptyState } from '../components/common/Feedback';
import { haversineKm, formatDistance, walkMinutes, driveMinutes } from '../utils/format';

const FILTERS = [
  { id: 'ALL', label: 'All zones' },
  { id: 'FREE', label: 'Has free bays' },
  { id: 'EV', label: 'EV charging', icon: Zap },
  { id: 'COVERED', label: 'Covered', icon: Shield },
  { id: 'ACCESSIBLE', label: 'Accessible', icon: Accessibility }
];

export const NearbyParkingPage = () => {
  const { isAdmin } = useAuth();
  const { zones, slots, userLocation, detectUserLocation, isDetectingLocation, locationError } = useParking();
  const toast = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedKey, setSelectedKey] = useState(null);
  const [baysFor, setBaysFor] = useState(null);

  // Reference point: the driver's GPS fix, otherwise the middle of the campus.
  const reference = useMemo(() => {
    if (userLocation) return { lat: userLocation.lat, lng: userLocation.lng, live: true };
    const pts = zones.filter((z) => z.lat != null);
    if (!pts.length) return null;
    return { lat: pts.reduce((a, z) => a + z.lat, 0) / pts.length, lng: pts.reduce((a, z) => a + z.lng, 0) / pts.length, live: false };
  }, [userLocation, zones]);

  const enriched = useMemo(
    () =>
      zones
        .map((z) => {
          const km = reference && z.lat != null ? haversineKm(reference.lat, reference.lng, z.lat, z.lng) : null;
          return { ...z, km };
        })
        .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.zone.localeCompare(b.zone)),
    [zones, reference]
  );

  const nearestOpen = enriched.find((z) => z.availableSlots > 0);

  const visible = enriched.filter((z) => {
    const q = query.trim().toLowerCase();
    if (q && !`${z.name} ${z.zone} ${z.address} ${z.level}`.toLowerCase().includes(q)) return false;
    if (filter === 'FREE') return z.availableSlots > 0;
    if (filter === 'EV') return z.evSlots > 0;
    if (filter === 'COVERED') return z.isCovered;
    if (filter === 'ACCESSIBLE') return z.accessibleSlots > 0;
    return true;
  });

  const selectedZone = enriched.find((z) => z.zone === selectedKey) || null;

  const directionsUrl = useCallback(
    (z) => {
      const dest = `${z.lat},${z.lng}`;
      const origin = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : '';
      return `https://www.google.com/maps/dir/?api=1${origin}&destination=${dest}&travelmode=driving`;
    },
    [userLocation]
  );

  const locate = async () => {
    try {
      await detectUserLocation();
      toast.success('Location found. Zones are now sorted by distance from you.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const baySlots = baysFor ? slots.filter((s) => s.zone === baysFor.zone) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Campus parking map"
        title="Find the closest free zone"
        subtitle="Live availability for every parking zone, sorted by distance. Allow location access for precise walking and driving times."
        actions={
          <button type="button" onClick={locate} disabled={isDetectingLocation} className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-white ${userLocation ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
            <LocateFixed className={`w-4 h-4 ${isDetectingLocation ? 'animate-spin' : ''}`} />
            <span>{isDetectingLocation ? 'Locating…' : userLocation ? 'Refresh my location' : 'Use my location'}</span>
          </button>
        }
      />

      {userLocation && (
        <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-900 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Location locked at <code className="bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono font-bold">{userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}</code> — distances are measured from you.
            </span>
          </div>
          <span className="text-emerald-700 font-semibold text-[11px]">Accuracy ±{Math.round(userLocation.accuracy || 0)} m</span>
        </div>
      )}
      {locationError && !userLocation && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-2 text-xs text-amber-800" role="alert">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{locationError}</span>
        </div>
      )}

      <div data-tour="map"><ZoneMap zones={enriched} selectedZone={selectedZone} onSelect={(z) => setSelectedKey(z.zone)} userLocation={userLocation} directionsUrl={directionsUrl} /></div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by zone, facility or landmark…" aria-label="Search zones" className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${filter === f.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={SearchX} title="No zones match" message="Try clearing the search or choosing a different filter." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {visible.map((z) => {
            const selected = selectedKey === z.zone;
            const full = z.availableSlots === 0;
            const best = nearestOpen?.zone === z.zone;
            return (
              <div key={z.zone} onClick={() => setSelectedKey(z.zone)} className={`bg-white rounded-3xl p-6 border transition-all duration-200 shadow-sm flex flex-col justify-between cursor-pointer ${selected ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'}`}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-900 text-white">{z.zone}</span>
                      {best && <Badge tone="green" size="xs">Closest with free bays</Badge>}
                    </div>
                    {z.km != null && (
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-800 flex items-center justify-end gap-1">
                          {reference?.live && <Compass className="w-3 h-3 text-emerald-500" />}
                          {formatDistance(z.km)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {walkMinutes(z.km)} min walk · {driveMinutes(z.km)} min drive
                        </span>
                        {!reference?.live && <span className="text-[10px] text-slate-400 block">from campus centre</span>}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{z.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{z.address}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Availability</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className={`text-2xl font-bold font-mono ${full ? 'text-rose-600' : z.availableSlots <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>{z.availableSlots}</span>
                        <span className="text-xs text-slate-400 font-mono">/ {z.totalSlots} free</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Security</span>
                      <span className="text-xs font-semibold text-emerald-600 mt-0.5 block">{z.securityLevel}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Tag>{z.level}</Tag>
                    <Tag>{z.isCovered ? 'Covered' : 'Open air'}</Tag>
                    {z.evSlots > 0 && <Tag tone="green">⚡ {z.evSlots} EV</Tag>}
                    {z.accessibleSlots > 0 && <Tag tone="blue">♿ {z.accessibleSlots} accessible</Tag>}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                  <a href={directionsUrl(z)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Directions</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setBaysFor(z); }} className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 transition-colors">
                    <span>Bays</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={Boolean(baysFor)} onClose={() => setBaysFor(null)} title={baysFor ? `Bays in ${baysFor.name}` : ''}>
        {baysFor && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-800">{baysFor.zone}</span>
              <span className="text-slate-500">{baySlots.filter((s) => s.status === 'available').length} of {baySlots.length} open</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {baySlots.map((s) => {
                const avail = s.status === 'available';
                return (
                  <div key={s.id} className={`p-3 rounded-xl border flex flex-col justify-between gap-3 ${avail ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-slate-900 text-sm">{s.code}</span>
                      <Badge variant={s.status} size="xs" dot={false}>{s.occupiedBy?.isMine ? 'yours' : s.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{s.type}</span>
                      {avail && !isAdmin && (
                        <button type="button" onClick={() => { setBaysFor(null); navigate(`/qr-parking?code=${s.code}`); }} className="font-bold text-emerald-600 hover:text-emerald-700">
                          Park →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const Tag = ({ children, tone = 'slate' }) => (
  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{children}</span>
);
