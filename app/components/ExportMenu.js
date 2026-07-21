'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Download, ChevronDown, FileText, Image as ImageIcon, Loader2,
  ScanLine, MousePointerClick, UserPlus, Target,
} from 'lucide-react';
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
const RED    = '#EF4444';

/* ─── UI palette (tombol + dropdown di header) — ikut tema dashboard ─── */
const UI_CARD   = 'var(--cd)';
const UI_BORDER = 'var(--br)';
const UI_BRS    = 'var(--br-strong)';
const UI_TXT    = 'var(--t1)';
const UI_SUB    = 'var(--t2)';
const UI_MUTE   = 'var(--t3)';
const UI_HOVER  = 'var(--hover)';

/* ─── Format helpers — ANGKA PENUH biar sama dgn dashboard (Rp 1.440.076) ─── */
function fmtSpendFull(n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); }
function fmtNumFull(n)   { return Math.round(n || 0).toLocaleString('id-ID'); }

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

/* series harian ratio (untuk sparkline 4C), sejajar dgn perhitungan dashboard */
function ratio(a = [], b = [], mul = 1) {
  return a.map((v, i) => (v != null && b[i] > 0) ? (v / b[i]) * mul : null);
}

/* ─── Badge perbandingan % vs periode sebelumnya ───
   Panah = arah nyata; warna = baik/buruk. Untuk biaya (CPM/CPC/CPL) turun = baik (hijau),
   untuk hasil (CTR + 5 KPI volume) naik = baik. */
