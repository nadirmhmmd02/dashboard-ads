'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, GitCompare, Moon, Sun } from 'lucide-react';
import CountUp from './components/CountUp';
import BarChart from './components/BarChart';

/* ─── Design tokens ─── */
const LIME     = '#a3e635';
const LIME_DIM = 'rgba(163,230,53,0.10)';
const CARD     = {
  background:   '#111111',
  border:       '1px solid rgba(255,255,255,0.07)',
  borderRadius: '14px',
  boxShadow:    '0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
};

const LABEL_STYLE = {
  fontSize: '10px', fontWeight: '600',
  textTransform: 'uppercase', letterSpacing: '1.2px',
  color: '#505050',
};

/* ─── Date options ─── */
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
  for (const type of types) {
    const a = actions.find(x => x.action_type === type);
    if (a) return parseInt(a.value) || 0;
  }
  return 0;
}

function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC')) return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}

function fmtBigNum(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.0','') + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1).replace('.0','') + 'K';
  return n.toLocaleString('id-ID');
}

function fmtSpend(n) {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1_000)     return 'Rp ' + (n / 1_000).toFixed(0) + 'K';
  return 'Rp ' + Math.round(n);
}

function buildChartData(daily) {
  const r = { spend: [], awareness: [], traffic: [], leads: [] };
  daily.forEach(d => {
    r.spend    .push(Math.round(parseFloat(d.spend || 0)));
    r.awareness.push(Math.round(parseFloat(d.impressions || 0)));
    r.traffic  .push(getActionValue(d.actions, ['link_click']));
    r.leads    .push(getActionValue(d.actions, ['lead','onsite_conversion.lead_grouped']));
  });
  return r;
}

