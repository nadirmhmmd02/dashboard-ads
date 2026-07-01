'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, GitCompare, Moon, Sun } from 'lucide-react';
import CountUp from './components/CountUp';
import BarChart from './components/BarChart';

const DATE_OPTIONS = [
  { label: 'Today',       value: 'today' },
  { label: 'Yesterday',   value: 'yesterday' },
  { label: 'Last 7 days', value: 'last_7d' },
  { label: 'Last 14 days',value: 'last_14d' },
  { label: 'Last 30 days',value: 'last_30d' },
  { label: 'This month',  value: 'this_month' },
  { label: 'Last month',  value: 'last_month' },
];

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
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace('.0', '') + 'B';
  if (n >= 1000000)    return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000)       return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return n.toLocaleString('id-ID');
}

function fmtSpend(n) {
  if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000)    return 'Rp ' + (n / 1000).toFixed(0) + 'K';
  return 'Rp ' + Math.round(n);
}

function buildChartData(daily) {
  const result = { spend: [], awareness: [], traffic: [], leads: [] };
  daily.forEach(d => {
    result.spend.push(Math.round(parseFloat(d.spend || 0)));
    result.awareness.push(Math.round(parseFloat(d.impressions || 0)));
    result.traffic.push(getActionValue(d.actions, ['link_click']));
    result.leads.push(getActionValue(d.actions, ['lead', 'onsite_conversion.lead_grouped']));
  });
  return result;
}

