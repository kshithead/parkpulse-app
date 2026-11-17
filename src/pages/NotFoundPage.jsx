import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/hooks';

export const NotFoundPage = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  useDocumentTitle('Page not found');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center mb-6">
          <Compass className="w-8 h-8" />
        </div>
        <p className="text-xs font-mono text-emerald-400 tracking-widest">ERROR 404</p>
        <h1 className="text-3xl font-extrabold text-white mt-2">This bay doesn't exist</h1>
        <p className="text-sm text-slate-400 mt-3">The page you're looking for was moved, or the link is wrong. Let's get you back on the road.</p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <button onClick={() => navigate(-1)} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-900 text-sm font-semibold flex items-center gap-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <Link to={isAuthenticated ? (isAdmin ? '/admin' : '/dashboard') : '/'} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-colors">
            {isAuthenticated ? 'Open dashboard' : 'Back to home'}
          </Link>
        </div>
      </div>
    </div>
  );
};
