import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, session } from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState(null);
  // 'loading' while we validate a stored token, so guards don't flash the login page on refresh.
  const [status, setStatus] = useState(session.token ? 'loading' : 'ready');

  const clear = useCallback(() => {
    session.set(null);
    setCurrentUser(null);
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!session.token) return;
    let cancelled = false;
    api
      .me()
      .then(({ user }) => !cancelled && setCurrentUser(user))
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401 || err.status === 403) clear();
        else toast.error(err.message);
      })
      .finally(() => !cancelled && setStatus('ready'));
    return () => {
      cancelled = true;
    };
  }, [clear, toast]);

  // Any 401 from the API means the token expired (or the server was reset).
  useEffect(() => {
    session.onUnauthorized(() => {
      clear();
      toast.info('Your session has ended. Please sign in again.');
    });
    return () => session.onUnauthorized(null);
  }, [clear, toast]);

  const login = useCallback(async (email, password, portal) => {
    const { token, user } = await api.login({ email, password, portal });
    session.set(token);
    setCurrentUser(user);
    return user;
  }, []);

  const register = useCallback(async (form) => {
    const { token, user } = await api.register(form);
    session.set(token);
    setCurrentUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* token may already be invalid */
    }
    clear();
  }, [clear]);

  const updateProfile = useCallback(async (fields) => {
    const { user } = await api.updateMe(fields);
    setCurrentUser(user);
    return user;
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      status,
      isAuthenticated: !!currentUser,
      isAdmin: currentUser?.role === 'admin',
      isDriver: currentUser?.role === 'user',
      login,
      register,
      logout,
      updateProfile
    }),
    [currentUser, status, login, register, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
