import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Clock, ArrowRight, LogOut, Settings, CheckCircle2, CircleHelp } from 'lucide-react';
import { useTour } from '../../context/TourContext';
import { useAuth } from '../../context/AuthContext';
import { useParking } from '../../context/ParkingContext';
import { useToast } from '../../context/ToastContext';
import { PlateBadge } from '../violations/PlateBadge';
import { Modal } from './Modal';
import { NotificationBell } from './NotificationBell';
import { ROUTE_META } from '../../pages/registry';
import { cleanPlateInput, normalizePlate } from '../../utils/format';

const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10';

export const Navbar = ({ onOpenSidebar }) => {
  const { currentUser, isAdmin, logout, updateProfile } = useAuth();
  const { activeSession, stats } = useParking();
  const toast = useToast();
  const { start: startTour } = useTour();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const startEdit = () => {
    setForm({
      name: currentUser.name || '',
      phone: currentUser.phone || '',
      vehicleNumber: currentUser.vehicleNumber || '',
      vehicleModel: currentUser.vehicleModel || ''
    });
    setIsEditing(true);
  };

  const closeProfile = () => {
    setIsProfileOpen(false);
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin && !normalizePlate(form.vehicleNumber)) {
      toast.error('Enter a valid registration plate, for example KA-03-HA-8820.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(isAdmin ? { name: form.name, phone: form.phone } : form);
      toast.success('Profile updated.');
      setIsEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    closeProfile();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onOpenSidebar} className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl lg:hidden transition-colors" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{ROUTE_META[pathname]?.title || 'ParkPulse'}</h2>
            <p className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${stats.availableSlots > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="font-mono">
                {stats.availableSlots} of {stats.totalSlots} bays free campus-wide
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {!isAdmin && activeSession && (
            <Link to="/qr-parking" className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-all text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-semibold font-mono">{activeSession.slotCode}</span>
              <span className="hidden md:inline text-emerald-700">Active session</span>
              <ArrowRight className="w-3 h-3 text-emerald-600" />
            </Link>
          )}

          <div data-tour="bell"><NotificationBell /></div>

          <button data-tour="help" onClick={startTour} className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors" title="Take the guided tour" aria-label="Take the guided tour">
            <CircleHelp className="w-[18px] h-[18px]" />
          </button>

          <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl hover:bg-slate-100 transition-colors text-left" aria-label="Open profile">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${isAdmin ? 'bg-indigo-600 ring-2 ring-indigo-500/20' : 'bg-slate-900 ring-2 ring-emerald-500/20'}`}>
              {currentUser?.name?.charAt(0)}
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-500">{isAdmin ? 'Security Officer' : 'Registered Driver'}</p>
            </div>
          </button>

          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Sign out" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <Modal isOpen={isProfileOpen} onClose={closeProfile} title={isAdmin ? 'Officer Profile' : 'Driver & Vehicle Profile'}>
        {!isEditing ? (
          <div className="space-y-4 text-xs text-slate-600">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-lg font-bold">{currentUser?.name?.charAt(0)}</div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">{currentUser?.name}</h4>
                <p className="text-slate-500 truncate">{currentUser?.email}</p>
                <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">{isAdmin ? 'Security & Enforcement' : 'Authorised Campus Driver'}</span>
              </div>
            </div>

            {isAdmin ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <Row label="Badge ID" value={<span className="font-mono font-bold text-slate-900">{currentUser?.badgeId}</span>} />
                <Row label="Department" value={currentUser?.department} />
                <Row label="Contact" value={<span className="font-mono">{currentUser?.phone || '—'}</span>} />
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <Row label="Licence plate" value={<PlateBadge plateNumber={currentUser?.vehicleNumber} size="sm" />} />
                <Row label="Vehicle" value={currentUser?.vehicleModel || '—'} />
                <Row label="Mobile" value={<span className="font-mono">{currentUser?.phone || '—'}</span>} />
                <Row label="Member since" value={new Date(currentUser?.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })} />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={startEdit} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <Settings className="w-3.5 h-3.5" />
                <span>{isAdmin ? 'Edit Contact Details' : 'Edit Vehicle Details'}</span>
              </button>
              <button type="button" onClick={handleLogout} className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3 text-xs">
            <Field label="Full name">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
            </Field>
            {!isAdmin && (
              <>
                <Field label="Vehicle licence plate">
                  <input className={`${inputCls} font-mono uppercase`} value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: cleanPlateInput(e.target.value) })} placeholder="KA-03-HA-8820" required />
                </Field>
                <Field label="Vehicle model">
                  <input className={inputCls} value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} placeholder="e.g. Hyundai Creta" />
                </Field>
              </>
            )}
            <Field label="Contact phone">
              <input className={inputCls} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
};

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-slate-800 text-right">{value}</span>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="block font-semibold text-slate-700 mb-1">{label}</span>
    {children}
  </label>
);
