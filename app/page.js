'use client';

import { useState, useEffect } from 'react';
import {
  Calendar, ChevronDown, GitCompare, RefreshCw, Moon, Sun,
  DollarSign, Users, Eye, LayoutGrid, User,
  ScanLine, MousePointerClick, UserPlus, Target,
} from 'lucide-react';
import CountUp from './components/CountUp';
import AreaChart from './components/AreaChart';

/* ─── Design tokens (Figma handoff) ─── */
const BG      = '#090A0C';
const CARD    = '#121417';
const BORDER  = '#23262C';
const TXT      = '#FFFFFF';
const SUB      = '#9CA3AF';
const GREEN   = '#8BE34D';
const BLUE    = '#3B82F6';
const PURPLE  = '#8B5CF6';
const ORANGE  = '#F59E0B';

const CARD_BASE = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '18px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
};

const DATE_OPTIONS = [
  { label: 'Today',        value: 'today' },
  { label: 'Yesterday',    value: 'yesterday' },
  { label: 'Last 7 days',  value: 'last_7d' },
  { label: 'Last 14 days', value: 'last_14d' },
  { label: 'Last 30 days', value: 'last_30d' },
  { label: 'This month',   value: 'this_month' },
  { label: 'Last month',   value: 'last_month' },
];

/* ─── Helpers ─── */
function getActionValue(actions, types) {
  if (!actions) return 0;
  for (const t of types) {
    const a = actions.find(x => x.action_type === t);
    if (a) return parseInt(a.value) || 0;
  }
  return 0;
}

function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC'))                            return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}

function fmtBigNum(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0','') + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1).replace('.0','') + 'K';
  return Math.round(n).toLocaleString('id-ID');
}

function fmtSpend(n) {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)     return 'Rp ' + (n / 1_000).toFixed(0) + 'K';
  return 'Rp ' + Math.round(n);
}

