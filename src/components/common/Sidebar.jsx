import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, QrCode, MapPin, AlertTriangle, ShieldAlert, Server, LogOut, Printer, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useParking } from '../../context/ParkingContext';
import { Logo } from './Feedback';
import { preloadRoute } from '../../pages/registry';
import { timeAgo } from '../../utils/format';

const CONNECTION = {
  live: { label: 'LIVE', dot: 'bg-emerald-400', text: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  polling: { label: 'LIVE · 3s', dot: 'bg-emerald-400', text: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  connecting: { label: 'CONNECTING', dot: 'bg-amber-400', text: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  reconnecting: { label: 'RECONNECTING', dot: 'bg-amber-400', text: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  offline: { label: 'OFFLINE', dot: 'bg-rose-500', text: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }
};

export const Sidebar = ({ isOpen, onClose }) => {
  const { currentUser, isAdmin, logout } = useAuth();
  const { stats, activeSession, connection } = useParking();
  const navigate = useNavigate();

  const driverNav = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: activeSession ? 'Parked' : null, badgeColor: 'bg-emerald-500/20 text-emerald-400' },
    { to: '/qr-parking', label: 'Scan & Park', icon: QrCode },
    { to: '/nearby', label: 'Campus Map', icon: MapPin, badge: stats.zoneCount ? `${stats.zoneCount} zones` : null, badgeColor: 'bg-slate-800 text-slate-400' },
    { to: '/report-violation', label: 'Report Violation', icon: AlertTriangle }
  ];

  const adminNav = [
    { to: '/admin', label: 'Operations Center', icon: ShieldAlert, badge: stats.openViolations > 0 ? `${stats.openViolations} open` : null, badgeColor: 'bg-rose-500 text-white' },
    { to: '/nearby', label: 'Campus Map', icon: MapPin },
    { to: '/admin/placards', label: 'QR Placards', icon: Printer },
    { to: '/report-violation', label: 'Patrol Reports', icon: AlertTriangle }
  ];

  const nav = isAdmin ? adminNav : driverNav;
  const conn = CONNECTION[connection.status] || CONNECTION.connecting;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden backdrop-enter print:hidden" />}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-[#0A0F1D] text-slate-300 flex flex-col border-r border-slate-800/80 transition-transform duration-300 ease-out lg:translate-x-0 print:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-slate-800/60">
          <Logo onClick={onClose} subtitle={isAdmin ? 'Security Console' : 'Smart Campus Parking'} />
        </div>

        <div className="px-4 py-3 mx-4 mt-4 rounded-xl bg-slate-900/90 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 ${isAdmin ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
              {currentUser?.name?.charAt(0) || '?'}
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
              <p className="text-[11px] text-slate-400 truncate font-mono">
                {isAdmin ? currentUser?.badgeId || 'Security Officer' : currentUser?.vehicleNumber}
              </p>
            </div>
          </div>
        </div>

        <nav data-tour="nav" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{isAdmin ? 'Security Management' : 'Driver Navigation'}</div>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                onClick={onClose}
                onMouseEnter={() => preloadRoute(item.to)}
                onFocus={() => preloadRoute(item.to)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${item.badgeColor}`}>{item.badge}</span>}
              </NavLink>
            );
          })}

          <div className="pt-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Public</div>
          <NavLink to="/" onClick={onClose} className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors">
            <ExternalLink className="w-4 h-4" />
            <span>Landing Page</span>
          </NavLink>
        </nav>

        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                Cloud Sync
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${conn.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${conn.dot} ${connection.status === 'live' || connection.status === 'polling' ? 'animate-pulse' : ''}`} />
                {conn.label}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
              <span>{stats.totalSlots} bays tracked</span>
              <span>{connection.latencyMs != null ? `${connection.latencyMs} ms` : '—'}</span>
            </div>
            {connection.lastSync && <p className="text-[10px] text-slate-500 font-mono">Synced {timeAgo(connection.lastSync)}</p>}
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
