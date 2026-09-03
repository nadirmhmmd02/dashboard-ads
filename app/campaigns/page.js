'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Calendar, Calculator, Check, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Pause, Pencil, Play, RefreshCw, X } from 'lucide-react';
import { useCampaignsFilter, DATE_PRESETS_CAMPAIGNS } from '../components/DateFilterContext';
import { useAuth } from '../components/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import useIsMobile from '../components/useIsMobile';
import DateFilterPopup from '../components/DateFilterPopup';
import CampaignModal from '../components/CampaignModal';
import CombineModal from '../components/CombineModal';
import { authFetch } from '../supabase';


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

function fmtRp(v) {
  if (!v && v !== 0) return '—';
  const n = parseFloat(v);
  if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1).replace('.0', '') + ' jt';
  if (n >= 1000) return 'Rp ' + (n / 1000).toFixed(0) + 'rb';
  return 'Rp ' + n.toFixed(0);
}

function fmtNum(v) {
  if (!v) return '—';
  return parseFloat(v).toLocaleString('id-ID');
}

function fmtPct(v) {
  if (!v) return '—';
  return parseFloat(v).toFixed(2) + '%';
}

function getActionValue(actions, types) {
  if (!actions) return null;
  for (const type of types) {
    const a = actions.find(x => x.action_type === type);
    if (a) return parseInt(a.value);
  }
  return null;
}

/* Leads = form (instant form Meta + form website via pixel) + CTA klik-ke-WhatsApp.
   Aturan Nadir 3 Sep 2026 — sinkron dgn page.js/reportData/CompareModal/insightEngine. */
function getLeads(actions) {
  const form = getActionValue(actions, ["lead", "onsite_conversion.lead_grouped"]);
  const wa   = getActionValue(actions, ["onsite_conversion.messaging_conversation_started_7d"]);
  if (form === null && wa === null) return null;   // benar-benar tak ada data → tetap tampil "—"
  return (form || 0) + (wa || 0);
}

function getLinkClicks(actions) {
  return getActionValue(actions, ['link_click']);
}

/* Objective Meta yang berarti campaign Awareness (result = Reach/Impressions). */
const AWARENESS_OBJECTIVES = ['OUTCOME_AWARENESS', 'BRAND_AWARENESS', 'REACH'];

function getResult(campaign, insights) {
  const name = campaign.name?.toUpperCase() || '';
  const actions = insights?.actions || [];

  // Objective asli Meta menang atas nama untuk campaign Awareness — ada campaign
  // bernama "…TRAFFIC…" yang objective-nya OUTCOME_AWARENESS, hasilnya bukan link click.
  if (AWARENESS_OBJECTIVES.includes(campaign.objective)) {
    return name.includes('REACH')
      ? { label: 'Reach', value: fmtNum(insights?.reach) }
      : { label: 'Impressions', value: fmtNum(insights?.impressions) };
  }

  if (name.includes('AWR REACH')) return { label: 'Reach', value: fmtNum(insights?.reach) };
  if (name.includes('AWR IMPR')) return { label: 'Impressions', value: fmtNum(insights?.impressions) };
  if (name.includes('AWR')) return { label: 'Impressions', value: fmtNum(insights?.impressions) };
  if (name.includes('TRAFFIC')) return { label: 'Link Clicks', value: fmtNum(getLinkClicks(actions)) };
  if (name.includes('PROSPEK') || name.includes('KONVERSI')) return { label: 'Leads', value: fmtNum(getLeads(actions)) };
  return { label: '—', value: '—' };
}

function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC')) return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}

const OBJ_GROUP = {
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_LEADS: 'Conversion',
  OUTCOME_SALES: 'Conversion',
  OUTCOME_ENGAGEMENT: 'Traffic',
  LINK_CLICKS: 'Traffic',
};

const OBJ_STYLE = {
  Awareness: { bg: 'rgba(91,127,212,0.14)', color: '#5b8fd4' },
  Traffic: { bg: 'rgba(245,158,11,0.14)', color: '#f59e0b' },
  Conversion: { bg: 'rgba(16,185,129,0.14)', color: '#10b981' },
};

const OBJ_ORDER = ['Awareness', 'Traffic', 'Conversion'];

/* ─── SORT TABEL ───
   Nilai mentah per kolom (versi angka dari sel yang tampil). Sort diterapkan
   di dalam tiap grup objektif DAN tetap menghormati aturan lama "active di atas". */
function resultRaw(c, ci) {
  const name = c.name?.toUpperCase() || '';
  if (AWARENESS_OBJECTIVES.includes(c.objective)) {
    return parseFloat((name.includes('REACH') ? ci?.reach : ci?.impressions) || 0);
  }
  if (name.includes('AWR REACH')) return parseFloat(ci?.reach || 0);
  if (name.includes('AWR')) return parseFloat(ci?.impressions || 0);
  if (name.includes('TRAFFIC')) return getLinkClicks(ci?.actions) || 0;
  if (name.includes('PROSPEK') || name.includes('KONVERSI')) return getLeads(ci?.actions) || 0;
  return 0;
}

