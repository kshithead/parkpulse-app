import React from 'react';
import { Zap, Accessibility, QrCode, Car, Printer, Trash2, Wrench, Lock, Unlock, LogOut, UserCheck } from 'lucide-react';
import { Badge } from '../common/Badge';
import { formatTime } from '../../utils/format';

const BTN = 'flex-1 min-w-[5.5rem] py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1';

export const SlotCard = ({ slot, onSelect, admin }) => {
  const isAvailable = slot.status === 'available';
  const isOccupied = slot.status === 'occupied';
  const mine = slot.occupiedBy?.isMine;

  const handleKey = (e) => {
    if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect(slot);
    }
  };

  return (
    <div
      onClick={() => onSelect?.(slot)}
      onKeyDown={handleKey}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Bay ${slot.code}, ${slot.status}` : undefined}
      className={`group relative rounded-2xl p-4 transition-all duration-200 border bg-white ${
        mine ? 'border-emerald-400 ring-2 ring-emerald-400/30' : isAvailable ? 'border-emerald-200/90 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-500/10' : isOccupied ? 'border-rose-200/90 hover:border-rose-300' : 'border-slate-200 hover:border-slate-300'
      } ${onSelect ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-extrabold tracking-tight text-slate-900">{slot.code}</span>
          <Badge variant={slot.status} size="xs">
            {mine ? 'YOURS' : slot.status.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {slot.isEV && (
            <span title="EV charging" className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <Zap className="w-3.5 h-3.5" />
            </span>
          )}
          {slot.isAccessible && (
            <span title="Accessible bay" className="p-1 rounded-md bg-blue-50 text-blue-600">
              <Accessibility className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1 mb-3">
        <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>{slot.zone}</span>
          <span className="text-[11px] font-medium text-slate-500">{slot.type}</span>
        </div>
        <p className="text-[11px] text-slate-400 truncate">{slot.level}</p>
      </div>

      {isOccupied && slot.occupiedBy && (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-rose-50/70 border border-rose-100 text-[11px] space-y-0.5">
          {slot.occupiedBy.vehicleNumber ? (
            <>
              <div className="flex items-center gap-1 text-rose-800 font-mono font-bold">
                <Car className="w-3 h-3 text-rose-500" />
                {slot.occupiedBy.vehicleNumber}
              </div>
              <p className="text-rose-600/80 text-[10px] truncate">
                {slot.occupiedBy.driverName} · since {formatTime(slot.occupiedBy.startTime)}
              </p>
            </>
          ) : (
            <p className="text-rose-600/80 text-[10px]">Parked since {formatTime(slot.occupiedBy.startTime)}</p>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1 font-mono">
          <QrCode className={`w-3 h-3 ${isAvailable ? 'text-emerald-500' : 'text-slate-400'}`} />
          <span>{slot.qrPlacardId}</span>
        </div>
        {!admin && <span className="font-medium text-slate-500">{isAvailable ? 'Tap to park' : mine ? 'Your bay' : slot.status === 'occupied' ? 'In use' : slot.status === 'reserved' ? 'Reserved' : 'Closed'}</span>}
      </div>

      {admin && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1.5">
            {isAvailable && (
              <>
                <button onClick={() => admin.onSetStatus(slot, 'occupied')} className={`${BTN} bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100`}>
                  <UserCheck className="w-3 h-3" /> Mark occupied
                </button>
                <button onClick={() => admin.onSetStatus(slot, 'reserved')} className={`${BTN} bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100`}>
                  <Lock className="w-3 h-3" /> Reserve
                </button>
                <button onClick={() => admin.onSetStatus(slot, 'maintenance')} className={`${BTN} bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100`}>
                  <Wrench className="w-3 h-3" /> Maintenance
                </button>
              </>
            )}
            {isOccupied && (
              <button onClick={() => admin.onSetStatus(slot, 'available')} className={`${BTN} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`}>
                <LogOut className="w-3 h-3" /> Release vehicle
              </button>
            )}
            {(slot.status === 'reserved' || slot.status === 'maintenance') && (
              <button onClick={() => admin.onSetStatus(slot, 'available')} className={`${BTN} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`}>
                <Unlock className="w-3 h-3" /> Make available
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <button onClick={() => admin.onPlacard(slot)} className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
              <Printer className="w-3 h-3" /> QR placard
            </button>
            {!isOccupied && (
              <button onClick={() => admin.onDelete(slot)} className="text-slate-400 hover:text-rose-600 flex items-center gap-1" title="Decommission bay">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
