'use client';

import { useState, useRef } from 'react';
import { Info } from 'lucide-react';

const COLORS = {
  spend:     '#8BE34D',
  awareness: '#8B5CF6',
  traffic:   '#F59E0B',
  leads:     '#3B82F6',
};
const TITLES = {
  spend:     'Daily Spend',
  awareness: 'Daily Awareness',
  traffic:   'Daily Traffic',
  leads:     'Daily Leads',
};
const METRICS = [
  { key: 'spend',     label: 'Spend' },
  { key: 'awareness', label: 'Awareness' },
  { key: 'traffic',   label: 'Traffic' },
  { key: 'leads',     label: 'Leads' },
];

function fmtVal(m, v) {
  if (m === 'spend') {
    if (v >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (v >= 1000)    return 'Rp ' + (v / 1000).toFixed(0) + 'K';
    return 'Rp ' + Math.round(v);
  }
  return Math.round(v).toLocaleString('id-ID');
}
function fmtAxis(m, v) {
  if (v >= 1000000) return (v / 1000000).toFixed(0) + 'M';
  if (v >= 1000)    return (v / 1000).toFixed(0) + 'K';
  return Math.round(v);
}

// Catmull-Rom → cubic bezier untuk kurva mulus
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function AreaChart({ data, today }) {
  const [metric, setMetric] = useState('spend');
  const [hover, setHover]   = useState(null); // { idx, xPct, yPct }
  const wrapRef = useRef(null);

  const arr = data[metric] || [];
  const n   = arr.length;
  const max = Math.max.apply(null, arr.length ? arr : [1]) || 1;
  const col = COLORS[metric];

  // Titik dalam koordinat 0..100 (viewBox), y disisakan 8% padding atas
  const pts = arr.map((v, i) => ({
    x: n > 1 ? (i / (n - 1)) * 100 : 50,
    y: 92 - (v / max) * 84,
    v,
    i,
  }));
  const line = smoothPath(pts);
  const area = line ? `${line} L 100 100 L 0 100 Z` : '';

  const yLabels = [];
  for (let s = 4; s >= 0; s--) yLabels.push(fmtAxis(metric, (max * s) / 4));

  // Label sumbu-x: kira-kira tiap 3 hari
  const xTicks = [];
  if (n > 0) {
    const step = Math.max(1, Math.round(n / 10));
    for (let i = 0; i < n; i += step) xTicks.push(i);
    if (xTicks[xTicks.length - 1] !== n - 1) xTicks.push(n - 1);
  }

  function onMove(e) {
    if (!wrapRef.current || n === 0) return;
    const r = wrapRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const idx = Math.round(ratio * (n - 1));
    const p = pts[idx];
    if (p) setHover({ idx, xPct: p.x, yPct: p.y, clientX: e.clientX, clientY: e.clientY });
  }

  return (
    <div style={{
      background: '#121417',
      border: '1px solid #23262C',
      borderRadius: '18px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span key={metric} style={{
            fontSize: '15px', fontWeight: 600, color: '#FFFFFF',
            animation: 'wdSoftIn 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}>{TITLES[metric]}</span>
          <Info size={13} color="#4B5563" />
        </div>
        <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '9px' }}>
          {METRICS.map((m) => {
            const active = metric === m.key;
            return (
              <button key={m.key} onClick={() => setMetric(m.key)} style={{
                padding: '5px 12px', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                background: active ? COLORS[m.key] : 'transparent',
                color: active ? '#0A0F06' : '#9CA3AF',
                cursor: 'pointer', transition: 'all 0.18s',
              }}>{m.label}</button>
            );
          })}
        </div>
      </div>

      {/* Chart body */}
      <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
        {/* Y axis */}
        <div style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          fontSize: '10px', color: '#4B5563', textAlign: 'right', minWidth: '36px', paddingBottom: '20px',
        }}>
          {yLabels.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        {/* Plot */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div
            ref={wrapRef}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            style={{ flex: 1, position: 'relative', minHeight: 0, cursor: 'crosshair' }}
          >
            {/* Grid */}
            <div style={{ position: 'absolute', inset: 0 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  position: 'absolute', top: (i / 4) * 100 + '%', left: 0, right: 0,
                  borderTop: '1px solid rgba(255,255,255,0.035)',
                }} />
              ))}
            </div>

            {/* Area + line */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={col} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={col} stopOpacity="0" />
                </linearGradient>
              </defs>
              {area && (
                <path key={`a-${metric}`} d={area} fill={`url(#fill-${metric})`} stroke="none"
                  style={{
                    transformOrigin: 'bottom',
                    animation: 'wdAreaGrow 0.6s cubic-bezier(0.4,0,0.2,1)',
                  }} />
              )}
              {line && (
                <path key={`l-${metric}`} d={line} fill="none" stroke={col} strokeWidth="2"
                  pathLength="1" strokeDasharray="1"
                  vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 2px 5px ${col}55)`,
                    animation: 'wdDrawLine 0.7s cubic-bezier(0.4,0,0.2,1)',
                  }} />
              )}
            </svg>

            {/* Hover guide */}
            {hover && (
              <>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: hover.xPct + '%',
                  width: '1px', background: 'rgba(255,255,255,0.14)', pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', left: hover.xPct + '%', top: hover.yPct + '%',
                  width: '9px', height: '9px', borderRadius: '50%', background: col,
                  border: '2px solid #121417', transform: 'translate(-50%,-50%)',
                  boxShadow: `0 0 8px ${col}`, pointerEvents: 'none',
                }} />
              </>
            )}
          </div>

          {/* X axis */}
          <div style={{ position: 'relative', height: '14px', marginTop: '6px' }}>
            {xTicks.map((i) => {
              const isToday = i === today - 1;
              return (
                <span key={i} style={{
                  position: 'absolute', left: (n > 1 ? (i / (n - 1)) * 100 : 50) + '%',
                  transform: 'translateX(-50%)', fontSize: '9px',
                  color: isToday ? COLORS.spend : '#4B5563', fontWeight: isToday ? 700 : 400,
                }}>{i + 1}</span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hover && arr[hover.idx] !== undefined && (
        <div style={{
          position: 'fixed', left: hover.clientX + 14, top: hover.clientY - 44,
          background: '#0A0C0E', border: '1px solid #23262C', borderRadius: '8px',
          padding: '7px 11px', pointerEvents: 'none', zIndex: 100, whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '3px' }}>
            Day {hover.idx + 1}{hover.idx === today - 1 ? ' · today' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{fmtVal(metric, arr[hover.idx])}</span>
          </div>
        </div>
      )}
    </div>
  );
}
