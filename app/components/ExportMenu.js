'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import Logo from './Logo';

/* ─── Report palette — SELALU dark (artefak laporan, tidak ikut tema) ─── */
const BG     = '#090A0C';
const CARD   = '#121417';
const BORDER = '#23262C';
const TXT    = '#FFFFFF';
const SUB    = '#9CA3AF';
const MUTE   = '#5B616B';
const GREEN  = '#2FB673';   // emerald — ikut palet redesain 2026
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';
const ORANGE = '#F59E0B';

/* ─── UI palette (tombol + dropdown di header) — ikut tema dashboard ─── */
const UI_CARD   = 'var(--cd)';
const UI_BORDER = 'var(--br)';
const UI_BRS    = 'var(--br-strong)';
const UI_TXT    = 'var(--t1)';
const UI_SUB    = 'var(--t2)';
const UI_MUTE   = 'var(--t3)';
const UI_HOVER  = 'var(--hover)';

/* ─── Format helpers ─── */
function fmtSpend(n) {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)     return 'Rp ' + (n / 1_000).toFixed(0) + 'K';
  return 'Rp ' + Math.round(n || 0);
}
function fmtBigNum(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0','') + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1).replace('.0','') + 'K';
  return Math.round(n || 0).toLocaleString('id-ID');
}
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const METRIC_META = [
  { key: 'spend',     name: 'Daily Spend',     color: GREEN,  money: true },
  { key: 'awareness', name: 'Daily Awareness', color: PURPLE, money: false },
  { key: 'traffic',   name: 'Daily Traffic',   color: ORANGE, money: false },
  { key: 'leads',     name: 'Daily Leads',     color: BLUE,   money: false },
];

function Pct({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0, c = up ? GREEN : '#EF4444';
  return <span style={{ fontSize: '13px', fontWeight: 600, color: c }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>;
}

/* ─── Mini area chart (satu metrik) untuk laporan ─── */
function MiniChart({ arr = [], color, name, money }) {
  const valid = [];
  arr.forEach((v, i) => { if (v != null) valid.push({ v, i }); });
  const n     = arr.length || 1;
  const max   = Math.max.apply(null, valid.length ? valid.map(p => p.v) : [1]) || 1;
  const total = valid.reduce((s, p) => s + p.v, 0);
  const pts   = valid.map(p => ({ x: n > 1 ? (p.i / (n - 1)) * 100 : 50, y: 90 - (p.v / max) * 78 }));
  const line  = smoothPath(pts);
  const area  = pts.length >= 2 ? `${line} L ${pts[pts.length - 1].x.toFixed(1)} 100 L ${pts[0].x.toFixed(1)} 100 Z` : '';
  const gid   = 'g-' + name.replace(/\s/g, '');

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color }} />
        <span style={{ fontSize: '13px', color: SUB, fontWeight: 500 }}>{name}</span>
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px', margin: '8px 0 10px' }}>
        {money ? fmtSpend(total) : fmtBigNum(total)}
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {area && <path d={area} fill={`url(#${gid})`} />}
          {line && <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
        </svg>
        {pts.length <= 7 && pts.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: p.x + '%', top: p.y + '%', width: '7px', height: '7px', borderRadius: '50%', background: color, border: `2px solid ${CARD}`, transform: 'translate(-50%,-50%)' }} />
        ))}
      </div>
    </div>
  );
}