/* ─── Main component ─── */
export default function DashboardPage() {
  const [hoverSeg, setHoverSeg]   = useState(null);
  const [dateOpt, setDateOpt]     = useState(DATE_OPTIONS[5]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customSince, setCustomSince]   = useState('');
  const [customUntil, setCustomUntil]   = useState('');
  const [isCustom, setIsCustom]         = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [summary, setSummary]   = useState(null);
  const [chartData, setChartData]   = useState({ spend:[], awareness:[], traffic:[], leads:[] });
  const [donutSegs, setDonutSegs]   = useState([]);
  const [donutTotal, setDonutTotal] = useState({ value:'—', label:'Total spend' });
  const [todayIdx, setTodayIdx]     = useState(0);
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

      const sum       = json.summary   || {};
      const daily     = json.daily     || [];
      const campaigns = json.campaigns || [];

      const totalSpend       = parseFloat(sum.spend || 0);
      const totalReach       = parseFloat(sum.reach || 0);
      const totalImpressions = parseFloat(sum.impressions || 0);
      const totalLeads       = getActionValue(sum.actions, ['lead','onsite_conversion.lead_grouped']);

      const activeCamps    = campaigns.filter(c => c.status === 'ACTIVE');
      setActiveCampaignCount(activeCamps.length);

      const campsWithData  = campaigns.filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0);
      const trafficCamps   = campsWithData.filter(c => getCampaignType(c.name) === 'TRAFFIC');
      const convCamps      = campsWithData.filter(c => getCampaignType(c.name) === 'CONVERSION');
      const awareCamps     = campsWithData.filter(c => getCampaignType(c.name) === 'AWARENESS');

      const trafficSpend    = trafficCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
      const trafficClicks   = trafficCamps.reduce((s,c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
      const convSpend       = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
      const convLeads       = convCamps.reduce((s,c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['lead','onsite_conversion.lead_grouped']), 0);
      const convImpressions = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
      const convClicks      = convCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.clicks || 0), 0);
      const awareSpend      = awareCamps.reduce((s,c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);

      setSummary({
        totalSpend, totalReach, totalImpressions,
        totalTraffic: trafficClicks,
        totalLeads:   convLeads || totalLeads,
        calcCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
        calcCPC: trafficClicks > 0    ? trafficSpend / trafficClicks : null,
        calcCPL: convLeads > 0        ? convSpend / convLeads : null,
        calcCTR: convImpressions > 0  ? (convClicks / convImpressions) * 100 : null,
      });

      setChartData(buildChartData(daily));
      setTodayIdx(daily.length);

      const total = totalSpend || 1;
      const segs  = [];
      if (awareSpend > 0)   segs.push({ color:'#8b5cf6', label:'Awareness',  pct: Math.round(awareSpend   / total * 100), value: fmtSpend(awareSpend)  });
      if (trafficSpend > 0) segs.push({ color:'#f59e0b', label:'Traffic',    pct: Math.round(trafficSpend / total * 100), value: fmtSpend(trafficSpend) });
      if (convSpend > 0)    segs.push({ color:'#10b981', label:'Conversion', pct: Math.round(convSpend    / total * 100), value: fmtSpend(convSpend)    });
      const otherSpend = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (otherSpend > 0)   segs.push({ color:'#3b82f6', label:'Other',      pct: Math.round(otherSpend   / total * 100), value: fmtSpend(otherSpend)  });

      const CIRC = 238.76;
      let offset = 0;
      setDonutSegs(segs.map(seg => {
        const dash = (seg.pct / 100) * CIRC;
        const s = { ...seg, dash: parseFloat(dash.toFixed(1)), offset: parseFloat((-offset).toFixed(1)) };
        offset += dash;
        return s;
      }));
      setDonutTotal({ value: fmtSpend(totalSpend), label: 'Total spend' });
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

  const BIG_CARDS = summary ? [
    { dot:'#10b981', label:'Total Spend',  value: Math.round(summary.totalSpend),       display: fmtSpend(summary.totalSpend),       sub:'all campaigns' },
    { dot:'#3b82f6', label:'Reach',        value: Math.round(summary.totalReach),        display: fmtBigNum(summary.totalReach),       sub:'all campaigns' },
    { dot:'#8b5cf6', label:'Impressions',  value: Math.round(summary.totalImpressions),  display: fmtBigNum(summary.totalImpressions), sub:'all campaigns' },
    { dot:'#f59e0b', label:'Traffic',      value: summary.totalTraffic,                  display: fmtBigNum(summary.totalTraffic),     sub:'traffic only' },
    { dot:'#10b981', label:'Leads',        value: summary.totalLeads,                    display: fmtBigNum(summary.totalLeads),       sub:'conversion only' },
  ] : [];

  const SMALL_CARDS = summary ? [
    { label:'CPM', value: summary.calcCPM ? fmtSpend(summary.calcCPM) : '—', sub:'cost per 1K impr.' },
    { label:'CPC', value: summary.calcCPC ? fmtSpend(summary.calcCPC) : '—', sub:'traffic campaigns' },
    { label:'CPL', value: summary.calcCPL ? fmtSpend(summary.calcCPL) : '—', sub:'conversion campaigns' },
    { label:'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2)+'%' : '—', sub:'conversion campaigns' },
  ] : [];

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'var(--pg)' }}>

      {/* ══ TOPBAR ══ */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:'54px', flexShrink:0,
        borderBottom:'1px solid rgba(255,255,255,0.05)',
      }}>
        <div>
          <h1 style={{ fontSize:'15px', fontWeight:'600', color:'var(--t1)', letterSpacing:'-0.3px', lineHeight:1 }}>
            Dashboard
          </h1>
          <p style={{ fontSize:'11px', color:'var(--t3)', marginTop:'3px', letterSpacing:'0.1px' }}>
            Meta Ads · {loading ? 'loading…' : `${activeCampaignCount} active campaigns`}
          </p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>

          {/* Date filter */}
          <div style={{ position:'relative' }} data-filter>
            <button
              onClick={() => setShowDropdown(d => !d)}
              style={{
                display:'flex', alignItems:'center', gap:'7px',
                padding:'7px 13px',
                background:'#161616',
                border:`1px solid ${isCustom ? LIME : 'rgba(255,255,255,0.09)'}`,
                borderRadius:'9px', fontSize:'12px',
                color:'rgba(255,255,255,0.75)', cursor:'pointer',
                letterSpacing:'-0.1px',
                transition:'border-color 0.15s',
              }}
            >
              <Calendar size={14} color="rgba(255,255,255,0.4)" />
              {filterLabel()}
              <ChevronDown size={13} color="rgba(255,255,255,0.3)" />
            </button>

            {showDropdown && (
              <div data-filter style={{
                position:'absolute', top:'40px', right:0, zIndex:50,
                background:'#161616',
                border:'1px solid rgba(255,255,255,0.09)',
                borderRadius:'12px', minWidth:'220px',
                boxShadow:'0 16px 48px rgba(0,0,0,0.6)',
                animation:'wdScaleIn 0.16s cubic-bezier(0.4,0,0.2,1)',
                overflow:'hidden',
              }}>
                <div style={{ padding:'6px' }}>
                  {DATE_OPTIONS.map(opt => {
                    const active = !isCustom && opt.value === dateOpt.value;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => selectPreset(opt)}
                        style={{
                          padding:'8px 12px', fontSize:'12px', cursor:'pointer', borderRadius:'7px',
                          color: active ? LIME : 'rgba(255,255,255,0.6)',
                          background: active ? LIME_DIM : 'transparent',
                          transition:'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}
                      >
                        {opt.label}
                      </div>
                    );
                  })}
                </div>
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px' }}>
                  <div style={{ ...LABEL_STYLE, marginBottom:'10px' }}>Custom range</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                    {[['From', customSince, setCustomSince, ''], ['To', customUntil, setCustomUntil, customSince]].map(([lbl,val,setter,min]) => (
                      <div key={lbl}>
                        <div style={{ fontSize:'10px', color:'var(--t3)', marginBottom:'5px' }}>{lbl}</div>
                        <input
                          type="date" value={val} min={min}
                          onChange={e => setter(e.target.value)}
                          style={{
                            width:'100%', padding:'6px 8px', fontSize:'11px',
                            border:'1px solid rgba(255,255,255,0.09)', borderRadius:'7px',
                            background:'#111', color:'var(--t1)', outline:'none', fontFamily:'inherit',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={applyCustomRange}
                    disabled={!customSince || !customUntil}
                    style={{
                      width:'100%', padding:'8px', fontSize:'12px', fontWeight:'600',
                      border:'none', borderRadius:'7px', cursor: customSince && customUntil ? 'pointer' : 'default',
                      background: customSince && customUntil ? LIME : 'rgba(255,255,255,0.06)',
                      color: customSince && customUntil ? '#000' : 'var(--t3)',
                      transition:'background 0.15s, color 0.15s',
                    }}
                  >
                    Apply range
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Compare (disabled) */}
          <button style={{
            display:'flex', alignItems:'center', gap:'7px',
            padding:'7px 13px',
            background:'#161616',
            border:'1px solid rgba(255,255,255,0.09)',
            borderRadius:'9px', fontSize:'12px',
            color:'rgba(255,255,255,0.25)', cursor:'not-allowed',
          }} title="Coming soon">
            <GitCompare size={14} /> Compare
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'16px 20px', gap:'10px', overflow:'hidden' }}>

        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)', fontSize:'13px' }}>
            Loading Meta Ads data…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding:'14px 18px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'12px', color:'#ef4444', fontSize:'13px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && summary && (<>

          {/* ── 5 BIG KPI CARDS ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(0,1fr))', gap:'10px', flexShrink:0, height:'136px' }}>
            {BIG_CARDS.map((c, i) => (
              <div
                key={c.label}
                style={{
                  ...CARD,
                  padding:'0 22px',
                  display:'flex', flexDirection:'column', justifyContent:'center',
                  animation:`wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1) backwards`,
                  animationDelay: i * 0.06 + 's',
                  transition:'border-color 0.2s, box-shadow 0.2s',
                  cursor:'default',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                  e.currentTarget.style.boxShadow   = '0 4px 16px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.boxShadow   = '0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)';
                }}
              >
                {/* Label */}
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:c.dot, flexShrink:0 }} />
                  <span style={LABEL_STYLE}>{c.label}</span>
                </div>
                {/* Value */}
                <div style={{
                  fontSize:'clamp(20px, 2vw, 32px)', fontWeight:'800',
                  color:'var(--t1)', lineHeight:1,
                  letterSpacing:'-1px', marginBottom:'8px',
                }}>
                  <CountUp value={c.value} display={c.display} delay={200 + i * 60} />
                </div>
                {/* Sub */}
                <span style={{ fontSize:'10px', color:'var(--t3)', letterSpacing:'0.2px' }}>{c.sub}</span>
              </div>
            ))}
          </div>

          {/* ── 4 SECONDARY METRIC CARDS ── */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:'10px', flexShrink:0, height:'70px' }}>
            {SMALL_CARDS.map((c, i) => (
              <div
                key={c.label}
                style={{
                  ...CARD,
                  padding:'0 22px',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  animation:`wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1) backwards`,
                  animationDelay: (BIG_CARDS.length + i) * 0.05 + 's',
                  transition:'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
              >
                <div>
                  <div style={{ ...LABEL_STYLE, marginBottom:'5px' }}>{c.label}</div>
                  <div style={{ fontSize:'18px', fontWeight:'700', color:'var(--t1)', letterSpacing:'-0.5px' }}>{c.value}</div>
                </div>
                <div style={{ fontSize:'10px', color:'#3a3a3a', textAlign:'right', maxWidth:'72px', lineHeight:1.5 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* ── CHARTS ROW ── */}
          <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'260px 1fr', gap:'10px' }}>

            {/* Donut — Spend Breakdown */}
            <div style={{
              ...CARD,
              display:'flex', flexDirection:'column', overflow:'hidden',
            }}>
              <div style={{ padding:'16px 20px 0', flexShrink:0 }}>
                <span style={LABEL_STYLE}>Spend breakdown</span>
              </div>

              {donutSegs.length === 0 ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:'var(--t3)' }}>
                  No data
                </div>
              ) : (
                <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'14px', padding:'12px 16px 16px', overflow:'hidden' }}>
                  {/* SVG Donut */}
                  <div style={{ position:'relative', width:'120px', height:'120px', flexShrink:0 }}>
                    <svg viewBox="0 0 100 100" style={{ width:'120px', height:'120px' }}>
                      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12"/>
                      {donutSegs.map((seg, i) => {
                        let sw = 12, op = 1;
                        if (hoverSeg !== null) { sw = hoverSeg === i ? 16 : 9; op = hoverSeg === i ? 1 : 0.25; }
                        return (
                          <circle key={i} cx="50" cy="50" r="38" fill="none"
                            stroke={seg.color} strokeWidth={sw}
                            strokeDasharray={`${seg.dash} 239`}
                            strokeDashoffset={seg.offset}
                            transform="rotate(-90 50 50)"
                            style={{ opacity:op, transition:'stroke-width 0.2s, opacity 0.2s', cursor:'pointer' }}
                            onMouseEnter={() => setHoverSeg(i)}
                            onMouseLeave={() => setHoverSeg(null)}
                          />
                        );
                      })}
                    </svg>
                    <div style={{
                      position:'absolute', inset:0,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      pointerEvents:'none',
                    }}>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:'var(--t1)', letterSpacing:'-0.3px' }}>{center.value}</div>
                      <div style={{ fontSize:'9px', color:'var(--t3)', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.8px' }}>{center.label}</div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'5px', overflow:'auto' }}>
                    {donutSegs.map((seg, i) => (
                      <div
                        key={i}
                        onMouseEnter={() => setHoverSeg(i)}
                        onMouseLeave={() => setHoverSeg(null)}
                        style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'5px 8px', borderRadius:'8px', cursor:'pointer', flexShrink:0,
                          background: hoverSeg === i ? 'rgba(255,255,255,0.05)' : 'transparent',
                          transition:'background 0.15s',
                        }}
                      >
                        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                          <span style={{ width:'8px', height:'8px', borderRadius:'3px', background:seg.color, flexShrink:0 }} />
                          <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.65)' }}>{seg.label}</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--t1)' }}>{seg.value}</div>
                          <div style={{ fontSize:'9px', color:'var(--t3)' }}>{seg.pct}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bar Chart */}
            <div style={{ minHeight:0, display:'flex' }}>
              <BarChart data={chartData} today={todayIdx} daysInMonth={chartData.spend.length} />
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
    <button
      onClick={toggle}
      style={{
        width:'34px', height:'34px',
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'#161616',
        border:'1px solid rgba(255,255,255,0.09)',
        borderRadius:'9px', cursor:'pointer',
        transition:'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
    >
      {dark ? <Moon size={15} color="rgba(255,255,255,0.5)" /> : <Sun size={15} color={LIME} />}
    </button>
  );
}
