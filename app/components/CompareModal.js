'use client';

import { useState, useMemo } from 'react';
import {
  X, ArrowRight, TrendingUp, TrendingDown, Minus,
  ChevronLeft, ChevronRight, RefreshCw, CircleAlert, Check,
} from 'lucide-react';
import { authFetch } from '../supabase';
import { TYPE } from './typography';
import CountUp from './CountUp';

/* ─────────────────────────────────────────────────────────────
   COMPARE MODAL — Ads Hub
   Bandingkan DUA periode dengan durasi sama (apple to apple).
   Periode A = basis, Periode B = pembanding; angka A ditampilkan
   besar + persentase perubahannya terhadap B.

   Rumus metrik SENGAJA disalin persis dari Dashboard (app/page.js)
   supaya angka di popup ini tidak pernah berbeda dengan angka
   dashboard untuk rentang yang sama. Jangan diubah sebelah pihak.
   ───────────────────────────────────────────────────────────── */

const CAL_DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CAL_MON = ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December'];

function pad2(n) { return String(n).padStart(2, '0'); }
function toYMD(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function parseYMD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function ymdOf(dt) { return toYMD(dt.getFullYear(), dt.getMonth(), dt.getDate()); }
function addDays(s, n) { const d = parseYMD(s); d.setDate(d.getDate() + n); return ymdOf(d); }
function dayCount(since, until) {
  if (!since || !until) return 0;
  return Math.round((parseYMD(until) - parseYMD(since)) / 86400000) + 1;
}
function fmtRangeLabel(since, until) {
  if (!since || !until) return 'Not set';
  const a = parseYMD(since), b = parseYMD(until);
  const f = (d, withYear) => `${d.getDate()} ${CAL_MON[d.getMonth()].slice(0, 3)}${withYear ? ' ' + d.getFullYear() : ''}`;
  return a.getFullYear() === b.getFullYear()
    ? `${f(a, false)} – ${f(b, true)}`
    : `${f(a, true)} – ${f(b, true)}`;
}
function monthGrid(y, m) {
  const start = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

/* Kalau rentang ini persis N bulan kalender penuh (mulai tanggal 1, berakhir di
   hari terakhir bulan), kembalikan N. Selain itu null.
   Dipakai supaya Juni (30 hari) tetap boleh dibandingkan dengan Mei (31 hari):
   sama-sama satu bulan penuh, jadi tetap apple to apple. */
function fullMonthSpan(since, until) {
  if (!since || !until) return null;
  const s = parseYMD(since), u = parseYMD(until);
  if (s.getDate() !== 1) return null;
  const lastDay = new Date(u.getFullYear(), u.getMonth() + 1, 0).getDate();
  if (u.getDate() !== lastDay) return null;
  const months = (u.getFullYear() - s.getFullYear()) * 12 + (u.getMonth() - s.getMonth()) + 1;
  return months > 0 ? months : null;
}

/* ─── Metrik: rumus identik dashboard ─── */
function campaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC')) return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}
function actionVal(actions, types) {
  if (!actions) return 0;
  for (const t of types) {
    const a = actions.find(x => x.action_type === t);
    if (a) return parseInt(a.value) || 0;
  }
  return 0;
}

/* ─── Leads = SEMUA mekanisme penangkapan lead (aturan Nadir 3 Sep 2026) ───
   Dulu hanya form, sehingga iklan klik-ke-WhatsApp (dipakai sepanjang Q1 2026)
   tidak ikut terhitung dan lead Q1 tampil 1 padahal aslinya 389.
     LEAD_FORM = payung form (instant form Meta + form website via pixel)
     LEAD_WA   = CTA klik-ke-WhatsApp
   Rumus ini terduplikasi di page.js, campaigns, reportData, CompareModal,
   CombineModal, CampaignModal & insightEngine — JAGA TETAP SINKRON. */
const LEAD_FORM = ["lead", "onsite_conversion.lead_grouped"];
const LEAD_WA   = ["onsite_conversion.messaging_conversation_started_7d"];
function getLeads(actions) {
  return (actionVal(actions, LEAD_FORM) || 0) + (actionVal(actions, LEAD_WA) || 0);
}
/* Rincian per sumber untuk popup di kartu KPI Leads. "lead" adalah payung form;
   instant form dipisah lewat lead_grouped, sisanya dianggap form website (pixel). */
function getLeadBreakdown(actions) {
  const form    = actionVal(actions, LEAD_FORM) || 0;
  const instant = actionVal(actions, ["onsite_conversion.lead_grouped"]) || 0;
  const wa      = actionVal(actions, LEAD_WA) || 0;
  return { instant, web: Math.max(0, form - instant), wa, total: form + wa };
}
function computeMetrics(json) {
  const s = json.summary || {};
  const campaigns = json.campaigns || [];
  const totalSpend = parseFloat(s.spend || 0);
  const totalImpressions = parseFloat(s.impressions || 0);

  const withData = campaigns.filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0);
  const ofType = t => withData.filter(c => campaignType(c.name) === t);
  const traffic = ofType('TRAFFIC'), conv = ofType('CONVERSION'), aware = ofType('AWARENESS');
  const sum = (list, fn) => list.reduce((acc, c) => acc + fn(c.insights?.data?.[0] || {}), 0);

  const trafficSpend  = sum(traffic, i => parseFloat(i.spend || 0));
  const trafficClicks = sum(traffic, i => actionVal(i.actions, ['link_click']));
  const convSpend     = sum(conv, i => parseFloat(i.spend || 0));
  const convLeads     = sum(conv, i => getLeads(i.actions));
  const convImpr      = sum(conv, i => parseFloat(i.impressions || 0));
  const convClicks    = sum(conv, i => parseFloat(i.clicks || 0));

  return {
    spend: totalSpend,
    reach: parseFloat(s.reach || 0),
    impressions: totalImpressions,
    traffic: trafficClicks,
    leads: convLeads,
    cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
    cpc: trafficClicks > 0 ? trafficSpend / trafficClicks : null,
    cpl: convLeads > 0 ? convSpend / convLeads : null,
    ctr: convImpr > 0 ? (convClicks / convImpr) * 100 : null,
    adsTotal: withData.length,
    adsAwareness: aware.length,
    adsTraffic: traffic.length,
    adsConversion: conv.length,
  };
}

const fmtRp  = v => 'Rp ' + Math.round(v || 0).toLocaleString('id-ID');
const fmtNum = v => (v == null ? '—' : Math.round(v).toLocaleString('id-ID'));
const fmtPct = v => (v == null ? '—' : v.toFixed(2) + '%');

/* Metrik biaya: turun = bagus. Metrik hasil: naik = bagus. Spend: netral. */
const METRICS = [
  { key: 'spend',       label: 'Total Spend',  fmt: fmtRp,  dir: 'neutral' },
  { key: 'reach',       label: 'Reach',        fmt: fmtNum, dir: 'up' },
  { key: 'impressions', label: 'Impressions',  fmt: fmtNum, dir: 'up' },
  { key: 'traffic',     label: 'Traffic',      fmt: fmtNum, dir: 'up' },
  { key: 'leads',       label: 'Leads',        fmt: fmtNum, dir: 'up' },
  { key: 'cpm',         label: 'CPM',          fmt: fmtRp,  dir: 'down' },
  { key: 'cpc',         label: 'CPC',          fmt: fmtRp,  dir: 'down' },
  { key: 'cpl',         label: 'CPL',          fmt: fmtRp,  dir: 'down' },
  { key: 'ctr',         label: 'CTR',          fmt: fmtPct, dir: 'up' },
];

const GREEN = '#2FB673', RED = '#EF4444';

export default function CompareModal({ initialSince, initialUntil, onClose }) {
  // Periode A default = rentang yang sedang dipakai dashboard
  const [aSince, setASince] = useState(initialSince || '');
  const [aUntil, setAUntil] = useState(initialUntil || '');
  const [bSince, setBSince] = useState('');
  const [bUntil, setBUntil] = useState('');
  const [editing, setEditing] = useState('B'); // kartu mana yang sedang diedit kalendernya
  const [pendingStart, setPendingStart] = useState(''); // klik pertama di kalender

  const initCal = initialSince ? parseYMD(initialSince) : new Date();
  const [calY, setCalY] = useState(initCal.getFullYear());
  const [calM, setCalM] = useState(initCal.getMonth());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { a, b }

  const aDays = dayCount(aSince, aUntil);
  const bDays = dayCount(bSince, bUntil);
  const bothSet = aDays > 0 && bDays > 0;

  /* Dua cara dianggap adil (apple to apple):
     1. sama-sama N bulan kalender PENUH (Juni 30 hari vs Mei 31 hari → boleh), atau
     2. jumlah harinya persis sama.
     Setengah bulan (mis. Mei tapi hanya 29 hari) tidak lolos jalur bulan penuh. */
  const aMonths = fullMonthSpan(aSince, aUntil);
  const bMonths = fullMonthSpan(bSince, bUntil);
  const monthMatch = aMonths != null && bMonths != null && aMonths === bMonths;
  const dayMatch = bothSet && aDays === bDays;
  const sameLength = monthMatch || dayMatch;
  const overlap = bothSet && aSince <= bUntil && bSince <= aUntil;
  const canCompare = bothSet && sameLength && !overlap;

  /* Pintasan periode B: mundur tepat sepanjang durasi A */
  function shiftB(kind) {
    if (!aSince || !aUntil) return;
    if (kind === 'prev') {
      setBUntil(addDays(aSince, -1));
      setBSince(addDays(aSince, -aDays));
    } else if (kind === 'prevMonth') {
      const s = parseYMD(aSince);
      // Kalau A memang bulan penuh, B ikut bulan penuh sebelumnya (bukan digeser
      // per tanggal) — supaya Juni penuh berpasangan dengan Mei penuh.
      if (aMonths != null) {
        const startM = new Date(s.getFullYear(), s.getMonth() - aMonths, 1);
        const endM = new Date(startM.getFullYear(), startM.getMonth() + aMonths, 0);
        setBSince(ymdOf(startM)); setBUntil(ymdOf(endM));
        setCalY(startM.getFullYear()); setCalM(startM.getMonth());
        return;
      }
      const ns = new Date(s.getFullYear(), s.getMonth() - 1, s.getDate());
      setBSince(ymdOf(ns));
      setBUntil(ymdOf(new Date(ns.getFullYear(), ns.getMonth(), ns.getDate() + (dayCount(aSince, aUntil) - 1))));
      setCalY(ns.getFullYear()); setCalM(ns.getMonth());
      return;
    } else if (kind === 'prevYear') {
      const s = parseYMD(aSince);
      const ns = new Date(s.getFullYear() - 1, s.getMonth(), s.getDate());
      setBSince(ymdOf(ns));
      setBUntil(addDays(ymdOf(ns), aDays - 1));
      setCalY(ns.getFullYear()); setCalM(ns.getMonth());
      return;
    }
    const st = parseYMD(addDays(aSince, -aDays));
    setCalY(st.getFullYear()); setCalM(st.getMonth());
  }

  function pickDay(ymd) {
    const setS = editing === 'A' ? setASince : setBSince;
    const setU = editing === 'A' ? setAUntil : setBUntil;
    if (!pendingStart) { setPendingStart(ymd); setS(ymd); setU(''); return; }
    if (ymd < pendingStart) { setS(ymd); setU(pendingStart); }
    else { setS(pendingStart); setU(ymd); }
    setPendingStart('');
  }

  function startEditing(which) {
    setEditing(which);
    setPendingStart('');
    const s = which === 'A' ? aSince : bSince;
    if (s) { const d = parseYMD(s); setCalY(d.getFullYear()); setCalM(d.getMonth()); }
  }

  async function runCompare() {
    if (!canCompare) return;
    setBusy(true); setError(null);
    try {
      const [ra, rb] = await Promise.all([
        authFetch(`/api/meta?mode=dashboard&since=${aSince}&until=${aUntil}`),
        authFetch(`/api/meta?mode=dashboard&since=${bSince}&until=${bUntil}`),
      ]);
      const [ja, jb] = await Promise.all([ra.json(), rb.json()]);
      if (ja.error) throw new Error(ja.error);
      if (jb.error) throw new Error(jb.error);
      setResult({ a: computeMetrics(ja), b: computeMetrics(jb) });
    } catch (e) {
      setError(e.message || 'Failed to load comparison data');
    }
    setBusy(false);
  }

  const cur = editing === 'A' ? { since: aSince, until: aUntil } : { since: bSince, until: bUntil };
  const editColor = editing === 'A' ? 'var(--cal-accent)' : '#8B5CF6';

  function Month({ y, m }) {
    const cells = monthGrid(y, m);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...TYPE.small, fontWeight: 700, textAlign: 'center', marginBottom: '8px' }}>
          {CAL_MON[m]} {y}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
          {CAL_DOW.map(d => (
            <div key={d} style={{ ...TYPE.caption, textAlign: 'center', padding: '2px 0', fontWeight: 700 }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={'e' + i} />;
            const ymd = toYMD(y, m, d);
            const inRange = cur.since && cur.until && ymd >= cur.since && ymd <= cur.until;
            const isEdge = ymd === cur.since || ymd === cur.until;
            // Rentang kartu satunya ditandai samar biar mudah menghindari tumpang tindih
            const other = editing === 'A' ? { since: bSince, until: bUntil } : { since: aSince, until: aUntil };
            const inOther = other.since && other.until && ymd >= other.since && ymd <= other.until;
            return (
              <div
                key={ymd}
                onClick={() => pickDay(ymd)}
                style={{
                  textAlign: 'center', padding: '6px 0', borderRadius: '7px', cursor: 'pointer',
                  fontSize: '11.5px', fontWeight: isEdge ? 800 : 500,
                  background: isEdge ? editColor : inRange ? 'var(--hover)' : 'transparent',
                  color: isEdge ? 'var(--cal-accent-fg)' : inOther ? 'var(--t3)' : 'var(--t1)',
                  outline: inOther && !inRange ? '1px dashed var(--br)' : 'none',
                  outlineOffset: '-2px',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isEdge && !inRange) e.currentTarget.style.background = 'var(--hover)'; }}
                onMouseLeave={e => { if (!isEdge && !inRange) e.currentTarget.style.background = 'transparent'; }}
              >{d}</div>
            );
          })}
        </div>
      </div>
    );
  }

  function PeriodCard({ which }) {
    const active = editing === which;
    const since = which === 'A' ? aSince : bSince;
    const until = which === 'A' ? aUntil : bUntil;
    const days = which === 'A' ? aDays : bDays;
    const months = which === 'A' ? aMonths : bMonths;
    const color = which === 'A' ? 'var(--cal-accent)' : '#8B5CF6';
    return (
      <div
        onClick={() => startEditing(which)}
        style={{
          flex: 1, minWidth: 0, cursor: 'pointer', padding: '12px 14px', borderRadius: '14px',
          background: 'var(--cd)',
          border: `1px solid ${active ? color : 'var(--br)'}`,
          boxShadow: active ? `0 0 0 3px ${which === 'A' ? 'rgba(30,107,75,0.10)' : 'rgba(139,92,246,0.12)'}` : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ ...TYPE.caption, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--t2)' }}>
            {which === 'A' ? 'Period A · base' : 'Period B · compare against'}
          </span>
        </div>
        <div style={{ ...TYPE.body, fontWeight: 700, marginTop: '6px' }}>{fmtRangeLabel(since, until)}</div>
        <div style={{ ...TYPE.caption, marginTop: '2px' }}>
          {days > 0 ? `${days} day${days === 1 ? '' : 's'}` : 'Pick a date range'}
          {months != null && <span style={{ color, fontWeight: 700 }}> · {months} full month{months === 1 ? '' : 's'}</span>}
          {active && <span style={{ color, fontWeight: 700 }}> · editing</span>}
        </div>
      </div>
    );
  }

  const btn = (primary, disabled) => ({
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: primary ? 'none' : '1px solid var(--br)',
    background: primary ? (disabled ? 'var(--hover)' : 'var(--cal-accent)') : 'var(--cd)',
    color: primary ? (disabled ? 'var(--t3)' : 'var(--cal-accent-fg)') : 'var(--t1)',
    opacity: disabled && !primary ? 0.6 : 1,
    transition: 'background 0.15s, border-color 0.15s',
  });

  const quickBtn = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 12px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600,
    background: 'var(--cd)', border: '1px solid var(--br)', color: 'var(--t1)',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        animation: 'wdFadeIn 0.18s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: result ? '940px' : '880px', maxHeight: '92vh', overflowY: 'auto',
          background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '20px',
          boxShadow: 'var(--pop-shadow)', animation: 'wdScaleIn 0.18s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px', borderBottom: '1px solid var(--br)',
          position: 'sticky', top: 0, background: 'var(--cd)', zIndex: 2, borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...TYPE.h4 }}>Compare Periods</div>
            <div style={{ ...TYPE.caption, marginTop: '2px' }}>
              {result
                ? `${fmtRangeLabel(aSince, aUntil)} compared against ${fmtRangeLabel(bSince, bUntil)} · ${aDays} days each`
                : 'Both periods must cover the same number of days'}
            </div>
          </div>
          {result && (
            <button onClick={() => { setResult(null); setError(null); }} style={btn(false, false)}>
              Edit periods
            </button>
          )}
          <button onClick={onClose} title="Close" style={{
            display: 'flex', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--t3)', padding: '6px', borderRadius: '8px', flexShrink: 0,
          }}><X size={18} /></button>
        </div>

        {/* ── Pemilih periode ── */}
        {!result && (
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px' }}>
              <PeriodCard which="A" />
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--t3)', flexShrink: 0 }}>
                <ArrowRight size={16} />
              </div>
              <PeriodCard which="B" />
            </div>

            {/* Pintasan periode B — supaya apple to apple tanpa hitung manual */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ ...TYPE.caption, fontWeight: 700 }}>Quick pick for Period B:</span>
              <button style={quickBtn} onClick={() => { startEditing('B'); shiftB('prev'); }}>Previous {aDays || ''} days</button>
              <button style={quickBtn} onClick={() => { startEditing('B'); shiftB('prevMonth'); }}>
                {aMonths != null ? `Previous ${aMonths} full month${aMonths === 1 ? '' : 's'}` : 'Same range, previous month'}
              </button>
              <button style={quickBtn} onClick={() => { startEditing('B'); shiftB('prevYear'); }}>Same range, last year</button>
            </div>

            {/* Kalender dual-month */}
            <div style={{ border: '1px solid var(--br)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <button onClick={() => { const d = new Date(calY, calM - 1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}
                  style={{ display: 'flex', background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '8px', padding: '5px', cursor: 'pointer', color: 'var(--t2)' }}>
                  <ChevronLeft size={15} />
                </button>
                <span style={{ ...TYPE.caption, fontWeight: 700 }}>
                  Picking dates for <span style={{ color: editColor }}>Period {editing}</span>
                  {pendingStart ? ' — now click the end date' : ''}
                </span>
                <button onClick={() => { const d = new Date(calY, calM + 1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}
                  style={{ display: 'flex', background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '8px', padding: '5px', cursor: 'pointer', color: 'var(--t2)' }}>
                  <ChevronRight size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: '22px' }}>
                <Month y={calY} m={calM} />
                <Month y={calM === 11 ? calY + 1 : calY} m={(calM + 1) % 12} />
              </div>
            </div>

            {/* Status validasi */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '9px', padding: '11px 14px', borderRadius: '12px',
              background: canCompare ? 'rgba(47,182,115,0.10)' : bothSet ? 'rgba(239,68,68,0.08)' : 'var(--hover)',
              border: `1px solid ${canCompare ? 'rgba(47,182,115,0.30)' : bothSet ? 'rgba(239,68,68,0.28)' : 'var(--br)'}`,
            }}>
              {canCompare
                ? <Check size={15} color={GREEN} strokeWidth={3} />
                : <CircleAlert size={15} color={bothSet ? RED : 'var(--t3)'} />}
              <span style={{ ...TYPE.small, color: canCompare ? GREEN : bothSet ? RED : 'var(--t2)', fontWeight: 600 }}>
                {!bothSet
                  ? 'Pick a date range for both periods to continue.'
                  : !sameLength
                    ? `Not comparable yet — Period A is ${aDays} days, Period B is ${bDays} days. Either make the day counts equal, or pick full calendar months on both sides (a full June and a full May are fine even though one has 30 days and the other 31).`
                    : overlap
                      ? 'The two periods overlap. Pick periods that do not share any dates.'
                      : monthMatch
                        ? `Ready — comparing ${aMonths} full calendar month${aMonths === 1 ? '' : 's'} on each side (${aDays} vs ${bDays} days).`
                        : `Ready — both periods cover ${aDays} days.`}
              </span>
            </div>

            {error && (
              <div style={{ ...TYPE.small, color: RED, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CircleAlert size={15} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={onClose} style={btn(false, false)}>Cancel</button>
              <button onClick={runCompare} disabled={!canCompare || busy} style={btn(true, !canCompare || busy)}>
                {busy
                  ? <><RefreshCw size={14} style={{ animation: 'wdSpin 0.8s linear infinite' }} /> Comparing…</>
                  : <>Compare</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Hasil ── */}
        {result && <CompareResult a={result.a} b={result.b} aLabel={fmtRangeLabel(aSince, aUntil)} bLabel={fmtRangeLabel(bSince, bUntil)} />}
      </div>
    </div>
  );
}

/* ─── Tampilan hasil perbandingan ─── */
function CompareResult({ a, b, aLabel, bLabel }) {
  const rows = useMemo(() => METRICS.map(m => {
    const va = a[m.key], vb = b[m.key];
    const hasBoth = va != null && vb != null && vb !== 0;
    const pct = hasBoth ? ((va - vb) / Math.abs(vb)) * 100 : null;
    const up = pct != null && pct > 0.05;
    const down = pct != null && pct < -0.05;
    // Metrik biaya: turun itu bagus. Metrik hasil: naik itu bagus.
    const good = m.dir === 'neutral' ? null
      : m.dir === 'up' ? (up ? true : down ? false : null)
      : (down ? true : up ? false : null);
    return { ...m, va, vb, pct, up, down, good };
  }), [a, b]);

  const chip = (label, value, color, i = 0) => (
    <div key={label} style={{
      flex: 1, minWidth: 0, padding: '10px 13px', borderRadius: '12px',
      background: 'var(--hover)', border: '1px solid var(--br)',
      animation: `wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${480 + i * 45}ms backwards`,
    }}>
      <div style={{ ...TYPE.caption, fontWeight: 700, color: 'var(--t3)' }}>{label}</div>
      <div style={{ ...TYPE.tableCellStrong, fontSize: '18px', marginTop: '3px', color: color || 'var(--t1)' }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px',
      animation: 'wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Legenda dua periode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--cal-accent)' }} />
          <span style={{ ...TYPE.small, fontWeight: 700 }}>A · {aLabel}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#8B5CF6' }} />
          <span style={{ ...TYPE.small, fontWeight: 700, color: 'var(--t2)' }}>B · {bLabel}</span>
        </span>
      </div>

      {/* Grid metrik */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px' }}>
        {rows.map((r, i) => {
          const color = r.good == null ? 'var(--t2)' : r.good ? GREEN : RED;
          const Icon = r.pct == null ? Minus : r.up ? TrendingUp : r.down ? TrendingDown : Minus;
          return (
            <div key={r.key} style={{
              padding: '13px 15px', borderRadius: '14px',
              background: 'var(--cd)', border: '1px solid var(--br)',
              display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0,
              animation: `wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${i * 45}ms backwards`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ ...TYPE.caption, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.label}</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  padding: '2px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 800,
                  background: r.good == null ? 'var(--hover)' : r.good ? 'rgba(47,182,115,0.13)' : 'rgba(239,68,68,0.11)',
                  color,
                }}>
                  <Icon size={11} strokeWidth={3} />
                  {r.pct == null ? '—' : `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(1)}%`}
                </span>
              </div>
              <div style={{ ...TYPE.metricValueSm, fontSize: '21px' }}>
                {r.va == null
                  ? '—'
                  : <CountUp value={r.va} display={r.fmt(r.va)} duration={900} delay={150 + i * 45} />}
              </div>
              <div style={{ ...TYPE.caption }}>vs {r.fmt(r.vb)}</div>
            </div>
          );
        })}
      </div>

      {/* Jumlah campaign + breakdown */}
      <div>
        <div style={{ ...TYPE.cardTitle, marginBottom: '8px' }}>Campaigns running</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {chip('Total — Period A', <CountUp value={a.adsTotal} display={String(a.adsTotal)} duration={700} delay={520} />, 'var(--ac)', 0)}
          {chip('Total — Period B', `${b.adsTotal}`, undefined, 1)}
          {chip('Awareness', `${a.adsAwareness} vs ${b.adsAwareness}`, '#8B5CF6', 2)}
          {chip('Traffic', `${a.adsTraffic} vs ${b.adsTraffic}`, '#F59E0B', 3)}
          {chip('Conversion', `${a.adsConversion} vs ${b.adsConversion}`, GREEN, 4)}
        </div>
      </div>

      <div style={{ ...TYPE.caption, borderTop: '1px solid var(--br)', paddingTop: '10px' }}>
        Percentages show how Period A performed against Period B. For cost metrics (CPM, CPC, CPL) a drop is shown in green
        because cheaper is better; for reach, traffic, leads and CTR a rise is green.
      </div>
    </div>
  );
}
