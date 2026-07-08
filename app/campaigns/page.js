'use client';
import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Moon, Sun } from 'lucide-react';
import { useCampaignsFilter, DATE_PRESETS_CAMPAIGNS } from '../components/DateFilterContext';
import { useAuth } from '../components/AuthContext';

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

function getLeads(actions) {
  return getActionValue(actions, ['lead', 'onsite_conversion.lead_grouped']);
}

function getLinkClicks(actions) {
  return getActionValue(actions, ['link_click']);
}

function getResult(campaign, insights) {
  const name = campaign.name?.toUpperCase() || '';
  const actions = insights?.actions || [];
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

export default function CampaignsPage() {
  const { dateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, selectPreset, applyCustom } = useCampaignsFilter();
  const [showDropdown, setShowDropdown]   = useState(false);
  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [showSubtotal, setShowSubtotal]   = useState({ Awareness: false, Traffic: false, Conversion: false });

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
      const res  = await fetch(url);
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

  const allCampaigns = data?.campaigns || [];

  // Tampilkan semua campaign yang punya data di periode ini (spend/reach/impressions > 0)
  const campaignsWithData = allCampaigns.filter(c => {
    const ci = c.insights?.data?.[0];
    if (!ci) return false;
    return parseFloat(ci.spend || 0) > 0 || parseFloat(ci.reach || 0) > 0 || parseFloat(ci.impressions || 0) > 0;
  });

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

  // Gabungkan per grup: aktif di atas, non-aktif di bawah
  const mergedGrouped = {};
  OBJ_ORDER.forEach(grp => {
    const active = (groupCampaigns(activeCampaigns)[grp] || []);
    const inactive = (groupCampaigns(inactiveCampaigns)[grp] || []);
    if (active.length || inactive.length) mergedGrouped[grp] = [...active, ...inactive];
  });

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
        style={{
          borderTop: '1px solid var(--br)',
          opacity: 1,
          transition: 'background 0.15s',
          animation: `wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1) ${rowIdx * 0.04}s backwards`,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <td style={{ ...tdStyle('left'), fontWeight: '500', color: 'var(--t1)' }}>{c.name}</td>
        <td style={tdStyle('center')}>
          {isActive ? (
            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(16,185,129,0.14)', color: '#10b981', fontWeight: '600', whiteSpace: 'nowrap' }}>▶ Active</span>
          ) : (
            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(115,115,115,0.12)', color: 'var(--t3)', fontWeight: '600', whiteSpace: 'nowrap' }}>■ {c.status === 'PAUSED' ? 'Stop' : 'Ended'}</span>
          )}
        </td>
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
        <td colSpan={12} style={{ padding: '6px 14px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', background: OBJ_STYLE[grp]?.bg || 'var(--sf)', color: OBJ_STYLE[grp]?.color || 'var(--t2)' }}>{grp}</span>
            {rows.length} campaign{rows.length > 1 ? 's' : ''}
          </span>
        </td>
      </tr>,

      ...rows.map((c, i) => renderCampaignRow(c, i)),

      isActive && showSubtotal[grp] && (
        <tr key={key + '-sub'} style={{ borderTop: '0.5px solid var(--br)', background: 'var(--sf)' }}>
          <td colSpan={2} style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--t1)', fontSize: '11px', fontStyle: 'italic' }}>Subtotal {grp}</td>
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
          <td colSpan={12} style={{ padding: '4px 14px', textAlign: 'center' }}>
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

  return (
    <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', animation: 'wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--t1)' }}>Campaign Performance</div>
          <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>
            {loading ? 'Loading...' : `${campaignsWithData.length} campaigns · ${activeCampaigns.length} active · ${inactiveCampaigns.length} non-active · ${filterLabel()}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

          {showDropdown && (() => {
            const rd = new Date(calY, calM + 1, 1);       // bulan kanan = bulan kiri + 1
            const rY = rd.getFullYear(), rM = rd.getMonth();
            const navBtn = {
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--br)', borderRadius: '8px', background: 'transparent',
              cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s',
            };
            const rangeReady = customSince && customUntil;
            return (
            <div style={{
              position: 'absolute', top: '44px', right: 0, zIndex: 50,
              background: 'var(--cd)', border: '1px solid var(--br)',
              borderRadius: '14px', boxShadow: 'var(--pop-shadow)', overflow: 'hidden',
              animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ display: 'flex' }}>
                {/* ── Presets kiri ── */}
                <div style={{ width: '178px', borderRight: '1px solid var(--br)', padding: '10px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  {DATE_PRESETS_CAMPAIGNS.map(opt => {
                    const active = !isCustom && opt.value === dateOpt.value;
                    return (
                      <div key={opt.value} onClick={() => handleSelectPreset(opt)} style={{
                        padding: '9px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '8px',
                        color: active ? 'var(--cal-accent-line)' : 'var(--t2)',
                        background: active ? 'var(--cal-accent-soft)' : 'transparent',
                        fontWeight: active ? 600 : 400, transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover)'; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >{opt.label}</div>
                    );
                  })}
                  <div style={{ borderTop: '1px solid var(--br)', margin: '8px 4px 0' }} />
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', color: 'var(--t3)', textTransform: 'uppercase', padding: '12px 8px 8px' }}>Custom Range</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px',
                    border: `1px solid ${isCustom ? 'var(--cal-accent-line)' : 'var(--br)'}`, background: 'var(--data-bg)' }}>
                    <Calendar size={15} color="var(--t2)" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '12px', lineHeight: 1.55 }}>
                      <div style={{ color: customSince ? 'var(--t1)' : 'var(--t3)' }}>{fmtNice(customSince)}</div>
                      <div style={{ color: customUntil ? 'var(--t1)' : 'var(--t3)' }}>{fmtNice(customUntil)}</div>
                    </div>
                  </div>
                </div>

                {/* ── Kalender kanan ── */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <button onClick={() => shiftCal(-1)} style={navBtn}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <ChevronLeft size={17} color="var(--t2)" />
                    </button>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                      {CAL_MON[calM]} <span style={{ color: 'var(--t2)', fontWeight: 400 }}>{calY}</span>
                    </div>
                    <div style={{ width: '16px', flexShrink: 0 }} />
                    <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                      {CAL_MON[rM]} <span style={{ color: 'var(--t2)', fontWeight: 400 }}>{rY}</span>
                    </div>
                    <button onClick={() => shiftCal(1)} style={navBtn}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <ChevronRight size={17} color="var(--t2)" />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {renderMonth(calY, calM)}
                    {renderMonth(rY, rM)}
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderTop: '1px solid var(--br)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: customSince ? 'var(--t1)' : 'var(--t3)' }}>
                  {customSince ? `${fmtNice(customSince)}${customUntil ? '  –  ' + fmtNice(customUntil) : ''}` : 'Select a date range'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowDropdown(false)} style={{
                    padding: '8px 18px', fontSize: '13px', fontWeight: 500, borderRadius: '9px',
                    border: '1px solid var(--br)', background: 'transparent', color: 'var(--t1)', cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >Cancel</button>
                  <button onClick={applyCustomRange} disabled={!rangeReady} style={{
                    padding: '8px 22px', fontSize: '13px', fontWeight: 600, borderRadius: '9px', border: 'none',
                    background: rangeReady ? 'var(--cal-accent)' : 'var(--hover)',
                    color:      rangeReady ? 'var(--cal-accent-fg)' : 'var(--t3)',
                    cursor:     rangeReady ? 'pointer' : 'default',
                  }}>Apply</button>
                </div>
              </div>
            </div>
            );
          })()}
          </div>

          <button onClick={refresh} title="Refresh" style={{
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px', cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--t3)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}
          >
            <RefreshCw size={14} color="var(--t2)" style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
          </button>

          <ThemeToggle />
        </div>
      </div>

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
        <div style={{ background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '10px', overflow: 'hidden', animation: 'wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1) 0.05s backwards' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--sf)' }}>
                  <th style={thStyle('left')}>Campaign</th>
                  <th style={thStyle('center')}>Status</th>
                  <th style={thStyle()}>Daily Budget</th>
                  <th style={thStyle()}>Result</th>
                  <th style={thStyle()}>Reach</th>
                  <th style={thStyle()}>Impressions</th>
                  <th style={thStyle()}>Traffic</th>
                  <th style={thStyle()}>Leads</th>
                  <th style={thStyle()}>CPM</th>
                  <th style={thStyle()}>CPC</th>
                  <th style={thStyle()}>CPL</th>
                  <th style={thStyle()}>Total Spend</th>
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
                    <tr><td colSpan={12} style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
                      No campaign data for {dateOpt.label}
                    </td></tr>
                  )
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Theme toggle (role-aware, dikelola AuthContext) ─── */
function ThemeToggle() {
  const { theme, toggleTheme } = useAuth();
  const dark = theme !== 'light';
  return (
    <button onClick={toggleTheme} title={dark ? 'Switch to light' : 'Switch to dark'} style={{
      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '9px', cursor: 'pointer',
      transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--t3)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}
    >
      {dark ? <Moon size={14} color="var(--t2)"/> : <Sun size={14} color="#f59e0b"/>}
    </button>
  );
}
