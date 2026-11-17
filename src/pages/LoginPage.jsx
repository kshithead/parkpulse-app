import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Car, Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo, Spinner } from '../components/common/Feedback';
import { api } from '../services/api';
import { useDocumentTitle } from '../hooks/hooks';

export const LoginPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const portal = searchParams.get('portal') === 'admin' ? 'admin' : 'user';
  const isAdminPortal = portal === 'admin';
  useDocumentTitle(isAdminPortal ? 'Officer sign in' : 'Driver sign in');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [demo, setDemo] = useState(null);
  const [storage, setStorage] = useState(null);

  const { login } = useAuth();

  // Offer one-click demo credentials only when the server is running the demo dataset.
  useEffect(() => {
    api
      .health()
      .then((h) => {
        setStorage(h.storage);
        if (h.demoMode) setDemo(h.demoAccounts);
      })
      .catch(() => {});
  }, []);

  const switchPortal = (next) => {
    setSearchParams(next === 'admin' ? { portal: 'admin' } : {}, { replace: true });
    setError('');
  };

  const fillDemo = () => {
    const acct = demo?.[isAdminPortal ? 'admin' : 'driver'];
    if (acct) {
      setEmail(acct.email);
      setPassword(acct.password);
      setError('');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // On success, <GuestRoute> redirects to the page the user was originally headed to.
      await login(email, password, portal);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const accent = isAdminPortal ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20';
  const input = 'w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none transition-colors';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 page-enter">
        <div className="flex justify-center mb-6">
          <Logo size="lg" subtitle="Smart Parking Management" />
        </div>

        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-800">
          <div role="tablist" aria-label="Sign-in portal" className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 mb-6">
            <button type="button" role="tab" aria-selected={!isAdminPortal} onClick={() => switchPortal('user')} className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${!isAdminPortal ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}>
              <Car className="w-4 h-4" />
              <span>Driver Portal</span>
            </button>
            <button type="button" role="tab" aria-selected={isAdminPortal} onClick={() => switchPortal('admin')} className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${isAdminPortal ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
              <ShieldCheck className="w-4 h-4" />
              <span>Security Officer</span>
            </button>
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-lg font-bold text-white">{isAdminPortal ? 'Security & Operations Sign-In' : 'Welcome back'}</h1>
            <p className="text-xs text-slate-400 mt-1">{isAdminPortal ? 'Access the parking control & enforcement console' : 'Sign in to check in, view free bays and track your sessions'}</p>
          </div>

          {storage === 'ephemeral' && (
            <div role="status" className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              This server has no shared database configured, so sign-ins may drop between requests. The administrator needs to connect Redis (see README).
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate={false}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isAdminPortal ? 'Officer email' : 'Campus email'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isAdminPortal ? 'officer@campus.edu' : 'you@campus.edu'} className={`${input} focus:border-emerald-500`} required />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className={`${input} pr-11 focus:border-emerald-500`} required />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-3 text-slate-500 hover:text-slate-300" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 ${accent}`}>
              {isLoading ? <Spinner /> : null}
              <span>{isLoading ? 'Signing in…' : `Enter ${isAdminPortal ? 'Operations Center' : 'Driver Portal'}`}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {demo && (
            <button type="button" onClick={fillDemo} className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-xs font-semibold text-slate-400 hover:text-emerald-300 transition-colors flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              Fill demo {isAdminPortal ? 'officer' : 'driver'} credentials
            </button>
          )}

          {!isAdminPortal && (
            <div className="mt-6 text-center text-xs text-slate-400">
              New to campus parking?{' '}
              <Link to="/register" className="text-emerald-400 hover:underline font-semibold">
                Register your vehicle
              </Link>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          <Link to="/" className="hover:text-slate-300 transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  );
};
