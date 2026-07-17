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
   LEADS HUB — DASHBOARD (v3.0, read-only)
   Sesuai MASTER PLAN 3.3: leads masuk per periode, breakdown
   status, follow-up compliance, spend konversi, Cost per Deal,
   ROI (atribusi cohort: closing dihitung di periode lead masuk).
   Filter tanggal reuse pola Ads Hub (state independen) + filter
   kategori promo. Data leads dari Supabase, spend dari
   /api/leads?mode=spend (agregat konversi saja — aman utk
   role marketing).
   ───────────────────────────────────────────────────────────── */

function fmtRp(v) { return 'Rp ' + Math.round(v || 0).toLocaleString('id-ID'); }
function fmtPct(v) { return (v || 0).toFixed(0) + '%'; }

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
  const [data, setData] = useState(null); // { total, fuRate, statusCounts, deals, closing, spend, cpd, roi, byKategori, inboxCount }

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
        .select('status, followed_up, closing_amount, kategori_promo, sales')
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

  /* KPI card kecil seragam */
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

        {/* Info Inbox (admin) */}
        {!loading && d?.inboxCount > 0 && role === 'admin' && (
          <Link href="/leads/list" style={{
            ...card, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px',
            textDecoration: 'none', borderColor: 'var(--cal-accent)',
          }}>
            <Inbox size={16} color="var(--ac)" />
            <span style={{ ...TYPE.body, fontWeight: 600 }}>{d.inboxCount} lead{d.inboxCount === 1 ? '' : 's'} awaiting verification in Inbox</span>
            <span style={{ ...TYPE.small, marginLeft: 'auto', color: 'var(--ac)', fontWeight: 600 }}>Open Inbox →</span>
          </Link>
        )}

        {/* ── KPI ROW (Deals tidak di sini — sudah ada di kartu status Deal) ── */}
        <div style={{
          display: 'grid', gap: '10px',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(3, minmax(0,1fr))',
        }}>
          <Kpi Icon={Users} label="New Leads" value={d?.total || 0} display={(d?.total || 0).toLocaleString('id-ID')} sub={`period: ${filterLabel()}`} />
          <Kpi Icon={PhoneCall} label="Follow-up" value={d?.fuRate || 0} display={fmtPct(d?.fuRate)} sub={`${d?.fuCount || 0} of ${d?.total || 0} followed up`} color="#3B82F6" />
          <Kpi Icon={Wallet} label="Total Closing" value={d?.closing || 0} display={fmtRp(d?.closing)} sub={d?.spend ? `ROAS ${(d.roas).toFixed(2)}x on conversion spend` : 'conversion spend Rp 0'} color="#F59E0B" />
        </div>

        {/* ── STATUS CARDS (status = metrik penting, permintaan Nadir) ── */}
        <div style={{
          display: 'grid', gap: '10px',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(5, minmax(0,1fr))',
        }}>
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
                <div style={{ ...TYPE.metricValueSm, fontSize: isMobile ? '19px' : '22px', color: s === 'No Status' ? 'var(--t1)' : c }}>
                  {loading || !d ? '—' : <CountUp value={n} display={n.toLocaleString('id-ID')} />}
                </div>
                <div style={{ ...TYPE.metricSub }}>{loading || !d ? '' : `${pct.toFixed(0)}% of leads`}</div>
              </div>
            );
          })}
        </div>

        {/* ── ROW 2: donut status · cost & roi · sales performance ── */}
        <div style={{
          display: 'grid', gap: '10px', alignItems: 'stretch',
          gridTemplateColumns: isMobile ? '1fr' : '4fr 3fr 3fr',
        }}>
          {/* Status distribution — donut */}
          <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ ...TYPE.cardTitle }}>Status Distribution</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Donut counts={d?.statusCounts} total={d?.total || 0} loading={loading} />
              {/* Legend: kolom angka rata & lurus (tabular-nums + lebar tetap) */}
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

          {/* Cost & ROI (+ ROAS) */}
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

          {/* Sales performance */}
          <div style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ ...TYPE.cardTitle }}>Sales Performance</span>
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
                  <span style={{ ...TYPE.small, width: isMobile ? '110px' : '190px', flexShrink: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
      </div>
    </div>
  );
}

/* ─── Donut chart status (SVG, segmen per status) ─── */
function Donut({ counts, total, loading }) {
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
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--hover)" strokeWidth="15" />
        {segments.map(seg => (
          <circle
            key={seg.s}
            cx="60" cy="60" r={R} fill="none"
            stroke={STATUS_COLOR[seg.s]?.fg} strokeWidth="15"
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
        <span style={{ ...TYPE.metricValueSm, fontSize: '22px', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{loading ? '—' : total.toLocaleString('id-ID')}</span>
        <span style={{ ...TYPE.caption, textAlign: 'center' }}>leads</span>
      </div>
    </div>
  );
}