const SORT_COLS = {
  name:        { label: 'Campaign',     get: c => (c.name || '').toLowerCase() },
  budget:      { label: 'Daily Budget', get: c => parseFloat(c.daily_budget || 0) },
  result:      { label: 'Result',       get: c => resultRaw(c, c.insights?.data?.[0] || {}) },
  reach:       { label: 'Reach',        get: c => parseFloat(c.insights?.data?.[0]?.reach || 0) },
  impressions: { label: 'Impressions',  get: c => parseFloat(c.insights?.data?.[0]?.impressions || 0) },
  traffic:     { label: 'Traffic',      get: c => getLinkClicks(c.insights?.data?.[0]?.actions) || 0 },
  leads:       { label: 'Leads',        get: c => getLeads(c.insights?.data?.[0]?.actions) || 0 },
  cpm:         { label: 'CPM',          get: c => { const ci = c.insights?.data?.[0] || {}; const im = parseFloat(ci.impressions || 0); return im > 0 ? (parseFloat(ci.spend || 0) / im) * 1000 : null; } },
  cpc:         { label: 'CPC',          get: c => { const ci = c.insights?.data?.[0] || {}; const lc = getLinkClicks(ci.actions); return lc > 0 ? parseFloat(ci.spend || 0) / lc : null; } },
  cpl:         { label: 'CPL',          get: c => { const ci = c.insights?.data?.[0] || {}; const ld = getLeads(ci.actions); return ld > 0 ? parseFloat(ci.spend || 0) / ld : null; } },
  spend:       { label: 'Total Spend',  get: c => parseFloat(c.insights?.data?.[0]?.spend || 0) },
};

function applySort(list, sort) {
  const col = sort && SORT_COLS[sort.key];
  if (!col) return list;
  return [...list].sort((a, b) => {
    const va = col.get(a), vb = col.get(b);
    if (typeof va === 'string' || typeof vb === 'string') {
      return sort.dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    }
    // Nilai kosong (—) selalu ditaruh di bawah, apa pun arah sortnya
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return sort.dir === 'asc' ? va - vb : vb - va;
  });
}

/* ─── STATUS AKUN IKLAN META ───
   Kalau iklan mati di Meta (tagihan belum dibayar, akun ditinjau, dsb) angka di
   dashboard/campaigns bisa tetap "kelihatan normal" padahal iklan sudah berhenti
   tayang. account_status dari Graph API memberi sinyal itu. Kita terjemahkan ke
   peringatan berbahasa manusia. Referensi nilai account_status Meta:
   1=aktif · 2=dinonaktifkan · 3=tagihan belum lunas · 7=ditinjau risiko ·
   8=menunggu penyelesaian · 9=masa tenggang · 100=proses tutup · 101=ditutup.
   disable_reason (saat status 2): 3=masalah pembayaran/risiko. */
const ACCOUNT_DISABLE_REASON = {
  1: 'it broke Meta advertising policies',
  2: 'it is under intellectual-property review',
  3: 'a payment or account-risk problem',
  5: 'it is under review by Meta',
  7: 'it was permanently closed by Meta',
};
function accountAlert(account) {
  if (!account || account.status == null || account.status === 1 || account.status === 201) return null;
  const s = account.status;
  const base = { icon: 'card', level: 'error' };
  switch (s) {
    case 3: // UNSETTLED — kasus paling umum: tagihan belum dibayar, iklan berhenti tayang
      return { ...base, title: 'Ads stopped — unpaid balance',
        body: 'There is an unpaid balance on your Meta Ads account, so every ad has stopped running even though the campaigns below may still say "Active". Settle the payment in Meta Ads Manager → Billing to get your ads running again.' };
    case 8:
      return { ...base, level: 'warn', icon: 'card', title: 'Waiting for payment to settle',
        body: 'Your account payment is being processed by Meta. Ads may pause until the payment clears.' };
    case 9:
      return { ...base, level: 'warn', icon: 'card', title: 'Account is in a payment grace period',
        body: 'Your ads are still running for now, but there is a balance that needs to be paid soon in Meta Ads Manager → Billing before the grace period ends.' };
    case 2:
      return { ...base, title: 'Ad account disabled by Meta',
        body: `Your ad account is disabled${account.disableReason && ACCOUNT_DISABLE_REASON[account.disableReason] ? ` because of ${ACCOUNT_DISABLE_REASON[account.disableReason]}` : ''}. All ads have stopped running. Check Account Quality / Ads Manager for the recovery steps.` };
    case 7:
      return { ...base, level: 'warn', icon: 'review', title: 'Account under review by Meta',
        body: 'Meta is reviewing your ad account. Ads may pause until the review is finished.' };
    case 100:
      return { ...base, icon: 'review', title: 'Ad account is being closed',
        body: 'Your ad account is being processed for closure, so ads will not run. Contact Meta support if this is unexpected.' };
    case 101:
      return { ...base, icon: 'review', title: 'Ad account is closed',
        body: 'This ad account has been closed, so no ads are running.' };
    default:
      return { ...base, level: 'warn', icon: 'review', title: 'Ad account has an issue on Meta',
        body: 'Your ad account status is not normal, so ads may stop running. Check Meta Ads Manager for the details.' };
  }
}