export default function DashboardPage() {
  const [hoverSeg, setHoverSeg]           = useState(null);
  const [dateOpt, setDateOpt]             = useState(DATE_OPTIONS[5]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [customSince, setCustomSince]     = useState('');
  const [customUntil, setCustomUntil]     = useState('');
  const [isCustom, setIsCustom]           = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [summary, setSummary]             = useState(null);
  const [chartData, setChartData]         = useState({ spend: [], awareness: [], traffic: [], leads: [] });
  const [donutSegs, setDonutSegs]         = useState([]);
  const [donutTotal, setDonutTotal]       = useState({ value: '—', label: 'Total spend' });
  const [todayIdx, setTodayIdx]           = useState(0);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e) => { if (!e.target.closest('[data-filter-dropdown]')) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  async function fetchData(since = '', until = '') {
    setLoading(true);
    setError(null);
    try {
      const url = since && until
        ? `/api/meta?mode=dashboard&since=${since}&until=${until}`
        : `/api/meta?mode=dashboard&date_preset=${dateOpt.value}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const sum       = json.summary || {};
      const daily     = json.daily   || [];
      const campaigns = json.campaigns || [];

      const totalSpend       = parseFloat(sum.spend || 0);
      const totalReach       = parseFloat(sum.reach || 0);
      const totalImpressions = parseFloat(sum.impressions || 0);
      const totalLeads       = getActionValue(sum.actions, ['lead', 'onsite_conversion.lead_grouped']);

      const activeCamps  = campaigns.filter(c => c.status === 'ACTIVE');
      setActiveCampaignCount(activeCamps.length);

      const trafficCamps = activeCamps.filter(c => getCampaignType(c.name) === 'TRAFFIC');
      const convCamps    = activeCamps.filter(c => getCampaignType(c.name) === 'CONVERSION');
      const awareCamps   = activeCamps.filter(c => getCampaignType(c.name) === 'AWARENESS');

      const trafficSpend  = trafficCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
      const trafficClicks = trafficCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
      const convSpend     = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
      const convLeads     = convCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['lead', 'onsite_conversion.lead_grouped']), 0);
      const convImpressions = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
      const convClicks    = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.clicks || 0), 0);
      const awareSpend    = awareCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);

      setSummary({
        totalSpend,
        totalReach,
        totalImpressions,
        totalTraffic:  trafficClicks,
        totalLeads:    convLeads || totalLeads,
        calcCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
        calcCPC: trafficClicks > 0    ? trafficSpend / trafficClicks : null,
        calcCPL: convLeads > 0        ? convSpend / convLeads : null,
        calcCTR: convImpressions > 0  ? (convClicks / convImpressions) * 100 : null,
      });

      setChartData(buildChartData(daily));
      setTodayIdx(daily.length);

      // Donut
      const total = totalSpend || 1;
      const segs = [];
      if (awareSpend > 0)  segs.push({ color:'#8b5cf6', label:'Awareness',  pct: Math.round((awareSpend  / total) * 100), value: fmtSpend(awareSpend),  spend: awareSpend });
      if (trafficSpend > 0) segs.push({ color:'#f59e0b', label:'Traffic',   pct: Math.round((trafficSpend / total) * 100), value: fmtSpend(trafficSpend), spend: trafficSpend });
      if (convSpend > 0)   segs.push({ color:'#10b981', label:'Conversion', pct: Math.round((convSpend   / total) * 100), value: fmtSpend(convSpend),    spend: convSpend });
      const otherSpend = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (otherSpend > 0)  segs.push({ color:'#3b82f6', label:'Other',      pct: Math.round((otherSpend  / total) * 100), value: fmtSpend(otherSpend),   spend: otherSpend });

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
    setIsCustom(true);
    setShowDropdown(false);
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
    { label:'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2) + '%' : '—', sub:'conversion campaigns' },
  ] : [];

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>

      {/* ── TOPBAR ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 20px', borderBottom:'1px solid var(--br)',
        gap:'12px', flexWrap:'wrap', flexShrink:0,
      }}>
        <div>
          <div style={{ fontSize:'17px', fontWeight:500, color:'var(--t1)' }}>Dashboard</div>
          <div style={{ fontSize:'12px', color:'var(--t3)' }}>
            Meta Ads · {loading ? 'loading...' : activeCampaignCount > 0 ? `${activeCampaignCount} active campaigns` : 'no active campaigns'}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>

          {/* Date filter */}
          <div style={{ position:'relative' }} data-filter-dropdown>
            <div onClick={() => setShowDropdown(d => !d)} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'7px 12px', background:'var(--cd)',
              border:`1px solid ${isCustom ? 'var(--ac)' : 'var(--br)'}`,
              borderRadius:'8px', fontSize:'13px', color:'var(--t1)', cursor:'pointer',
              transition:'border-color 0.15s',
            }}>
              <Calendar size={16} /> {filterLabel()} <ChevronDown size={14} color="var(--t3)" />
            </div>
            {showDropdown && (
              <div style={{
                position:'absolute', top:'38px', right:0, zIndex:50,
                background:'var(--cd)', border:'1px solid var(--br)',
                borderRadius:'10px', minWidth:'220px',
                boxShadow:'0 8px 32px rgba(0,0,0,0.3)',
                animation:'wdScaleIn 0.18s cubic-bezier(0.4,0,0.2,1)',
              }}>
                <div style={{ padding:'6px 0' }}>
                  {DATE_OPTIONS.map(opt => (
                    <div key={opt.value} onClick={() => selectPreset(opt)} style={{
                      padding:'8px 14px', fontSize:'13px', cursor:'pointer',
                      color: (!isCustom && opt.value === dateOpt.value) ? 'var(--ac)' : 'var(--t2)',
                      background: (!isCustom && opt.value === dateOpt.value) ? 'rgba(245,158,11,0.08)' : 'transparent',
                      transition:'background 0.1s',
                    }}
                    onMouseEnter={e => { if (isCustom || opt.value !== dateOpt.value) e.currentTarget.style.background='var(--sf)'; }}
                    onMouseLeave={e => { if (isCustom || opt.value !== dateOpt.value) e.currentTarget.style.background='transparent'; }}
                    >{opt.label}</div>
                  ))}
                </div>
                <div style={{ borderTop:'1px solid var(--br)', padding:'12px 14px' }}>
                  <div style={{ fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'10px' }}>Custom range</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                    {[['From', customSince, setCustomSince, ''], ['To', customUntil, setCustomUntil, customSince]].map(([lbl, val, setter, min]) => (
                      <div key={lbl}>
                        <div style={{ fontSize:'10px', color:'var(--t3)', marginBottom:'4px' }}>{lbl}</div>
                        <input type="date" value={val} min={min} onChange={e => setter(e.target.value)}
                          style={{ width:'100%', padding:'6px 8px', fontSize:'12px', border:'1px solid var(--br)', borderRadius:'6px', background:'var(--sf)', color:'var(--t1)', outline:'none', fontFamily:'inherit' }}/>
                      </div>
                    ))}
                  </div>
                  <button onClick={applyCustomRange} disabled={!customSince || !customUntil} style={{
                    width:'100%', padding:'7px', fontSize:'12px', fontWeight:'600',
                    border:'none', borderRadius:'6px',
                    background: customSince && customUntil ? 'var(--ac)' : 'var(--sf)',
                    color: customSince && customUntil ? '#fff' : 'var(--t3)',
                    cursor: customSince && customUntil ? 'pointer' : 'default',
                    transition:'background 0.15s, color 0.15s',
                  }}>Apply range</button>
                </div>
              </div>
            )}
          </div>

          <div style={{
            display:'flex', alignItems:'center', gap:'6px',
            padding:'7px 12px', background:'var(--cd)',
            border:'1px solid var(--br)', borderRadius:'8px',
            fontSize:'13px', color:'var(--t3)', cursor:'not-allowed',
          }} title="Coming soon">
            <GitCompare size={16} /> Compare
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* ── KONTEN ── */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'16px 20px', gap:'12px', overflow:'auto' }}>

        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)', fontSize:'14px' }}>
            Loading Meta Ads data...
          </div>
        )}

        {!loading && error && (
          <div style={{ padding:'14px 16px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'10px', color:'#ef4444', fontSize:'13px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && summary && (
          <>
            {/* ── 5 BIG CARDS ── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(0,1fr))', gap:'10px', flexShrink:0 }}>
              {BIG_CARDS.map((c, i) => (
                <div key={c.label} style={{
                  background:'var(--cd)', border:'1px solid var(--br)',
                  borderRadius:'12px', padding:'22px 22px 18px',
                  animation:`wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards`,
                  animationDelay: i * 0.06 + 's',
                  transition:'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--br)'}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'14px' }}>
                    <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:c.dot, flexShrink:0 }}/>
                    <span style={{ fontSize:'12px', color:'var(--t2)', fontWeight:'500' }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize:'28px', fontWeight:'700', color:'var(--t1)', lineHeight:1, marginBottom:'10px', letterSpacing:'-0.8px' }}>
                    <CountUp value={c.value} display={c.display} delay={200 + i * 60} />
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--t3)' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* ── 4 SMALL CARDS ── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:'10px', flexShrink:0 }}>
              {SMALL_CARDS.map((c) => (
                <div key={c.label} style={{
                  background:'var(--cd)', border:'1px solid var(--br)',
                  borderRadius:'12px', padding:'16px 20px',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                }}>
                  <div>
                    <div style={{ fontSize:'11px', color:'var(--t3)', marginBottom:'6px', fontWeight:'500' }}>{c.label}</div>
                    <div style={{ fontSize:'22px', fontWeight:'600', color:'var(--t1)', letterSpacing:'-0.4px' }}>{c.value}</div>
                  </div>
                  <div style={{ fontSize:'10px', color:'var(--t3)', textAlign:'right', maxWidth:'80px', lineHeight:1.3 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* ── BOTTOM: DONUT + BAR CHART BERDAMPINGAN ── */}
            <div style={{ height:'230px', flexShrink:0, display:'grid', gridTemplateColumns:'260px 1fr', gap:'10px' }}>

              {/* DONUT */}
              <div style={{
                background:'var(--cd)', border:'1px solid var(--br)',
                borderRadius:'12px', padding:'16px',
                display:'flex', flexDirection:'column',
              }}>
                <div style={{ fontSize:'12px', fontWeight:'500', color:'var(--t2)', marginBottom:'16px' }}>Spend breakdown</div>

                {donutSegs.length === 0 ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', color:'var(--t3)' }}>No data</div>
                ) : (
                  <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px' }}>
                    {/* SVG donut */}
                    <div style={{ position:'relative', width:'150px', height:'150px' }}>
                      <svg viewBox="0 0 100 100" style={{ width:'150px', height:'150px' }}>
                        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--br)" strokeWidth="14"/>
                        {donutSegs.map((seg, i) => {
                          let sw = 14, op = 1;
                          if (hoverSeg !== null) { sw = hoverSeg === i ? 18 : 10; op = hoverSeg === i ? 1 : 0.35; }
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
                        position:'absolute', top:0, left:0, width:'100%', height:'100%',
                        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        pointerEvents:'none',
                      }}>
                        <div style={{ fontSize:'15px', fontWeight:'600', color:'var(--t1)' }}>{center.value}</div>
                        <div style={{ fontSize:'10px', color:'var(--t3)', marginTop:'2px' }}>{center.label}</div>
                      </div>
                    </div>

                    {/* Legend */}
                    <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'8px' }}>
                      {donutSegs.map((seg, i) => (
                        <div key={i}
                          onMouseEnter={() => setHoverSeg(i)}
                          onMouseLeave={() => setHoverSeg(null)}
                          style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'6px 10px', borderRadius:'8px', cursor:'pointer',
                            background: hoverSeg === i ? 'var(--sf)' : 'transparent',
                            transition:'background 0.15s',
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <span style={{ width:'10px', height:'10px', borderRadius:'3px', background:seg.color, flexShrink:0 }}/>
                            <span style={{ fontSize:'12px', color:'var(--t1)' }}>{seg.label}</span>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:'12px', fontWeight:'500', color:'var(--t1)' }}>{seg.value}</div>
                            <div style={{ fontSize:'10px', color:'var(--t3)' }}>{seg.pct}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* BAR CHART */}
              <div style={{ minHeight:0, display:'flex' }}>
                <BarChart data={chartData} today={todayIdx} daysInMonth={chartData.spend.length} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  return (
    <div onClick={() => setDark(d => !d)} style={{
      width:'34px', height:'34px', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--cd)', border:'1px solid var(--br)', borderRadius:'8px', cursor:'pointer',
    }}>
      {dark
        ? <Moon size={17} color="#f59e0b" style={{ transition:'transform 0.5s cubic-bezier(0.4,0,0.2,1)' }}/>
        : <Sun  size={17} color="#f59e0b" style={{ transition:'transform 0.5s cubic-bezier(0.4,0,0.2,1)' }}/>
      }
    </div>
  );
}
