'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, ChevronDown, ChevronLeft, ChevronRight, RefreshCw,
  DollarSign, Users, Eye, LayoutGrid, User,
  ScanLine, MousePointerClick, UserPlus, Target,
  MessageSquare, Trash2,
} from 'lucide-react';
import CountUp from './components/CountUp';
import AreaChart from './components/AreaChart';
import ExportMenu from './components/ExportMenu';
import { useAuth } from './components/AuthContext';
import { useDashboardFilter, DATE_PRESETS_DASHBOARD } from './components/DateFilterContext';
import ThemeToggle from './components/ThemeToggle';
import PlatformSelector, { DEFAULT_PLATFORM } from './components/PlatformSelector';
import PlatformPlaceholder from './components/PlatformPlaceholder';
import useIsMobile from './components/useIsMobile';
import DateFilterPopup from './components/DateFilterPopup';
import { TYPE } from './components/typography';
import { supabase } from './supabase';

/* ─── Design tokens: netral = CSS var (ikut tema), aksen = literal (sama di 2 tema) ─── */
const BG      = 'var(--pg)';
const CARD    = 'var(--cd)';
const BORDER  = 'var(--br)';
const TXT     = 'var(--t1)';
const SUB     = 'var(--t2)';
const MUTE    = 'var(--t3)';
const GREEN   = '#8BE34D';
const BLUE    = '#3B82F6';
const PURPLE  = '#8B5CF6';
const ORANGE  = '#F59E0B';

const CARD_BASE = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '18px',
  boxShadow: 'var(--shadow)',
};


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

// Cost per result — angka penuh (tanpa singkatan K/M), pakai pemisah ribuan
function fmtCPR(v) {
  if (v == null) return '—';
  return 'Rp ' + Math.round(v).toLocaleString('id-ID');
}

// Spend full format — tanpa abbreviation, dengan pemisah ribuan
function fmtSpendFull(n) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// Angka penuh (Reach/Impressions/Traffic/Leads) — pemisah ribuan, tanpa singkatan
function fmtNumFull(n) {
  return Math.round(n).toLocaleString('id-ID');
}

// Buang prefix tipe iklan ("KTBR AWR - ", dst) → tampilkan nama setelah "-"
function stripCampPrefix(name) {
  const i = (name || '').indexOf('-');
  return i >= 0 ? name.slice(i + 1).trim() : (name || '—');
}

