import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, X, Check } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useParking } from './ParkingContext';
import { ADMIN_STEPS, DRIVER_STEPS } from '../tour/steps';

const TourContext = createContext({ active: false, start: () => {}, sidebarForced: false });
const storageKey = (id) => `parkpulse_tour_v1_${id}`;

/**
 * Interactive product tour. Highlights real UI elements (tagged with data-tour attributes),
 * navigates between pages, opens the mobile drawer when a menu item is the subject, and
 * remembers per user that it has been seen. Replayable from the "?" button in the top bar.
 */
export const TourProvider = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();
  const { ready } = useParking();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = currentUser?.id;
  const steps = isAdmin ? ADMIN_STEPS : DRIVER_STEPS;

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const step = active ? steps[index] : null;

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(storageKey(userId), 'done');
    } catch {
      /* storage unavailable */
    }
  }, [userId]);

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
  }, []);

  // Finishing returns to the home page; skipping leaves the user where they are.
  const close = useCallback(
    (goHome) => {
      setActive(false);
      markSeen();
      if (goHome) navigate(isAdmin ? '/admin' : '/dashboard');
    },
    [markSeen, navigate, isAdmin]
  );
  const skip = useCallback(() => close(false), [close]);

  const next = useCallback(() => (index >= steps.length - 1 ? close(true) : setIndex((i) => i + 1)), [index, steps.length, close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Go to the page a step belongs to.
  useEffect(() => {
    if (!step?.route) return;
    if (`${location.pathname}${location.search}` !== step.route) navigate(step.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, step?.route]);

  // First visit: offer the tour once the app has loaded (but never interrupt a QR deep link).
  useEffect(() => {
    if (!userId || !ready) return undefined;
    let seen = true;
    try {
      seen = Boolean(localStorage.getItem(storageKey(userId)));
    } catch {
      /* treat as seen */
    }
    if (seen || new URLSearchParams(window.location.search).has('code')) return undefined;
    const t = setTimeout(start, 900);
    return () => clearTimeout(t);
  }, [userId, ready, start]);

  const value = useMemo(() => ({ active, start, sidebarForced: Boolean(step?.sidebar) }), [active, start, step?.sidebar]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && step && createPortal(<TourOverlay step={step} index={index} total={steps.length} onNext={next} onBack={back} onSkip={skip} />, document.body)}
    </TourContext.Provider>
  );
};

export const useTour = () => useContext(TourContext);

// ---------------------------------------------------------------------------
const PAD = 8;
const GAP = 16;

function TourOverlay({ step, index, total, onNext, onBack, onSkip }) {
  const [rect, setRect] = useState(null);
  const [waited, setWaited] = useState(false); // target never appeared -> fall back to a centred card
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [pop, setPop] = useState({ w: 360, h: 240 });
  const popRef = useRef(null);
  const nextRef = useRef(null);
  const scrolledFor = useRef(null);

  const mobile = vp.w < 640;
  const isLast = index === total - 1;
  const isIntro = !step.target;

  // Track the target every frame (it may move: route transition, drawer animation, scrolling, resize).
  useEffect(() => {
    let raf = 0;
    const started = performance.now();
    scrolledFor.current = null;
    setRect(null);
    setWaited(false);

    const tick = () => {
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      const el = step.target ? document.querySelector(step.target) : null;
      const r = el?.getBoundingClientRect();
      if (el && r.width > 0 && r.height > 0) {
        if (scrolledFor.current !== step.id && !el.closest('aside')) {
          scrolledFor.current = step.id;
          const vh = window.innerHeight;
          const reserve = window.innerWidth < 640 ? 270 : 24; // room for the bottom sheet on phones
          const top = 84; // below the sticky top bar
          const tall = r.height > vh - reserve - top;
          if (r.top < top || r.bottom > vh - reserve) {
            const target = tall ? top : top + (vh - reserve - top - r.height) / 2;
            window.scrollTo({ top: Math.max(0, window.scrollY + r.top - target), behavior: 'smooth' });
          }
        }
        setRect((p) => (p && Math.abs(p.top - r.top) < 0.5 && Math.abs(p.left - r.left) < 0.5 && Math.abs(p.width - r.width) < 0.5 && Math.abs(p.height - r.height) < 0.5 ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      } else {
        setRect((p) => (p === null ? p : null));
        if (step.target && performance.now() - started > 2500) setWaited((w) => w || true);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step.id, step.target]);

  // Measure the popover so it can be placed without overflowing the screen.
  useLayoutEffect(() => {
    const el = popRef.current;
    if (el && (Math.abs(el.offsetWidth - pop.w) > 1 || Math.abs(el.offsetHeight - pop.h) > 1)) setPop({ w: el.offsetWidth, h: el.offsetHeight });
  });

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [step.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onBack, onSkip]);

  const waiting = Boolean(step.target) && !rect && !waited;
  const spot = rect && { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };

  // Popover placement (desktop/tablet). Phones use a bottom sheet instead.
  let style;
  if (mobile) style = { left: 12, right: 12, bottom: 12 };
  else if (!rect) style = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  else {
    const W = Math.min(pop.w, vp.w - 24);
    const H = pop.h;
    const clampX = (x) => Math.min(Math.max(12, x), vp.w - W - 12);
    const clampY = (y) => Math.min(Math.max(12, y), vp.h - H - 12);
    const spots = {
      right: spot.left + spot.width + GAP + W <= vp.w - 12 && { left: spot.left + spot.width + GAP, top: clampY(spot.top) },
      left: spot.left - GAP - W >= 12 && { left: spot.left - GAP - W, top: clampY(spot.top) },
      bottom: spot.top + spot.height + GAP + H <= vp.h - 12 && { left: clampX(spot.left + spot.width / 2 - W / 2), top: spot.top + spot.height + GAP },
      top: spot.top - GAP - H >= 12 && { left: clampX(spot.left + spot.width / 2 - W / 2), top: spot.top - GAP - H }
    };
    const order = { right: ['right', 'left', 'bottom', 'top'], left: ['left', 'right', 'bottom', 'top'], bottom: ['bottom', 'top', 'right', 'left'], top: ['top', 'bottom', 'right', 'left'] }[step.placement || 'bottom'];
    const found = order.map((k) => spots[k]).find(Boolean);
    style = found || { right: 16, bottom: 16 }; // target fills the screen: park the card in a corner
  }

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      {/* Swallows clicks so the page underneath can't be triggered mid-tour */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {spot ? (
        <div
          className="absolute rounded-2xl pointer-events-none"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, boxShadow: '0 0 0 9999px rgba(2,6,23,0.74), 0 0 0 3px rgba(52,211,153,0.95)', transition: 'top .28s, left .28s, width .28s, height .28s' }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/75 backdrop-enter pointer-events-none" />
      )}

      {!waiting && (
        <div
          ref={popRef}
          key={step.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          style={style}
          className={`absolute tour-pop bg-white text-slate-700 shadow-2xl shadow-slate-950/40 border border-slate-200 ${mobile ? 'rounded-3xl safe-bottom' : 'rounded-2xl w-[360px] max-w-[calc(100vw-24px)]'}`}
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              {isIntro && index === 0 ? (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
              ) : (
                <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-600 uppercase">
                  Step {index + 1} of {total}
                </span>
              )}
              <button onClick={onSkip} className="no-tt -mr-1 -mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label="Close tour">
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 id="tour-title" className={`font-extrabold text-slate-900 tracking-tight ${isIntro && index === 0 ? 'text-xl mt-4' : 'text-lg mt-2'}`}>
              {step.title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-2">{step.body}</p>

            <div className="flex items-center gap-1 mt-5" aria-hidden="true">
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`h-1 rounded-full transition-all ${i === index ? 'w-6 bg-emerald-500' : i < index ? 'w-2 bg-emerald-300' : 'w-2 bg-slate-200'}`} />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 mt-5">
              <button onClick={onSkip} className="px-2 py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors">
                {index === 0 ? 'Skip for now' : 'Skip tour'}
              </button>
              <div className="flex items-center gap-2">
                {index > 0 && (
                  <button onClick={onBack} className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                )}
                <button ref={nextRef} onClick={onNext} className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-slate-900/20 active:scale-95 transition-all">
                  {index === 0 ? 'Start tour' : isLast ? 'Finish' : 'Next'}
                  {isLast ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
