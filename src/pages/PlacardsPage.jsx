import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Printer, Zap, Accessibility } from 'lucide-react';
import { useParking } from '../context/ParkingContext';
import { PageHeader } from '../components/common/Feedback';

export const PlacardsPage = () => {
  const { slots, zones } = useParking();
  const [params, setParams] = useSearchParams();
  const zone = params.get('zone') || 'ALL';
  const code = params.get('code');
  const [images, setImages] = useState({});

  const list = useMemo(() => slots.filter((s) => (code ? s.code === code : zone === 'ALL' || s.zone === zone)), [slots, zone, code]);
  const origin = window.location.origin;

  useEffect(() => {
    let alive = true;
    Promise.all(
      list.map(async (s) => [s.code, await QRCode.toDataURL(`${origin}/qr-parking?code=${s.code}`, { margin: 1, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })])
    ).then((pairs) => alive && setImages(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, [list, origin]);

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        <PageHeader
          eyebrow="Bay identification"
          eyebrowTone="text-indigo-600"
          title="Printable QR placards"
          subtitle="Each placard encodes a link to its bay. Print, laminate and mount one on every pillar — drivers can scan with the in-app scanner or any phone camera."
          actions={
            <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95 transition-all">
              <Printer className="w-4 h-4" /> Print {list.length} placard{list.length === 1 ? '' : 's'}
            </button>
          }
        />
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-white p-3 rounded-2xl border border-slate-200/80">
          {['ALL', ...zones.map((z) => z.zone)].map((z) => (
            <button key={z} onClick={() => setParams(z === 'ALL' ? {} : { zone: z })} className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${!code && zone === z ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {z === 'ALL' ? 'All zones' : z}
            </button>
          ))}
          {code && (
            <button onClick={() => setParams({})} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 whitespace-nowrap">
              Showing {code} · clear
            </button>
          )}
        </div>
      </div>

      <div data-tour="placards" className="print-sheet grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 gap-5">
        {list.map((s) => (
          <div key={s.id} className="print-card bg-white rounded-3xl border-2 border-slate-900 p-6 text-center shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">ParkPulse · {s.zone}</p>
            <p className="text-5xl font-extrabold font-mono text-slate-900 mt-1">{s.code}</p>
            <div className="mx-auto mt-3 w-48 h-48 flex items-center justify-center">
              {images[s.code] ? <img src={images[s.code]} alt={`QR code for bay ${s.code}`} className="w-full h-full" /> : <div className="w-full h-full rounded-xl bg-slate-100 animate-pulse" />}
            </div>
            <p className="text-sm font-bold text-slate-900 mt-3">Scan to check in</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.zoneName} · {s.level}</p>
            <div className="flex items-center justify-center gap-2 mt-3 text-[11px] font-semibold">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">{s.qrPlacardId}</span>
              {s.isEV && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-1"><Zap className="w-3 h-3" /> EV</span>}
              {s.isAccessible && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-1"><Accessibility className="w-3 h-3" /> Accessible</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
