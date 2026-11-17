import React from 'react';
import { Link } from 'react-router-dom';
import { Car, Loader2, WifiOff } from 'lucide-react';

export const Logo = ({ size = 'md', subtitle, to = '/', onClick }) => {
  const box = size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-xl';
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 group focus:outline-none">
      <div className={`${box} bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform`}>
        <Car className="w-5 h-5 text-slate-950 stroke-[2.5]" />
      </div>
      <div>
        <span className={`${size === 'lg' ? 'text-2xl' : 'text-xl'} font-extrabold tracking-tight text-white block leading-none`}>
          Park<span className="text-emerald-400">Pulse</span>
        </span>
        {subtitle && <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase mt-1">{subtitle}</p>}
      </div>
    </Link>
  );
};

export const Spinner = ({ className = 'w-4 h-4' }) => <Loader2 className={`animate-spin ${className}`} />;

/** Full-page loader used while the session is restored. */
export const FullPageLoader = ({ label = 'Loading ParkPulse…' }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/25 animate-pulse">
      <Car className="w-6 h-6 text-slate-950 stroke-[2.5]" />
    </div>
    <p className="text-xs font-mono tracking-wider">{label}</p>
  </div>
);

const Bar = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;

/** Skeleton shown inside the layout while a lazy page chunk or the first snapshot loads. */
export const PageSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading page">
    <Bar className="h-28 rounded-3xl" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <Bar key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
    <Bar className="h-64 rounded-3xl" />
  </div>
);

export const EmptyState = ({ icon: Icon, title, message, action }) => (
  <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-300">
    {Icon && (
      <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6" />
      </div>
    )}
    <p className="text-sm font-bold text-slate-700">{title}</p>
    {message && <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="bg-white rounded-3xl p-10 text-center border border-rose-200">
    <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
      <WifiOff className="w-6 h-6" />
    </div>
    <p className="text-sm font-bold text-slate-800">We couldn't load live parking data</p>
    <p className="text-xs text-slate-500 mt-1">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
        Try again
      </button>
    )}
  </div>
);

/** Page header card used on every in-app page for a consistent look. */
export const PageHeader = ({ eyebrow, eyebrowTone = 'text-emerald-600', title, subtitle, actions }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <span className={`text-xs font-bold uppercase tracking-wider font-mono ${eyebrowTone}`}>{eyebrow}</span>}
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
