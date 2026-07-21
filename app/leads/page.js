'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, ChevronDown, RefreshCw, Users, PhoneCall,
  Wallet, CircleAlert, Inbox,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../components/AuthContext';
import { supabase, authFetch } from '../supabase';
import useIsMobile from '../components/useIsMobile';
import ThemeToggle from '../components/ThemeToggle';
import DateFilterPopup from '../components/DateFilterPopup';
import Dropdown from '../components/Dropdown';
import { STATUSES, STATUS_COLOR, SALES, SALES_COLOR, CATEGORIES, kategoriLabel } from '../components/leadsConfig';
import { useLeadsFilter, DATE_PRESETS_DASHBOARD } from '../components/DateFilterContext';
import { TYPE } from '../components/typography';
import CountUp from '../components/CountUp';

/* ─────────────────────────────────────────────────────────────
   LEADS HUB — DASHBOARD (v3.1, redesain G1 "Forest Panel")
   Logika data SAMA dgn v3.0 (MASTER PLAN 3.3): leads per periode,
   breakdown status, follow-up compliance, spend konversi, CPD,
   ROI (atribusi cohort). Desktop = fit 1 layar: KPI pair →
   panel forest status → Leads by Sales + By Category (compact) →
   baris uang DORMANT (abu-abu s.d. ada Deal). Mobile tetap
   layout lama.
   ───────────────────────────────────────────────────────────── */

function fmtRp(v) { return 'Rp ' + Math.round(v || 0).toLocaleString('id-ID'); }
function fmtPct(v) { return (v || 0).toFixed(0) + '%'; }

/* Warna status khusus panel forest (bg gelap tetap kontras dua tema).
   Deal pakai lime biar jadi klimaks panel; di luar panel tetap STATUS_COLOR. */
const PANEL_STATUS_COLOR = {
  'No Status': '#8E9C92',
  Cold: '#3B82F6',
  Warm: '#F59E0B',
  Hot: '#EF4444',
  Deal: '#C8F169',
};
const FOREST = '#14382A';

/* preset → {since, until} (versi client; sama logikanya dgn /api/meta) */
function ymd(d) { return d.toISOString().slice(0, 10); }
function presetToRange(preset) {
  const now = new Date();
  const today = ymd(now);
  const add = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return ymd(d); };
  switch (preset) {
    case 'today':     return { since: today, until: today };
    case 'yesterday': return { since: add(-1), until: add(-1) };
    case 'last_7d':   return { since: add(-7),  until: add(-1) };
    case 'last_14d':  return { since: add(-14), until: add(-1) };
    case 'last_30d':  return { since: add(-30), until: add(-1) };
    case 'this_month': return { since: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, until: today };
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { since: ymd(first), until: ymd(last) };
    }
    default: return { since: add(-30), until: add(-1) };
  }
}

