import React, { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';

// Single-hue sequential blue from the reference palette (one series => no categorical colour needed).
const BAR = '#2a78d6';
const BAR_EMPHASIS = '#1c5cab';

const niceMax = (v) => {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

/**
 * Column chart: thin bars with rounded data-ends anchored to the baseline, recessive grid,
 * one emphasised bar, hover tooltip per column (hit area = full column), and a table view.
 */
export const ColumnChart = ({ title, subtitle, data, unit = '', emphasisIndex = -1, labelEvery = 1, height = 180 }) => {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [max, max / 2, 0];

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={() => setAsTable((t) => !t)} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 shrink-0" aria-pressed={asTable}>
          {asTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-[220px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 text-[10px] uppercase">
              <tr>
                <th className="py-1.5">Period</th>
                <th className="py-1.5 text-right">{unit || 'Value'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((d) => (
                <tr key={d.key}>
                  <td className="py-1.5 text-slate-600">{d.tooltip || d.label}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-slate-800">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2" role="img" aria-label={`${title}. ${data.map((d) => `${d.tooltip || d.label}: ${d.value}`).join('; ')}`}>
          <div className="flex flex-col justify-between text-[10px] font-mono text-slate-400 text-right pb-5" style={{ height: height + 20 }}>
            {ticks.map((t) => (
              <span key={t}>{Math.round(t)}</span>
            ))}
          </div>
          <div className="relative flex-1 min-w-0">
            {/* recessive gridlines */}
            <div className="absolute inset-x-0 top-0 flex flex-col justify-between pointer-events-none" style={{ height }}>
              {ticks.map((t) => (
                <div key={t} className={`border-t ${t === 0 ? 'border-slate-300' : 'border-slate-100'}`} />
              ))}
            </div>
            <div className="relative flex items-end gap-[2px]" style={{ height }}>
              {data.map((d, i) => {
                const h = d.value ? Math.max(3, (d.value / max) * height) : 0;
                return (
                  <div key={d.key} className="relative flex-1 h-full flex items-end justify-center group" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover((h) => (h === i ? null : i))} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.tooltip || d.label}: ${d.value} ${unit}`}>
                    <div className="w-full max-w-[28px] transition-[height,opacity] duration-300" style={{ height: h, background: i === emphasisIndex ? BAR_EMPHASIS : BAR, borderRadius: '4px 4px 0 0', opacity: hover != null && hover !== i ? 0.55 : 1 }} />
                    {hover === i && (
                      <div className="absolute z-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-[11px] shadow-xl pointer-events-none" style={{ bottom: h + 8 }}>
                        <span className="block text-slate-300">{d.tooltip || d.label}</span>
                        <span className="font-bold font-mono">{d.value} {unit}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[2px] mt-1.5 h-4">
              {data.map((d, i) => (
                <div key={d.key} className="flex-1 text-center text-[10px] text-slate-400 font-mono overflow-visible whitespace-nowrap">
                  {i % labelEvery === 0 ? d.label : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** One row per entity: a name, an aligned track+bar, and a figure. Used for ratios and ranked counts. */
export const MeterList = ({ title, subtitle, rows, emptyText = 'No data yet.' }) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
    <h3 className="text-sm font-bold text-slate-900">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    <div className="mt-4 space-y-3.5">
      {rows.length === 0 || rows.every((r) => !r.max) ? (
        <p className="text-xs text-slate-400 py-4 text-center">{emptyText}</p>
      ) : (
        rows.map((r) => {
          const pct = r.max ? Math.min(100, (r.value / r.max) * 100) : 0;
          return (
            <div key={r.key} title={r.tooltip}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-semibold text-slate-700 truncate">{r.label}</span>
                <span className="font-mono font-bold text-slate-800 shrink-0">{r.display ?? r.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: BAR }} />
              </div>
              {r.sub && <p className="text-[10px] text-slate-400 mt-1">{r.sub}</p>}
            </div>
          );
        })
      )}
    </div>
  </div>
);