// Result per campaign sesuai tipe (logika bisnis CLAUDE.md)
function getCampaignResult(name, ins) {
  const type = getCampaignType(name);
  if (type === 'TRAFFIC')    return getActionValue(ins.actions, ['link_click']);
  if (type === 'CONVERSION') return getActionValue(ins.actions, ['lead','onsite_conversion.lead_grouped']);
  const n = (name || '').toUpperCase();
  if (n.includes('AWR REACH')) return parseFloat(ins.reach || 0);
  return parseFloat(ins.impressions || 0); // AWARENESS default → impressions
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

/* ─── Calendar UI helpers (murni tampilan — tidak menyentuh logika filter) ─── */
const CAL_DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const CAL_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function pad2(n) { return String(n).padStart(2, '0'); }
function toYMD(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; } // m 0-based
function monthGrid(y, m) {
  const start = new Date(y, m, 1).getDay();      // 0=Min
  const days  = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function fmtNice(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${CAL_MON[m - 1]} ${y}`;
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
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
      background: up ? 'var(--pos-soft)' : 'var(--neg-soft)',
      color: up ? 'var(--accent-fg)' : '#EF4444',
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
        borderColor: hover ? 'var(--br-strong)' : BORDER,
        height: '100%', overflow: 'hidden',
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
        <span style={{ ...TYPE.metricLabel }}>{label}</span>
      </div>

      {/* value */}
      <div style={{ ...TYPE.metricValue, marginTop: '10px' }}>
        <CountUp value={value} display={display} delay={delay + 100} />
      </div>

      {/* badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '8px' }}>
        <Badge pct={pct} />
        {pct !== null && pct !== undefined && (
          <span style={{ ...TYPE.caption }}>vs prev period</span>
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
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const { dateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, selectPreset, applyCustom } = useDashboardFilter();
  const [hoverSeg, setHoverSeg]         = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
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
  const [showSuggest, setShowSuggest]   = useState(false);
  const [suggestions, setSuggestions]   = useState([]);
  const [hasUnread, setHasUnread]       = useState(false);
  const [platform, setPlatform]         = useState(DEFAULT_PLATFORM);
  const suggestRef = useRef(null);

  // Slot aksi di top bar mobile (MobileNav) — diisi via portal.
  // Kiri theme toggle: export + refresh · kanan theme toggle: suggestions (admin)
  const [topbarSlot, setTopbarSlot]           = useState(null);
  const [topbarSlotRight, setTopbarSlotRight] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
    setTopbarSlotRight(isMobile ? document.getElementById('wd-topbar-actions-right') : null);
  }, [isMobile]);

  // Bulan kiri kalender (UI only). Default: bulan lalu, jadi tampil "bulan lalu + bulan ini".
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from('suggestions').select('created_at').order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        const lastSeen = localStorage.getItem('wd-suggest-seen');
        if (!lastSeen || new Date(data[0].created_at) > new Date(lastSeen)) setHasUnread(true);
      }
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!showSuggest) return;
    (async () => {
      const { data, error } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });
      if (!error && data) setSuggestions(data);
    })();
    localStorage.setItem('wd-suggest-seen', new Date().toISOString());
    setHasUnread(false);
  }, [showSuggest]);

  useEffect(() => {
    if (!showSuggest) return;
    const handler = (e) => { if (suggestRef.current && !suggestRef.current.contains(e.target)) setShowSuggest(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggest]);

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

      // Top campaigns — Campaign · Spend · Result · Cost/Result · CTR
      // Urutan: Awareness → Traffic → Conversion (lalu spend desc). Warna per tipe.
      const TYPE_ORDER = { AWARENESS: 0, TRAFFIC: 1, CONVERSION: 2 };
      const TYPE_COLOR = { AWARENESS: PURPLE, TRAFFIC: ORANGE, CONVERSION: GREEN };
      const tops = campsWithData
        .map(c => {
          const ins    = c.insights?.data?.[0] || {};
          const sp     = parseFloat(ins.spend || 0);
          const impr   = parseFloat(ins.impressions || 0);
          const clk    = parseFloat(ins.clicks || 0);
          const type   = getCampaignType(c.name);
          const result = getCampaignResult(c.name, ins);
          return {
            name:  stripCampPrefix(c.name),
            type,
            spend: sp,
            result,
            // Awareness → CPM (per 1.000 impressions); Traffic/Conversion → per result
            cpr:   result > 0 ? (type === 'AWARENESS' ? (sp / result) * 1000 : sp / result) : null,
            ctr:   impr > 0 ? (clk / impr) * 100 : 0,
            color: TYPE_COLOR[type],
          };
        })
        .sort((a, b) => (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) || (b.spend - a.spend));
      setTopCampaigns(tops);

      // Donut spend breakdown
      const total = totalSpend || 1;
      const segs  = [];
      if (awareSpend > 0)   segs.push({ color: PURPLE, label:'Awareness',  pct: Math.round(awareSpend/total*100),   value: fmtSpendFull(awareSpend)   });
      if (trafficSpend > 0) segs.push({ color: ORANGE, label:'Traffic',    pct: Math.round(trafficSpend/total*100), value: fmtSpendFull(trafficSpend) });
      if (convSpend > 0)    segs.push({ color: GREEN,  label:'Conversion', pct: Math.round(convSpend/total*100),    value: fmtSpendFull(convSpend)    });
      const other = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
      if (other > 0)        segs.push({ color: BLUE,   label:'Other',      pct: Math.round(other/total*100),        value: fmtSpendFull(other)        });

      const CIRC = 238.76;
      let offset = 0;
      setDonutSegs(segs.map(seg => {
        const dash = (seg.pct / 100) * CIRC;
        const s = { ...seg, dash: parseFloat(dash.toFixed(1)), offset: parseFloat((-offset).toFixed(1)) };
        offset += dash;
        return s;
      }));
      setDonutTotal({ value: fmtSpendFull(totalSpend), label: 'Total Spend' });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleDeleteSuggestion(id) {
    const { error } = await supabase.from('suggestions').delete().eq('id', id);
    if (!error) setSuggestions(prev => prev.filter(s => s.id !== id));
  }

  async function handleClearAllSuggestions() {
    // id bertipe UUID — filter harus valid untuk uuid, bukan angka
    const { error } = await supabase.from('suggestions').delete().not('id', 'is', null);
    if (!error) setSuggestions([]);
  }

  function applyCustomRange() {
    if (!customSince || !customUntil) return;
    applyCustom(customSince, customUntil);
    setShowDropdown(false);
    fetchData(customSince, customUntil);
  }

  function handleSelectPreset(opt) {
    selectPreset(opt);
    setShowDropdown(false);
  }

  // ── Kalender (UI only) ──
  function openFilter() {
    const next = !showDropdown;
    if (next && customSince) { // buka: lompat ke bulan tanggal mulai
      const p = customSince.split('-');
      setCalY(+p[0]); setCalM(+p[1] - 1);
    }
    setShowDropdown(next);
  }
  function shiftCal(delta) {
    const dt = new Date(calY, calM + delta, 1);
    setCalY(dt.getFullYear()); setCalM(dt.getMonth());
  }
  // Bangun range di customSince/customUntil (dipakai applyCustomRange yang sudah ada)
  function pickDay(ds) {
    if (!customSince || (customSince && customUntil)) { setCustomSince(ds); setCustomUntil(''); }
    else if (ds < customSince) { setCustomUntil(customSince); setCustomSince(ds); }
    else setCustomUntil(ds);
  }
  // Pilih range sekaligus (tombol kuartal) + lompatkan kalender ke bulan awal range
  function pickRange(s, u) {
    setCustomSince(s); setCustomUntil(u);
    const p = s.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1);
  }
  // Render satu bulan (dow + grid tanggal) dengan highlight range
  function renderMonth(y, m) {
    const todayStr = toYMD(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    return (
      <div style={{ width:'232px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', rowGap:'2px' }}>
          {CAL_DOW.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:'11px', color:MUTE, paddingBottom:'8px' }}>{d}</div>
          ))}
          {monthGrid(y, m).map((d, i) => {
            if (!d) return <div key={i} />;
            const ds       = toYMD(y, m, d);
            const isStart  = ds === customSince;
            const isEnd    = ds === customUntil;
            const inRange  = customSince && customUntil && ds > customSince && ds < customUntil;
            const isToday  = ds === todayStr;
            const endpoint = isStart || isEnd;
            const hasLeft  = customUntil && (isEnd || inRange);   // band menyambung ke kiri
            const hasRight = customUntil && (isStart || inRange); // band menyambung ke kanan
            return (
              <div key={i} style={{ position:'relative', height:'32px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {(hasLeft || hasRight) && (
                  <span style={{ position:'absolute', top:'3px', bottom:'3px',
                    left: hasLeft ? 0 : '50%', right: hasRight ? 0 : '50%',
                    background:'var(--cal-range)' }} />
                )}
                {endpoint && (
                  <span style={{ position:'absolute', width:'30px', height:'30px', borderRadius:'50%',
                    background:'var(--cal-accent)', boxShadow:'0 2px 8px var(--cal-glow)' }} />
                )}
                <button onClick={() => pickDay(ds)} style={{
                  position:'relative', width:'30px', height:'30px', borderRadius:'50%',
                  border: isToday && !endpoint ? '1px solid var(--cal-accent-line)' : '1px solid transparent',
                  background:'transparent', cursor:'pointer', fontSize:'12.5px', fontFamily:'inherit',
                  fontWeight: endpoint ? 700 : 400,
                  color: endpoint ? 'var(--cal-accent-fg)' : isToday ? 'var(--cal-accent-line)' : inRange ? TXT : SUB,
                  transition:'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { if (!endpoint) e.currentTarget.style.background='var(--hover)'; }}
                onMouseLeave={e => { if (!endpoint) e.currentTarget.style.background='transparent'; }}
                >{d}</button>
              </div>
            );
          })}
        </div>
      </div>
    );
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

  // ── Refresh + Suggestions: di header (desktop) ATAU top bar via portal (mobile).
  //    Ukuran 36px di mobile biar serasi dengan ThemeToggle top bar. ──
  const ctrlSize   = isMobile ? '36px' : '40px';
  const ctrlRadius = isMobile ? '9px'  : '10px';

  const refreshButton = (
    <button onClick={refresh} title="Refresh" style={{
      width:ctrlSize, height:ctrlSize, display:'flex', alignItems:'center', justifyContent:'center',
      background: CARD, border:`1px solid ${BORDER}`, borderRadius:ctrlRadius, cursor:'pointer',
      flexShrink:0, transition:'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor='var(--br-strong)'}
    onMouseLeave={e => e.currentTarget.style.borderColor=BORDER}
    >
      <RefreshCw size={15} color={SUB} style={loading ? { animation:'wdSpin 0.8s linear infinite' } : undefined}/>
    </button>
  );

  const suggestionsBlock = isAdmin ? (
    <div ref={suggestRef} style={{ position:'relative' }}>
      <button
        onClick={() => setShowSuggest(prev => !prev)}
        title="Suggestions"
        style={{
          width:ctrlSize, height:ctrlSize, display:'flex', alignItems:'center', justifyContent:'center',
          background: CARD, border:`1px solid ${showSuggest ? 'var(--cal-accent-line)' : BORDER}`,
          borderRadius:ctrlRadius, cursor:'pointer', position:'relative',
          flexShrink:0, transition:'border-color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor='var(--br-strong)'}
        onMouseLeave={e => { if (!showSuggest) e.currentTarget.style.borderColor=BORDER; }}
      >
        <MessageSquare size={15} color="var(--cal-accent-line)"/>
        {hasUnread && (
          <span style={{
            position:'absolute', top:'6px', right:'6px',
            width:'8px', height:'8px', borderRadius:'50%',
            background:'#EF4444', border:`2px solid ${CARD}`,
            animation:'wdPulseDot 1.5s ease-in-out infinite',
          }}/>
        )}
      </button>

      {showSuggest && (
        <div style={ isMobile ? {
          position:'fixed', top:'64px', left:'16px', right:'16px', zIndex:60,
          maxHeight:'60vh',
          background:'var(--cd)', border:`1px solid ${BORDER}`, borderRadius:'14px',
          boxShadow:'var(--pop-shadow)', overflow:'hidden',
          animation:'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
          display:'flex', flexDirection:'column',
        } : {
          position:'absolute', top:'48px', right:0, zIndex:50,
          width:'380px', maxHeight:'440px',
          background:'var(--cd)', border:`1px solid ${BORDER}`, borderRadius:'14px',
          boxShadow:'var(--pop-shadow)', overflow:'hidden',
          animation:'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
          display:'flex', flexDirection:'column',
        }}>
          <div style={{
            padding:'14px 16px', borderBottom:`1px solid ${BORDER}`, background:'var(--sf)',
            display:'flex', alignItems:'center', gap:'8px',
          }}>
            <MessageSquare size={16} color={SUB}/>
            <span style={{ ...TYPE.sectionTitle }}>User Suggestions</span>
            <span style={{ ...TYPE.caption, marginLeft:'auto' }}>{suggestions.length} total</span>
            {suggestions.length > 0 && (
              <button onClick={handleClearAllSuggestions} title="Clear all" style={{
                background:'none', border:'none', cursor:'pointer', color:'#EF4444',
                fontSize:'11px', fontWeight:500, padding:'2px 6px', borderRadius:'6px',
                transition:'background 0.15s', marginLeft:'8px',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
              >Clear all</button>
            )}
          </div>
          <div style={{ overflowY:'auto', flex:1, padding:'12px' }}>
            {suggestions.length === 0 ? (
              <div style={{ ...TYPE.body, textAlign:'center', color:MUTE, padding:'24px 0' }}>No suggestions yet.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {suggestions.map(s => (
                  <div key={s.id} style={{
                    padding:'12px', borderRadius:'10px',
                    border:`1px solid ${BORDER}`, background:'var(--data-bg)',
                    animation:'wdFadeUp 0.2s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontSize:'11px', fontWeight:600, color:SUB, textTransform:'capitalize' }}>{s.author}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <span style={{ fontSize:'10px', color:MUTE }}>
                          {new Date(s.created_at).toLocaleDateString('en-GB',{ day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </span>
                        <button onClick={() => handleDeleteSuggestion(s.id)} title="Delete" style={{
                          background:'none', border:'none', cursor:'pointer', color:'#EF4444',
                          display:'flex', alignItems:'center', opacity:0.6, transition:'opacity 0.15s', padding:0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity=1}
                        onMouseLeave={e => e.currentTarget.style.opacity=0.6}
                        ><Trash2 size={13}/></button>
                      </div>
                    </div>
                    <div style={{ ...TYPE.small, color:TXT, whiteSpace:'pre-wrap' }}>{s.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background: BG }}>

      {/* ══ HEADER (72px desktop · 2 baris mobile) ══ */}
      <header style={ isMobile ? {
        display:'flex', flexDirection:'column', alignItems:'stretch', gap:'12px',
        padding:'14px 16px', flexShrink:0,
        borderBottom:`1px solid ${BORDER}`,
      } : {
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:'72px', flexShrink:0,
        borderBottom:`1px solid ${BORDER}`,
      }}>
        <div>
          <h1 style={{ ...TYPE.h1, ...(isMobile ? { fontSize:'20px' } : null) }}>Dashboard</h1>
          <p style={{ ...TYPE.small, marginTop:'3px' }}>
            {platform.available
              ? (loading ? 'Loading…' : `${platform.label} Performance Overview · ${activeCampaignCount} active`)
              : `${platform.label} · Under development`}
          </p>
        </div>

        <div style={{
          display:'flex', alignItems:'center',
          gap:isMobile ? '8px' : '10px',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          // Mobile: chip platform + date filter rata kanan (semua role)
          justifyContent: isMobile ? 'flex-end' : 'flex-start',
        }}>
          {/* Platform selector */}
          <PlatformSelector selected={platform} onSelect={setPlatform} />

          {/* Date filter */}
          <div style={{ position:'relative' }} data-filter>
            <button onClick={openFilter} style={{
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
              <DateFilterPopup
                presets={DATE_PRESETS_DASHBOARD}
                dateOpt={dateOpt}
                isCustom={isCustom}
                customSince={customSince}
                customUntil={customUntil}
                calY={calY} calM={calM}
                isMobile={isMobile}
                onSelectPreset={handleSelectPreset}
                onPickDay={pickDay}
                onPickRange={pickRange}
                onShiftCal={shiftCal}
                onApply={applyCustomRange}
                onClose={() => setShowDropdown(false)}
              />
            )}
          </div>

          {!isMobile && isAdmin && (
            <ExportMenu
              summary={summary}
              chartData={chartData}
              rangeLabel={filterLabel()}
              activeCount={activeCampaignCount}
            />
          )}

          {!isMobile && refreshButton}
          {!isMobile && <ThemeToggle/>}
          {!isMobile && suggestionsBlock}

          {/* Mobile: aksi pindah ke top bar. Urutan dari kanan:
              Suggestions → Theme toggle → Refresh → Export */}
          {isMobile && topbarSlot && createPortal(
            <>
              {isAdmin && (
                <ExportMenu
                  summary={summary}
                  chartData={chartData}
                  rangeLabel={filterLabel()}
                  activeCount={activeCampaignCount}
                  compact
                />
              )}
              {refreshButton}
            </>,
            topbarSlot
          )}
          {isMobile && topbarSlotRight && suggestionsBlock && createPortal(suggestionsBlock, topbarSlotRight)}
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{
        flex:1, minHeight:0, display:'flex', flexDirection:'column',
        padding: isMobile ? '16px' : '24px',
        gap:     isMobile ? '16px' : '20px',
        overflowY: isMobile ? 'auto' : 'hidden',
        overflowX: 'hidden',
      }}>

        {!platform.available && <PlatformPlaceholder platform={platform} />}

        {platform.available && loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:SUB, fontSize:'13px' }}>Loading…</div>
        )}

        {platform.available && !loading && error && (
          <div style={{ padding:'14px 18px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'12px', color:'#EF4444', fontSize:'12px' }}>
            Error: {error}
          </div>
        )}

        {platform.available && !loading && !error && summary && (<>

          {/* ══ ROW 1: KPI — 5 equal cards (desktop) · swipe carousel (mobile) ══ */}
          {(() => {
            const kpis = [
              { label:'Total Spend', icon:DollarSign, color:GREEN,
                value:Math.round(summary.totalSpend), display:fmtSpendFull(summary.totalSpend),
                pct:summary.pctSpend, spark:chartData.spend },
              { label:'Reach', icon:Users, color:BLUE,
                value:Math.round(summary.totalReach), display:fmtNumFull(summary.totalReach),
                pct:summary.pctReach, spark:chartData.awareness },
              { label:'Impressions', icon:Eye, color:PURPLE,
                value:Math.round(summary.totalImpressions), display:fmtNumFull(summary.totalImpressions),
                pct:summary.pctImpressions, spark:chartData.awareness },
              { label:'Traffic', icon:LayoutGrid, color:ORANGE,
                value:summary.totalTraffic, display:fmtNumFull(summary.totalTraffic),
                pct:summary.pctTraffic, spark:chartData.traffic },
              { label:'Leads', icon:User, color:GREEN,
                value:summary.totalLeads, display:fmtNumFull(summary.totalLeads),
                pct:summary.pctLeads, spark:chartData.leads },
            ];
            if (isMobile) return (
              // Carousel swipe: scroll-snap native (smooth di semua browser, tanpa library)
              <div className="wd-hscroll" style={{
                display:'flex', gap:'12px', overflowX:'auto', flexShrink:0,
                scrollSnapType:'x mandatory',
                margin:'0 -16px', padding:'0 16px',
              }}>
                {kpis.map((k, i) => (
                  <div key={k.label} style={{ minWidth:'76%', flexShrink:0, scrollSnapAlign:'center', display:'grid' }}>
                    <KpiCard {...k} delay={i * 55}/>
                  </div>
                ))}
              </div>
            );
            return (
              <div style={{ flex:'1 1 0', minHeight:'150px', maxHeight:'190px', display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'16px' }}>
                {kpis.map((k, i) => <KpiCard key={k.label} {...k} delay={i * 55}/>)}
              </div>
            );
          })()}

          {/* ══ ROW 2: SECONDARY METRICS — 4 kolom (desktop) · 2x2 (mobile) ══ */}
          <div style={{
            ...CARD_BASE, overflow:'hidden',
            display:'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            ...(isMobile ? { flexShrink:0 } : { flex:'1 1 0', minHeight:'74px', maxHeight:'92px' }),
            animation:'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 260ms backwards',
          }}>
            {[
              { label:'CPM', value: summary.calcCPM ? fmtSpendFull(summary.calcCPM) : '—', sub:'cost per 1K impressions', icon: ScanLine },
              { label:'CPC', value: summary.calcCPC ? fmtSpendFull(summary.calcCPC) : '—', sub:'cost per click',          icon: MousePointerClick },
              { label:'CPL', value: summary.calcCPL ? fmtSpendFull(summary.calcCPL) : '—', sub:'cost per lead',           icon: UserPlus },
              { label:'CTR', value: summary.calcCTR ? summary.calcCTR.toFixed(2)+'%' : '—', sub:'click through rate',  icon: Target },
            ].map((m, i) => {
              const Ic = m.icon;
              return (
                <div key={m.label} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding: isMobile ? '14px 16px' : '0 22px',
                  borderRight: (isMobile ? i % 2 === 0 : i < 3) ? `1px solid ${BORDER}` : 'none',
                  borderBottom: isMobile && i < 2 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <div>
                    <div style={{ ...TYPE.small, marginBottom:'3px' }}>{m.label}</div>
                    <div style={{ ...TYPE.metricValueSm }}>{m.value}</div>
                    <div style={{ ...TYPE.metricSub, marginTop:'3px' }}>{m.sub}</div>
                  </div>
                  <Ic size={18} color="var(--icon-muted)"/>
                </div>
              );
            })}
          </div>

          {/* ══ ROW 3: ANALYTICS — 30/40/30 (desktop) · stack vertikal (mobile) ══ */}
          <div style={ isMobile ? {
            display:'flex', flexDirection:'column', gap:'16px', flexShrink:0,
          } : {
            flex:'1 1 0', minHeight:'260px', maxHeight:'500px', display:'grid', gridTemplateColumns:'2.55fr 4.45fr 3fr', gap:'16px',
          }}>

            {/* Spend Breakdown (donut) */}
            <div style={{ ...CARD_BASE, display:'flex', flexDirection:'column', overflow:'hidden', padding:'18px 20px', ...(isMobile ? { flexShrink:0 } : null) }}>
              <div style={{ ...TYPE.cardTitle, flexShrink:0 }}>Spend Breakdown</div>
              {donutSegs.length === 0 ? (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:SUB }}>No data</div>
              ) : (
                <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px', overflow:'hidden', marginTop: isMobile ? '16px' : 0 }}>
                  <div style={{ position:'relative', width:'200px', height:'200px', flexShrink:0 }}>
                    <svg viewBox="0 0 100 100" style={{ width:'200px', height:'200px' }}>
                      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--track)" strokeWidth="16"/>
                      {donutSegs.map((seg, i) => {
                        let sw=16, op=1;
                        if (hoverSeg!==null){ sw=hoverSeg===i?19:12; op=hoverSeg===i?1:0.25; }
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
                      <div style={{ ...TYPE.metricValueSm }}>{center.value}</div>
                      <div style={{ ...TYPE.caption, color:SUB, marginTop:'4px' }}>{center.label}</div>
                    </div>
                  </div>
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:'8px', overflow:'auto' }}>
                    {donutSegs.map((seg, i) => (
                      <div key={i} onMouseEnter={() => setHoverSeg(i)} onMouseLeave={() => setHoverSeg(null)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'2px 4px', borderRadius:'7px', cursor:'pointer', flexShrink:0,
                          background: hoverSeg===i ? 'var(--hover)' : 'transparent', transition:'background 0.15s' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ width:'9px', height:'9px', borderRadius:'3px', background:seg.color, flexShrink:0 }}/>
                          <span style={{ ...TYPE.body, color:SUB }}>{seg.label}</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ ...TYPE.body, fontWeight:600 }}>{seg.value}</span>
                          <span style={{ ...TYPE.small, color:MUTE }}>{seg.pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Daily Spend (area chart) — mobile: tinggi tetap 300px */}
            {isMobile ? (
              <div style={{ height:'300px', flexShrink:0, display:'flex', flexDirection:'column' }}>
                <AreaChart data={chartData} dates={chartDates} today={todayIdx}/>
              </div>
            ) : (
              <AreaChart data={chartData} dates={chartDates} today={todayIdx}/>
            )}

            {/* Top Campaigns */}
            <div style={{ ...CARD_BASE, display:'flex', flexDirection:'column', overflow:'hidden', padding:'18px 20px', ...(isMobile ? { flexShrink:0, maxHeight:'420px' } : null) }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexShrink:0 }}>
                <span style={{ ...TYPE.cardTitle }}>Top Campaigns</span>
              </div>
              {/* header row */}
              <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.9fr 0.8fr 1.05fr 0.7fr', gap:'6px',
                ...TYPE.tableHeader, paddingBottom:'10px', borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                <span>Campaign</span>
                <span style={{ textAlign:'right' }}>Spend</span>
                <span style={{ textAlign:'right' }}>Result</span>
                <span style={{ textAlign:'right' }}>Cost/Result</span>
                <span style={{ textAlign:'right' }}>CTR</span>
              </div>
              <div style={{ flex:1, minHeight:0, overflow:'auto', display:'flex', flexDirection:'column' }}>
                {topCampaigns.length === 0 ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:SUB }}>No data</div>
                ) : topCampaigns.map((c, i) => (
                  <div key={i}
                    onMouseEnter={e => e.currentTarget.style.background='var(--hover)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    style={{ display:'grid', gridTemplateColumns:'1.4fr 0.9fr 0.8fr 1.05fr 0.7fr', gap:'6px',
                    alignItems:'center', padding:'11px 8px', margin:'0 -8px', borderRadius:'8px', transition:'background 0.15s',
                    borderBottom: i < topCampaigns.length-1 ? '1px solid var(--divider)' : 'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
                      <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                      <span style={{ ...TYPE.tableCell, color:TXT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={c.name}>{c.name}</span>
                    </div>
                    <span style={{ ...TYPE.tableCell, textAlign:'right' }}>{fmtSpend(c.spend)}</span>
                    <span style={{ ...TYPE.tableCell, textAlign:'right' }}>{fmtBigNum(c.result)}</span>
                    <span style={{ ...TYPE.tableCellStrong, textAlign:'right' }}>{fmtCPR(c.cpr)}</span>
                    <span style={{ ...TYPE.tableCell, textAlign:'right' }}>{c.ctr.toFixed(2)}%</span>
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

