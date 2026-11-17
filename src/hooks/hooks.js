import { useEffect, useState } from 'react';

/** Re-renders the caller every `intervalMs` and returns the current timestamp (for live timers). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ParkPulse` : 'ParkPulse – Smart Campus Parking';
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/** Debounce a changing value. */
export function useDebounced(value, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
