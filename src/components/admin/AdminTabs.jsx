import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ShieldAlert, MapPin, Plus, Pencil, ExternalLink, Download, Search, Server, Zap, Accessibility, SearchX, Timer } from 'lucide-react';
import { useParking } from '../../context/ParkingContext';
import { useNow, useDebounced } from '../../hooks/hooks';
import { api } from '../../services/api';
import { ColumnChart, MeterList } from './Charts';
import { SlotGrid } from '../parking/SlotGrid';
import { ViolationCard } from '../violations/ViolationCard';
import { PlateBadge } from '../violations/PlateBadge';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/Feedback';
import { formatDuration, formatTime, formatDateTime, minutesSince, statusLabel, timeAgo } from '../../utils/format';

const LONG_STAY_MIN = 240;

// ---------------------------------------------------------------------------
export const OverviewTab = ({ analytics, onNavigate, onRelease }) => {
  const { stats, sessions, violations, zones } = useParking();
  const now = useNow(30000);
  const active = sessions.filter((s) => s.status === 'active');
  const open = violations.filter((v) => v.status === 'pending' || v.status === 'investigating');
  const [logs, setLogs] = useState([]);
  const { rev } = useParking();

  useEffect(() => {
    api.logs(6).then(setLogs).catch(() => {});
  }, [rev]);

  const seg = [
    { label: 'Available', n: stats.availableSlots, color: 'bg-emerald-500' },
    { label: 'Occupied', n: stats.occupiedSlots, color: 'bg-rose-500' },
    { label: 'Reserved', n: stats.reservedSlots, color: 'bg-purple-500' },
    { label: 'Maintenance', n: stats.maintenanceSlots, color: 'bg-amber-500' }
  ];

  const k = analytics?.kpis;
  const tiles = k
    ? [
        ['Sessions · 7 days', k.sessions7d],
        ['Avg. stay', formatDuration(k.avgDurationMin)],
        [`Peak hour · ${k.peakOccupied || 0} bays`, k.peakHour ? new Date(k.peakHour).toLocaleTimeString([], { hour: 'numeric' }) : '—'],
        ['Avg. first response', k.avgResponseMin != null ? formatDuration(k.avgResponseMin) : '—'],
        ['Case closure rate', k.closureRate != null ? `${k.closureRate}%` : '—'],
        ['Registered drivers', k.registeredDrivers]
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Facility occupancy</h3>
            <p className="text-xs text-slate-500">Live breakdown of all {stats.totalSlots} bays</p>
          </div>
          <span className="font-mono text-sm font-bold text-slate-800">{stats.occupancyPercentage}% occupied</span>
        </div>
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex gap-[2px]">
          {seg.map((s) => (
            <div key={s.label} style={{ width: `${stats.totalSlots ? (s.n / stats.totalSlots) * 100 : 0}%` }} className={`${s.color} transition-all duration-500`} title={`${s.label}: ${s.n}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
          {seg.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-full ${s.color}`} />
              <span>{s.label} ({s.n})</span>
            </div>
          ))}
        </div>
      </div>

      {k && (
        <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6 gap-3">
          {tiles.map(([label, value]) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-slate-200/80">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{label}</p>
              <p className="text-lg font-extrabold font-mono text-slate-900 mt-1 truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <ColumnChart
              title="Bay occupancy · last 24 hours"
              subtitle="Vehicles parked during each hour"
              unit="vehicles"
              labelEvery={3}
              emphasisIndex={analytics.hourly.reduce((best, h, i, arr) => (h.occupied > arr[best].occupied ? i : best), 0)}
              data={analytics.hourly.map((h) => {
                const d = new Date(h.hour);
                return { key: h.hour, label: d.toLocaleTimeString([], { hour: 'numeric' }).replace(' ', '').toLowerCase(), tooltip: d.toLocaleString([], { weekday: 'short', hour: 'numeric' }), value: h.occupied };
              })}
            />
          </div>
          <ColumnChart
            title="Check-ins · last 7 days"
            subtitle="Sessions started per day"
            unit="sessions"
            height={150}
            emphasisIndex={6}
            data={analytics.daily.map((d) => ({ key: d.date, label: new Date(d.date).toLocaleDateString([], { weekday: 'short' }), tooltip: new Date(d.date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }), value: d.sessions }))}
          />
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MeterList
            title="Zone utilisation right now"
            subtitle="Occupied bays out of capacity"
            rows={analytics.byZone.map((z) => ({ key: z.zone, label: `${z.zone} · ${z.name}`, value: z.occupied, max: z.totalSlots, display: `${z.occupied}/${z.totalSlots}`, sub: `${z.sessions7d} sessions in the last 7 days` }))}
          />
          <MeterList
            title="Violation reports by category"
            subtitle="All reports on record"
            emptyText="No violations reported yet."
            rows={[...analytics.byCategory].sort((a, b) => b.count - a.count).map((c) => ({ key: c.category, label: c.category, value: c.count, max: Math.max(...analytics.byCategory.map((x) => x.count)) }))}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" /> Live parking sessions ({active.length})
            </h3>
            <button onClick={() => onNavigate('sessions')} className="text-xs text-emerald-600 font-semibold hover:underline">Manage all</button>
          </div>
          {active.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No vehicles are parked right now.</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {active.map((s) => (
                <div key={s.sessionId} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-sm text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200">{s.slotCode}</span>
                    <div className="min-w-0">
                      <PlateBadge plateNumber={s.vehicleNumber} size="sm" />
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{s.driverName} · {formatDuration(minutesSince(s.startTime, now))}</p>
                    </div>
                  </div>
                  <button onClick={() => onRelease(s)} className="py-1 px-2.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors shrink-0">Release</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" /> Violations awaiting action ({open.length})
            </h3>
            <button onClick={() => onNavigate('violations')} className="text-xs text-rose-600 font-semibold hover:underline">Open registry</button>
          </div>
          {open.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No open cases. Nice work.</p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {open.map((v) => (
                <button key={v.id} onClick={() => onNavigate('violations')} className="w-full text-left p-3 rounded-2xl bg-rose-50/60 border border-rose-100 hover:border-rose-300 transition-colors flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800">{v.id}</span>
                      <span className="font-semibold text-rose-700 truncate">{v.category}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate">{v.zone} · {v.vehicleNumber} · {timeAgo(v.timestamp, now)}</p>
                  </div>
                  <Badge variant={v.status} size="xs">{statusLabel(v.status)}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono"><Server className="w-4 h-4 text-emerald-400" /> Recent activity</h3>
          <button onClick={() => onNavigate('audit')} className="text-xs text-emerald-400 font-semibold hover:underline">Full audit trail</button>
        </div>
        <ul className="divide-y divide-slate-800/80 font-mono text-[11px]">
          {logs.map((l) => (
            <li key={l.id} className="py-2 flex gap-3">
              <span className="text-slate-500 shrink-0">{new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-slate-300 truncate">{l.message}</span>
            </li>
          ))}
          {logs.length === 0 && <li className="py-3 text-slate-500">No activity yet.</li>}
        </ul>
      </div>
      <p className="sr-only">{zones.length} zones monitored</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
export const SlotsTab = ({ onSetStatus, onPlacard, onDelete }) => {
  const { slots } = useParking();
  return <SlotGrid slots={slots} admin={{ onSetStatus, onPlacard, onDelete }} />;
};

// ---------------------------------------------------------------------------
export const ZonesTab = ({ onAdd, onEdit }) => {
  const { zones } = useParking();
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 font-mono">Campus infrastructure</span>
          <h3 className="text-lg font-bold text-slate-900 mt-1">Parking zones & hubs</h3>
          <p className="text-xs text-slate-500">Add new facilities with GPS coordinates; bays and QR identifiers are generated automatically.</p>
        </div>
        <button onClick={onAdd} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto active:scale-95">
          <Plus className="w-4 h-4" /> Add parking hub
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {zones.map((z) => (
          <div key={z.zone} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-900 text-white">{z.zone}</span>
                <button onClick={() => onEdit(z)} className="text-slate-400 hover:text-indigo-600 p-2.5 -m-1.5 rounded-lg hover:bg-indigo-50 transition-colors" aria-label={`Edit ${z.name}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">{z.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{z.address}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-emerald-600" /> GPS</span>
                <span className="font-bold text-slate-800">{z.lat.toFixed(5)}, {z.lng.toFixed(5)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{z.level}</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{z.isCovered ? 'Covered' : 'Open air'}</span>
                {z.evSlots > 0 && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 flex items-center gap-1"><Zap className="w-3 h-3" />{z.evSlots} EV</span>}
                {z.accessibleSlots > 0 && <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 flex items-center gap-1"><Accessibility className="w-3 h-3" />{z.accessibleSlots}</span>}
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">{z.securityLevel}</span>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                <strong className="text-emerald-600 font-mono font-bold text-sm">{z.availableSlots}</strong> of {z.totalSlots} bays open
              </span>
              <div className="flex items-center gap-3 text-xs font-bold">
                <Link to={`/admin/placards?zone=${encodeURIComponent(z.zone)}`} className="text-slate-600 hover:text-slate-900 py-3 -my-3 px-1">Placards</Link>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${z.lat},${z.lng}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 py-3 -my-3 px-1">
                  Route <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
export const SessionsTab = ({ onRelease }) => {
  const { sessions } = useParking();
  const now = useNow(30000);
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim().toLowerCase(), 200);
  const [filter, setFilter] = useState('active');
  const [limit, setLimit] = useState(25);

  const rows = useMemo(
    () =>
      sessions.filter((s) => {
        if (filter === 'active' && s.status !== 'active') return false;
        if (filter === 'completed' && s.status !== 'completed') return false;
        return !q || `${s.vehicleNumber} ${s.driverName} ${s.slotCode} ${s.zone}`.toLowerCase().includes(q);
      }),
    [sessions, filter, q]
  );

  const exportCsv = () => {
    const head = ['Session', 'Bay', 'Zone', 'Plate', 'Driver', 'Start', 'End', 'Minutes', 'Status', 'Ended by'];
    const body = rows.map((s) => [s.sessionId, s.slotCode, s.zone, s.vehicleNumber, s.driverName, s.startTime, s.endTime || '', s.durationMin ?? minutesSince(s.startTime), s.status, s.endedBy || '']);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `parkpulse-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">Parking sessions</h3>
          <p className="text-xs text-slate-500">Live sessions with officer release, plus the recent history (last {sessions.length} records).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Plate, driver or bay…" aria-label="Search sessions" className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-full sm:w-48 focus:outline-none focus:border-emerald-500" />
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1">
            {['active', 'completed', 'all'].map((f) => (
              <button key={f} onClick={() => { setFilter(f); setLimit(25); }} className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{f}</button>
            ))}
          </div>
          <button onClick={exportCsv} disabled={!rows.length} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No sessions found" message="Nothing matches this filter yet." />
      ) : (
        <>
          {/* Phones: one card per session */}
          <ul className="md:hidden space-y-3">
            {rows.slice(0, limit).map((s) => {
              const active = s.status === 'active';
              const mins = active ? minutesSince(s.startTime, now) : s.durationMin;
              const long = active && mins >= LONG_STAY_MIN;
              return (
                <li key={s.sessionId} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-slate-900 text-base">{s.slotCode}</span>
                      <span className="text-[11px] text-slate-400">{s.zone}</span>
                    </div>
                    <Badge tone={active ? 'green' : 'slate'} size="xs">{active ? 'Active' : s.endedBy === 'admin' ? 'Released' : 'Completed'}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <PlateBadge plateNumber={s.vehicleNumber} size="sm" />
                    <span className="text-xs font-medium text-slate-700 truncate">{s.driverName}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{formatDateTime(s.startTime)}</span>
                    <span className="font-bold text-slate-800">{formatDuration(mins)}</span>
                  </div>
                  {long && <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-center gap-1"><Timer className="w-3 h-3" /> Long stay — over 4 hours</p>}
                  {active && <button onClick={() => onRelease(s)} className="w-full py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors">Release bay</button>}
                </li>
              );
            })}
          </ul>

          {/* Tablet / desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Bay</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Checked in</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, limit).map((s) => {
                  const active = s.status === 'active';
                  const mins = active ? minutesSince(s.startTime, now) : s.durationMin;
                  const long = active && mins >= LONG_STAY_MIN;
                  return (
                    <tr key={s.sessionId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4"><span className="font-mono font-bold text-slate-900">{s.slotCode}</span> <span className="text-slate-400">{s.zone.replace('Zone ', '')}</span></td>
                      <td className="py-3 px-4"><PlateBadge plateNumber={s.vehicleNumber} size="sm" /></td>
                      <td className="py-3 px-4 font-medium text-slate-800">{s.driverName}</td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{formatDateTime(s.startTime)}</td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        {formatDuration(mins)}
                        {long && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5"><Timer className="w-3 h-3" />Long stay</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={active ? 'green' : 'slate'} size="xs">{active ? 'Active' : s.endedBy === 'admin' ? 'Released by officer' : 'Completed'}</Badge>
                        {!active && <span className="text-slate-400 ml-1.5 text-[10px]">{formatTime(s.endTime)}</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {active && (
                          <button onClick={() => onRelease(s)} className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors">Release bay</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <button onClick={() => setLimit((l) => l + 25)} className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors">
              Show more ({rows.length - limit} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
export const ViolationsTab = () => {
  const { violations, updateViolationStatus } = useParking();
  const [filter, setFilter] = useState('open');
  const shown = violations.filter((v) => (filter === 'ALL' ? true : filter === 'open' ? v.status === 'pending' || v.status === 'investigating' : v.status === filter));
  const filters = [['open', 'Needs action'], ['ALL', 'All'], ['warning_issued', 'Notice issued'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Violation adjudication</h3>
          <p className="text-xs text-slate-500">Verify reports, issue notices and close cases. Reporters and vehicle owners are notified automatically.</p>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {filters.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filter === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Nothing here" message={filter === 'open' ? 'There are no cases waiting for action.' : 'No cases with this status.'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {shown.map((v) => <ViolationCard key={v.id} violation={v} isAdmin onStatusUpdate={updateViolationStatus} />)}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
const LEVEL = {
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
};

export const AuditTab = () => {
  const { rev, connection } = useParking();
  const [logs, setLogs] = useState(null);
  const [level, setLevel] = useState('ALL');
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim().toLowerCase(), 200);

  useEffect(() => {
    api.logs(300).then(setLogs).catch(() => setLogs([]));
  }, [rev]);

  const shown = (logs || []).filter((l) => (level === 'ALL' || l.level === level) && (!q || `${l.message} ${l.source} ${l.actor}`.toLowerCase().includes(q)));

  return (
    <div className="bg-slate-950 text-slate-200 rounded-3xl p-4 sm:p-8 border border-slate-800 shadow-xl space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-white font-mono">System audit trail</h3>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase">{connection.status}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter events…" aria-label="Filter audit events" className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-44" />
          {['ALL', 'info', 'success', 'warning'].map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`px-2.5 py-1 rounded-lg text-[11px] font-mono uppercase transition-colors ${level === l ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 font-mono text-xs max-h-[560px] overflow-y-auto">
        {logs === null ? (
          <p className="text-slate-500 py-6 text-center">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-slate-500 py-6 text-center">No events match.</p>
        ) : (
          shown.map((l) => (
            <div key={l.id} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex flex-wrap items-start gap-x-3 gap-y-1 hover:border-slate-700 transition-colors">
              <span className="text-slate-500 shrink-0">{formatDateTime(l.at)}</span>
              <span className={`px-1.5 rounded text-[10px] uppercase font-bold shrink-0 border ${LEVEL[l.level] || LEVEL.info}`}>{l.level}</span>
              <span className="text-slate-400 shrink-0 font-bold">{l.source}</span>
              <span className="text-slate-200 flex-1 min-w-[12rem]">{l.message}</span>
              <span className="text-slate-500 shrink-0">{l.actor}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