function pctChange(cur, prev) {
  if (!prev || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/* ─── Date helpers (untuk sumbu chart sebulan penuh) ─── */
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetweenStr(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) + 1;
}

// Bangun array chart selebar rentang (range); slot tanpa data = null,
// jadi garis hanya muncul di hari yang punya data. Label = tanggal (day-of-month).
function buildChartData(daily, range) {
  // Fallback: tanpa range, susun kontigu seperti semula
  if (!range || !range.since || !range.until) {
    const r = { spend: [], awareness: [], traffic: [], leads: [] };
    const dates = [];
    daily.forEach((d, i) => {
      r.spend    .push(Math.round(parseFloat(d.spend || 0)));
      r.awareness.push(Math.round(parseFloat(d.impressions || 0)));
      r.traffic  .push(getActionValue(d.actions, ['link_click']));
      r.leads    .push(getActionValue(d.actions, ['lead','onsite_conversion.lead_grouped']));
      dates.push(d.date_start ? parseInt(d.date_start.slice(8, 10), 10) : i + 1);
    });
    return { data: r, dates, todayIdx: -1 };
  }

  const { since, until } = range;
  const n = Math.max(1, daysBetweenStr(since, until));
  const data = {
    spend:     Array(n).fill(null),
    awareness: Array(n).fill(null),
    traffic:   Array(n).fill(null),
    leads:     Array(n).fill(null),
  };
  const dates = [];
  for (let i = 0; i < n; i++) {
    const ds = addDaysStr(since, i);
    dates.push(parseInt(ds.slice(8, 10), 10)); // tanggal (1..31)
  }

  daily.forEach(d => {
    if (!d.date_start) return;
    const idx = daysBetweenStr(since, d.date_start) - 1;
    if (idx < 0 || idx >= n) return;
    data.spend[idx]     = Math.round(parseFloat(d.spend || 0));
    data.awareness[idx] = Math.round(parseFloat(d.impressions || 0));
    data.traffic[idx]   = getActionValue(d.actions, ['link_click']);
    data.leads[idx]     = getActionValue(d.actions, ['lead','onsite_conversion.lead_grouped']);
  });

  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayIdx  = daysBetweenStr(since, todayStr) - 1;
  return { data, dates, todayIdx: (todayIdx >= 0 && todayIdx < n) ? todayIdx : -1 };
}

/* ─── Growth badge (real prev-period comparison) ─── */
function Badge({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  const c  = up ? GREEN : '#EF4444';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
      background: up ? 'rgba(139,227,77,0.12)' : 'rgba(239,68,68,0.12)',
      color: c,
    }}>
      <span style={{ fontSize: '8px' }}>{up ? '▲' : '▼'}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ─── Mini sparkline ─── */
function Sparkline({ data, color, h = 30 }) {
  const pts = (data || []).filter(v => v != null && v >= 0);
  if (pts.length < 2) return <div style={{ height: h }} />;
  const max = Math.max(...pts) || 1;
  const min = Math.min(...pts);
  const range = max - min || 1;
  const W = 240;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = h - 3 - ((v - min) / range) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: h }}>
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.6"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" style={{ opacity: 0.85 }} />
    </svg>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ label, display, value, icon: Icon, color, pct, spark, delay }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...CARD_BASE,
        borderColor: hover ? 'rgba(255,255,255,0.14)' : BORDER,
        height: '145px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        padding: '16px 18px 10px',
        animation: `wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms backwards`,
        transition: 'border-color 0.2s',
      }}
    >
      {/* icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
          background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontSize: '14px', fontWeight: 500, color: SUB }}>{label}</span>
      </div>

      {/* value */}
      <div style={{
        fontSize: '34px', fontWeight: 700, color: TXT, letterSpacing: '-1px',
        lineHeight: 1, marginTop: '10px',
      }}>
        <CountUp value={value} display={display} delay={delay + 100} />
      </div>

      {/* badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '8px' }}>
        <Badge pct={pct} />
        {pct !== null && pct !== undefined && (
          <span style={{ fontSize: '11px', color: '#5B616B' }}>vs prev period</span>
        )}
      </div>

      {/* sparkline */}
      <div style={{ marginTop: 'auto' }}>
        <Sparkline data={spark} color={color} h={28} />
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function DashboardPage() {
  const [hoverSeg, setHoverSeg]         = useState(null);
  const [dateOpt, setDateOpt]           = useState(DATE_OPTIONS[4]); // Last 30 days
  const [showDropdown, setShowDropdown] = useState(false);
  const [customSince, setCustomSince]   = useState('');
  const [customUntil, setCustomUntil]   = useState('');
  const [isCustom, setIsCustom]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [summary, setSummary]           = useState(null);
  const [chartData, setChartData]       = useState({ spend:[], awareness:[], traffic:[], leads:[] });
  const [chartDates, setChartDates]     = useState([]);
  const [donutSegs, setDonutSegs]       = useState([]);
  const [donutTotal, setDonutTotal]     = useState({ value:'—', label:'Total Spend' });
  const [todayIdx, setTodayIdx]         = useState(0);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);

  useEffect(() => {
    if (!showDropdown) return;
    const h = e => { if (!e.target.closest('[data-filter]')) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDropdown]);

  async function fetchData(since = '', until = '') {
    setLoading(true); setError(null);
    try {
      const url = since && until
        ? `/api/meta?mode=dashboard&since=${since}&until=${until}`
        : `/api/meta?mode=dashboard&date_preset=${dateOpt.value}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const sum        = json.summary     || {};
      const prev       = json.prevSummary || {};
      const daily      = json.daily       || [];
      const campaigns  = json.campaigns   || [];
      const chartRange = json.chartRange  || null;

      const totalSpend       = parseFloat(sum.spend || 0);
      const totalReach       = parseFloat(sum.reach || 0);
      const totalImpressions = parseFloat(sum.impressions || 0);
      const curTraffic       = getActionValue(sum.actions, ['link_click']);
      const curLeadsAcc      = getActionValue(sum.actions, ['lead','onsite_conversion.lead_grouped']);

      // Periode sebelumnya (untuk growth badge) — pakai level akun biar ringan & konsisten
      const prevSpend       = parseFloat(prev.spend || 0);
      const prevReach       = parseFloat(prev.reach || 0);
      const prevImpressions = parseFloat(prev.impressions || 0);
      const prevTraffic     = getActionValue(prev.actions, ['link_click']);
      const prevLeads       = getActionValue(prev.actions, ['lead','onsite_conversion.lead_grouped']);

      setActiveCampaignCount(campaigns.filter(c => c.status === 'ACTIVE').length);

      const campsWithData  = campaigns.filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0);
      const trafficCamps   = campsWithData.filter(c => getCampaignType(c.name) === 'TRAFFIC');
      const convCamps      = campsWithData.filter(c => getCampaignType(c.name) === 'CONVERSION');
      const awareCamps     = campsWithData.filter(c => getCampaignType(c.name) === 'AWARENESS');

      const trafficSpend    = trafficCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);
      const trafficClicks   = trafficCamps.reduce((s,c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
      const convSpend       = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);
      const convLeads       = convCamps.reduce((s,c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['lead','onsite_conversion.lead_grouped']), 0);
      const convImpressions = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.impressions||0), 0);
      const convClicks      = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.clicks||0), 0);
      const awareSpend      = awareCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend||0), 0);

      setSummary({
        totalSpend, totalReach, totalImpressions,
        totalTraffic: trafficClicks,
        totalLeads:   convLeads || curLeadsAcc,
        calcCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
        calcCPC: trafficClicks > 0    ? trafficSpend / trafficClicks            : null,
        calcCPL: convLeads > 0        ? convSpend / convLeads                   : null,
        calcCTR: convImpressions > 0  ? (convClicks / convImpressions) * 100    : null,
        pctSpend:       pctChange(totalSpend, prevSpend),
        pctReach:       pctChange(totalReach, prevReach),
        pctImpressions: pctChange(totalImpressions, prevImpressions),
        pctTraffic:     pctChange(curTraffic, prevTraffic),
        pctLeads:       pctChange(curLeadsAcc, prevLeads),
      });

      const built = buildChartData(daily, chartRange);
      setChartData(built.data);
      setChartDates(built.dates);
      setTodayIdx(built.todayIdx);

      // Top campaigns (by spend) — Campaign · Spend · Leads · CTR · CPL
      const DOT = [GREEN, BLUE, PURPLE, ORANGE, '#EF4444'];
      const tops = campsWithData
        .map(c => {
          const ins  = c.insights?.data?.[0] || {};
          const sp   = parseFloat(ins.spend || 0);
          const impr = parseFloat(ins.impressions || 0);
          const clk  = parseFloat(ins.clicks || 0);
          const lds  = getActionValue(ins.actions, ['lead','onsite_conversion.lead_grouped']);
          return {
            name: c.name || '—',
            spend: sp,
            leads: lds,
            ctr: impr > 0 ? (clk / impr) * 100 : 0,
            cpl: lds > 0 ? sp / lds : null,
          };
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5)
        .map((c, i) => ({ ...c, color: DOT[i % DOT.length] }));
      setTopCampaigns(tops);

      // Donut spend breakdown
      const total = totalSpend || 1;
      const segs  = [];
      if (awareSpend > 0)   segs.push({ color: PURPLE, label:'Awareness',  pct: Math.round(awareSpend/total*100),   value: fmtSpend(awareSpend)   });
      if (trafficSpend > 0) segs.push({ color: ORANGE, label:'Traffic',    pct: Math.round(trafficSpend/total*100), value: fmtSpend(trafficSpend) });
      if (convSpend > 0)    segs.push({ color: GREEN,  label:'Conversion', pct: Math.round(convSpend/total*100),    value: fmtSpend(convSpend)    });
      const other = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (other > 0)        segs.push({ color: BLUE,   label:'Other',      pct: Math.round(other/total*100),        value: fmtSpend(other)        });

      const CIRC = 238.76;
      let offset = 0;
      setDonutSegs(segs.map(seg => {
        const dash = (seg.pct / 100) * CIRC;
        const s = { ...seg, dash: parseFloat(dash.toFixed(1)), offset: parseFloat((-offset).toFixed(1)) };
        offset += dash;
        return s;
      }));
      setDonutTotal({ value: fmtSpend(totalSpend), label: 'Total Spend' });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function applyCustomRange() {
    if (!customSince || !customUntil) return;
    setIsCustom(true); setShowDropdown(false);
    fetchData(customSince, customUntil);
  }

  function selectPreset(opt) {
    setDateOpt(opt); setIsCustom(false);
    setCustomSince(''); setCustomUntil('');
    setShowDropdown(false);
  }

  function refresh() {
    if (isCustom && customSince && customUntil) fetchData(customSince, customUntil);
    else fetchData();
  }

  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }

  const center = hoverSeg === null
    ? donutTotal
    : { value: donutSegs[hoverSeg]?.value || '—', label: donutSegs[hoverSeg]?.label || '' };

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background: BG }}>

      {/* ══ HEADER (72px) ══ */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:'72px', flexShrink:0,
        borderBottom:`1px solid ${BORDER}`,
      }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color: TXT, letterSpacing:'-0.4px' }}>Dashboard</h1>
          <p style={{ fontSize:'12px', color: SUB, marginTop:'3px' }}>
            {loading ? 'Loading…' : `Meta Ads Performance Overview · ${activeCampaignCount} active`}
          </p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {/* Date filter */}
          <div style={{ position:'relative' }} data-filter>
            <button onClick={() => setShowDropdown(d => !d)} style={{
              display:'flex', alignItems:'center', gap:'8px',
              padding:'9px 14px',
              background: CARD,
              border:`1px solid ${isCustom ? GREEN+'55' : BORDER}`,
              borderRadius:'10px', fontSize:'13px',
              color: TXT, cursor:'pointer', transition:'border-color 0.15s',
            }}>
              <Calendar size={14} color={SUB}/>
              {filterLabel()}
              <ChevronDown size={13} color={SUB}/>
            </button>

            {showDropdown && (
              <div data-filter style={{
                position:'absolute', top:'46px', right:0, zIndex:50,
                background: CARD, border:`1px solid ${BORDER}`,
                borderRadius:'12px', minWidth:'220px',
                boxShadow:'0 20px 60px rgba(0,0,0,0.7)',
                animation:'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)', overflow:'hidden',
              }}>
                <div style={{ padding:'6px' }}>
                  {DATE_OPTIONS.map(opt => {
                    const active = !isCustom && opt.value === dateOpt.value;
                    return (
                      <div key={opt.value} onClick={() => selectPreset(opt)} style={{
                        padding:'8px 11px', fontSize:'13px', cursor:'pointer', borderRadius:'7px',
                        color: active ? GREEN : SUB,
                        background: active ? 'rgba(139,227,77,0.10)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}
                      >{opt.label}</div>
                    );
                  })}
                </div>
                <div style={{ borderTop:`1px solid ${BORDER}`, padding:'12px' }}>
                  <div style={{ fontSize:'10px', fontWeight:600, letterSpacing:'1.2px', color:SUB, textTransform:'uppercase', marginBottom:'10px' }}>Custom range</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                    {[['From',customSince,setCustomSince,''],['To',customUntil,setCustomUntil,customSince]].map(([lbl,val,setter,min]) => (
                      <div key={lbl}>
                        <div style={{ fontSize:'10px', color:SUB, marginBottom:'4px' }}>{lbl}</div>
                        <input type="date" value={val} min={min} onChange={e => setter(e.target.value)} style={{
                          width:'100%', padding:'6px 8px', fontSize:'11px',
                          border:`1px solid ${BORDER}`, borderRadius:'6px',
                          background: BG, color: TXT, outline:'none', fontFamily:'inherit',
                        }}/>
                      </div>
                    ))}
                  </div>
                  <button onClick={applyCustomRange} disabled={!customSince || !customUntil} style={{
                    width:'100%', padding:'8px', fontSize:'12px', fontWeight:600,
                    border:'none', borderRadius:'7px',
                    background: customSince && customUntil ? GREEN : 'rgba(255,255,255,0.05)',
                    color:      customSince && customUntil ? '#0A0F06' : SUB,
                    cursor:     customSince && customUntil ? 'pointer' : 'default',
                  }}>Apply range</button>
                </div>
              </div>
            )}
          </div>

          <button style={{
            display:'flex', alignItems:'center', gap:'7px', padding:'9px 14px',
            background: CARD, border:`1px solid ${BORDER}`, borderRadius:'10px',
            fontSize:'13px', color:'rgba(255,255,255,0.35)', cursor:'not-allowed',
          }} title="Coming soon">
            <GitCompare size={14}/> Compare
          </button>

          <button onClick={refresh} title="Refresh" style={{
            width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center',
            background: CARD, border:`1px solid ${BORDER}`, borderRadius:'10px', cursor:'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}
          >
            <RefreshCw size={15} color={SUB} style={loading ? { animation:'wdSpin 0.8s linear infinite' } : undefined}/>
          </button>

          <ThemeToggle/>
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'24px', gap:'20px', overflow:'hidden' }}>

        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:SUB, fontSize:'13px' }}>Loading…</div>
        )}

        {!loading && error && (
          <div style={{ padding:'14px 18px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'12px', color:'#EF4444', fontSize:'12px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && summary && (<>

          {/* ══ ROW 1: KPI — 5 equal cards ══ */}
          <div style={{ flexShrink:0, display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'16px' }}>
            <KpiCard label="Total Spend"  icon={DollarSign} color={GREEN}
              value={Math.round(summary.totalSpend)} display={fmtSpend(summary.totalSpend)}
              pct={summary.pctSpend} spark={chartData.spend} delay={0}/>
            <KpiCard label="Reach"        icon={Users} color={BLUE}
              value={Math.round(summary.totalReach)} display={fmtBigNum(summary.totalReach)}
              pct={summary.pctReach} spark={chartData.awareness} delay={60}/>
            <KpiCard label="Impressions"  icon={Eye} color={PURPLE}
              value={Math.round(summary.totalImpressions)} display={fmtBigNum(summary.totalImpressions)}
              pct={summary.pctImpressions} spark={chartData.awareness} delay={110}/>
            <KpiCard label="Traffic"      icon={LayoutGrid} color={ORANGE}
              value={summary.totalTraffic} display={fmtBigNum(summary.totalTraffic)}
              pct={summary.pctTraffic} spark={chartData.traffic} delay={160}/>
            <KpiCard label="Leads"        icon={User} color={GREEN}
              value={summary.totalLeads} display={fmtBigNum(summary.totalLeads)}
              pct={summary.pctLeads} spark={chartData.leads} delay={210}/>
          </div>

          {/* ══ ROW 2: SECONDARY METRICS ══ */}
          <div style={{
            ...CARD_BASE, flexShrink:0, height:'78px',
            display:'grid', gridTemplateColumns:'repeat(4, 1fr)', overflow:'hidden',
            animation:'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 260ms backwards',
          }}>
            {[
              { label:'CPM', value: summary.calcCPM ? fmtSpend(summary.calcCPM) : '—', sub:'cost per 1K impressions', icon: ScanLine },
              { label:'CPC', value: summary.calcCPC ? fmtSpend(summary.calcCPC) : '—', sub:'cost per click',          icon: MousePointerClick },
              { label:'CPL', value: summary.calcCPL ? fmtSpend(summary.calcCPL) : '—', sub:'cost per lead',           icon: UserPlus },
              { label:'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2)+'%' : '—', sub:'click through rate',  icon: Target },
            ].map((m, i) => {
              const Ic = m.icon;
              return (
                <div key={m.label} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'0 22px', borderRight: i < 3 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize:'12px', color:SUB, marginBottom:'3px' }}>{m.label}</div>
                    <div style={{ fontSize:'20px', fontWeight:700, color:TXT, letterSpacing:'-0.5px', lineHeight:1 }}>{m.value}</div>
                    <div style={{ fontSize:'11px', color:'#5B616B', marginTop:'3px' }}>{m.sub}</div>
                  </div>
                  <Ic size={18} color="#3A3F47"/>
                </div>
              );
            })}
          </div>

          {/* ══ ROW 3: ANALYTICS — 30% / 40% / 30% ══ */}
          <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'2.55fr 4.45fr 3fr', gap:'16px' }}>

            {/* Spend Breakdown (donut) */}
            <div style={{ ...CARD_BASE, display:'flex', flexDirection:'column', overflow:'hidden', padding:'18px 20px' }}>
              <div style={{ fontSize:'15px', fontWeight:600, color:TXT, flexShrink:0 }}>Spend Breakdown</div>
              {donutSegs.length === 0 ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:SUB }}>No data</div>
              ) : (
                <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', overflow:'hidden' }}>
                  <div style={{ position:'relative', width:'150px', height:'150px', flexShrink:0 }}>
                    <svg viewBox="0 0 100 100" style={{ width:'150px', height:'150px' }}>
                      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12"/>
                      {donutSegs.map((seg, i) => {
                        let sw=12, op=1;
                        if (hoverSeg!==null){ sw=hoverSeg===i?15:8; op=hoverSeg===i?1:0.25; }
                        return (
                          <circle key={i} cx="50" cy="50" r="38" fill="none"
                            stroke={seg.color} strokeWidth={sw}
                            strokeDasharray={`${seg.dash} 239`} strokeDashoffset={seg.offset}
                            transform="rotate(-90 50 50)" strokeLinecap="butt"
                            style={{ opacity:op, transition:'stroke-width 0.2s, opacity 0.2s', cursor:'pointer' }}
                            onMouseEnter={() => setHoverSeg(i)} onMouseLeave={() => setHoverSeg(null)}/>
                        );
                      })}
                    </svg>
                    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                      <div style={{ fontSize:'17px', fontWeight:700, color:TXT, letterSpacing:'-0.4px' }}>{center.value}</div>
                      <div style={{ fontSize:'10px', color:SUB, marginTop:'3px' }}>{center.label}</div>
                    </div>
                  </div>
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'8px', overflow:'auto' }}>
                    {donutSegs.map((seg, i) => (
                      <div key={i} onMouseEnter={() => setHoverSeg(i)} onMouseLeave={() => setHoverSeg(null)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'2px 4px', borderRadius:'7px', cursor:'pointer', flexShrink:0,
                          background: hoverSeg===i ? 'rgba(255,255,255,0.04)' : 'transparent', transition:'background 0.15s' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ width:'9px', height:'9px', borderRadius:'3px', background:seg.color, flexShrink:0 }}/>
                          <span style={{ fontSize:'13px', color:SUB }}>{seg.label}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'13px', fontWeight:600, color:TXT }}>{seg.value}</span>
                          <span style={{ fontSize:'12px', color:'#5B616B' }}>{seg.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Daily Spend (area chart) */}
            <AreaChart data={chartData} dates={chartDates} today={todayIdx}/>

            {/* Top Campaigns */}
            <div style={{ ...CARD_BASE, display:'flex', flexDirection:'column', overflow:'hidden', padding:'18px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexShrink:0 }}>
                <span style={{ fontSize:'15px', fontWeight:600, color:TXT }}>Top Campaigns</span>
              </div>
              {/* header row */}
              <div style={{ display:'grid', gridTemplateColumns:'1.7fr 1fr 0.7fr 0.8fr 1fr', gap:'6px',
                fontSize:'11px', color:SUB, paddingBottom:'10px', borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span>Campaign</span>
                <span style={{ textAlign:'right' }}>Spend</span>
                <span style={{ textAlign:'right' }}>Leads</span>
                <span style={{ textAlign:'right' }}>CTR</span>
                <span style={{ textAlign:'right' }}>CPL</span>
              </div>
              <div style={{ flex:1, minHeight:0, overflow:'auto', display:'flex', flexDirection:'column' }}>
                {topCampaigns.length === 0 ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:SUB }}>No data</div>
                ) : topCampaigns.map((c, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1.7fr 1fr 0.7fr 0.8fr 1fr', gap:'6px',
                    alignItems:'center', padding:'11px 0', borderBottom: i < topCampaigns.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                      <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                      <span style={{ fontSize:'12px', color:TXT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={c.name}>{c.name}</span>
                    </div>
                    <span style={{ fontSize:'12px', color:SUB, textAlign:'right' }}>{fmtSpend(c.spend)}</span>
                    <span style={{ fontSize:'12px', color:SUB, textAlign:'right' }}>{c.leads.toLocaleString('id-ID')}</span>
                    <span style={{ fontSize:'12px', color:SUB, textAlign:'right' }}>{c.ctr.toFixed(2)}%</span>
                    <span style={{ textAlign:'right' }}>
                      <span style={{ display:'inline-block', padding:'3px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:600,
                        background: c.cpl !== null ? 'rgba(139,227,77,0.12)' : 'rgba(245,158,11,0.12)',
                        color: c.cpl !== null ? GREEN : ORANGE }}>
                        {c.cpl !== null ? fmtSpend(c.cpl) : '—'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>)}
      </div>
    </div>
  );
}

/* ─── Theme toggle ─── */
function ThemeToggle() {
  const [dark, setDark] = useState(true);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  }
  return (
    <button onClick={toggle} style={{
      width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center',
      background: CARD, border:`1px solid ${BORDER}`, borderRadius:'10px', cursor:'pointer',
      transition:'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'}
    onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}
    >
      {dark ? <Moon size={15} color={SUB}/> : <Sun size={15} color={GREEN}/>}
    </button>
  );
}
