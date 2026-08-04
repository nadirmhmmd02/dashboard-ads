'use client';

import { useState, useRef, useEffect, forwardRef } from 'react';
import {
  Download, ChevronDown, FileText, Image as ImageIcon, Loader2,
  ScanLine, MousePointerClick, UserPlus, Target,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from './AuthContext';
import { authFetch } from '../supabase';
import { buildReportData, monthChunks, isWholeMonths, rangeLabelOf, monthToken } from './reportData';

/* ─── Warna data — SAMA di kedua tema (aturan palet redesain 2026) ─── */
const GREEN  = '#2FB673';   // emerald
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';
const ORANGE = '#F59E0B';
const RED    = '#EF4444';

/* ─── Palet laporan — IKUT tema dashboard yang sedang dipakai ───
   Nilainya sengaja hex literal (bukan var CSS): laporan di-render di elemen
   tersembunyi lalu difoto html2canvas, jadi warnanya harus pasti.
   Angka-angkanya dijaga sama dengan globals.css biar hasil export identik
   dengan yang dilihat di layar. */
const REPORT_THEME = {
  dark: {
    BG: '#090A0C', CARD: '#121417', BORDER: '#23262C', TILE: '#181B1F',
    TXT: '#FFFFFF', SUB: '#9CA3AF', MUTE: '#5B616B',
    ACCENT: GREEN, ACCENT_SOFT: 'rgba(47,182,115,0.14)',
    LOGO_BG: GREEN, LOGO_MARK: '#0A0F06',
    POS: GREEN,                 // badge % naik — sama dgn --pos tema gelap
  },
  light: {
    BG: '#F1F2EF', CARD: '#FFFFFF', BORDER: '#E7E9E4', TILE: '#F1F2EF',
    // MUTE sengaja sedikit lebih gelap dari --t3 layar (#93A099, cuma 2.7:1 di
    // putih): laporan ini dicetak/diproyeksikan, teks kecilnya harus tetap kebaca.
    TXT: '#101915', SUB: '#5F6B63', MUTE: '#78857D',
    ACCENT: '#1E6B4B', ACCENT_SOFT: 'rgba(30,107,75,0.10)',
    LOGO_BG: '#14382A', LOGO_MARK: '#C8F169',
    POS: '#16A34A',             // --pos tema terang: hijau lebih gelap biar terbaca di putih
  },
};
const paletteFor = (theme) => REPORT_THEME[theme === 'light' ? 'light' : 'dark'];

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

/* ─── Badge % vs periode sebelumnya (panah = arah nyata; warna = baik/buruk) ─── */
function Pct({ pct, goodDir = 'up', size = 14, P }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  const good = goodDir === 'up' ? up : !up;
  return (
    <span style={{ fontSize: size + 'px', fontWeight: 700, color: good ? P.POS : RED, whiteSpace: 'nowrap' }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ─── Sparkline mini untuk kartu KPI ─── */
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

/* ─── Donut Spend Breakdown ─── */
function DonutCard({ donut, P }) {
  const { CARD, BORDER, SUB, MUTE } = P;
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

/* ─── Kartu chart harian gabungan (semua metrik, tiap warna satu metrik) ───
   Sumbu-X: tampil LENGKAP kalau ≤ ~1 bulan; kalau lebih panjang (mis. 2 bulan
   jadi 1 gambar) ditipiskan proporsional jadi ~15 label biar tidak berdesakan. */
function DailyMultiCard({ chartData = {}, dates = [], summary = {}, P }) {
  const { CARD, BORDER, SUB, MUTE } = P;
  const series = [
    { key: 'spend',     name: 'Spend',     color: GREEN,  total: fmtSpendFull(summary.totalSpend) },
    { key: 'awareness', name: 'Awareness', color: PURPLE, total: fmtNumFull(summary.totalImpressions) },
    { key: 'traffic',   name: 'Traffic',   color: ORANGE, total: fmtNumFull(summary.totalTraffic) },
    { key: 'leads',     name: 'Leads',     color: BLUE,   total: fmtNumFull(summary.totalLeads) },
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

  const ticks = [];
  if (dates.length) {
    const step = dates.length <= 33 ? 1 : Math.ceil(dates.length / 15);
    for (let i = 0; i < dates.length; i += step) ticks.push({ x: n > 1 ? (i / (n - 1)) * 100 : 50, label: dates[i] });
  }
  const denseTicks = ticks.length > 20;

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
            <span key={i} style={{ position: 'absolute', left: t.x + '%', transform: 'translateX(-50%)', fontSize: denseTicks ? '9.5px' : '11px', color: MUTE }}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── ReportBody — kartu laporan 1280×720 (dipakai untuk 1 gambar & pisah per bulan) ─── */
const ReportBody = forwardRef(function ReportBody({ summary, chartData = {}, chartDates = [], donut = {}, rangeLabel = '', activeCount = 0, P }, ref) {
  const { BG, CARD, BORDER, TILE, TXT, SUB, MUTE, ACCENT, ACCENT_SOFT, LOGO_BG, LOGO_MARK } = P;
  const kpis = summary ? [
    { label: 'Total Spend',  value: fmtSpendFull(summary.totalSpend),     pct: summary.pctSpend,       color: GREEN,  spark: chartData.spend },
    { label: 'Reach',        value: fmtNumFull(summary.totalReach),       pct: summary.pctReach,       color: BLUE,   spark: chartData.awareness },
    { label: 'Impressions',  value: fmtNumFull(summary.totalImpressions), pct: summary.pctImpressions, color: PURPLE, spark: chartData.awareness },
    { label: 'Traffic',      value: fmtNumFull(summary.totalTraffic),     pct: summary.pctTraffic,     color: ORANGE, spark: chartData.traffic },
    { label: 'Leads',        value: fmtNumFull(summary.totalLeads),       pct: summary.pctLeads,       color: GREEN,  spark: chartData.leads },
  ] : [];
  const secondary = summary ? [
    { label: 'CPM', value: summary.calcCPM ? fmtSpendFull(summary.calcCPM) : '—', sub: 'cost per 1K impressions', icon: ScanLine,          pct: summary.pctCPM, goodDir: 'down' },
    { label: 'CPC', value: summary.calcCPC ? fmtSpendFull(summary.calcCPC) : '—', sub: 'cost per click',          icon: MousePointerClick, pct: summary.pctCPC, goodDir: 'down' },
    { label: 'CPL', value: summary.calcCPL ? fmtSpendFull(summary.calcCPL) : '—', sub: 'cost per lead',           icon: UserPlus,          pct: summary.pctCPL, goodDir: 'down' },
    { label: 'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2) + '%' : '—', sub: 'click through rate',   icon: Target,            pct: summary.pctCTR, goodDir: 'up' },
  ] : [];

  return (
    <div ref={ref} style={{
      position: 'fixed', left: '-10000px', top: 0, width: '1280px', height: '720px',
      background: BG, color: TXT, padding: '36px 46px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '18px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: LOGO_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Logo size={27} color={LOGO_MARK} />
          </div>
          <div style={{ fontSize: '31px', fontWeight: 800, letterSpacing: '-0.6px' }}>Performance Marketing Report</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-block', padding: '7px 16px', borderRadius: '10px', background: ACCENT_SOFT, color: ACCENT, fontSize: '15px', fontWeight: 700 }}>
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
              <Pct pct={k.pct} P={P} />
              <span style={{ fontSize: '12px', color: MUTE }}>vs prev period</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, marginTop: '8px', display: 'flex', alignItems: 'flex-end' }}>
              <Spark arr={k.spark} color={k.color} h={34} />
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2 — 4C */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '14px', height: '96px', flexShrink: 0 }}>
        {secondary.map((m, i) => {
          const Ic = m.icon;
          return (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, background: TILE, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ic size={19} color={SUB} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '14px', color: SUB }}>{m.label}</span>
                  <Pct pct={m.pct} goodDir={m.goodDir} size={13} P={P} />
                </div>
                <div style={{ fontSize: '25px', fontWeight: 800, letterSpacing: '-0.6px', margin: '3px 0 2px', whiteSpace: 'nowrap' }}>{m.value}</div>
                <div style={{ fontSize: '12px', color: MUTE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ROW 3 — donut + daily performance */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.8fr 7.2fr', gap: '14px', flex: 1, minHeight: 0, marginTop: '14px' }}>
        <DonutCard donut={donut} P={P} />
        <DailyMultiCard chartData={chartData} dates={chartDates} summary={summary || {}} P={P} />
      </div>
    </div>
  );
});

// compact: tombol icon-only (dipakai toolbar mobile biar chip muat satu baris)
export default function ExportMenu({ summary, chartData = {}, chartDates = [], donut = {}, rangeLabel = '', activeCount = 0, since = '', until = '', compact = false }) {
  // Laporan hasil export ikut tema dashboard yang sedang aktif (terang/gelap)
  const { theme } = useAuth();
  const P = paletteFor(theme);

  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [splitMode, setSplitMode] = useState('combined');   // 'combined' | 'perMonth'
  const [split, setSplit] = useState(null);                 // { format, reports:[...] } saat menangkap gambar per bulan
  const reportRef = useRef(null);
  const splitRefs = useRef([]);

  // Opsi "pisah per bulan" hanya kalau filter = beberapa bulan penuh (≥2)
  const months   = isWholeMonths(since, until) ? monthChunks(since, until) : [];
  const canSplit = months.length >= 2;

  useEffect(() => {
    if (!open) return;
    const h = e => { if (!e.target.closest('[data-export]')) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const stamp = () => new Date().toISOString().slice(0, 10);

  // Export 1 gambar (rentang aktif apa adanya) — snapshot report tunggal
  async function runSingle(type) {
    if (!reportRef.current || busy) return;
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: P.BG, useCORS: true, logging: false });
      const wCss = canvas.width / 2, hCss = canvas.height / 2;
      if (type === 'jpg') {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg', 0.95); a.download = `BabaRafiAdHub-report-${stamp()}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [wCss, hCss] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wCss, hCss);
        pdf.save(`BabaRafiAdHub-report-${stamp()}.pdf`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export gagal: ' + err.message);
    }
    setBusy(false);
  }

  // Export pisah per bulan: fetch tiap bulan → build → render N ReportBody → capture (di useEffect)
  async function runSplit(type) {
    if (busy) return;
    setBusy(true);
    try {
      const reports = await Promise.all(months.map(async (mo) => {
        const res  = await authFetch(`/api/meta?mode=dashboard&since=${mo.since}&until=${mo.until}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        return { ...buildReportData(json), rangeLabel: rangeLabelOf(mo.since, mo.until), token: monthToken(mo) };
      }));
      splitRefs.current = [];
      setSplit({ format: type, reports });   // trigger render + capture di useEffect
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export gagal: ' + err.message);
      setBusy(false);
    }
  }

  // Tangkap gambar per bulan setelah N ReportBody ter-render
  useEffect(() => {
    if (!split) return;
    let cancelled = false;
    (async () => {
      // tunggu 2 frame + sedikit jeda supaya layout & font matang
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 80));
      if (cancelled) return;
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvases = [];
        for (let i = 0; i < split.reports.length; i++) {
          const el = splitRefs.current[i];
          if (el) canvases.push(await html2canvas(el, { scale: 2, backgroundColor: P.BG, useCORS: true, logging: false }));
        }
        if (split.format === 'jpg') {
          // JPG: tiap bulan jadi file terpisah, kedownload otomatis satu per satu (bukan zip)
          for (let i = 0; i < canvases.length; i++) {
            const a = document.createElement('a');
            a.href = canvases[i].toDataURL('image/jpeg', 0.95);
            a.download = `BabaRafiAdHub-report-${split.reports[i].token}-${stamp()}.jpg`;
            document.body.appendChild(a); a.click(); a.remove();
            await new Promise(r => setTimeout(r, 400));   // jeda antar unduhan biar tidak diblok browser
          }
        } else {
          // PDF: satu file, N lembar berurutan
          const { jsPDF } = await import('jspdf');
          let pdf;
          canvases.forEach((c, i) => {
            const w = c.width / 2, h = c.height / 2;
            if (i === 0) pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [w, h] });
            else pdf.addPage([w, h], 'landscape');
            pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h);
          });
          if (pdf) pdf.save(`BabaRafiAdHub-report-${split.reports.length}bulan-${stamp()}.pdf`);
        }
      } catch (err) {
        console.error('Export failed:', err);
        alert('Export gagal: ' + err.message);
      }
      if (!cancelled) { setSplit(null); setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [split]);

  function handleFormat(type) {
    setOpen(false);
    if (canSplit && splitMode === 'perMonth') runSplit(type);
    else runSingle(type);
  }

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

      {/* ── Dropdown format (+ pilihan pisah per bulan kalau filter beberapa bulan) ── */}
      {open && !busy && (
        <div style={{ position: 'absolute', top: '46px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
        <div style={{
          background: UI_CARD, border: `1px solid ${UI_BORDER}`, borderRadius: '12px', minWidth: canSplit ? '244px' : '190px',
          boxShadow: 'var(--pop-shadow)', animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', padding: '6px',
        }}>
          {canSplit && (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.8px', color: UI_MUTE, textTransform: 'uppercase', padding: '6px 10px 6px' }}>
                {months.length} bulan — jadikan
              </div>
              <div style={{ display: 'flex', gap: '6px', padding: '0 8px 8px' }}>
                {[
                  { v: 'combined', label: '1 gambar' },
                  { v: 'perMonth', label: `Per bulan (${months.length})` },
                ].map(opt => {
                  const on = splitMode === opt.v;
                  return (
                    <button key={opt.v} onClick={() => setSplitMode(opt.v)} style={{
                      flex: 1, padding: '8px 6px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                      border: `1px solid ${on ? 'var(--cal-accent)' : UI_BORDER}`,
                      background: on ? 'var(--cal-accent-soft, var(--hover))' : 'transparent',
                      color: on ? 'var(--ac)' : UI_SUB, transition: 'all 0.12s',
                    }}>{opt.label}</button>
                  );
                })}
              </div>
              <div style={{ height: '1px', background: UI_BORDER, margin: '0 8px 6px' }} />
            </>
          )}
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1.4px', color: UI_MUTE, textTransform: 'uppercase', padding: '2px 10px 8px' }}>Export as</div>
          {[
            { type: 'pdf', label: 'PDF Document', icon: FileText, hint: canSplit && splitMode === 'perMonth' ? `${months.length} lembar` : '.pdf' },
            { type: 'jpg', label: 'JPG Image',    icon: ImageIcon, hint: canSplit && splitMode === 'perMonth' ? `${months.length} file` : '.jpg' },
          ].map(o => {
            const Ic = o.icon;
            return (
              <div key={o.type} onClick={() => handleFormat(o.type)} style={{
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

      {/* Report tunggal (tersembunyi) — sumber export 1 gambar */}
      <ReportBody ref={reportRef} summary={summary} chartData={chartData} chartDates={chartDates} donut={donut} rangeLabel={rangeLabel} activeCount={activeCount} P={P} />

      {/* Report per bulan (tersembunyi, hanya saat proses pisah) — sumber capture */}
      {split && split.reports.map((r, i) => (
        <ReportBody key={i} ref={el => { splitRefs.current[i] = el; }}
          summary={r.summary} chartData={r.chartData} chartDates={r.chartDates}
          donut={r.donut} rangeLabel={r.rangeLabel} activeCount={r.activeCount} P={P} />
      ))}
    </div>
  );
}
