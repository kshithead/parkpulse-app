import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Lock, Mail, User, Phone, ArrowRight, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PlateBadge } from '../components/violations/PlateBadge';
import { Logo, Spinner } from '../components/common/Feedback';
import { cleanPlateInput, normalizePlate } from '../utils/format';
import { useDocumentTitle } from '../hooks/hooks';

const field = 'w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors';

export const RegisterPage = () => {
  useDocumentTitle('Register');
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', vehicleNumber: '', vehicleModel: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: name === 'vehicleNumber' ? cleanPlateInput(e.target.value) : e.target.value }));

  const plate = normalizePlate(form.vehicleNumber);
  const plateTouched = form.vehicleNumber.length > 5;
  const rules = [
    { ok: form.password.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(form.password) && /\d/.test(form.password), text: 'A letter and a number' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!plate) {
      setError('Enter a valid registration plate, for example KA-03-HA-8820.');
      return;
    }
    if (!rules.every((r) => r.ok)) {
      setError('Please choose a stronger password.');
      return;
    }
    setBusy(true);
    try {
      await register({ ...form, vehicleNumber: plate });
      toast.success('Account created. Welcome to ParkPulse!');
      // <GuestRoute> forwards the now-signed-in user to their dashboard.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg relative z-10 px-4 page-enter">
        <div className="flex justify-center mb-6">
          <Logo size="lg" subtitle="Vehicle Registration" />
        </div>

        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-800">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-white">Register for campus parking</h1>
            <p className="text-xs text-slate-400 mt-1">Link your vehicle to check in with a single scan</p>
          </div>

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Labeled label="Full name">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input type="text" autoComplete="name" value={form.name} onChange={set('name')} placeholder="Your full name" className={field} required minLength={2} maxLength={60} />
            </Labeled>

            <Labeled label="Campus email">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@campus.edu" className={field} required />
            </Labeled>

            <Labeled label="Mobile number">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" className={field} />
            </Labeled>

            <div>
              <div className="flex items-center justify-between mb-1.5 min-h-[24px]">
                <label className="block text-xs font-semibold text-slate-300">Vehicle licence plate</label>
                {plate ? <PlateBadge plateNumber={plate} size="sm" /> : plateTouched ? <span className="text-[11px] text-amber-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Format: KA-03-HA-8820</span> : null}
              </div>
              <div className="relative">
                <Car className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input type="text" value={form.vehicleNumber} onChange={set('vehicleNumber')} placeholder="e.g. MH-12-AB-1234" className={`${field} font-mono tracking-wider uppercase`} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Vehicle make / model</label>
              <input type="text" value={form.vehicleModel} onChange={set('vehicleModel')} placeholder="e.g. Honda City" maxLength={60} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="Create a password" className={`${field} pr-11`} required />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  {rules.map((r) => (
                    <li key={r.text} className={`flex items-center gap-1 ${r.ok ? 'text-emerald-400' : 'text-slate-500'}`}>
                      <CheckCircle2 className="w-3 h-3" /> {r.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-70 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              {busy ? <Spinner /> : null}
              <span>{busy ? 'Creating account…' : 'Create account'}</span>
              {!busy && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already registered?{' '}
            <Link to="/login" className="text-emerald-400 hover:underline font-semibold">
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const Labeled = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-300 mb-1.5">{label}</label>
    <div className="relative">{children}</div>
  </div>
);
