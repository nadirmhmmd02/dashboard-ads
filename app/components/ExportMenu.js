'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, Image as ImageIcon, Zap, Loader2 } from 'lucide-react';

/* ─── Tokens (samain sama dashboard) ─── */
const BG     = '#090A0C';
const CARD   = '#121417';
const BORDER = '#23262C';
const TXT    = '#FFFFFF';
const SUB    = '#9CA3AF';
const MUTE   = '#5B616B';
const GREEN  = '#8BE34D';
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';
const ORANGE = '#F59E0B';

/* ─── Format helpers (self-contained) ─── */
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

function Pct({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0, c = up ? GREEN : '#EF4444';
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, color: c }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function ExportMenu({ summary, donutSegs = [], topCampaigns = [], chartData = {}, rangeLabel = '', activeCount = 0 }) {
  const [open, setOpen]         = useState(false);
  const [busy, setBusy]         = useState(false);
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
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, backgroundColor: BG, useCORS: true, logging: false,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const wCss = canvas.width / 2, hCss = canvas.height / 2;

      if (type === 'jpg') {
        const url = canvas.toDataURL('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = url; a.download = `WILLOFD-report-${stamp}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: hCss >= wCss ? 'portrait' : 'landscape', unit: 'px', format: [wCss, hCss] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, wCss, hCss);
        pdf.save(`WILLOFD-report-${stamp}.pdf`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export gagal: ' + err.message);
    }
    setBusy(false);
  }

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

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

  // Area chart untuk laporan (spend harian)
  const spendArr = (chartData.spend || []);
  const valid = [];
  spendArr.forEach((v, i) => { if (v != null) valid.push({ v, i }); });
  const nAll = spendArr.length || 1;
  const cmax = Math.max.apply(null, valid.length ? valid.map(p => p.v) : [1]) || 1;
  const CW = 984, CH = 200;
  const cpts = valid.map(p => ({ x: nAll > 1 ? (p.i / (nAll - 1)) * CW : CW / 2, y: CH - 12 - (p.v / cmax) * (CH - 30) }));
  const cLine = smoothPath(cpts);
  const cArea = cpts.length >= 2 ? `${cLine} L ${cpts[cpts.length-1].x.toFixed(1)} ${CH} L ${cpts[0].x.toFixed(1)} ${CH} Z` : '';

  return (
    <div style={{ position: 'relative' }} data-export>
      {/* ── Tombol Export ── */}
      <button
        onClick={() => !busy && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 14px',
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px',
          fontSize: '13px', color: busy ? SUB : TXT, cursor: busy ? 'default' : 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
        onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
      >
        {busy
          ? <Loader2 size={14} color={SUB} style={{ animation: 'wdSpin 0.8s linear infinite' }} />
          : <Download size={14} color={SUB} />}
        {busy ? 'Exporting…' : 'Export'}
        {!busy && <ChevronDown size={13} color={SUB} />}
      </button>

      {/* ── Dropdown pilihan format ── */}
      {open && !busy && (
        <div style={{
          position: 'absolute', top: '46px', right: 0, zIndex: 50,
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px',
          minWidth: '190px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', padding: '6px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', color: MUTE, textTransform: 'uppercase', padding: '6px 10px 8px' }}>
            Export as
          </div>
          {[
            { type: 'pdf', label: 'PDF Document', icon: FileText, hint: '.pdf' },
            { type: 'jpg', label: 'JPG Image',    icon: ImageIcon, hint: '.jpg' },
          ].map(o => {
            const Ic = o.icon;
            return (
              <div key={o.type} onClick={() => runExport(o.type)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: SUB,
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = TXT; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = SUB; }}
              >
                <Ic size={16} />
                <span style={{ flex: 1 }}>{o.label}</span>
                <span style={{ fontSize: '11px', color: MUTE }}>{o.hint}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ LAPORAN TERSEMBUNYI (di-render ke gambar) ══════════ */}
      <div ref={reportRef} style={{
        position: 'fixed', left: '-10000px', top: 0, width: '1080px',
        background: BG, color: TXT, padding: '44px 48px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '22px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={26} color="#0A0F06" fill="#0A0F06" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '1px' }}>WILL OF D</div>
              <div style={{ fontSize: '13px', color: SUB, marginTop: '2px' }}>Performance Marketing Report</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '9px', background: 'rgba(139,227,77,0.12)', color: GREEN, fontSize: '14px', fontWeight: 600 }}>
              {rangeLabel || '—'}
            </div>
            <div style={{ fontSize: '12px', color: MUTE, marginTop: '8px' }}>Meta Ads · {activeCount} active campaigns</div>
            <div style={{ fontSize: '12px', color: MUTE, marginTop: '2px' }}>Generated {generatedAt}</div>
          </div>
        </div>

        {/* Section: KPI */}
        <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1.4px', color: MUTE, textTransform: 'uppercase', margin: '26px 0 14px' }}>Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: k.color }} />
                <span style={{ fontSize: '13px', color: SUB }}>{k.label}</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.6px', marginTop: '12px' }}>{k.value}</div>
              <div style={{ marginTop: '8px' }}><Pct pct={k.pct} /></div>
            </div>
          ))}
        </div>

        {/* Section: Efficiency metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '14px' }}>
          {secondary.map((m, i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '14px 18px' }}>
              <div style={{ fontSize: '12px', color: SUB }}>{m.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', margin: '4px 0 3px' }}>{m.value}</div>
              <div style={{ fontSize: '11px', color: MUTE }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Section: Daily Spend trend */}
        <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1.4px', color: MUTE, textTransform: 'uppercase', margin: '26px 0 14px' }}>Daily Spend Trend</div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px' }}>
          <svg width={CW} height={CH} style={{ display: 'block', width: '100%', height: CH + 'px', overflow: 'visible' }} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="rpt-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity="0.30" />
                <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map(i => (
              <line key={i} x1="0" y1={(i / 3) * (CH - 18)} x2={CW} y2={(i / 3) * (CH - 18)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {cArea && <path d={cArea} fill="url(#rpt-fill)" />}
            {cLine && <path d={cLine} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
            {cpts.length <= 7 && cpts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" fill={GREEN} stroke={CARD} strokeWidth="2" />
            ))}
          </svg>
        </div>

        {/* Section: Breakdown + Top Campaigns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '14px', marginTop: '26px' }}>
          {/* Spend Breakdown */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '18px' }}>Spend Breakdown</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
              <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
                <svg viewBox="0 0 100 100" style={{ width: '130px', height: '130px' }}>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  {donutSegs.map((seg, i) => (
                    <circle key={i} cx="50" cy="50" r="38" fill="none" stroke={seg.color} strokeWidth="12"
                      strokeDasharray={`${seg.dash} 239`} strokeDashoffset={seg.offset} transform="rotate(-90 50 50)" />
                  ))}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{summary ? fmtSpend(summary.totalSpend) : '—'}</div>
                  <div style={{ fontSize: '10px', color: SUB, marginTop: '2px' }}>Total Spend</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {donutSegs.length === 0 ? (
                  <div style={{ fontSize: '13px', color: SUB }}>No data</div>
                ) : donutSegs.map((seg, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color }} />
                      <span style={{ fontSize: '13px', color: SUB }}>{seg.label}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 600, marginRight: '8px' }}>{seg.value}</span>
                      <span style={{ fontSize: '12px', color: MUTE }}>{seg.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Campaigns */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Top Campaigns</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 0.8fr 1fr', gap: '6px', fontSize: '11px', color: SUB, paddingBottom: '10px', borderBottom: `1px solid ${BORDER}` }}>
              <span>Campaign</span>
              <span style={{ textAlign: 'right' }}>Spend</span>
              <span style={{ textAlign: 'right' }}>Leads</span>
              <span style={{ textAlign: 'right' }}>CTR</span>
              <span style={{ textAlign: 'right' }}>CPL</span>
            </div>
            {topCampaigns.length === 0 ? (
              <div style={{ fontSize: '13px', color: SUB, padding: '14px 0' }}>No data</div>
            ) : topCampaigns.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr 0.7fr 0.8fr 1fr', gap: '6px', alignItems: 'center', padding: '10px 0', borderBottom: i < topCampaigns.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                </div>
                <span style={{ fontSize: '12px', color: SUB, textAlign: 'right' }}>{fmtSpend(c.spend)}</span>
                <span style={{ fontSize: '12px', color: SUB, textAlign: 'right' }}>{(c.leads || 0).toLocaleString('id-ID')}</span>
                <span style={{ fontSize: '12px', color: SUB, textAlign: 'right' }}>{(c.ctr || 0).toFixed(2)}%</span>
                <span style={{ fontSize: '12px', color: c.cpl !== null ? GREEN : ORANGE, textAlign: 'right', fontWeight: 600 }}>
                  {c.cpl !== null ? fmtSpend(c.cpl) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', paddingTop: '18px', borderTop: `1px solid ${BORDER}`, fontSize: '11px', color: MUTE }}>
          <span>WILL OF D · Performance Marketing Dashboard</span>
          <span>Data source: Meta Ads · dashboard-ads-six.vercel.app</span>
        </div>
      </div>
    </div>
  );
}
