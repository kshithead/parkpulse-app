import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, session } from '../services/api';
import { useAuth } from './AuthContext';

const ParkingContext = createContext(null);

const EMPTY_STATS = {
  totalSlots: 0,
  availableSlots: 0,
  occupiedSlots: 0,
  reservedSlots: 0,
  maintenanceSlots: 0,
  occupancyPercentage: 0,
  zoneCount: 0,
  activeSessions: 0,
  openViolations: 0
};

export const ParkingProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [connection, setConnection] = useState({ status: 'connecting', latencyMs: null, lastSync: null });
  const revRef = useRef(0);

  // GPS (kept for the session only; never persisted)
  const [userLocation, setUserLocation] = useState(() => {
    try {
      const raw = sessionStorage.getItem('parkpulse_gps');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // ---- data sync --------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!session.token) return null;
    const t0 = performance.now();
    try {
      const snap = await api.state();
      if (snap.rev >= revRef.current) {
        revRef.current = snap.rev;
        setData(snap);
      }
      setLoadError('');
      setConnection((c) => ({
        ...c,
        status: c.status === 'offline' ? 'reconnecting' : c.status,
        latencyMs: Math.round(performance.now() - t0),
        lastSync: Date.now()
      }));
      return snap;
    } catch (err) {
      if (err.status === 0) setConnection((c) => ({ ...c, status: 'offline' }));
      else if (err.status !== 401) setLoadError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      revRef.current = 0;
      setData(null);
      setLoading(false);
      return undefined;
    }

    let closed = false;
    let source = null;
    let retryTimer = null;
    let refreshTimer = null;

    setLoading(true);
    refresh().finally(() => !closed && setLoading(false));

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 120);
    };

    const connect = async () => {
      if (closed || typeof EventSource === 'undefined') return;
      try {
        const { ticket } = await api.eventTicket();
        if (closed) return;
        source = new EventSource(api.eventsUrl(ticket));
        source.addEventListener('hello', () => {
          setConnection((c) => ({ ...c, status: 'live' }));
          scheduleRefresh();
        });
        source.addEventListener('change', scheduleRefresh);
        source.onerror = () => {
          source?.close();
          if (closed) return;
          setConnection((c) => ({ ...c, status: c.status === 'offline' ? 'offline' : 'reconnecting' }));
          retryTimer = setTimeout(connect, 3000);
        };
      } catch (err) {
        if (closed || err.status === 401) return;
        setConnection((c) => ({ ...c, status: 'reconnecting' }));
        retryTimer = setTimeout(connect, 5000);
      }
    };
    connect();

    // Safety net: periodic resync, and resync when the tab regains focus / network.
    const poll = setInterval(refresh, 20000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);

    return () => {
      closed = true;
      source?.close();
      clearTimeout(retryTimer);
      clearTimeout(refreshTimer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [userId, refresh]);

  // ---- actions (server is authoritative; refresh pulls the resulting state) --
  const act = useCallback(
    async (fn) => {
      const result = await fn();
      await refresh();
      return result;
    },
    [refresh]
  );

  const startParking = useCallback(({ slotCode, vehicleNumber }) => act(() => api.startSession({ slotCode, vehicleNumber })), [act]);
  const endParking = useCallback((sessionId) => act(() => api.endSession(sessionId)), [act]);
  const reportViolation = useCallback((payload) => act(() => api.reportViolation(payload)), [act]);
  const updateViolationStatus = useCallback((id, status, note) => act(() => api.updateViolationStatus(id, status, note)), [act]);
  const updateSlotStatus = useCallback((id, status, vehicleNumber) => act(() => api.patchSlot(id, { status, vehicleNumber })), [act]);
  const addSlot = useCallback((payload) => act(() => api.createSlot(payload)), [act]);
  const removeSlot = useCallback((id) => act(() => api.deleteSlot(id)), [act]);
  const addZone = useCallback((payload) => act(() => api.createZone(payload)), [act]);
  const updateZone = useCallback((zone, payload) => act(() => api.updateZone(zone, payload)), [act]);
  const resetData = useCallback((mode) => act(() => api.resetData(mode)), [act]);
  const markNotificationsRead = useCallback((ids) => act(() => api.markNotificationsRead(ids)), [act]);

  // ---- geolocation ------------------------------------------------------
  const detectUserLocation = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          const msg = 'Location services are not supported by this browser.';
          setLocationError(msg);
          reject(new Error(msg));
          return;
        }
        setIsDetectingLocation(true);
        setLocationError('');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: pos.timestamp };
            setUserLocation(loc);
            try {
              sessionStorage.setItem('parkpulse_gps', JSON.stringify(loc));
            } catch {
              /* ignore */
            }
            setIsDetectingLocation(false);
            resolve(loc);
          },
          (error) => {
            setIsDetectingLocation(false);
            const msg =
              { 1: 'Location permission was denied. Allow location access in your browser to sort by distance.', 2: 'Your position is unavailable. Check that GPS is switched on.', 3: 'Locating you timed out. Please try again.' }[error.code] ||
              'Could not determine your location.';
            setLocationError(msg);
            reject(new Error(msg));
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      }),
    []
  );

  // ---- derived values -----------------------------------------------------
  const slots = useMemo(() => data?.slots ?? [], [data]);
  const zones = useMemo(() => data?.zones ?? [], [data]);
  const sessions = useMemo(() => data?.sessions ?? [], [data]);
  const violations = useMemo(() => data?.violations ?? [], [data]);
  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const notices = useMemo(() => data?.notices ?? [], [data]);

  const activityHistory = useMemo(() => {
    if (!userId) return [];
    const items = [];
    for (const s of sessions) {
      if (s.userId !== userId) continue;
      items.push({
        id: `sess-${s.sessionId}`,
        type: s.status === 'active' ? 'session_started' : 'session_completed',
        slotCode: s.slotCode,
        zone: s.zone,
        durationMin: s.durationMin,
        time: s.endTime || s.startTime
      });
    }
    for (const v of violations) {
      if (v.reporterId !== userId) continue;
      items.push({ id: `vio-${v.id}`, type: 'violation_reported', violationId: v.id, category: v.category, status: v.status, time: v.timestamp });
    }
    return items.sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [sessions, violations, userId]);

  const value = useMemo(
    () => ({
      ready: Boolean(data),
      loading,
      loadError,
      connection,
      slots,
      zones,
      locations: zones,
      sessions,
      allSessions: sessions,
      violations,
      notices,
      notifications,
      activeSession: data?.activeSession ?? null,
      activityHistory,
      stats: data?.stats ?? EMPTY_STATS,
      rev: data?.rev ?? 0,
      refresh,
      startParking,
      endParking,
      reportViolation,
      updateViolationStatus,
      updateSlotStatus,
      addSlot,
      removeSlot,
      addZone,
      updateZone,
      resetData,
      markNotificationsRead,
      userLocation,
      isDetectingLocation,
      locationError,
      detectUserLocation
    }),
    [
      data, loading, loadError, connection, slots, zones, sessions, violations, notices, notifications, activityHistory, refresh,
      startParking, endParking, reportViolation, updateViolationStatus, updateSlotStatus, addSlot, removeSlot, addZone, updateZone,
      resetData, markNotificationsRead, userLocation, isDetectingLocation, locationError, detectUserLocation
    ]
  );

  return <ParkingContext.Provider value={value}>{children}</ParkingContext.Provider>;
};

export const useParking = () => {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error('useParking must be used within a ParkingProvider');
  return ctx;
};
