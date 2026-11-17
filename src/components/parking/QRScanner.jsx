import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, VideoOff, Video, RefreshCw } from 'lucide-react';

/**
 * Live camera QR scanner. Frames from the video are down-scaled onto a canvas and
 * decoded with jsQR a few times per second; `onResult(text)` fires once per detection.
 */
export const QRScanner = ({ onResult, hint }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastScanRef = useRef(0);
  const lastTextRef = useRef({ text: '', at: 0 });
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [facing, setFacing] = useState('environment');

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    const now = performance.now();
    if (now - lastScanRef.current > 140 && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
      lastScanRef.current = now;
      const scale = Math.min(1, 480 / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        const last = lastTextRef.current;
        if (code.data !== last.text || now - last.at > 2500) {
          lastTextRef.current = { text: code.data, at: now };
          navigator.vibrate?.(60);
          onResultRef.current?.(code.data);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(
    async (mode = facing) => {
      setError('');
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access needs a secure (HTTPS) connection or localhost. You can still type the bay code.');
        return;
      }
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode }, width: { ideal: 1280 } }, audio: false });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});
        setActive(true);
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        setError(denied ? 'Camera permission was denied. Allow camera access in your browser settings, or type the bay code instead.' : `Couldn't open the camera (${err?.message || 'device busy'}). Type the bay code instead.`);
      }
    },
    [facing, stop, tick]
  );

  useEffect(() => stop, [stop]);

  const flip = async () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    if (active) await start(next);
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-square max-w-[300px] w-full mx-auto rounded-2xl border-2 border-dashed border-emerald-500/40 bg-slate-900 overflow-hidden">
        {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2', 'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'].map((c) => (
          <div key={c} className={`absolute w-6 h-6 border-emerald-400 z-20 pointer-events-none ${c}`} />
        ))}
        {active && <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400 animate-scan pointer-events-none z-20" />}
        <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover z-10 ${active ? 'block' : 'hidden'} ${facing === 'user' ? '-scale-x-100' : ''}`} />
        <canvas ref={canvasRef} className="hidden" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-10 text-center">
            <Camera className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-xs font-mono text-slate-400">{hint || 'Point your camera at the QR placard on the bay'}</p>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-[11px] text-amber-300 text-center bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">{error}</p>}

      <div className="flex gap-2">
        {!active ? (
          <button type="button" onClick={() => start()} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95">
            <Video className="w-4 h-4" />
            Start camera scanner
          </button>
        ) : (
          <>
            <div className="flex-1 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Scanning for QR…
            </div>
            <button type="button" onClick={flip} className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors" title="Switch camera" aria-label="Switch camera">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button type="button" onClick={stop} className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors" title="Stop camera" aria-label="Stop camera">
              <VideoOff className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
