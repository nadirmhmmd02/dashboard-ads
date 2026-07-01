'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, GitCompare, Moon, Sun } from 'lucide-react';
import GridLayout from 'react-grid-layout';
import CountUp from './components/CountUp';
import BarChart from './components/BarChart';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const DATE_OPTIONS = [
  { label: 'Today',        value: 'today' },
  { label: 'Yesterday',    value: 'yesterday' },
  { label: 'Last 7 days',  value: 'last_7d' },
  { label: 'Last 14 days', value: 'last_14d' },
  { label: 'Last 30 days', value: 'last_30d' },
  { label: 'This month',   value: 'this_month' },
  { label: 'Last month',   value: 'last_month' },
];

const COLS = 20;
const ROWS = 16;
const MARGIN = 8;

const DEFAULT_LAYOUT = [
  { i: 'card-spend',       x: 0,  y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'card-reach',       x: 4,  y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'card-impressions', x: 8,  y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'card-traffic',     x: 12, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'card-leads',       x: 16, y: 0, w: 4, h: 5, minW: 2, minH: 3 },
  { i: 'card-cpm',         x: 0,  y: 5, w: 5, h: 3, minW: 2, minH: 2 },
  { i: 'card-cpc',         x: 5,  y: 5, w: 5, h: 3, minW: 2, minH: 2 },
  { i: 'card-cpl',         x: 10, y: 5, w: 5, h: 3, minW: 2, minH: 2 },
  { i: 'card-ctr',         x: 15, y: 5, w: 5, h: 3, minW: 2, minH: 2 },
  { i: 'donut',            x: 0,  y: 8, w: 5, h: 8, minW: 3, minH: 4 },
  { i: 'barchart',         x: 5,  y: 8, w: 15, h: 8, minW: 4, minH: 4 },
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
  const gridRef  = useRef(null);
  const [gridWidth, setGridWidth]   = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  const [layout, setLayout]         = useState(DEFAULT_LAYOUT);
  const [hoverSeg, setHoverSeg]     = useState(null);
  const [dateOpt, setDateOpt]       = useState(DATE_OPTIONS[5]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customSince, setCustomSince]   = useState('');
  const [customUntil, setCustomUntil]   = useState('');
  const [isCustom, setIsCustom]         = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [summary, setSummary]   = useState(null);
  const [chartData, setChartData]   = useState({ spend: [], awareness: [], traffic: [], leads: [] });
  const [donutSegs, setDonutSegs]   = useState([]);
  const [donutTotal, setDonutTotal] = useState({ value: '—', label: 'Total spend' });
  const [todayIdx, setTodayIdx]     = useState(0);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);

  // Measure grid container
  useEffect(() => {
    if (!gridRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setGridWidth(e.contentRect.width);
        setGridHeight(e.contentRect.height);
      }
    });
    ro.observe(gridRef.current);
    setGridWidth(gridRef.current.clientWidth);
    setGridHeight(gridRef.current.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);

  useEffect(() => {
    if (!showDropdown) return;
    const h = (e) => { if (!e.target.closest('[data-filter-dropdown]')) setShowDropdown(false); };
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
      const totalLeads       = getActionValue(sum.actions, ['lead', 'onsite_conversion.lead_grouped']);

      const activeCamps  = campaigns.filter(c => c.status === 'ACTIVE');
      setActiveCampaignCount(activeCamps.length);

      const trafficCamps = activeCamps.filter(c => getCampaignType(c.name) === 'TRAFFIC');
      const convCamps    = activeCamps.filter(c => getCampaignType(c.name) === 'CONVERSION');
      const awareCamps   = activeCamps.filter(c => getCampaignType(c.name) === 'AWARENESS');

      const trafficSpend    = trafficCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
      const trafficClicks   = trafficCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
      const convSpend       = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
      const convLeads       = convCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['lead', 'onsite_conversion.lead_grouped']), 0);
      const convImpressions = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
      const convClicks      = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.clicks || 0), 0);
      const awareSpend      = awareCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);

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
      if (awareSpend > 0)   segs.push({ color:'#8b5cf6', label:'Awareness',  pct: Math.round((awareSpend  / total)*100), value: fmtSpend(awareSpend),  spend: awareSpend });
      if (trafficSpend > 0) segs.push({ color:'#f59e0b', label:'Traffic',    pct: Math.round((trafficSpend/ total)*100), value: fmtSpend(trafficSpend), spend: trafficSpend });
      if (convSpend > 0)    segs.push({ color:'#10b981', label:'Conversion', pct: Math.round((convSpend   / total)*100), value: fmtSpend(convSpend),    spend: convSpend });
      const otherSpend = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (otherSpend > 0)   segs.push({ color:'#3b82f6', label:'Other',      pct: Math.round((otherSpend  / total)*100), value: fmtSpend(otherSpend),   spend: otherSpend });

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

  // containerPadding [8,8] masing-masing 2 sisi = 16px; margin antar row = (ROWS-1)*MARGIN
  const rowHeight = Math.max(10, Math.floor((gridHeight - (ROWS - 1) * MARGIN - 16) / ROWS));

  const BIG_CARDS = summary ? [
    { i:'card-spend',       dot:'#10b981', label:'Total Spend',  value: Math.round(summary.totalSpend),       display: fmtSpend(summary.totalSpend),       sub:'all campaigns' },
    { i:'card-reach',       dot:'#3b82f6', label:'Reach',        value: Math.round(summary.totalReach),        display: fmtBigNum(summary.totalReach),       sub:'all campaigns' },
    { i:'card-impressions', dot:'#8b5cf6', label:'Impressions',  value: Math.round(summary.totalImpressions),  display: fmtBigNum(summary.totalImpressions), sub:'all campaigns' },
    { i:'card-traffic',     dot:'#f59e0b', label:'Traffic',      value: summary.totalTraffic,                  display: fmtBigNum(summary.totalTraffic),     sub:'traffic only' },
    { i:'card-leads',       dot:'#10b981', label:'Leads',        value: summary.totalLeads,                    display: fmtBigNum(summary.totalLeads),       sub:'conversion only' },
  ] : [];

  const SMALL_CARDS = summary ? [
    { i:'card-cpm', label:'CPM', value: summary.calcCPM ? fmtSpend(summary.calcCPM) : '—', sub:'cost per 1K impr.' },
    { i:'card-cpc', label:'CPC', value: summary.calcCPC ? fmtSpend(summary.calcCPC) : '—', sub:'traffic campaigns' },
    { i:'card-cpl', label:'CPL', value: summary.calcCPL ? fmtSpend(summary.calcCPL) : '—', sub:'conversion campaigns' },
    { i:'card-ctr', label:'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2)+'%' : '—', sub:'conversion campaigns' },
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

      {/* ── GRID AREA ── */}
      <div ref={gridRef} style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>

        {loading && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)', fontSize:'14px', zIndex:10 }}>
            Loading Meta Ads data...
          </div>
        )}

        {!loading && error && (
          <div style={{ margin:'16px 20px', padding:'14px 16px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'10px', color:'#ef4444', fontSize:'13px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && summary && gridHeight > 0 && (
          <GridLayout
            layout={layout}
            cols={COLS}
            rowHeight={rowHeight}
            width={gridWidth}
            margin={[MARGIN, MARGIN]}
            containerPadding={[MARGIN, MARGIN]}
            onLayoutChange={setLayout}
            isDraggable
            isResizable
            resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']}
            draggableHandle=".drag-handle"
            compactType="vertical"
            preventCollision={false}
            style={{ height: gridHeight + 'px' }}
          >
            {/* BIG CARDS */}
            {BIG_CARDS.map((c, i) => (
              <div key={c.i} style={{
                background:'var(--cd)', border:'1px solid var(--br)',
                borderRadius:'12px', overflow:'hidden',
                display:'flex', flexDirection:'column',
                transition:'border-color 0.2s',
                animation:`wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards`,
                animationDelay: i * 0.06 + 's',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--br)'}
              >
                {/* drag handle = label bar atas */}
                <div className="drag-handle" style={{
                  padding:'12px 16px 0', cursor:'grab', display:'flex', alignItems:'center', gap:'6px', flexShrink:0,
                }}>
                  <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:c.dot, flexShrink:0 }}/>
                  <span style={{ fontSize:'11px', color:'var(--t2)', fontWeight:'500', userSelect:'none' }}>{c.label}</span>
                </div>
                <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', justifyContent:'center', padding:'8px 16px 14px' }}>
                  <div style={{ fontSize:'clamp(20px, 2.4vw, 36px)', fontWeight:'700', color:'var(--t1)', lineHeight:1, marginBottom:'8px', letterSpacing:'-1px' }}>
                    <CountUp value={c.value} display={c.display} delay={200 + i * 60} />
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--t3)' }}>{c.sub}</div>
                </div>
              </div>
            ))}

            {/* SMALL CARDS */}
            {SMALL_CARDS.map((c, i) => (
              <div key={c.i} style={{
                background:'var(--cd)', border:'1px solid var(--br)',
                borderRadius:'12px', overflow:'hidden',
                display:'flex', flexDirection:'column', justifyContent:'center',
              }}>
                <div className="drag-handle" style={{ padding:'0 16px', cursor:'grab', display:'flex', alignItems:'center', justifyContent:'space-between', height:'100%' }}>
                  <div>
                    <div style={{ fontSize:'10px', color:'var(--t3)', marginBottom:'5px', fontWeight:'500', userSelect:'none' }}>{c.label}</div>
                    <div style={{ fontSize:'clamp(16px, 1.6vw, 22px)', fontWeight:'600', color:'var(--t1)', letterSpacing:'-0.3px' }}>{c.value}</div>
                  </div>
                  <div style={{ fontSize:'10px', color:'var(--t3)', textAlign:'right', maxWidth:'80px', lineHeight:1.3 }}>{c.sub}</div>
                </div>
              </div>
            ))}

            {/* DONUT */}
            <div key="donut" style={{
              background:'var(--cd)', border:'1px solid var(--br)',
              borderRadius:'12px', overflow:'hidden',
              display:'flex', flexDirection:'column',
            }}>
              <div className="drag-handle" style={{ padding:'12px 16px 8px', cursor:'grab', flexShrink:0 }}>
                <span style={{ fontSize:'12px', fontWeight:'500', color:'var(--t2)', userSelect:'none' }}>Spend breakdown</span>
              </div>
              {donutSegs.length === 0 ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', color:'var(--t3)' }}>No data</div>
              ) : (
                <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px', padding:'0 12px 12px', overflow:'hidden' }}>
                  <div style={{ position:'relative', width:'120px', height:'120px', flexShrink:0 }}>
                    <svg viewBox="0 0 100 100" style={{ width:'120px', height:'120px' }}>
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
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--t1)' }}>{center.value}</div>
                      <div style={{ fontSize:'9px', color:'var(--t3)', marginTop:'2px' }}>{center.label}</div>
                    </div>
                  </div>
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'6px', overflow:'auto' }}>
                    {donutSegs.map((seg, i) => (
                      <div key={i}
                        onMouseEnter={() => setHoverSeg(i)}
                        onMouseLeave={() => setHoverSeg(null)}
                        style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'5px 8px', borderRadius:'8px', cursor:'pointer', flexShrink:0,
                          background: hoverSeg === i ? 'var(--sf)' : 'transparent',
                          transition:'background 0.15s',
                        }}
                      >
                        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                          <span style={{ width:'9px', height:'9px', borderRadius:'3px', background:seg.color, flexShrink:0 }}/>
                          <span style={{ fontSize:'11px', color:'var(--t1)' }}>{seg.label}</span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'11px', fontWeight:'500', color:'var(--t1)' }}>{seg.value}</div>
                          <div style={{ fontSize:'9px', color:'var(--t3)' }}>{seg.pct}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* BAR CHART */}
            <div key="barchart" style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <BarChart data={chartData} today={todayIdx} daysInMonth={chartData.spend.length} />
            </div>

          </GridLayout>
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
        ? <Moon size={17} color="#f59e0b"/>
        : <Sun  size={17} color="#f59e0b"/>
      }
    </div>
  );
}
