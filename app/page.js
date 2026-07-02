'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, GitCompare, Moon, Sun, TrendingUp } from 'lucide-react';
import CountUp from './components/CountUp';
import BarChart from './components/BarChart';

/* ─── Design tokens ─── */
const LIME     = '#a3e635';
const LIME_DIM = 'rgba(163,230,53,0.10)';

const CARD = {
  background:   '#111111',
  border:       '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow:    '0 1px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
};

const LABEL = {
  fontSize: '10px', fontWeight: '600',
  textTransform: 'uppercase', letterSpacing: '1.4px', color: '#444',
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
  for (const t of types) {
    const a = actions.find(x => x.action_type === t);
    if (a) return parseInt(a.value) || 0;
  }
  return 0;
}

function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC'))                           return 'TRAFFIC';
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

/* ─── Sparkline component ─── */
function Sparkline({ data, color = LIME, height = 36, width = 160 }) {
  const pts = data.filter(v => v > 0);
  if (pts.length < 2) return null;
  const max   = Math.max(...pts);
  const min   = Math.min(...pts);
  const range = max - min || 1;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

/* ─── Main component ─── */
export default function DashboardPage() {
  const [hoverSeg, setHoverSeg]         = useState(null);
  const [dateOpt, setDateOpt]           = useState(DATE_OPTIONS[5]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customSince, setCustomSince]   = useState('');
  const [customUntil, setCustomUntil]   = useState('');
  const [isCustom, setIsCustom]         = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [summary, setSummary]           = useState(null);
  const [chartData, setChartData]       = useState({ spend:[], awareness:[], traffic:[], leads:[] });
  const [donutSegs, setDonutSegs]       = useState([]);
  const [donutTotal, setDonutTotal]     = useState({ value:'—', label:'Total spend' });
  const [todayIdx, setTodayIdx]         = useState(0);
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
        totalLeads:   convLeads || totalLeads,
        calcCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
        calcCPC: trafficClicks > 0    ? trafficSpend / trafficClicks            : null,
        calcCPL: convLeads > 0        ? convSpend / convLeads                   : null,
        calcCTR: convImpressions > 0  ? (convClicks / convImpressions) * 100    : null,
      });

      setChartData(buildChartData(daily));
      setTodayIdx(daily.length);

      const total = totalSpend || 1;
      const segs  = [];
      if (awareSpend > 0)   segs.push({ color:'#8b5cf6', label:'Awareness',  pct: Math.round(awareSpend/total*100),   value: fmtSpend(awareSpend)   });
      if (trafficSpend > 0) segs.push({ color:'#f59e0b', label:'Traffic',    pct: Math.round(trafficSpend/total*100), value: fmtSpend(trafficSpend) });
      if (convSpend > 0)    segs.push({ color:'#10b981', label:'Conversion', pct: Math.round(convSpend/total*100),    value: fmtSpend(convSpend)    });
      const otherSpend = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (otherSpend > 0)   segs.push({ color:'#3b82f6', label:'Other',      pct: Math.round(otherSpend/total*100),   value: fmtSpend(otherSpend)   });

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

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'var(--pg)' }}>

      {/* ══ TOPBAR ══ */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:'52px', flexShrink:0,
        borderBottom:'1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <h1 style={{ fontSize:'14px', fontWeight:'600', color:'rgba(255,255,255,0.85)', letterSpacing:'-0.2px' }}>
            Dashboard
          </h1>
          <span style={{ color:'rgba(255,255,255,0.12)' }}>·</span>
          <span style={{ fontSize:'11px', color:'#3a3a3a' }}>
            {loading ? 'loading…' : `${activeCampaignCount} active campaigns`}
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {/* Date filter */}
          <div style={{ position:'relative' }} data-filter>
            <button onClick={() => setShowDropdown(d => !d)} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'6px 12px',
              background:'rgba(255,255,255,0.04)',
              border:`1px solid ${isCustom ? LIME : 'rgba(255,255,255,0.09)'}`,
              borderRadius:'8px', fontSize:'12px',
              color:'rgba(255,255,255,0.6)', cursor:'pointer',
            }}>
              <Calendar size={13} color="rgba(255,255,255,0.3)"/>
              {filterLabel()}
              <ChevronDown size={12} color="rgba(255,255,255,0.25)"/>
            </button>

            {showDropdown && (
              <div data-filter style={{
                position:'absolute', top:'38px', right:0, zIndex:50,
                background:'#141414',
                border:'1px solid rgba(255,255,255,0.09)',
                borderRadius:'12px', minWidth:'215px',
                boxShadow:'0 20px 60px rgba(0,0,0,0.7)',
                animation:'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
                overflow:'hidden',
              }}>
                <div style={{ padding:'6px' }}>
                  {DATE_OPTIONS.map(opt => {
                    const active = !isCustom && opt.value === dateOpt.value;
                    return (
                      <div key={opt.value} onClick={() => selectPreset(opt)} style={{
                        padding:'7px 11px', fontSize:'12px', cursor:'pointer', borderRadius:'7px',
                        color: active ? LIME : 'rgba(255,255,255,0.55)',
                        background: active ? LIME_DIM : 'transparent',
                        transition:'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background='rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}
                      >{opt.label}</div>
                    );
                  })}
                </div>
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'12px' }}>
                  <div style={{ ...LABEL, marginBottom:'10px' }}>Custom range</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                    {[['From',customSince,setCustomSince,''],['To',customUntil,setCustomUntil,customSince]].map(([lbl,val,setter,min]) => (
                      <div key={lbl}>
                        <div style={{ fontSize:'10px', color:'#3a3a3a', marginBottom:'4px' }}>{lbl}</div>
                        <input type="date" value={val} min={min} onChange={e => setter(e.target.value)} style={{
                          width:'100%', padding:'5px 8px', fontSize:'11px',
                          border:'1px solid rgba(255,255,255,0.09)', borderRadius:'6px',
                          background:'#111', color:'var(--t1)', outline:'none', fontFamily:'inherit',
                        }}/>
                      </div>
                    ))}
                  </div>
                  <button onClick={applyCustomRange} disabled={!customSince || !customUntil} style={{
                    width:'100%', padding:'7px', fontSize:'12px', fontWeight:'600',
                    border:'none', borderRadius:'7px',
                    background: customSince && customUntil ? LIME : 'rgba(255,255,255,0.05)',
                    color:      customSince && customUntil ? '#0a1200' : '#3a3a3a',
                    cursor:     customSince && customUntil ? 'pointer' : 'default',
                  }}>Apply range</button>
                </div>
              </div>
            )}
          </div>

          <button style={{
            display:'flex', alignItems:'center', gap:'6px',
            padding:'6px 12px',
            background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:'8px', fontSize:'12px',
            color:'rgba(255,255,255,0.18)', cursor:'not-allowed',
          }} title="Coming soon">
            <GitCompare size={13}/> Compare
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'14px 20px', gap:'10px', overflow:'hidden' }}>

        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#3a3a3a', fontSize:'13px' }}>
            Loading data…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding:'14px 18px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:'12px', color:'#ef4444', fontSize:'12px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && summary && (<>

          {/* ══ ROW 1: HERO + 2×2 KPI GRID ══ */}
          <div style={{ flex:1, minHeight:0, display:'grid', gridTemplateColumns:'2fr 3fr', gap:'10px' }}>

            {/* HERO — Total Spend */}
            <div style={{
              position:'relative', overflow:'hidden',
              background:'linear-gradient(145deg, #0c1a06 0%, #0d1608 60%, #0a0a0a 100%)',
              border:'1px solid rgba(163,230,53,0.14)',
              borderRadius:'18px',
              padding:'26px 28px',
              display:'flex', flexDirection:'column', justifyContent:'space-between',
              animation:'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards',
            }}>
              {/* Glow orb */}
              <div style={{
                position:'absolute', top:'-80px', right:'-80px',
                width:'280px', height:'280px',
                background:'radial-gradient(circle, rgba(163,230,53,0.07) 0%, transparent 65%)',
                pointerEvents:'none',
              }}/>
              {/* Corner accent */}
              <div style={{
                position:'absolute', bottom:0, left:0, right:0, height:'2px',
                background:'linear-gradient(90deg, transparent, rgba(163,230,53,0.3), transparent)',
              }}/>

              {/* Top */}
              <div>
                <div style={{ ...LABEL, color:'rgba(163,230,53,0.5)', marginBottom:'6px' }}>Total Spend</div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:LIME, boxShadow:`0 0 6px ${LIME}`, animation:'wdPulseDot 2s ease-in-out infinite' }}/>
                  <span style={{ fontSize:'10px', color:'rgba(163,230,53,0.4)' }}>all campaigns</span>
                </div>
              </div>

              {/* Value */}
              <div>
                <div style={{
                  fontSize:'clamp(32px, 3.6vw, 58px)', fontWeight:900,
                  color:'#ffffff', letterSpacing:'-2px', lineHeight:1,
                  marginBottom:'8px',
                  animation:'wdFadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 0.1s backwards',
                }}>
                  <CountUp value={Math.round(summary.totalSpend)} display={fmtSpend(summary.totalSpend)} delay={200}/>
                </div>
              </div>

              {/* Sparkline */}
              <div>
                {chartData.spend.filter(v => v > 0).length > 1 && (
                  <div style={{ marginBottom:'10px', opacity:0.7 }}>
                    <Sparkline data={chartData.spend} color={LIME} height={32} width={160}/>
                  </div>
                )}
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.18)' }}>
                  {filterLabel()} · {activeCampaignCount} active
                </div>
              </div>
            </div>

            {/* 2×2 KPI GRID — Reach, Impressions, Traffic, Leads */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', gap:'10px' }}>
              {[
                { dot:'#3b82f6', label:'Reach',       value: Math.round(summary.totalReach),       display: fmtBigNum(summary.totalReach),       sub:'all campaigns', delay:80  },
                { dot:'#8b5cf6', label:'Impressions',  value: Math.round(summary.totalImpressions),  display: fmtBigNum(summary.totalImpressions), sub:'all campaigns', delay:130 },
                { dot:'#f59e0b', label:'Traffic',      value: summary.totalTraffic,                  display: fmtBigNum(summary.totalTraffic),     sub:'traffic only',  delay:180 },
                { dot:'#10b981', label:'Leads',        value: summary.totalLeads,                    display: fmtBigNum(summary.totalLeads),       sub:'conversion',    delay:230 },
              ].map((c, i) => (
                <div key={c.label} style={{
                  ...CARD,
                  padding:'20px 22px',
                  display:'flex', flexDirection:'column', justifyContent:'space-between',
                  animation:`wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${c.delay}ms backwards`,
                  transition:'border-color 0.2s, box-shadow 0.2s',
                  cursor:'default',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
                  e.currentTarget.style.boxShadow   = '0 4px 20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.boxShadow   = CARD.boxShadow;
                }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:c.dot, flexShrink:0 }}/>
                    <span style={LABEL}>{c.label}</span>
                  </div>
                  <div style={{
                    fontSize:'clamp(22px, 2.2vw, 36px)', fontWeight:800,
                    color:'#f0f0f0', letterSpacing:'-0.8px', lineHeight:1,
                  }}>
                    <CountUp value={c.value} display={c.display} delay={300 + i * 60}/>
                  </div>
                  <div style={{ fontSize:'10px', color:'#353535' }}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══ ROW 2: METRIC STRIP — CPM, CPC, CPL, CTR ══ */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'10px', flexShrink:0, height:'58px' }}>
            {[
              { label:'CPM', value: summary.calcCPM ? fmtSpend(summary.calcCPM) : '—', sub:'cost / 1K impr.' },
              { label:'CPC', value: summary.calcCPC ? fmtSpend(summary.calcCPC) : '—', sub:'traffic campaigns' },
              { label:'CPL', value: summary.calcCPL ? fmtSpend(summary.calcCPL) : '—', sub:'conv. campaigns' },
              { label:'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2)+'%' : '—', sub:'conv. campaigns' },
            ].map((c, i) => (
              <div key={c.label} style={{
                ...CARD,
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'0 20px',
                animation:`wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${400 + i*50}ms backwards`,
                transition:'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}
              >
                <span style={LABEL}>{c.label}</span>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'16px', fontWeight:700, color:'#e8e8e8', letterSpacing:'-0.3px' }}>{c.value}</div>
                  <div style={{ fontSize:'9px', color:'#303030', marginTop:'1px' }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ══ ROW 3: CHARTS — Donut + Bar ══ */}
          <div style={{ flexShrink:0, height:'178px', display:'grid', gridTemplateColumns:'220px 1fr', gap:'10px' }}>

            {/* Donut — Spend Breakdown */}
            <div style={{ ...CARD, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px 8px', flexShrink:0 }}>
                <span style={LABEL}>Breakdown</span>
              </div>
              {donutSegs.length === 0 ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#333' }}>No data</div>
              ) : (
                <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', gap:'12px', padding:'0 14px 12px', overflow:'hidden' }}>
                  {/* Donut */}
                  <div style={{ position:'relative', width:'90px', height:'90px', flexShrink:0 }}>
                    <svg viewBox="0 0 100 100" style={{ width:'90px', height:'90px' }}>
                      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="14"/>
                      {donutSegs.map((seg, i) => {
                        let sw=14, op=1;
                        if (hoverSeg!==null){ sw=hoverSeg===i?18:9; op=hoverSeg===i?1:0.2; }
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
                    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                      <div style={{ fontSize:'10px', fontWeight:700, color:'#e0e0e0', letterSpacing:'-0.3px' }}>{center.value}</div>
                      <div style={{ fontSize:'8px', color:'#333', marginTop:'1px', textTransform:'uppercase', letterSpacing:'0.6px' }}>{center.label}</div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'4px', overflow:'hidden' }}>
                    {donutSegs.map((seg, i) => (
                      <div key={i}
                        onMouseEnter={() => setHoverSeg(i)}
                        onMouseLeave={() => setHoverSeg(null)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'3px 6px', borderRadius:'6px', cursor:'pointer', background: hoverSeg===i?'rgba(255,255,255,0.04)':'transparent', transition:'background 0.15s' }}
                      >
                        <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                          <span style={{ width:'7px', height:'7px', borderRadius:'2px', background:seg.color, flexShrink:0 }}/>
                          <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.5)' }}>{seg.label}</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,0.75)' }}>{seg.value}</div>
                          <div style={{ fontSize:'9px', color:'#303030' }}>{seg.pct}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bar Chart */}
            <div style={{ display:'flex', minHeight:0, overflow:'hidden' }}>
              <BarChart data={chartData} today={todayIdx} daysInMonth={chartData.spend.length}/>
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
      width:'32px', height:'32px',
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(255,255,255,0.04)',
      border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:'8px', cursor:'pointer',
      transition:'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.16)'}
    onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}
    >
      {dark ? <Moon size={14} color="rgba(255,255,255,0.4)"/> : <Sun size={14} color={LIME}/>}
    </button>
  );
}
