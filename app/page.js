'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, GitCompare, Moon, Sun } from 'lucide-react';
import CountUp from './components/CountUp';
import BarChart from './components/BarChart';

/* ─── Tokens ─── */
const LIME     = '#a3e635';
const LIME_DIM = 'rgba(163,230,53,0.08)';
const CARD_BASE = {
  background:   '#111111',
  border:       '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
  boxShadow:    '0 1px 3px rgba(0,0,0,0.5)',
};
const LABEL = {
  fontSize: '10px', fontWeight: '600',
  textTransform: 'uppercase', letterSpacing: '1.4px', color: '#424242',
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

/* ─── Mini sparkline ─── */
function Sparkline({ data, color, w = 100, h = 28 }) {
  const pts = data.filter(v => v >= 0);
  if (pts.length < 2) return null;
  const max   = Math.max(...pts) || 1;
  const min   = Math.min(...pts);
  const range = max - min || 1;
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} style={{ display:'block', overflow:'visible' }}>
      <polyline
        points={coords.join(' ')}
        fill="none" stroke={color} strokeWidth="1.4"
        strokeLinejoin="round" strokeLinecap="round"
        style={{ opacity: 0.65 }}
      />
    </svg>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ label, display, value, sub, dot, sparkData, sparkColor, isHero, delay }) {
  return (
    <div
      style={{
        ...CARD_BASE,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '18px 20px 14px',
        animation: `wdFadeUp 0.38s cubic-bezier(0.4,0,0.2,1) ${delay}ms backwards`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
        e.currentTarget.style.boxShadow   = '0 4px 20px rgba(0,0,0,0.6)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.boxShadow   = '0 1px 3px rgba(0,0,0,0.5)';
      }}
    >
      {/* Subtle top accent line for hero */}
      {isHero && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, ${LIME}66, ${LIME}22, transparent)`,
        }}/>
      )}

      {/* Label */}
      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
        <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: dot, flexShrink:0 }}/>
        <span style={{ ...LABEL, color: isHero ? 'rgba(163,230,53,0.55)' : '#424242' }}>{label}</span>
      </div>

      {/* Value */}
      <div style={{
        fontSize: isHero ? 'clamp(26px, 2.2vw, 36px)' : 'clamp(20px, 1.7vw, 28px)',
        fontWeight: 800,
        color: '#f0f0f0',
        letterSpacing: '-0.8px',
        lineHeight: 1,
      }}>
        <CountUp value={value} display={display} delay={delay + 100}/>
      </div>

      {/* Sparkline + sub */}
      <div>
        {sparkData && sparkData.filter(v => v > 0).length > 1 && (
          <div style={{ marginBottom: '8px' }}>
            <Sparkline data={sparkData} color={sparkColor || dot} w={100} h={26}/>
          </div>
        )}
        <div style={{ fontSize:'10px', color:'#333' }}>{sub}</div>
      </div>
    </div>
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
      const other = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (other > 0)        segs.push({ color:'#3b82f6', label:'Other',      pct: Math.round(other/total*100),        value: fmtSpend(other)        });

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
        <div>
          <h1 style={{ fontSize:'14px', fontWeight:'600', color:'rgba(255,255,255,0.8)', letterSpacing:'-0.2px' }}>
            Dashboard
          </h1>
          <p style={{ fontSize:'11px', color:'#383838', marginTop:'2px' }}>
            {loading ? 'loading…' : `Meta Ads · ${activeCampaignCount} active campaigns`}
          </p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {/* Date filter */}
          <div style={{ position:'relative' }} data-filter>
            <button onClick={() => setShowDropdown(d => !d)} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'6px 12px',
              background:'rgba(255,255,255,0.04)',
              border:`1px solid ${isCustom ? LIME+'55' : 'rgba(255,255,255,0.09)'}`,
              borderRadius:'9px', fontSize:'12px',
              color:'rgba(255,255,255,0.6)', cursor:'pointer',
              transition:'border-color 0.15s',
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
                        <div style={{ fontSize:'10px', color:'#383838', marginBottom:'4px' }}>{lbl}</div>
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
                    color:      customSince && customUntil ? '#0a1200' : '#383838',
                    cursor:     customSince && customUntil ? 'pointer' : 'default',
                    transition:'background 0.15s',
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
            borderRadius:'9px', fontSize:'12px',
            color:'rgba(255,255,255,0.18)', cursor:'not-allowed',
          }} title="Coming soon">
            <GitCompare size={13}/> Compare
          </button>

          <ThemeToggle/>
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'16px 22px', gap:'10px', overflow:'hidden' }}>

        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#303030', fontSize:'13px' }}>
            Loading…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding:'14px 18px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:'12px', color:'#ef4444', fontSize:'12px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && summary && (<>

          {/* ══ ROW 1: PRIMARY KPI — 5 cards, total spend slightly wider ══ */}
          <div style={{
            height: '156px', flexShrink: 0,
            display: 'grid',
            gridTemplateColumns: '1.18fr 1fr 1fr 1fr 1fr',
            gap: '10px',
          }}>
            <KpiCard
              label="Total Spend" isHero
              value={Math.round(summary.totalSpend)} display={fmtSpend(summary.totalSpend)}
              sub="all campaigns" dot={LIME}
              sparkData={chartData.spend} sparkColor={LIME}
              delay={0}
            />
            <KpiCard
              label="Reach"
              value={Math.round(summary.totalReach)} display={fmtBigNum(summary.totalReach)}
              sub="all campaigns" dot="#3b82f6"
              delay={60}
            />
            <KpiCard
              label="Impressions"
              value={Math.round(summary.totalImpressions)} display={fmtBigNum(summary.totalImpressions)}
              sub="all campaigns" dot="#8b5cf6"
              sparkData={chartData.awareness} sparkColor="#8b5cf6"
              delay={110}
            />
            <KpiCard
              label="Traffic"
              value={summary.totalTraffic} display={fmtBigNum(summary.totalTraffic)}
              sub="traffic only" dot="#f59e0b"
              sparkData={chartData.traffic} sparkColor="#f59e0b"
              delay={160}
            />
            <KpiCard
              label="Leads"
              value={summary.totalLeads} display={fmtBigNum(summary.totalLeads)}
              sub="conversion" dot="#10b981"
              sparkData={chartData.leads} sparkColor="#10b981"
              delay={210}
            />
          </div>

          {/* ══ ROW 2: SECONDARY METRICS — single unified panel ══ */}
          <div style={{
            ...CARD_BASE,
            flexShrink: 0, height: '62px',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            overflow: 'hidden',
            animation: 'wdFadeUp 0.38s cubic-bezier(0.4,0,0.2,1) 260ms backwards',
          }}>
            {[
              { label:'CPM', value: summary.calcCPM ? fmtSpend(summary.calcCPM) : '—', sub:'cost / 1K impr.' },
              { label:'CPC', value: summary.calcCPC ? fmtSpend(summary.calcCPC) : '—', sub:'traffic camps' },
              { label:'CPL', value: summary.calcCPL ? fmtSpend(summary.calcCPL) : '—', sub:'conversion camps' },
              { label:'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2)+'%' : '—', sub:'conversion camps' },
            ].map((m, i) => (
              <div key={m.label} style={{
                display:'flex', flexDirection:'column', justifyContent:'center',
                padding:'0 22px',
                borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <div style={{ ...LABEL, marginBottom:'5px' }}>{m.label}</div>
                <div style={{ fontSize:'17px', fontWeight:700, color:'#e0e0e0', letterSpacing:'-0.4px' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* ══ ROW 3: CHARTS ══ */}
          <div style={{
            flex: 1, minHeight: 0,
            display: 'grid', gridTemplateColumns: '240px 1fr', gap: '10px',
          }}>

            {/* Donut */}
            <div style={{ ...CARD_BASE, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'16px 20px 8px', flexShrink:0 }}>
                <span style={LABEL}>Spend breakdown</span>
              </div>
              {donutSegs.length === 0 ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#303030' }}>No data</div>
              ) : (
                <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px', padding:'4px 16px 16px', overflow:'hidden' }}>
                  <div style={{ position:'relative', width:'110px', height:'110px', flexShrink:0 }}>
                    <svg viewBox="0 0 100 100" style={{ width:'110px', height:'110px' }}>
                      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="13"/>
                      {donutSegs.map((seg, i) => {
                        let sw=13, op=1;
                        if (hoverSeg!==null){ sw=hoverSeg===i?17:9; op=hoverSeg===i?1:0.2; }
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
                      <div style={{ fontSize:'11px', fontWeight:700, color:'#e8e8e8', letterSpacing:'-0.3px' }}>{center.value}</div>
                      <div style={{ fontSize:'8px', color:'#303030', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.8px' }}>{center.label}</div>
                    </div>
                  </div>
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'4px', overflow:'auto' }}>
                    {donutSegs.map((seg, i) => (
                      <div key={i}
                        onMouseEnter={() => setHoverSeg(i)}
                        onMouseLeave={() => setHoverSeg(null)}
                        style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'4px 8px', borderRadius:'7px', cursor:'pointer', flexShrink:0,
                          background: hoverSeg===i ? 'rgba(255,255,255,0.04)' : 'transparent',
                          transition:'background 0.15s',
                        }}
                      >
                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ width:'7px', height:'7px', borderRadius:'2px', background:seg.color, flexShrink:0 }}/>
                          <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.5)' }}>{seg.label}</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'11px', fontWeight:600, color:'rgba(255,255,255,0.72)' }}>{seg.value}</div>
                          <div style={{ fontSize:'9px', color:'#2e2e2e' }}>{seg.pct}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bar chart */}
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
      borderRadius:'9px', cursor:'pointer',
      transition:'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.16)'}
    onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}
    >
      {dark ? <Moon size={14} color="rgba(255,255,255,0.4)"/> : <Sun size={14} color={LIME}/>}
    </button>
  );
}