export default function LeadsDashboardPage() {
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const { dateOpt, customSince, customUntil, isCustom, selectPreset, applyCustom } = useLeadsFilter();

  const [showDropdown, setShowDropdown] = useState(false);
  const [kategori, setKategori] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null); // { total, fuRate, statusCounts, deals, closing, spend, cpd, roi, byKategori, inboxCount, daily }

  // Kalender popup (UI only)
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());
  const [localSince, setLocalSince] = useState('');
  const [localUntil, setLocalUntil] = useState('');

  // Slot top bar mobile (refresh via portal, pola Reports)
  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
  }, [isMobile]);

  useEffect(() => { if (!role) return; fetchData(); }, [role, dateOpt, isCustom, customSince, customUntil, kategori]);

  useEffect(() => {
    if (!showDropdown) return;
    const h = e => { if (!e.target.closest('[data-filter]')) setShowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showDropdown]);

  async function fetchData() {
    setLoading(true); setError(null);
    try {
      const range = isCustom && customSince && customUntil
        ? { since: customSince, until: customUntil }
        : presetToRange(dateOpt.value);

      // 1. Leads approved dalam periode (cohort by created_at)
      let query = supabase
        .from('leads')
        .select('status, followed_up, closing_amount, kategori_promo, sales, created_at')
        .eq('verification', 'approved')
        .gte('created_at', range.since + 'T00:00:00')
        .lte('created_at', range.until + 'T23:59:59.999');
      if (kategori !== 'Semua') query = query.eq('kategori_promo', kategori);
      const { data: leads, error: qErr } = await query.limit(10000);
      if (qErr) throw new Error(qErr.message);

      // 2. Spend campaign konversi (agregat) — periode sama
      let spend = 0;
      try {
        const url = isCustom && customSince && customUntil
          ? `/api/leads?mode=spend&since=${customSince}&until=${customUntil}`
          : `/api/leads?mode=spend&date_preset=${dateOpt.value}`;
        const res  = await authFetch(url);
        const json = await res.json();
        if (!json.error) spend = json.spend || 0;
      } catch (e) {}

      // 3. Inbox count (admin only, info kecil)
      let inboxCount = 0;
      if (role === 'admin') {
        const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('verification', 'unverified');
        inboxCount = count || 0;
      }

      const total = leads.length;
      const fu = leads.filter(l => l.followed_up).length;
      const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0]));
      const byKategori = Object.fromEntries([...CATEGORIES.map(c => c.value), '—'].map(k => [k, 0]));
      const bySales = Object.fromEntries([...SALES, '—'].map(s => [s, { leads: 0, deals: 0 }]));
      let closing = 0;
      for (const l of leads) {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
        byKategori[l.kategori_promo || '—'] = (byKategori[l.kategori_promo || '—'] || 0) + 1;
        const sk = l.sales && bySales[l.sales] ? l.sales : '—';
        bySales[sk].leads += 1;
        if (l.status === 'Deal') bySales[sk].deals += 1;
        if (l.status === 'Deal' && l.closing_amount) closing += parseFloat(l.closing_amount);
      }
      const deals = statusCounts.Deal;

      // Sparkline harian New Leads (jumlah lead per hari dalam rentang)
      const dayCounts = {};
      for (const l of leads) {
        const day = (l.created_at || '').slice(0, 10);
        if (day) dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
      const daily = [];
      {
        const start = new Date(range.since + 'T00:00:00');
        const end = new Date(range.until + 'T00:00:00');
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
          daily.push(dayCounts[ymd(dt)] || 0);
        }
      }

      setData({
        total,
        fuRate: total ? (fu / total) * 100 : 0,
        fuCount: fu,
        statusCounts,
        byKategori,
        bySales,
        deals,
        closing,
        spend,
        cpd: deals ? spend / deals : 0,
        roas: spend ? closing / spend : 0,                 // ROAS = omzet ÷ spend
        roi:  spend ? (closing - spend) / spend * 100 : 0, // ROI  = (omzet − spend) ÷ spend
        inboxCount,
        daily,
      });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  /* ── Handler filter (pola sama Reports) ── */
  function openFilter() {
    const next = !showDropdown;
    if (next) {
      setLocalSince(customSince || ''); setLocalUntil(customUntil || '');
      if (customSince) { const p = customSince.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
    }
    setShowDropdown(next);
  }
  function shiftCal(delta) {
    const dt = new Date(calY, calM + delta, 1);
    setCalY(dt.getFullYear()); setCalM(dt.getMonth());
  }
  function pickDay(ds) {
    if (!localSince || (localSince && localUntil)) { setLocalSince(ds); setLocalUntil(''); }
    else if (ds < localSince) { setLocalUntil(localSince); setLocalSince(ds); }
    else setLocalUntil(ds);
  }
  function pickRange(s, u) {
    setLocalSince(s); setLocalUntil(u);
    const p = s.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1);
  }
  function applyCustomRange() {
    if (!localSince || !localUntil) return;
    applyCustom(localSince, localUntil);
    setShowDropdown(false);
  }
  function handleSelectPreset(opt) {
    selectPreset(opt);
    setShowDropdown(false);
  }
  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }

  const card = {
    background: 'var(--cd)', border: '1px solid var(--br)',
    borderRadius: '18px', boxShadow: 'var(--shadow)',
  };
  /* Kartu "dormant" (mati) — dipakai baris uang saat belum ada Deal */
  const dormCard = {
    background: 'var(--hover)', border: '1px dashed var(--br)',
    borderRadius: '18px', boxShadow: 'none',
  };
  const refreshButton = (
    <button onClick={fetchData} title="Refresh" style={{
      width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: isMobile ? '9px' : '10px',
      cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
    }}>
      <RefreshCw size={15} color="var(--t2)" style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  if (!role) return null;

  const d = data;
  const hasDeal = !loading && !!d && d.deals > 0;
  const dormant = !loading && !!d && d.deals === 0;
  const maxStatus = d ? Math.max(...STATUSES.map(s => d.statusCounts?.[s] || 0), 1) : 1;

  /* KPI card kecil seragam (dipakai layout mobile lama) */
  function Kpi({ Icon, label, value, display, sub, color }) {
    return (
      <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            background: (color || 'var(--ac)') + '1f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={15} color={color || 'var(--ac)'} />
          </div>
          <span style={{ ...TYPE.small, fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ ...TYPE.metricValueSm, fontSize: isMobile ? '20px' : '24px' }}>
          {loading || !d ? '—' : <CountUp value={value} display={display} />}
        </div>
        <div style={{ ...TYPE.metricSub, minHeight: '14px' }}>{loading || !d ? '' : sub}</div>
      </div>
    );
  }

  /* ── Blok desktop G1 ── */

  /* Sparkline harian (data real dari daily[]) */
  function Spark({ daily }) {
    if (!daily || daily.length < 2) return null;
    const max = Math.max(...daily, 1);
    const W = 100, H = 30;
    const pts = daily.map((v, i) => `${(i / (daily.length - 1)) * W},${H - (v / max) * (H - 3) - 1}`);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{
        position: 'absolute', right: '16px', bottom: '12px', width: '44%', height: '44px', pointerEvents: 'none',
      }}>
        <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill="var(--cal-accent)" opacity="0.09" />
        <polyline points={pts.join(' ')} fill="none" stroke="var(--cal-accent)" strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  /* Meter "barcode" Follow-up */
  function BarcodeMeter({ pct }) {
    const stripe = c => `repeating-linear-gradient(90deg, ${c} 0 3px, transparent 3px 7px)`;
    return (
      <div style={{ height: '32px', width: '58%', minWidth: '160px', borderRadius: '8px', overflow: 'hidden', display: 'flex', marginTop: 'auto' }}>
        <div style={{ width: `${Math.max(Math.min(pct, 100), 0)}%`, background: stripe('var(--cal-accent)') }} />
        <div style={{ flex: 1, background: stripe('var(--br)') }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ══ HEADER CARD ══ */}
      <header style={isMobile ? {
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px',
        padding: '14px 16px', flexShrink: 0, borderBottom: '1px solid var(--br)',
      } : {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', margin: '12px 16px 0', flexShrink: 0, ...card,
      }}>
        <div>
          <h1 style={{ ...TYPE.h1, ...(isMobile ? { fontSize: '20px' } : null) }}>Dashboard</h1>
          <p style={{ ...TYPE.small, marginTop: '3px' }}>
            Leads Hub · {loading || !d ? 'Loading…' : `${d.total} leads · ${filterLabel()}`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', justifyContent: isMobile ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
          {/* Chip Black Box (admin, desktop) — pengganti banner biar fit 1 layar */}
          {!isMobile && !loading && d?.inboxCount > 0 && role === 'admin' && (
            <Link href="/leads/list" style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px', textDecoration: 'none',
              padding: '8px 13px', borderRadius: '999px', flexShrink: 0,
              border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.09)',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B', animation: 'wdPulseDot 1.6s ease-in-out infinite' }} />
              <span style={{ ...TYPE.small, fontWeight: 700, color: '#B45309' }}>{d.inboxCount} in Black Box</span>
            </Link>
          )}

          {/* Filter kategori promo (scope Dashboard saja — MASTER PLAN 3.3) */}
          <Dropdown
            label={kategori === 'Semua' ? 'All Categories' : kategoriLabel(kategori)}
            value={kategori}
            minWidth={220}
            align="right"
            buttonStyle={{ padding: '9px 12px', fontSize: '13px', fontWeight: 500 }}
            options={[
              { value: 'Semua', label: 'All Categories' },
              ...CATEGORIES.map(c => ({ value: c.value, label: c.label })),
            ]}
            onSelect={setKategori}
          />

          {/* Date filter */}
          <div style={{ position: 'relative' }} data-filter>
            <button onClick={openFilter} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px',
              background: 'var(--cd)', border: `1px solid ${isCustom ? 'var(--cal-accent)' : 'var(--br)'}`,
              borderRadius: '10px', fontSize: '13px', color: 'var(--t1)', cursor: 'pointer',
            }}>
              <Calendar size={14} color="var(--t2)" />
              {filterLabel()}
              <ChevronDown size={13} color="var(--t2)" />
            </button>
            {showDropdown && (
              <DateFilterPopup
                presets={DATE_PRESETS_DASHBOARD}
                dateOpt={dateOpt}
                isCustom={isCustom}
                customSince={localSince}
                customUntil={localUntil}
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

          {!isMobile && refreshButton}
          {!isMobile && <ThemeToggle />}
          {isMobile && topbarSlot && createPortal(refreshButton, topbarSlot)}
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: isMobile ? '16px' : '12px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {error && (
          <div style={{ ...card, padding: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CircleAlert size={18} color="#EF4444" />
            <span style={{ ...TYPE.body }}>Failed to load data: {error}</span>
          </div>
        )}

        {/* Info Inbox (admin, mobile — desktop pakai chip di header) */}
        {isMobile && !loading && d?.inboxCount > 0 && role === 'admin' && (
          <Link href="/leads/list" style={{
            ...card, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px',
            textDecoration: 'none', borderColor: 'var(--cal-accent)',
          }}>
            <Inbox size={16} color="var(--ac)" />
            <span style={{ ...TYPE.body, fontWeight: 600 }}>{d.inboxCount} lead{d.inboxCount === 1 ? '' : 's'} awaiting verification in Inbox</span>
            <span style={{ ...TYPE.small, marginLeft: 'auto', color: 'var(--ac)', fontWeight: 600 }}>Open Inbox →</span>
          </Link>
        )}

        {isMobile ? (
          /* ════════ MOBILE — layout lama (tidak diubah) ════════ */
          <>
            {/* ── KPI ROW ── */}
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              <Kpi Icon={Users} label="Total Leads" value={d?.total || 0} display={(d?.total || 0).toLocaleString('id-ID')} sub={`period: ${filterLabel()}`} />
              <Kpi Icon={PhoneCall} label="Follow-up" value={d?.fuRate || 0} display={fmtPct(d?.fuRate)} sub={`${d?.fuCount || 0} of ${d?.total || 0} followed up`} color="#3B82F6" />
              <Kpi Icon={Wallet} label="Total Closing" value={d?.closing || 0} display={fmtRp(d?.closing)} sub={d?.spend ? `ROAS ${(d.roas).toFixed(2)}x on conversion spend` : 'conversion spend Rp 0'} color="#F59E0B" />
            </div>

            {/* ── STATUS CARDS ── */}
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              {STATUSES.map(s => {
                const n = d?.statusCounts?.[s] || 0;
                const pct = d?.total ? (n / d.total) * 100 : 0;
                const c = STATUS_COLOR[s]?.fg;
                return (
                  <div key={s} style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <span style={{ ...TYPE.small, fontWeight: 600 }}>{s}</span>
                    </div>
                    <div style={{ ...TYPE.metricValueSm, fontSize: '19px', color: s === 'No Status' ? 'var(--t1)' : c }}>
                      {loading || !d ? '—' : <CountUp value={n} display={n.toLocaleString('id-ID')} />}
                    </div>
                    <div style={{ ...TYPE.metricSub }}>{loading || !d ? '' : `${pct.toFixed(0)}% of leads`}</div>
                  </div>
                );
              })}
            </div>

            {/* ── ROW 2: donut · cost & roi · leads by sales ── */}
            <div style={{ display: 'grid', gap: '10px', alignItems: 'stretch', gridTemplateColumns: '1fr' }}>
              <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ ...TYPE.cardTitle }}>Status Distribution</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Donut counts={d?.statusCounts} total={d?.total || 0} loading={loading} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '190px' }}>
                    {STATUSES.map(s => {
                      const n = d?.statusCounts?.[s] || 0;
                      const pct = d?.total ? (n / d.total) * 100 : 0;
                      return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR[s]?.fg, flexShrink: 0 }} />
                          <span style={{ ...TYPE.small, flex: 1 }}>{s}</span>
                          <span style={{ ...TYPE.tableCellStrong, width: '36px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {loading ? '—' : n.toLocaleString('id-ID')}
                          </span>
                          <span style={{ ...TYPE.caption, width: '42px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {loading ? '' : pct.toFixed(0) + '%'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ ...TYPE.cardTitle }}>Cost &amp; ROI</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', flex: 1, justifyContent: 'center' }}>
                  {[
                    { label: 'Conversion Spend', val: loading || !d ? '—' : fmtRp(d.spend) },
                    { label: 'Cost per Deal',    val: loading || !d ? '—' : (d.deals ? fmtRp(d.cpd) : '—') },
                    { label: 'Total Closing',    val: loading || !d ? '—' : fmtRp(d.closing), color: '#2FB673' },
                    { label: 'ROAS',             val: loading || !d ? '—' : (d.spend ? d.roas.toFixed(2) + 'x' : '—'), color: d?.roas >= 1 ? '#2FB673' : '#EF4444', hint: 'closing ÷ spend' },
                    { label: 'ROI',              val: loading || !d ? '—' : (d.spend ? (d.roi >= 0 ? '+' : '') + d.roi.toFixed(0) + '%' : '—'), color: d?.roi >= 0 ? '#2FB673' : '#EF4444', hint: '(closing − spend) ÷ spend' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                      <span style={{ ...TYPE.small }}>
                        {r.label}
                        {r.hint && <span style={{ ...TYPE.caption, marginLeft: '5px' }}>{r.hint}</span>}
                      </span>
                      <span style={{ ...TYPE.tableCellStrong, fontSize: '13px', color: (loading || !d || !d.spend) ? 'var(--t1)' : (r.color || 'var(--t1)') }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ ...TYPE.caption, borderTop: '1px solid var(--br)', paddingTop: '9px' }}>
                  Cohort attribution — closings are counted in the period the lead came in
                </div>
              </div>

              <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ ...TYPE.cardTitle }}>Leads by Sales</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', flex: 1, justifyContent: 'center' }}>
                  {[...SALES, '—'].map(s => {
                    const row = d?.bySales?.[s] || { leads: 0, deals: 0 };
                    const pct = d?.total ? (row.leads / d.total) * 100 : 0;
                    if (s === '—' && row.leads === 0) return null;
                    return (
                      <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ ...TYPE.small, fontWeight: 600, color: s === '—' ? 'var(--t3)' : SALES_COLOR[s]?.fg || 'var(--t1)' }}>
                            {s === '—' ? 'Unassigned' : s}
                          </span>
                          <span style={{ ...TYPE.tableCellStrong, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {loading ? '—' : row.leads}
                            <span style={{ ...TYPE.caption }}> lead{row.leads === 1 ? '' : 's'}{row.deals ? ` · ${row.deals} deal${row.deals === 1 ? '' : 's'}` : ''}</span>
                          </span>
                        </div>
                        <div style={{ height: '7px', borderRadius: '999px', background: 'var(--hover)', overflow: 'hidden' }}>
                          <div style={{
                            width: '100%', height: '100%', borderRadius: '999px',
                            background: s === '—' ? 'var(--t3)' : SALES_COLOR[s]?.fg || 'var(--cal-accent)',
                            transform: `scaleX(${pct / 100})`, transformOrigin: 'left',
                            transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── ROW 3: by category ── */}
            <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ ...TYPE.cardTitle }}>By Category</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...CATEGORIES.map(c => c.value), '—'].map(k => {
                  const n = d?.byKategori?.[k] || 0;
                  const pct = d?.total ? (n / d.total) * 100 : 0;
                  if (k === '—' && n === 0) return null;
                  return (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ ...TYPE.small, width: '110px', flexShrink: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {k === '—' ? 'Uncategorized' : kategoriLabel(k)}
                      </span>
                      <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--hover)', overflow: 'hidden' }}>
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '999px',
                          background: 'var(--cal-accent)',
                          transform: `scaleX(${pct / 100})`, transformOrigin: 'left',
                          transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </div>
                      <span style={{ ...TYPE.tableCellStrong, width: '64px', textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {loading ? '—' : n}<span style={{ ...TYPE.caption }}> · {pct.toFixed(0)}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* ════════ DESKTOP — redesain G1 (fit 1 layar) ════════ */
          <>
            {/* ── 1 · KPI PAIR: New Leads + Follow-up ──
                Sisa tinggi layar dibagi proporsional ke semua baris (flex-grow kecil
                per baris) supaya dashboard menyentuh dasar layar tanpa ada baris yang
                menggelembung sendirian. */}
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr', flex: '0.6 0 auto', order: 1 }}>
              {/* New Leads + sparkline harian */}
              <div style={{ ...card, padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, position: 'relative', overflow: 'hidden', minHeight: '118px', animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 0ms backwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Users size={15} color="var(--cal-accent)" />
                    </div>
                    <span style={{ ...TYPE.small, fontWeight: 600 }}>Total Leads</span>
                  </div>
                </div>
                <div style={{ ...TYPE.metricValueSm, fontSize: '28px', marginTop: '4px' }}>
                  {loading || !d ? '—' : <CountUp value={d.total} display={d.total.toLocaleString('id-ID')} />}
                </div>
                <div style={{ ...TYPE.metricSub }}>{loading || !d ? '' : `period: ${filterLabel()}`}</div>
                {!loading && d && <Spark daily={d.daily} />}
              </div>

              {/* Follow-up + meter barcode */}
              <div style={{ ...card, padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, minHeight: '118px', animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 60ms backwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PhoneCall size={15} color="var(--cal-accent)" />
                  </div>
                  <span style={{ ...TYPE.small, fontWeight: 600 }}>Follow-up</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '18px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...TYPE.metricValueSm, fontSize: '28px', marginTop: '4px' }}>
                      {loading || !d ? '—' : <CountUp value={d.fuRate} display={fmtPct(d.fuRate)} />}
                    </div>
                    <div style={{ ...TYPE.metricSub, whiteSpace: 'nowrap' }}>{loading || !d ? '' : `${d.fuCount} of ${d.total} followed up`}</div>
                  </div>
                  {!loading && d && <BarcodeMeter pct={d.fuRate} />}
                </div>
              </div>
            </div>

            {/* ── 2 · PANEL FOREST: Leads by Status (tanpa donut — tile full width) ── */}
            <div style={{
              background: FOREST, border: `1px solid ${FOREST}`, borderRadius: '18px', boxShadow: 'var(--shadow)',
              padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px',
              flex: '1.2 0 auto', minWidth: 0, order: 2,
              animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 120ms backwards',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ ...TYPE.cardTitle, color: '#FFFFFF' }}>Leads by Status</span>
                <span style={{
                  ...TYPE.caption, fontWeight: 700, color: '#C8F169',
                  background: 'rgba(200,241,105,0.16)', padding: '4px 11px', borderRadius: '999px',
                }}>
                  {loading || !d ? '…' : `${d.total.toLocaleString('id-ID')} total leads`}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '12px', minWidth: 0, flex: 1 }}>
                {STATUSES.map(s => {
                  const n = d?.statusCounts?.[s] || 0;
                  const pct = d?.total ? (n / d.total) * 100 : 0;
                  const c = PANEL_STATUS_COLOR[s];
                  return (
                    <div key={s} style={{
                      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: '15px', padding: '15px 17px', minWidth: 0, minHeight: '122px',
                      display: 'flex', flexDirection: 'column', gap: '4px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: c, flexShrink: 0 }} />
                        <span style={{ ...TYPE.small, fontWeight: 700, color: '#BFD3C6', whiteSpace: 'nowrap' }}>{s}</span>
                      </div>
                      <div style={{ ...TYPE.metricValueSm, fontSize: '29px', color: '#FFFFFF', marginTop: '2px' }}>
                        {loading || !d ? '—' : <CountUp value={n} display={n.toLocaleString('id-ID')} />}
                      </div>
                      <span style={{ ...TYPE.small, fontSize: '12px', fontWeight: 700, color: '#A8BCAF' }}>{loading || !d ? '' : `${pct.toFixed(0)}% of leads`}</span>
                      <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 'auto' }}>
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '999px', background: c,
                          transform: `scaleX(${(d ? n / maxStatus : 0)})`, transformOrigin: 'left',
                          transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── LEADS BY SALES + BY CATEGORY (setengah–setengah; turun ke bawah money row saat ada Deal) ── */}
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr', flex: '1 0 auto', order: 4 }}>
              {/* Leads by Sales — baris per sales (gaya G1) */}
              <div style={{ ...card, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 200ms backwards' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ ...TYPE.cardTitle }}>Leads by Sales</span>
                  <span style={{ ...TYPE.caption }}>distribution of assigned leads</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(() => {
                    const entries = [...SALES, '—'].filter(s => s !== '—' || (d?.bySales?.['—']?.leads || 0) > 0);
                    const maxLeads = Math.max(...entries.map(s => d?.bySales?.[s]?.leads || 0), 1);
                    return entries.map((s, i) => {
                      const row = d?.bySales?.[s] || { leads: 0, deals: 0 };
                      const pct = d?.total ? (row.leads / d.total) * 100 : 0;
                      const fg = s === '—' ? 'var(--t3)' : SALES_COLOR[s]?.fg || 'var(--t1)';
                      const bg = s === '—' ? 'var(--hover)' : SALES_COLOR[s]?.bg || 'var(--hover)';
                      return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--br)' }}>
                          <span style={{
                            width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                            background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 800,
                          }}>{s === '—' ? 'U' : s.charAt(0)}</span>
                          <div style={{ minWidth: 0, width: '94px', flexShrink: 0 }}>
                            <div style={{ ...TYPE.small, fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s === '—' ? 'Unassigned' : s}</div>
                            <div style={{ ...TYPE.caption, whiteSpace: 'nowrap' }}>{loading ? '' : `${pct.toFixed(1)}% of leads${row.deals ? ` · ${row.deals} deal${row.deals === 1 ? '' : 's'}` : ''}`}</div>
                          </div>
                          <div style={{ flex: 1, height: '11px', borderRadius: '999px', background: 'var(--hover)', overflow: 'hidden', minWidth: '30px' }}>
                            <div style={{
                              width: '100%', height: '100%', borderRadius: '999px', background: fg,
                              transform: `scaleX(${(row.leads / maxLeads) || 0})`, transformOrigin: 'left',
                              transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                            }} />
                          </div>
                          <span style={{ ...TYPE.tableCellStrong, fontSize: '16px', fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: '36px', textAlign: 'right' }}>
                            {loading ? '—' : row.leads}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* By Category — baris per kategori (gaya G1) */}
              <div style={{ ...card, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 260ms backwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ ...TYPE.cardTitle }}>By Category</span>
                  <span style={{ ...TYPE.caption }}>from campaign name</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {[...CATEGORIES.map(c => c.value), '—'].map((k, i) => {
                    const n = d?.byKategori?.[k] || 0;
                    const pct = d?.total ? (n / d.total) * 100 : 0;
                    if (k === '—' && n === 0) return null;
                    return (
                      <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--br)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ ...TYPE.small, fontSize: '12.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {k === '—' ? 'Uncategorized' : kategoriLabel(k)}
                          </span>
                          <span style={{ ...TYPE.tableCellStrong, fontSize: '16px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {loading ? '—' : n}
                          </span>
                        </div>
                        <div style={{ height: '9px', borderRadius: '999px', background: 'var(--hover)', overflow: 'hidden' }}>
                          <div style={{
                            width: '100%', height: '100%', borderRadius: '999px',
                            background: k === '—' ? 'var(--t3)' : 'var(--cal-accent)',
                            transform: `scaleX(${pct / 100})`, transformOrigin: 'left',
                            transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
                          }} />
                        </div>
                        <span style={{ ...TYPE.caption }}>{loading ? '' : `${pct.toFixed(0)}% of all leads`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── MONEY ROW (dormant sampai ada Deal) ──
                Saat ADA Deal, baris ini naik ke tepat bawah panel status (order 3),
                baris Sales/Category turun ke bawahnya (order 4). Ukuran card tetap. */}
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr', flex: '0.6 0 auto', order: hasDeal ? 3 : 5 }}>
              {/* Total Closing */}
              <div style={{
                ...(dormant ? dormCard : card), padding: '14px 18px', minWidth: 0, minHeight: '116px',
                display: 'flex', flexDirection: dormant || loading || !d ? 'column' : 'row',
                alignItems: dormant || loading || !d ? 'stretch' : 'center',
                justifyContent: 'center', gap: dormant || loading || !d ? '4px' : '16px',
                transition: 'background 0.3s, border-color 0.3s',
                animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 320ms backwards',
              }}>
                {hasDeal && (
                  <div style={{ position: 'relative', width: '76px', height: '76px', flexShrink: 0 }}>
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: `conic-gradient(var(--cal-accent) ${Math.min((d.roas / 4) * 100, 100)}%, var(--hover) 0)`,
                    }} />
                    <div style={{ position: 'absolute', inset: '9px', borderRadius: '50%', background: 'var(--cd)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ ...TYPE.tableCellStrong, fontSize: '14px', color: 'var(--cal-accent)' }}>{d.spend ? d.roas.toFixed(2) + 'x' : '—'}</span>
                      <span style={{ ...TYPE.caption, fontSize: '8.5px' }}>ROAS</span>
                    </div>
                  </div>
                )}
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <span style={{ ...TYPE.cardTitle, color: dormant ? 'var(--t3)' : 'var(--t1)' }}>Total Closing</span>
                    <span style={{
                      ...TYPE.caption, fontWeight: 800, padding: '3px 10px', borderRadius: '999px',
                      background: hasDeal ? 'var(--cal-accent)' : 'var(--br)',
                      color: hasDeal ? 'var(--cal-accent-fg, #fff)' : 'var(--t3)',
                    }}>
                      {loading || !d ? '…' : `${d.deals} deal${d.deals === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <div style={{ ...TYPE.metricValueSm, fontSize: '25px', color: dormant ? 'var(--t3)' : '#2FB673' }}>
                    {loading || !d ? '—' : <CountUp value={d.closing} display={fmtRp(d.closing)} />}
                  </div>
                  <div style={{ ...TYPE.caption, color: dormant ? 'var(--t3)' : undefined }}>
                    {loading || !d ? '' : dormant
                      ? 'No closing in this period yet — this card lights up when the first deal lands'
                      : `${filterLabel()} · cohort by created_at`}
                  </div>
                </div>
              </div>

              {/* Cost & ROI */}
              <div style={{
                ...(dormant ? dormCard : card), padding: '14px 18px', minWidth: 0, minHeight: '116px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px',
                transition: 'background 0.3s, border-color 0.3s',
                animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 380ms backwards',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ ...TYPE.cardTitle, color: dormant ? 'var(--t3)' : 'var(--t1)' }}>Cost &amp; ROI</span>
                  <span style={{ ...TYPE.caption, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    cohort attribution — closings counted in the lead&apos;s period
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '10px' }}>
                  {[
                    { label: 'Conversion Spend', val: loading || !d ? '—' : fmtRp(d.spend) },
                    { label: 'Cost per Deal',    val: loading || !d ? '—' : (d.deals ? fmtRp(d.cpd) : '—') },
                    { label: 'Total Closing',    val: loading || !d ? '—' : fmtRp(d.closing), color: '#2FB673' },
                    { label: 'ROAS',             val: loading || !d ? '—' : (d.spend && d.deals ? d.roas.toFixed(2) + 'x' : '—'), color: d?.roas >= 1 ? '#2FB673' : '#EF4444' },
                    { label: 'ROI',              val: loading || !d ? '—' : (d.spend && d.deals ? (d.roi >= 0 ? '+' : '') + d.roi.toFixed(0) + '%' : '—'), color: d?.roi >= 0 ? '#2FB673' : '#EF4444' },
                  ].map(r => (
                    <div key={r.label} style={{ minWidth: 0 }}>
                      <div style={{ ...TYPE.caption, fontWeight: 700, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
                      <div style={{
                        ...TYPE.tableCellStrong, fontSize: '13px', marginTop: '3px', whiteSpace: 'nowrap',
                        color: dormant || loading || !d ? 'var(--t3)' : (r.color && d.deals ? r.color : 'var(--t1)'),
                      }}>{r.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Donut chart status (SVG, segmen per status) ───
   Props opsional utk panel forest: colors (map status→warna),
   baseStroke, centerColor, subColor. Default = tampilan lama. */
function Donut({ counts, total, loading, colors, baseStroke, centerColor, subColor }) {
  const R = 46, C = 2 * Math.PI * R;
  let acc = 0;
  const segments = STATUSES.map(s => {
    const n = counts?.[s] || 0;
    const frac = total ? n / total : 0;
    const seg = { s, frac, start: acc };
    acc += frac;
    return seg;
  }).filter(seg => seg.frac > 0);

  return (
    <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke={baseStroke || 'var(--hover)'} strokeWidth="15" />
        {segments.map(seg => (
          <circle
            key={seg.s}
            cx="60" cy="60" r={R} fill="none"
            stroke={(colors || {})[seg.s] || STATUS_COLOR[seg.s]?.fg} strokeWidth="15"
            strokeDasharray={`${Math.max(seg.frac * C - 1.5, 0.5)} ${C}`}
            strokeDashoffset={-seg.start * C}
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1), stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
          />
        ))}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <span style={{ ...TYPE.metricValueSm, fontSize: '22px', fontVariantNumeric: 'tabular-nums', textAlign: 'center', color: centerColor || undefined }}>{loading ? '—' : total.toLocaleString('id-ID')}</span>
        <span style={{ ...TYPE.caption, textAlign: 'center', color: subColor || undefined }}>leads</span>
      </div>
    </div>
  );
}
