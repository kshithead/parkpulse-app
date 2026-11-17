import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QrCode, ShieldAlert, MapPin, ArrowRight, Layers, Clock, Smartphone, ShieldCheck, Bell, Camera } from 'lucide-react';
import { Logo } from '../components/common/Feedback';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useDocumentTitle } from '../hooks/hooks';

function usePublicOverview() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .overview()
        .then((d) => alive && (setData(d), setFailed(false)))
        .catch(() => alive && setFailed(true));
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return { data, failed };
}

const FEATURES = [
  { icon: QrCode, tone: 'blue', title: 'Scan-to-park QR placards', text: 'Every bay carries a QR placard. Scan it with the in-app camera and the bay is yours — no tickets, no gates, no hardware sensors.' },
  { icon: Clock, tone: 'emerald', title: 'Digital check-out', text: 'Tap End Parking when you leave. Your session length is recorded and the bay returns to the pool instantly for the next driver.' },
  { icon: ShieldAlert, tone: 'rose', title: 'Community enforcement', text: 'Report blocked exits, double parking or misused reserved bays with a photo. Officers verify, issue notices, and you see every status change.' },
  { icon: MapPin, tone: 'amber', title: 'Live campus map', text: 'See which zones have free bays right now, sorted by how far they are from you, with one-tap directions.' },
  { icon: Layers, tone: 'indigo', title: 'Officer operations console', text: 'Live occupancy, usage analytics, bay overrides, session control, printable QR placards and a full audit trail.' },
  { icon: Bell, tone: 'teal', title: 'Real-time everywhere', text: 'Changes made on one device appear on every other within a second — a driver checks in, the officer console updates.' }
];

const TONES = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20'
};

export const LandingPage = () => {
  useDocumentTitle(null);
  const { isAuthenticated, isAdmin } = useAuth();
  const { data, failed } = usePublicOverview();
  const home = isAdmin ? '/admin' : '/dashboard';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <Logo subtitle="Campus Smart Parking" />
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link to={home} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-1.5">
                <span>Open {isAdmin ? 'Operations Center' : 'Dashboard'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login?portal=admin" className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Officer Login</span>
                </Link>
                <Link to="/login" className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-1.5">
                  <span>Driver Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative pt-16 sm:pt-24 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="text-center max-w-3xl mx-auto space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hardware-free smart parking</span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">Real-time availability</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Find a bay. <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">Scan. Park.</span> Keep campus clear.
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            ParkPulse ends the circling for a free spot. Drivers check in by scanning a QR placard, everyone sees live availability, and the community reports violations straight to campus security.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to={isAuthenticated ? home : '/register'} className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 group">
              <span>{isAuthenticated ? 'Go to my workspace' : 'Register your vehicle'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            {!isAuthenticated && (
              <Link to="/login?portal=admin" className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm border border-slate-700 transition-all flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Campus Security Login</span>
              </Link>
            )}
          </div>
        </div>

        {/* Live campus snapshot straight from the server */}
        <div className="mt-16 bg-slate-900/90 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${failed ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">{failed ? 'Server unreachable' : 'Live campus snapshot'}</span>
              </div>
              <h3 className="text-xl font-bold text-white mt-1">Availability across the campus right now</h3>
            </div>
            {data && (
              <div className="flex items-center gap-6 text-xs font-mono text-slate-400">
                <Stat label="Free" value={data.availableSlots} tone="text-emerald-400" />
                <Stat label="Occupied" value={data.occupiedSlots} tone="text-rose-400" />
                <Stat label="Total bays" value={data.totalSlots} tone="text-white" />
              </div>
            )}
          </div>

          {!data ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-800/60 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6">
              {data.zones.map((z) => {
                const pct = z.totalSlots ? Math.round(((z.totalSlots - z.availableSlots) / z.totalSlots) * 100) : 0;
                const full = z.availableSlots === 0;
                return (
                  <div key={z.zone} className={`p-4 rounded-2xl border ${full ? 'bg-rose-950/30 border-rose-500/30' : 'bg-emerald-950/20 border-emerald-500/30'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white">{z.zone}</span>
                      <span className={`text-[10px] font-mono ${full ? 'text-rose-300' : 'text-emerald-300'}`}>{full ? 'FULL' : 'OPEN'}</span>
                    </div>
                    <p className="mt-2 text-2xl font-extrabold font-mono text-white">
                      {z.availableSlots}
                      <span className="text-xs font-normal text-slate-400"> / {z.totalSlots} free</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{z.name}</p>
                    <div className="h-1.5 rounded-full bg-slate-800 mt-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${pct > 85 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-slate-900/60 border-t border-slate-800/80 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">How it works</span>
            <h2 className="text-3xl font-extrabold text-white">One platform for drivers and campus security</h2>
            <p className="text-sm text-slate-400">Software-first and free to use: no payment gates, no fines, no sensors to maintain.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition-colors">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${TONES[f.tone]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{f.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 grid sm:grid-cols-3 gap-4 text-center">
            {[
              { n: '1', t: 'Arrive & scan', d: 'Open Scan & Park and point the camera at the bay placard.', icon: Camera },
              { n: '2', t: 'Park with a live timer', d: 'The bay locks to your vehicle and your session starts counting.', icon: Clock },
              { n: '3', t: 'Tap to leave', d: 'End parking from your phone; the bay is released for everyone.', icon: ArrowRight }
            ].map((s) => (
              <div key={s.n} className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="w-8 h-8 mx-auto rounded-full bg-emerald-500 text-slate-950 text-sm font-extrabold flex items-center justify-center">{s.n}</div>
                <p className="text-sm font-bold text-white mt-3">{s.t}</p>
                <p className="text-xs text-slate-400 mt-1">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800/80 py-10 px-4 sm:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">ParkPulse</span>
            <span>– Cloud-based smart parking &amp; violation reporting</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/login" className="hover:text-white transition-colors">Driver login</Link>
            <Link to="/login?portal=admin" className="hover:text-white transition-colors">Security login</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register vehicle</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Stat = ({ label, value, tone }) => (
  <div className="text-right">
    <p className={`text-xl font-extrabold ${tone}`}>{value}</p>
    <p className="text-[10px] uppercase tracking-wider">{label}</p>
  </div>
);
