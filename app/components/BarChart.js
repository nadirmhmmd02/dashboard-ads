'use client';

import { useState } from 'react';

const METRIC_COLORS = {
  spend: '#3b82f6',
  awareness: '#8b5cf6',
  traffic: '#f59e0b',
  leads: '#10b981',
};
const TODAY_COLORS = {
  spend: '#93c5fd',
  awareness: '#c4b5fd',
  traffic: '#fcd34d',
  leads: '#6ee7b7',
};
const TODAY_GLOW = {
  spend: '147,197,253',
  awareness: '196,181,253',
  traffic: '252,211,77',
  leads: '110,231,183',
};
const METRIC_TITLES = {
  spend: 'Daily Spend',
  awareness: 'Daily Awareness',
  traffic: 'Daily Traffic',
  leads: 'Daily Leads',
};
const METRICS = [
  { key: 'spend', label: 'Spend' },
  { key: 'awareness', label: 'Awareness' },
  { key: 'traffic', label: 'Traffic' },
  { key: 'leads', label: 'Leads' },
];

function fmtNum(m, v) {
  if (m === 'spend') {
    if (v >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return 'Rp ' + (v / 1000).toFixed(0) + 'K';
    return 'Rp ' + v;
  }
  return v.toLocaleString('id-ID');
}
function fmtAxis(m, v) {
  if (m === 'spend') {
    if (v >= 1000000) return (v / 1000000).toFixed(0) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v;
  }
  if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
  return v;
}

export default function BarChart({ data, today, daysInMonth }) {
  const [metric, setMetric] = useState('spend');
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, html: '' });

  const arr = data[metric];
  const max = Math.max.apply(null, arr) || 1;
  const col = METRIC_COLORS[metric];
  const tcol = TODAY_COLORS[metric];
  const tglow = TODAY_GLOW[metric];

  const yLabels = [];
  for (let s = 4; s >= 0; s--) {
    yLabels.push(fmtAxis(metric, Math.round((max * s) / 4)));
  }

  return (
    <div
      style={{
        background: 'var(--cd)',
        border: '1px solid var(--br)',
        borderRadius: '10px',
        padding: '16px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Header: title + toggle metrik */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '14px', color: 'var(--t1)', fontWeight: 500 }}>
          {METRIC_TITLES[metric]}
        </div>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--sf)',
            padding: '4px',
            borderRadius: '8px',
          }}
        >
          {METRICS.map((m) => {
            const active = metric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  background: active ? METRIC_COLORS[m.key] : 'transparent',
                  color: active ? '#fff' : 'var(--t2)',
                  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart area: Y-axis + bars */}
      <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
        {/* Y-axis */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: 'var(--t3)',
            textAlign: 'right',
            minWidth: '34px',
            paddingBottom: '18px',
          }}
        >
          {yLabels.map((lbl, i) => (
            <div key={i}>{lbl}</div>
          ))}
        </div>

        {/* Bars + grid + x-axis */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* area chart (grid + bars) melar */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {/* grid lines */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: (i / 4) * 100 + '%',
                    left: 0,
                    right: 0,
                    borderTop: '1px solid #242424',
                  }}
                />
              ))}
            </div>

            {/* bars */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                height: '100%',
                position: 'relative',
              }}
            >
            {arr.map((v, idx) => {
              const h = (v / max) * 100;
              const isToday = idx === today - 1;
              const isFuture = idx >= today;
              const c = isToday ? tcol : isFuture ? '#222' : col;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    background: c,
                    borderRadius: '2px 2px 0 0',
                    height: h + '%',
                    minHeight: v > 0 ? '2px' : '0',
                    animation: 'wdGrowBar 0.6s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: isToday ? `0 0 6px 1px rgba(${tglow},0.6)` : 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.75';
                  }}
                  onMouseMove={(e) => {
                    const day = idx + 1;
                    const valTxt = isFuture ? '—' : fmtNum(metric, v);
                    const tag = isFuture
                      ? ' (upcoming)'
                      : day === today
                      ? ' · today'
                      : '';
                    setTooltip({
                      show: true,
                      x: e.clientX + 12,
                      y: e.clientY - 10,
                      html: `<span style="color:#737373;">${day}${tag}</span><br><span style="color:${col};font-weight:500;">${valTxt}</span>`,
                    });
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                    setTooltip((t) => ({ ...t, show: false }));
                  }}
                />
              );
            })}
          </div>
          </div>

          {/* x-axis: semua tanggal 1..daysInMonth */}
          <div style={{ display: 'flex', gap: '2px', marginTop: '6px' }}>
            {arr.map((v, idx) => {
              const isToday = idx === today - 1;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '7px',
                    color: isToday ? tcol : '#6a6a6a',
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* tooltip */}
      {tooltip.show && (
        <div
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            left: tooltip.x,
            top: tooltip.y,
            background: '#000',
            border: `1px solid ${col}`,
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            zIndex: 100,
            whiteSpace: 'nowrap',
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.html }}
        />
      )}
    </div>
  );
}