// compact: tombol icon-only (dipakai toolbar mobile biar chip muat satu baris)
export default function ExportMenu({ summary, chartData = {}, rangeLabel = '', activeCount = 0, compact = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (!e.target.closest('[data-export]')) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  async function runExport(type) {
    setOpen(false);
    if (!reportRef.current || busy) return;
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: BG, useCORS: true, logging: false });
      const stamp = new Date().toISOString().slice(0, 10);
      const wCss = canvas.width / 2, hCss = canvas.height / 2;

      if (type === 'jpg') {
        const url = canvas.toDataURL('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = url; a.download = `WILLOFD-report-${stamp}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [wCss, hCss] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wCss, hCss);
        pdf.save(`WILLOFD-report-${stamp}.pdf`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export gagal: ' + err.message);
    }
    setBusy(false);
  }

  const kpis = summary ? [
    { label: 'Total Spend',  value: fmtSpend(summary.totalSpend),        pct: summary.pctSpend,       color: GREEN },
    { label: 'Reach',        value: fmtBigNum(summary.totalReach),       pct: summary.pctReach,       color: BLUE },
    { label: 'Impressions',  value: fmtBigNum(summary.totalImpressions), pct: summary.pctImpressions, color: PURPLE },
    { label: 'Traffic',      value: fmtBigNum(summary.totalTraffic),     pct: summary.pctTraffic,     color: ORANGE },
    { label: 'Leads',        value: fmtBigNum(summary.totalLeads),       pct: summary.pctLeads,       color: GREEN },
  ] : [];

  const secondary = summary ? [
    { label: 'CPM', value: summary.calcCPM ? fmtSpend(summary.calcCPM) : '—', sub: 'cost per 1K impressions' },
    { label: 'CPC', value: summary.calcCPC ? fmtSpend(summary.calcCPC) : '—', sub: 'cost per click' },
    { label: 'CPL', value: summary.calcCPL ? fmtSpend(summary.calcCPL) : '—', sub: 'cost per lead' },
    { label: 'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2) + '%' : '—', sub: 'click through rate' },
  ] : [];

  const sectionLabel = { fontSize: '12px', fontWeight: 600, letterSpacing: '1.4px', color: MUTE, textTransform: 'uppercase' };

  return (
    <div style={{ position: 'relative' }} data-export>
      {/* ── Tombol Export ── */}
      <button
        onClick={() => !busy && setOpen(o => !o)}
        title="Export"
        style={ compact ? {
          width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: UI_CARD, border: `1px solid ${UI_BORDER}`, borderRadius: '9px',
          cursor: busy ? 'default' : 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
        } : {
          display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 14px',
          background: UI_CARD, border: `1px solid ${UI_BORDER}`, borderRadius: '10px',
          fontSize: '13px', color: busy ? UI_SUB : UI_TXT, cursor: busy ? 'default' : 'pointer', transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = UI_BRS; }}
        onMouseLeave={e => e.currentTarget.style.borderColor = UI_BORDER}
      >
        {busy
          ? <Loader2 size={14} color={UI_SUB} style={{ animation: 'wdSpin 0.8s linear infinite' }} />
          : <Download size={14} color={UI_SUB} />}
        {!compact && (busy ? 'Exporting…' : 'Export')}
        {!compact && !busy && <ChevronDown size={13} color={UI_SUB} />}
      </button>

      {/* ── Dropdown format ── */}
      {open && !busy && (
        <div style={{
          position: 'absolute', top: '46px', right: 0, zIndex: 50,
          background: UI_CARD, border: `1px solid ${UI_BORDER}`, borderRadius: '12px', minWidth: '190px',
          boxShadow: 'var(--pop-shadow)', animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', padding: '6px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1.4px', color: UI_MUTE, textTransform: 'uppercase', padding: '6px 10px 8px' }}>Export as</div>
          {[
            { type: 'pdf', label: 'PDF Document', icon: FileText, hint: '.pdf' },
            { type: 'jpg', label: 'JPG Image',    icon: ImageIcon, hint: '.jpg' },
          ].map(o => {
            const Ic = o.icon;
            return (
              <div key={o.type} onClick={() => runExport(o.type)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: UI_SUB,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = UI_HOVER; e.currentTarget.style.color = UI_TXT; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = UI_SUB; }}
              >
                <Ic size={16} />
                <span style={{ flex: 1 }}>{o.label}</span>
                <span style={{ fontSize: '11px', color: UI_MUTE }}>{o.hint}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ LAPORAN TERSEMBUNYI 16:9 (1280×720) ══════════ */}
      <div ref={reportRef} style={{
        position: 'fixed', left: '-10000px', top: 0, width: '1280px', height: '720px',
        background: BG, color: TXT, padding: '40px 48px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Logo size={26} color="#0A0F06" />
            </div>
            <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.6px' }}>Performance Marketing Report</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', padding: '7px 16px', borderRadius: '9px', background: 'rgba(139,227,77,0.12)', color: GREEN, fontSize: '15px', fontWeight: 600 }}>
              {rangeLabel || '—'}
            </div>
            <div style={{ fontSize: '12px', color: MUTE, marginTop: '8px' }}>Meta Ads · {activeCount} active campaigns</div>
          </div>
        </div>

        {/* Overview KPI */}
        <div style={{ ...sectionLabel, margin: '22px 0 12px', flexShrink: 0 }}>Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', flexShrink: 0 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '15px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: k.color }} />
                <span style={{ fontSize: '13px', color: SUB }}>{k.label}</span>
              </div>
              <div style={{ fontSize: '25px', fontWeight: 700, letterSpacing: '-0.6px', margin: '10px 0 7px' }}>{k.value}</div>
              <Pct pct={k.pct} />
            </div>
          ))}
        </div>

        {/* Efficiency strip */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginTop: '14px', flexShrink: 0, overflow: 'hidden' }}>
          {secondary.map((m, i) => (
            <div key={i} style={{ padding: '13px 20px', borderRight: i < 3 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ fontSize: '12px', color: SUB }}>{m.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px', margin: '3px 0 2px' }}>{m.value}</div>
              <div style={{ fontSize: '11px', color: MUTE }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Daily performance — 4 grafik */}
        <div style={{ ...sectionLabel, margin: '22px 0 12px', flexShrink: 0 }}>Daily Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', flex: 1, minHeight: 0 }}>
          {METRIC_META.map(m => (
            <MiniChart key={m.key} arr={chartData[m.key] || []} color={m.color} name={m.name} money={m.money} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '14px', borderTop: `1px solid ${BORDER}`, fontSize: '11px', color: MUTE, flexShrink: 0 }}>
          <span>WILL OF D · Performance Marketing Dashboard</span>
          <span>Data source: Meta Ads · dashboard-ads-babarafi.vercel.app</span>
        </div>
      </div>
    </div>
  );
}