function Pct({ pct, goodDir = 'up', size = 14 }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  const good = goodDir === 'up' ? up : !up;
  return (
    <span style={{ fontSize: size + 'px', fontWeight: 700, color: good ? GREEN : RED, whiteSpace: 'nowrap' }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ─── Sparkline mini (area + garis) untuk kartu KPI ─── */
function Spark({ arr = [], color = GREEN, h = 34 }) {
  const valid = [];
  arr.forEach((v, i) => { if (v != null) valid.push({ v, i }); });
  if (valid.length < 2) return <div style={{ height: h }} />;
  const n    = arr.length || 1;
  const max  = Math.max.apply(null, valid.map(p => p.v));
  const min  = Math.min.apply(null, valid.map(p => p.v));
  const rng  = (max - min) || 1;
  const pts  = valid.map(p => ({ x: n > 1 ? (p.i / (n - 1)) * 100 : 50, y: 96 - ((p.v - min) / rng) * 84 }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} 100 L ${pts[0].x.toFixed(1)} 100 Z`;
  const gid  = 'sp-' + color.replace('#', '') + '-' + Math.round(pts[0].y);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: h + 'px', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Donut Spend Breakdown (pakai dash/offset yang sudah dihitung di dashboard) ─── */
function DonutCard({ donut }) {
  const segs  = donut?.segs || [];
  const total = donut?.total || { value: '—', label: 'Total Spend' };
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px 22px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ fontSize: '17px', fontWeight: 700, flexShrink: 0 }}>Spend Breakdown</div>
      {segs.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: '13px' }}>No data</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="38" fill="none" stroke={BORDER} strokeWidth="15" />
              {segs.map((seg, i) => (
                <circle key={i} cx="50" cy="50" r="38" fill="none"
                  stroke={seg.color} strokeWidth="15"
                  strokeDasharray={`${seg.dash} 239`} strokeDashoffset={seg.offset}
                  transform="rotate(-90 50 50)" strokeLinecap="butt" />
              ))}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.4px' }}>{total.value}</div>
              <div style={{ fontSize: '11px', color: SUB, marginTop: '2px' }}>{total.label}</div>
            </div>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {segs.map((seg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: SUB }}>{seg.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>{seg.value}</span>
                  <span style={{ fontSize: '12px', color: MUTE, width: '30px', textAlign: 'right' }}>{seg.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Kartu chart harian GABUNGAN — semua metrik dalam satu card, tiap warna satu metrik.
   Tiap garis dinormalisasi ke skala-nya sendiri (skala metrik beda jauh) supaya semua
   tren terlihat; nilai total nyata ada di legenda. ─── */
function DailyMultiCard({ chartData = {}, dates = [], summary = {} }) {
  const series = [
    { key: 'spend',     name: 'Spend',      color: GREEN,  total: fmtSpendFull(summary.totalSpend) },
    { key: 'awareness', name: 'Awareness',  color: PURPLE, total: fmtNumFull(summary.totalImpressions) },
    { key: 'traffic',   name: 'Traffic',    color: ORANGE, total: fmtNumFull(summary.totalTraffic) },
    { key: 'leads',     name: 'Leads',      color: BLUE,   total: fmtNumFull(summary.totalLeads) },
  ];
  const n = Math.max(1, ...series.map(s => (chartData[s.key] || []).length));

  const lines = series.map(s => {
    const arr = chartData[s.key] || [];
    const valid = [];
    arr.forEach((v, i) => { if (v != null) valid.push({ v, i }); });
    const max = valid.length ? Math.max.apply(null, valid.map(p => p.v)) : 1;
    const pts = valid.map(p => ({ x: n > 1 ? (p.i / (n - 1)) * 100 : 50, y: 94 - (p.v / (max || 1)) * 86 }));
    return { ...s, d: smoothPath(pts) };
  });

  // Label sumbu-X: tampilkan SEMUA tanggal (lengkap). Baru dijarangkan kalau
  // rentangnya sangat panjang (mis. kuartal) supaya angkanya tidak tumpang tindih.
  const ticks = [];
  if (dates.length) {
    const step = dates.length <= 46 ? 1 : Math.ceil(dates.length / 46);
    for (let i = 0; i < dates.length; i += step) ticks.push({ x: n > 1 ? (i / (n - 1)) * 100 : 50, label: dates[i] });
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px 22px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: '17px', fontWeight: 700 }}>Daily Performance</span>
        <span style={{ fontSize: '12px', color: MUTE }}>each line scaled to its own range</span>
      </div>

      {/* legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', margin: '14px 0 10px', flexShrink: 0 }}>
        {lines.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ width: '13px', height: '3px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: SUB }}>{s.name}</span>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{s.total}</span>
          </div>
        ))}
      </div>

      {/* chart */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          {[8, 30, 52, 74].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={BORDER} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.5" />
          ))}
          {lines.map(s => s.d && (
            <path key={s.key} d={s.d} fill="none" stroke={s.color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </svg>
      </div>

      {/* sumbu tanggal */}
      {ticks.length > 0 && (
        <div style={{ position: 'relative', height: '16px', marginTop: '8px', flexShrink: 0 }}>
          {ticks.map((t, i) => (
            <span key={i} style={{ position: 'absolute', left: t.x + '%', transform: 'translateX(-50%)', fontSize: '9.5px', color: MUTE }}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// compact: tombol icon-only (dipakai toolbar mobile biar chip muat satu baris)
export default function ExportMenu({ summary, chartData = {}, chartDates = [], donut = {}, rangeLabel = '', activeCount = 0, compact = false }) {
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
        a.href = url; a.download = `BabaRafiAdHub-report-${stamp}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [wCss, hCss] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wCss, hCss);
        pdf.save(`BabaRafiAdHub-report-${stamp}.pdf`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export gagal: ' + err.message);
    }
    setBusy(false);
  }

  const kpis = summary ? [
    { label: 'Total Spend',  value: fmtSpendFull(summary.totalSpend),     pct: summary.pctSpend,       color: GREEN,  spark: chartData.spend },
    { label: 'Reach',        value: fmtNumFull(summary.totalReach),       pct: summary.pctReach,       color: BLUE,   spark: chartData.awareness },
    { label: 'Impressions',  value: fmtNumFull(summary.totalImpressions), pct: summary.pctImpressions, color: PURPLE, spark: chartData.awareness },
    { label: 'Traffic',      value: fmtNumFull(summary.totalTraffic),     pct: summary.pctTraffic,     color: ORANGE, spark: chartData.traffic },
    { label: 'Leads',        value: fmtNumFull(summary.totalLeads),       pct: summary.pctLeads,       color: GREEN,  spark: chartData.leads },
  ] : [];

  // 4C — value penuh + badge % (biaya turun = hijau, CTR naik = hijau)
  const secondary = summary ? [
    { label: 'CPM', value: summary.calcCPM ? fmtSpendFull(summary.calcCPM) : '—', sub: 'cost per 1K impressions', icon: ScanLine,          pct: summary.pctCPM, goodDir: 'down' },
    { label: 'CPC', value: summary.calcCPC ? fmtSpendFull(summary.calcCPC) : '—', sub: 'cost per click',          icon: MousePointerClick, pct: summary.pctCPC, goodDir: 'down' },
    { label: 'CPL', value: summary.calcCPL ? fmtSpendFull(summary.calcCPL) : '—', sub: 'cost per lead',           icon: UserPlus,          pct: summary.pctCPL, goodDir: 'down' },
    { label: 'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2) + '%' : '—', sub: 'click through rate',   icon: Target,            pct: summary.pctCTR, goodDir: 'up' },
  ] : [];

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
        /* Lapisan POSISI (rata tengah thd tombol) dipisah dari lapisan ANIMASI —
           wdScaleIn pakai transform, kalau digabung translateX(-50%) popup meleset. */
        <div style={{
          position: 'absolute', top: '46px', left: '50%', transform: 'translateX(-50%)', zIndex: 50,
        }}>
        <div style={{
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
        </div>
      )}

      {/* ══════════ LAPORAN TERSEMBUNYI 16:9 (1280×720) — mirror dashboard ══════════
          Font mengikuti web (inherit Plus Jakarta Sans dari <body>). */}
      <div ref={reportRef} style={{
        position: 'fixed', left: '-10000px', top: 0, width: '1280px', height: '720px',
        background: BG, color: TXT, padding: '36px 46px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'inherit',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '18px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Logo size={27} color="#0A0F06" />
            </div>
            <div style={{ fontSize: '31px', fontWeight: 800, letterSpacing: '-0.6px' }}>Performance Marketing Report</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', padding: '7px 16px', borderRadius: '10px', background: 'rgba(47,182,115,0.14)', color: GREEN, fontSize: '15px', fontWeight: 700 }}>
              {rangeLabel || '—'}
            </div>
            <div style={{ fontSize: '13px', color: MUTE, marginTop: '8px' }}>Meta Ads · {activeCount} active campaigns</div>
          </div>
        </div>

        {/* ROW 1 — 5 KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginTop: '18px', height: '160px', flexShrink: 0 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '16px 18px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: k.color, flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: SUB }}>{k.label}</span>
              </div>
              <div style={{ fontSize: '25px', fontWeight: 800, letterSpacing: '-0.6px', margin: '9px 0 6px' }}>{k.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pct pct={k.pct} />
                <span style={{ fontSize: '12px', color: MUTE }}>vs prev period</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, marginTop: '8px', display: 'flex', alignItems: 'flex-end' }}>
                <Spark arr={k.spark} color={k.color} h={34} />
              </div>
            </div>
          ))}
        </div>

        {/* ROW 2 — 4C (CPM/CPC/CPL/CTR): satu blok rapi — icon + label/value/sub + badge % */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '14px', height: '96px', flexShrink: 0 }}>
          {secondary.map((m, i) => {
            const Ic = m.icon;
            return (
              <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, background: '#181B1F', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic size={19} color={SUB} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '14px', color: SUB }}>{m.label}</span>
                    <Pct pct={m.pct} goodDir={m.goodDir} size={13} />
                  </div>
                  <div style={{ fontSize: '25px', fontWeight: 800, letterSpacing: '-0.6px', margin: '3px 0 2px', whiteSpace: 'nowrap' }}>{m.value}</div>
                  <div style={{ fontSize: '12px', color: MUTE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ROW 3 — Spend Breakdown (donut) + Daily Performance (multi-line, gantikan Top Campaigns) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.8fr 7.2fr', gap: '14px', flex: 1, minHeight: 0, marginTop: '14px' }}>
          <DonutCard donut={donut} />
          <DailyMultiCard chartData={chartData} dates={chartDates} summary={summary || {}} />
        </div>
      </div>
    </div>
  );
}
