import React, { useMemo, useState } from 'react';
import { Zap, CheckCircle2, Car, SearchX } from 'lucide-react';
import { SlotCard } from './SlotCard';
import { EmptyState } from '../common/Feedback';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'AVAILABLE', label: 'Available', icon: CheckCircle2, tone: 'emerald' },
  { id: 'OCCUPIED', label: 'Occupied', icon: Car, tone: 'rose' },
  { id: 'EV', label: 'EV only', icon: Zap, tone: 'emerald' }
];

export const SlotGrid = ({ slots, onSelectSlot, admin, initialZone = 'ALL' }) => {
  const [selectedZone, setSelectedZone] = useState(initialZone);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const zones = useMemo(() => ['ALL', ...Array.from(new Set(slots.map((s) => s.zone))).sort()], [slots]);

  const filtered = slots.filter((slot) => {
    if (selectedZone !== 'ALL' && slot.zone !== selectedZone) return false;
    if (statusFilter === 'AVAILABLE') return slot.status === 'available';
    if (statusFilter === 'OCCUPIED') return slot.status === 'occupied';
    if (statusFilter === 'EV') return slot.isEV;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {zones.map((zone) => (
            <button key={zone} onClick={() => setSelectedZone(zone)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedZone === zone ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              {zone === 'ALL' ? 'All zones' : zone}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const active = statusFilter === f.id;
            return (
              <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 whitespace-nowrap transition-colors ${active ? (f.tone === 'rose' ? 'bg-rose-50 border-rose-300 text-rose-800' : f.tone === 'emerald' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-slate-300 text-slate-800') : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {Icon && <Icon className={`w-3 h-3 ${f.tone === 'rose' ? 'text-rose-600' : 'text-emerald-600'}`} />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No bays match this filter" message="Try a different zone or status." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((slot) => (
            <SlotCard key={slot.id} slot={slot} onSelect={onSelectSlot} admin={admin} />
          ))}
        </div>
      )}
    </div>
  );
};