export default function CampaignsPage() {
  const { dateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, selectPreset, applyCustom } = useCampaignsFilter();
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [showDropdown, setShowDropdown]   = useState(false);

  // Slot top bar mobile (MobileNav) — tombol refresh pindah ke atas via portal
  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
  }, [isMobile]);

  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [showSubtotal, setShowSubtotal]   = useState({ Awareness: false, Traffic: false, Conversion: false });
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedIds, setSelectedIds]           = useState([]);   // pilihan untuk hitung gabungan
  const [showCombine, setShowCombine]           = useState(false);
  const [sort, setSort]                         = useState(null); // { key, dir } — null = urutan default

  // Aksi kontrol iklan (admin-only): stop/run + edit daily budget
  const [actionModal, setActionModal] = useState(null);  // { type:'status'|'budget', campaign, nextStatus }
  const [actionBusy, setActionBusy]   = useState(false);
  const [actionError, setActionError] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');    // digit murni, tampil pakai separator
  const [toast, setToast]             = useState(null);  // pesan sukses singkat

  // Lebar kolom Campaign — bisa di-drag lewat handle di batas kolom Campaign|Status
  const [campW, setCampW]     = useState(300);
  const [colDrag, setColDrag] = useState(false);
  const [colHover, setColHover] = useState(false);
  const colDragX = useRef(0);
  const colDragW = useRef(300);

  function startColDrag(e) {
    e.preventDefault();
    colDragX.current = e.clientX;
    colDragW.current = campW;
    setColDrag(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (ev) => {
      setCampW(Math.max(150, Math.min(620, colDragW.current + (ev.clientX - colDragX.current))));
    };
    const up = () => {
      setColDrag(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  // Bulan kiri kalender (UI only). Default: bulan lalu → tampil "bulan lalu + bulan ini".
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e) => {
      if (!e.target.closest('[data-filter-dropdown]')) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  async function fetchData(since = '', until = '') {
    setLoading(true);
    setError(null);
    try {
      const url = since && until
        ? `/api/meta?since=${since}&until=${until}`
        : `/api/meta?date_preset=${dateOpt.value}`;
      const res  = await authFetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function applyCustomRange() {
    if (!customSince || !customUntil) return;
    applyCustom(customSince, customUntil);
    setShowDropdown(false);
    fetchData(customSince, customUntil);
  }

  function refresh() {
    if (isCustom && customSince && customUntil) fetchData(customSince, customUntil);
    else fetchData();
  }

  function handleSelectPreset(opt) {
    selectPreset(opt);
    setShowDropdown(false);
  }

  // ── Kalender (UI only) ──
  function openFilter() {
    const next = !showDropdown;
    if (next && customSince) { const p = customSince.split('-'); setCalY(+p[0]); setCalM(+p[1] - 1); }
    setShowDropdown(next);
  }
  function shiftCal(delta) {
    const dt = new Date(calY, calM + delta, 1);
    setCalY(dt.getFullYear()); setCalM(dt.getMonth());
  }
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
  function renderMonth(y, m) {
    const todayStr = toYMD(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    return (
      <div style={{ width: '232px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: '2px' }}>
          {CAL_DOW.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--t3)', paddingBottom: '8px' }}>{d}</div>
          ))}
          {monthGrid(y, m).map((d, i) => {
            if (!d) return <div key={i} />;
            const ds       = toYMD(y, m, d);
            const isStart  = ds === customSince;
            const isEnd    = ds === customUntil;
            const inRange  = customSince && customUntil && ds > customSince && ds < customUntil;
            const isToday  = ds === todayStr;
            const endpoint = isStart || isEnd;
            const hasLeft  = customUntil && (isEnd || inRange);
            const hasRight = customUntil && (isStart || inRange);
            return (
              <div key={i} style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(hasLeft || hasRight) && (
                  <span style={{ position: 'absolute', top: '3px', bottom: '3px',
                    left: hasLeft ? 0 : '50%', right: hasRight ? 0 : '50%',
                    background: 'var(--cal-range)' }} />
                )}
                {endpoint && (
                  <span style={{ position: 'absolute', width: '30px', height: '30px', borderRadius: '50%',
                    background: 'var(--cal-accent)', boxShadow: '0 2px 8px var(--cal-glow)' }} />
                )}
                <button onClick={() => pickDay(ds)} style={{
                  position: 'relative', width: '30px', height: '30px', borderRadius: '50%',
                  border: isToday && !endpoint ? '1px solid var(--cal-accent-line)' : '1px solid transparent',
                  background: 'transparent', cursor: 'pointer', fontSize: '12.5px', fontFamily: 'inherit',
                  fontWeight: endpoint ? 700 : 400,
                  color: endpoint ? 'var(--cal-accent-fg)' : isToday ? 'var(--cal-accent-line)' : inRange ? 'var(--t1)' : 'var(--t2)',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { if (!endpoint) e.currentTarget.style.background = 'var(--hover)'; }}
                onMouseLeave={e => { if (!endpoint) e.currentTarget.style.background = 'transparent'; }}
                >{d}</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Label yang muncul di tombol filter
  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }

  function toggleSubtotal(grp) {
    setShowSubtotal(prev => ({ ...prev, [grp]: !prev[grp] }));
  }

  function toggleSelect(e, id) {
    e.stopPropagation(); // jangan sampai membuka popup detail
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ── Aksi kontrol iklan (admin-only) ──
  function openStatusModal(e, c) {
    e.stopPropagation();
    setActionError(null);
    setActionModal({ type: 'status', campaign: c, nextStatus: c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' });
  }
  function openBudgetModal(e, c) {
    e.stopPropagation();
    setActionError(null);
    setBudgetInput(c.daily_budget ? String(parseInt(c.daily_budget)) : '');
    setActionModal({ type: 'budget', campaign: c });
  }
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }
  async function executeAction() {
    if (!actionModal || actionBusy) return;
    const { type, campaign, nextStatus } = actionModal;
    setActionBusy(true);
    setActionError(null);
    try {
      const payload = type === 'status'
        ? { action: 'set_status', campaign_id: campaign.id, status: nextStatus }
        : { action: 'set_budget', campaign_id: campaign.id, daily_budget: parseInt(budgetInput || '0') };
      const res  = await authFetch('/api/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Update lokal langsung tanpa reload penuh (Meta sudah konfirmasi sukses)
      setData(prev => prev ? {
        ...prev,
        campaigns: prev.campaigns.map(x => x.id !== campaign.id ? x : (
          type === 'status' ? { ...x, status: nextStatus } : { ...x, daily_budget: String(parseInt(budgetInput)) }
        )),
      } : prev);

      setActionModal(null);
      showToast(type === 'status'
        ? (nextStatus === 'ACTIVE' ? 'Campaign is now running ✓' : 'Campaign stopped ✓')
        : 'Daily budget updated ✓');
    } catch (err) {
      setActionError(err.message);
    }
    setActionBusy(false);
  }

  const allCampaigns = data?.campaigns || [];

  // Tampilkan semua campaign yang punya data di periode ini (spend/reach/impressions > 0)
  const campaignsWithData = allCampaigns.filter(c => {
    const ci = c.insights?.data?.[0];
    if (!ci) return false;
    return parseFloat(ci.spend || 0) > 0 || parseFloat(ci.reach || 0) > 0 || parseFloat(ci.impressions || 0) > 0;
  });

  const selectedCampaigns = campaignsWithData.filter(c => selectedIds.includes(c.id));
  const selectedSpend     = selectedCampaigns.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);

  const activeCampaigns = campaignsWithData.filter(c => c.status === 'ACTIVE');
  const inactiveCampaigns = campaignsWithData.filter(c => c.status !== 'ACTIVE');

  // Dalam tiap grup: aktif dulu, lalu non-aktif — menyatu tanpa pemisah
  const groupCampaigns = (list) =>
    list.reduce((acc, c) => {
      const grp = OBJ_GROUP[c.objective] || 'Awareness';
      if (!acc[grp]) acc[grp] = [];
      acc[grp].push(c);
      return acc;
    }, {});

  // Default: aktif di atas, non-aktif di bawah.
  // Saat sort kolom aktif: campur semua status lalu urutkan murni per nilai kolom —
  // campaign yang sudah berhenti ikut naik kalau angkanya memang paling besar.
  const mergedGrouped = {};
  OBJ_ORDER.forEach(grp => {
    const active = groupCampaigns(activeCampaigns)[grp] || [];
    const inactive = groupCampaigns(inactiveCampaigns)[grp] || [];
    if (!active.length && !inactive.length) return;
    mergedGrouped[grp] = sort
      ? applySort([...active, ...inactive], sort)
      : [...active, ...inactive];
  });

  /* Klik 1 = tertinggi dulu (paling sering dipakai saat analisis), klik 2 = terendah,
     klik 3 = balik ke urutan default. Kolom Campaign mulai dari A–Z. */
  function toggleSort(key) {
    const firstDir = key === 'name' ? 'asc' : 'desc';
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: firstDir };
      if (prev.dir === firstDir) return { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
      return null;
    });
  }

  // Jumlah kolom tabel — admin dapat kolom Actions ekstra
  const totalCols = isAdmin ? 14 : 13;

  const thStyle = (align = 'right') => ({
    padding: '10px 12px',
    textAlign: align,
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--t3)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    whiteSpace: 'nowrap',
  });

  const tdStyle = (align = 'right') => ({
    padding: '9px 12px',
    textAlign: align,
    color: 'var(--t2)',
    whiteSpace: 'nowrap',
    fontSize: '12px',
  });

  /* Header kolom yang bisa diklik untuk mengurutkan (pola tabel data standar:
     panah samar saat hover, panah tegas + warna aksen saat kolom itu aktif). */
  function SortTh({ colKey, align = 'right', style: extra }) {
    const active = sort?.key === colKey;
    const [hover, setHover] = useState(false);
    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        onClick={() => toggleSort(colKey)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={active
          ? `Sorted by ${SORT_COLS[colKey].label} — click to ${sort.dir === 'desc' ? 'reverse' : 'reset'}`
          : `Sort by ${SORT_COLS[colKey].label}`}
        style={{
          ...thStyle(align), ...extra,
          cursor: 'pointer', userSelect: 'none',
          color: active ? 'var(--ac)' : 'var(--t3)',
          transition: 'color 0.15s',
        }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        }}>
          {SORT_COLS[colKey].label}
          <Icon
            size={11}
            strokeWidth={active ? 3 : 2}
            style={{ opacity: active ? 1 : hover ? 0.55 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}
          />
        </span>
      </th>
    );
  }

  function renderCampaignRow(c, rowIdx = 0) {
    const isActive = c.status === 'ACTIVE';
    const ci = c.insights?.data?.[0] || {};
    const cLeads = getLeads(ci.actions);
    const cLinkClicks = getLinkClicks(ci.actions);
    const cCPM = parseFloat(ci.impressions || 0) > 0 ? (parseFloat(ci.spend || 0) / parseFloat(ci.impressions)) * 1000 : null;
    const cCPC = cLinkClicks > 0 ? parseFloat(ci.spend || 0) / cLinkClicks : null;
    const cCPL = cLeads > 0 ? parseFloat(ci.spend || 0) / cLeads : null;
    const result = getResult(c, ci);

    return (
      <tr
        key={c.id}
        title="Klik untuk lihat detail campaign"
        onClick={() => setSelectedCampaign(c)}
        style={{
          borderTop: '1px solid var(--br)',
          opacity: 1,
          cursor: 'pointer',
          transition: 'background 0.15s',
          animation: `wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1) ${rowIdx * 0.04}s backwards`,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <td style={{ ...tdStyle('center'), width: '36px', padding: '9px 6px 9px 12px' }} onClick={(e) => toggleSelect(e, c.id)} title="Pilih untuk hitung gabungan">
          <span style={{
            width: '16px', height: '16px', borderRadius: '5px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle',
            border: selectedIds.includes(c.id) ? '1px solid var(--cal-accent)' : '1px solid var(--br-strong)',
            background: selectedIds.includes(c.id) ? 'var(--cal-accent)' : 'transparent',
            transition: 'background 0.15s, border-color 0.15s',
          }}>
            {selectedIds.includes(c.id) && <Check size={11} strokeWidth={3.5} color="var(--cal-accent-fg)" />}
          </span>
        </td>
        <td title={c.name} style={{
          ...tdStyle('left'), fontWeight: '500', color: 'var(--t1)',
          width: campW, minWidth: campW, maxWidth: campW,
          overflow: 'hidden', textOverflow: 'ellipsis',
          borderRight: colDrag ? '1px dashed var(--cal-accent)' : '1px solid transparent',
        }}>{c.name}</td>
        <td style={tdStyle('center')}>
          {isActive ? (
            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(16,185,129,0.14)', color: '#10b981', fontWeight: '600', whiteSpace: 'nowrap' }}>▶ Active</span>
          ) : (
            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(115,115,115,0.12)', color: 'var(--t3)', fontWeight: '600', whiteSpace: 'nowrap' }}>■ {c.status === 'PAUSED' ? 'Stop' : 'Ended'}</span>
          )}
        </td>
        {isAdmin && (
          <td style={{ ...tdStyle('center'), padding: '9px 8px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'inline-flex', gap: '6px' }}>
              {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
                <button
                  onClick={(e) => openStatusModal(e, c)}
                  title={isActive ? 'Stop campaign' : 'Run campaign'}
                  style={{
                    width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '7px', cursor: 'pointer', transition: 'background 0.12s, border-color 0.12s',
                    border: isActive ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(16,185,129,0.35)',
                    background: isActive ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isActive ? 'rgba(239,68,68,0.22)' : 'rgba(16,185,129,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)'}
                >
                  {isActive ? <Pause size={12} color="#ef4444" /> : <Play size={12} color="#10b981" />}
                </button>
              )}
              {c.daily_budget && (
                <button
                  onClick={(e) => openBudgetModal(e, c)}
                  title="Edit daily budget"
                  style={{
                    width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '7px', border: '1px solid var(--br-strong)', background: 'transparent',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Pencil size={12} color="var(--t2)" />
                </button>
              )}
            </div>
          </td>
        )}
        <td style={tdStyle()}>{c.daily_budget ? fmtRp(parseInt(c.daily_budget)) : '—'}</td>
        <td style={tdStyle()}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '9px', color: 'var(--t3)' }}>{result.label}</span>
            <span style={{ fontWeight: '500', color: 'var(--t1)' }}>{result.value}</span>
          </div>
        </td>
        <td style={tdStyle()}>{fmtNum(ci.reach)}</td>
        <td style={tdStyle()}>{fmtNum(ci.impressions)}</td>
        <td style={tdStyle()}>{fmtNum(cLinkClicks)}</td>
        <td style={tdStyle()}>{cLeads ?? '—'}</td>
        <td style={tdStyle()}>{fmtRp(cCPM)}</td>
        <td style={tdStyle()}>{fmtRp(cCPC)}</td>
        <td style={tdStyle()}>{fmtRp(cCPL)}</td>
        <td style={{ ...tdStyle(), fontWeight: '600', color: 'var(--t1)' }}>{fmtRp(ci.spend)}</td>
      </tr>
    );
  }

  function renderGroup(grp, rows, activeRows) {
    const isActive = true; // subtotal selalu ditampilkan, flag ini untuk subtotal logic
    if (!rows.length) return null;

    const subBudget = rows.reduce((s, c) => s + (c.daily_budget ? parseInt(c.daily_budget) : 0), 0);
    const subReach = rows.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.reach || 0), 0);
    const subImpressions = rows.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
    const subTraffic = rows.reduce((s, c) => s + (getLinkClicks(c.insights?.data?.[0]?.actions) || 0), 0);
    const subLeads = rows.reduce((s, c) => s + (getLeads(c.insights?.data?.[0]?.actions) || 0), 0);
    const subSpend = rows.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
    const subCPM = subImpressions > 0 ? (subSpend / subImpressions) * 1000 : null;
    const subCPC = subTraffic > 0 ? subSpend / subTraffic : null;
    const subCPL = subLeads > 0 ? subSpend / subLeads : null;
    const subResultVal = grp === 'Awareness' ? fmtNum(subImpressions) : grp === 'Traffic' ? fmtNum(subTraffic) : fmtNum(subLeads);
    const subResultLabel = grp === 'Awareness' ? 'Impressions' : grp === 'Traffic' ? 'Link Clicks' : 'Leads';

    const key = isActive ? grp : grp + '-inactive';

    return [
      <tr key={key + '-hdr'} style={{ background: 'var(--s2)' }}>
        <td colSpan={totalCols} style={{ padding: '6px 14px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', background: OBJ_STYLE[grp]?.bg || 'var(--sf)', color: OBJ_STYLE[grp]?.color || 'var(--t2)' }}>{grp}</span>
            {rows.length} campaign{rows.length > 1 ? 's' : ''}
            {/* Ruang kosong di baris objektif dipakai untuk menandai urutan yang sedang aktif
                di grup ini — klik untuk kembali ke urutan default. */}
            {sort && SORT_COLS[sort.key] && (
              <span
                onClick={() => setSort(null)}
                title="Back to default order"
                style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 9px', borderRadius: '20px', cursor: 'pointer',
                  background: 'var(--sf)', border: '1px solid var(--br)',
                  color: 'var(--ac)', fontSize: '10px', fontWeight: '600',
                }}
              >
                {sort.dir === 'asc' ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                {SORT_COLS[sort.key].label}
                <X size={10} strokeWidth={3} style={{ opacity: 0.55 }} />
              </span>
            )}
          </span>
        </td>
      </tr>,

      ...rows.map((c, i) => renderCampaignRow(c, i)),

      isActive && showSubtotal[grp] && (
        <tr key={key + '-sub'} style={{ borderTop: '0.5px solid var(--br)', background: 'var(--sf)' }}>
          <td colSpan={isAdmin ? 4 : 3} style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--t1)', fontSize: '11px', fontStyle: 'italic' }}>Subtotal {grp}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtRp(subBudget)}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '9px', color: 'var(--t3)' }}>{subResultLabel}</span>
              <span style={{ fontWeight: '500', color: 'var(--t1)' }}>{subResultVal}</span>
            </div>
          </td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtNum(subReach)}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtNum(subImpressions)}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{subTraffic > 0 ? fmtNum(subTraffic) : '—'}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{subLeads > 0 ? fmtNum(subLeads) : '—'}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtRp(subCPM)}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtRp(subCPC)}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtRp(subCPL)}</td>
          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--t1)', fontSize: '11px' }}>{fmtRp(subSpend)}</td>
        </tr>
      ),

      isActive && (
        <tr key={key + '-toggle'} style={{ borderTop: '0.5px solid var(--br)', background: 'var(--sf)' }}>
          <td colSpan={totalCols} style={{ padding: '4px 14px', textAlign: 'center' }}>
            <button
              onClick={() => toggleSubtotal(grp)}
              style={{ fontSize: '10px', padding: '2px 14px', borderRadius: '6px', border: '1px solid var(--bs)', background: 'transparent', color: 'var(--t3)', cursor: 'pointer' }}>
              {showSubtotal[grp] ? '▲ Hide subtotal' : '▼ Show subtotal'}
            </button>
          </td>
        </tr>
      ),
    ].filter(Boolean);
  }

  // Peringatan status akun iklan Meta (mis. tagihan belum dibayar / akun ditinjau)
  const acctAlert = accountAlert(data?.account);

  // Tombol refresh — header (desktop) atau top bar via portal (mobile)
  const refreshBtn = (
    <button onClick={refresh} title="Refresh" style={{
      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px', cursor: 'pointer',
      flexShrink: 0, transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--t3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}
    >
      <RefreshCw size={14} color="var(--t2)" style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  return (
    <div style={{ padding: isMobile ? '18px 20px' : '12px 16px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>

      {/* Topbar — desktop: card mengambang (nuansa dashboard redesain 2026) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: isMobile ? '16px' : '10px', flexWrap: 'wrap', rowGap: '10px',
        animation: 'wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        ...(isMobile ? null : {
          background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '18px',
          padding: '12px 20px', boxShadow: 'var(--shadow)',
        }) }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--t1)' }}>Campaign Performance</div>
          <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>
            {loading ? 'Loading...' : `${campaignsWithData.length} campaigns · ${activeCampaigns.length} active · ${inactiveCampaigns.length} non-active · ${filterLabel()}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          {/* Filter dropdown */}
          <div style={{ position: 'relative' }} data-filter-dropdown>
            <button
              onClick={openFilter}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 13px', fontSize: '13px',
                border: `1px solid ${isCustom ? 'var(--cal-accent)' : 'var(--br)'}`,
                borderRadius: '9px', background: 'var(--cd)', color: 'var(--t1)', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}>
            <Calendar size={14} color="var(--t2)" />
            {filterLabel()}
            <ChevronDown size={13} color="var(--t2)" />
          </button>

          {showDropdown && (
            <DateFilterPopup
              presets={DATE_PRESETS_CAMPAIGNS}
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

          {!isMobile && refreshBtn}
          {!isMobile && <ThemeToggle size={36} iconSize={14} />}

          {/* Mobile: refresh pindah ke top bar (kiri theme toggle) */}
          {isMobile && topbarSlot && createPortal(refreshBtn, topbarSlot)}
        </div>
      </div>

      {/* ── Peringatan status akun iklan Meta (iklan mati karena tagihan/dinonaktifkan/ditinjau) ── */}
      {acctAlert && (() => {
        const isErr = acctAlert.level === 'error';
        const accent = isErr ? '#EF4444' : '#F59E0B';
        const AlertIcon = acctAlert.icon === 'card' ? CreditCard : AlertTriangle;
        return (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '14px',
            padding: isMobile ? '14px 16px' : '16px 20px',
            marginBottom: isMobile ? '16px' : '10px',
            background: isErr ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.09)',
            border: `1px solid ${isErr ? 'rgba(239,68,68,0.32)' : 'rgba(245,158,11,0.34)'}`,
            borderRadius: isMobile ? '12px' : '18px',
            animation: 'wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <span style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isErr ? 'rgba(239,68,68,0.14)' : 'rgba(245,158,11,0.16)',
            }}>
              <AlertIcon size={19} color={accent} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: isMobile ? '13.5px' : '14px', fontWeight: 700, color: 'var(--t1)' }}>{acctAlert.title}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.3px', textTransform: 'uppercase',
                  background: accent, color: '#fff',
                }}>{isErr ? 'Ads down' : 'Needs attention'}</span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--t2)', lineHeight: 1.55, marginTop: '5px' }}>
                {acctAlert.body}
              </div>
              <a href="https://adsmanager.facebook.com/" target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '10px',
                  fontSize: '12px', fontWeight: 600, color: accent, textDecoration: 'none',
                }}>
                Open Meta Ads Manager <ChevronRight size={13} />
              </a>
            </div>
          </div>
        );
      })()}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--t3)', fontSize: '14px' }}>
          Loading data from Meta Ads...
        </div>
      )}

      {error && (
        <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && data && (
        <div style={{ background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: isMobile ? '10px' : '18px', overflow: 'hidden', boxShadow: 'var(--shadow)', animation: 'wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1) 0.05s backwards' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--sf)' }}>
                  <th style={{ ...thStyle('center'), width: '36px', padding: '10px 6px 10px 12px' }}></th>
                  <th
                    onClick={() => toggleSort('name')}
                    title={sort?.key === 'name' ? `Sorted by Campaign — click to ${sort.dir === 'asc' ? 'reverse' : 'reset'}` : 'Sort by Campaign'}
                    style={{
                      ...thStyle('left'), position: 'relative', width: campW, minWidth: campW, maxWidth: campW,
                      cursor: 'pointer', userSelect: 'none',
                      color: sort?.key === 'name' ? 'var(--ac)' : 'var(--t3)', transition: 'color 0.15s',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Campaign
                      {sort?.key === 'name' && (
                        sort.dir === 'asc'
                          ? <ArrowUp size={11} strokeWidth={3} />
                          : <ArrowDown size={11} strokeWidth={3} />
                      )}
                    </span>
                    {/* Handle drag batas kolom Campaign | Status */}
                    <div
                      onMouseDown={startColDrag}
                      onMouseEnter={() => setColHover(true)}
                      onMouseLeave={() => setColHover(false)}
                      title="Geser untuk atur lebar kolom"
                      style={{
                        position: 'absolute', top: 0, bottom: 0, right: '-4px', width: '9px',
                        cursor: 'col-resize', zIndex: 3,
                        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
                      }}>
                      <div style={{
                        width: '2px',
                        background: colDrag || colHover ? 'var(--cal-accent)' : 'var(--br-strong)',
                        opacity: colDrag || colHover ? 1 : 0.55,
                        borderRadius: '2px',
                        transition: 'background 0.15s, opacity 0.15s',
                      }} />
                    </div>
                  </th>
                  <th style={thStyle('center')}>Status</th>
                  {isAdmin && <th style={thStyle('center')}>Actions</th>}
                  <SortTh colKey="budget" />
                  <SortTh colKey="result" />
                  <SortTh colKey="reach" />
                  <SortTh colKey="impressions" />
                  <SortTh colKey="traffic" />
                  <SortTh colKey="leads" />
                  <SortTh colKey="cpm" />
                  <SortTh colKey="cpc" />
                  <SortTh colKey="cpl" />
                  <SortTh colKey="spend" />
                </tr>
              </thead>
              <tbody>
                {campaignsWithData.length > 0
                  ? OBJ_ORDER.map(grp => {
                      const rows = mergedGrouped[grp];
                      if (!rows || !rows.length) return null;
                      const activeRows = rows.filter(c => c.status === 'ACTIVE');
                      // tiap row: aktif = true kalau statusnya ACTIVE
                      return renderGroup(grp, rows, activeRows);
                    })
                  : (
                    <tr><td colSpan={totalCols} style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
                      No campaign data for {dateOpt.label}
                    </td></tr>
                  )
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating bar: muncul saat ada campaign terpilih untuk dihitung gabungan */}
      {selectedCampaigns.length > 0 && !showCombine && (
        <div style={{ position: 'fixed', bottom: '26px', left: '50%', transform: 'translateX(-50%)', zIndex: 80 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '10px 12px 10px 20px',
            background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '999px',
            boxShadow: 'var(--pop-shadow)',
            animation: 'wdSlideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <span style={{ fontSize: '12.5px', color: 'var(--t2)', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--cal-accent-line)' }}>{selectedCampaigns.length}</span> selected
            </span>
            <span style={{ width: '1px', height: '18px', background: 'var(--br)', flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap' }}>
              Rp {Math.round(selectedSpend).toLocaleString('id-ID')}
            </span>
            <button
              onClick={() => setShowCombine(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 18px', fontSize: '12.5px', fontWeight: 600,
                borderRadius: '999px', border: 'none', cursor: 'pointer',
                background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
                boxShadow: '0 2px 10px var(--cal-glow)', whiteSpace: 'nowrap',
              }}>
              <Calculator size={14} /> Calculate Total
            </button>
            <button
              onClick={() => setSelectedIds([])}
              title="Clear selection"
              style={{
                width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', border: '1px solid var(--br)', background: 'transparent', cursor: 'pointer',
                transition: 'background 0.12s', flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <X size={14} color="var(--t2)" />
            </button>
          </div>
        </div>
      )}

      {/* Popup hitung gabungan campaign terpilih */}
      {showCombine && selectedCampaigns.length > 0 && (
        <CombineModal
          campaigns={selectedCampaigns}
          periodLabel={filterLabel()}
          onClose={() => setShowCombine(false)}
        />
      )}

      {/* Popup konfirmasi aksi iklan (admin-only): stop/run + edit budget */}
      {actionModal && (
        <div
          onClick={() => { if (!actionBusy) setActionModal(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', padding: '20px',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '400px', background: 'var(--cd)', border: '1px solid var(--br)',
              borderRadius: '16px', padding: '22px', boxShadow: 'var(--pop-shadow)',
              animation: 'wdScaleIn 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}>
            {actionModal.type === 'status' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{
                    width: '38px', height: '38px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: actionModal.nextStatus === 'PAUSED' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  }}>
                    {actionModal.nextStatus === 'PAUSED' ? <Pause size={17} color="#ef4444" /> : <Play size={17} color="#10b981" />}
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t1)' }}>
                    {actionModal.nextStatus === 'PAUSED' ? 'Stop this campaign?' : 'Run this campaign?'}
                  </div>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--t2)', lineHeight: 1.55, marginBottom: '6px', wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{actionModal.campaign.name}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--t3)', lineHeight: 1.55, marginBottom: '16px' }}>
                  {actionModal.nextStatus === 'PAUSED'
                    ? 'This campaign will stop delivering on Meta until you run it again.'
                    : 'This campaign will resume delivering on Meta and start spending its budget.'}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{
                    width: '38px', height: '38px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: 'var(--cal-range)',
                  }}>
                    <Pencil size={16} color="var(--cal-accent-line)" />
                  </span>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t1)' }}>Edit Daily Budget</div>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--t2)', marginBottom: '14px', wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{actionModal.campaign.name}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '6px' }}>
                  Current budget: <span style={{ fontWeight: 600, color: 'var(--t2)' }}>
                    Rp {actionModal.campaign.daily_budget ? parseInt(actionModal.campaign.daily_budget).toLocaleString('id-ID') : '—'}
                  </span> / day
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
                  border: '1px solid var(--br-strong)', borderRadius: '10px', padding: '10px 13px', background: 'var(--sf)',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t3)', flexShrink: 0 }}>Rp</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={budgetInput ? parseInt(budgetInput).toLocaleString('id-ID') : ''}
                    onChange={e => setBudgetInput(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter') executeAction(); }}
                    placeholder="0"
                    style={{
                      flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                      fontSize: '16px', fontWeight: 700, color: 'var(--t1)', fontFamily: 'inherit',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--t3)', flexShrink: 0 }}>/ day</span>
                </div>
              </>
            )}

            {actionError && (
              <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '9px', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setActionModal(null)}
                disabled={actionBusy}
                style={{
                  padding: '9px 16px', fontSize: '12.5px', fontWeight: 500, borderRadius: '9px',
                  border: '1px solid var(--br)', background: 'transparent', color: 'var(--t2)',
                  cursor: actionBusy ? 'default' : 'pointer', opacity: actionBusy ? 0.5 : 1,
                }}>
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={actionBusy || (actionModal.type === 'budget' && (!budgetInput || parseInt(budgetInput) < 10000))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '9px 18px', fontSize: '12.5px', fontWeight: 600, borderRadius: '9px', border: 'none',
                  cursor: actionBusy ? 'wait' : 'pointer',
                  background: actionModal.type === 'status'
                    ? (actionModal.nextStatus === 'PAUSED' ? '#ef4444' : '#10b981')
                    : 'var(--cal-accent)',
                  color: actionModal.type === 'status' ? '#fff' : 'var(--cal-accent-fg)',
                  opacity: (actionModal.type === 'budget' && (!budgetInput || parseInt(budgetInput) < 10000)) ? 0.45 : 1,
                }}>
                {actionBusy && <RefreshCw size={13} style={{ animation: 'wdSpin 0.8s linear infinite' }} />}
                {actionBusy
                  ? 'Processing...'
                  : actionModal.type === 'status'
                    ? (actionModal.nextStatus === 'PAUSED' ? 'Yes, Stop' : 'Yes, Run')
                    : 'Save Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast sukses aksi iklan */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '26px', left: '50%', transform: 'translateX(-50%)', zIndex: 130 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '9px',
            padding: '10px 18px', background: 'var(--cd)', border: '1px solid var(--br)',
            borderRadius: '999px', boxShadow: 'var(--pop-shadow)', fontSize: '12.5px', fontWeight: 600, color: 'var(--t1)',
            animation: 'wdSlideUp 0.25s cubic-bezier(0.4,0,0.2,1)', whiteSpace: 'nowrap',
          }}>
            <Check size={14} color="#10b981" strokeWidth={3} />
            {toast}
          </div>
        </div>
      )}

      {/* Popup detail campaign: konten iklan (kiri) + performa & platform (kanan) */}
      {selectedCampaign && (
        <CampaignModal
          campaign={selectedCampaign}
          query={isCustom && customSince && customUntil
            ? `since=${customSince}&until=${customUntil}`
            : `date_preset=${dateOpt.value}`}
          periodLabel={filterLabel()}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}

