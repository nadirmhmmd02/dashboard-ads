'use client';
import { useState, useEffect } from 'react';

const dateOptions = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 3 days', value: 'last_3d' },
  { label: 'Last 7 days', value: 'last_7d' },
  { label: 'Last 14 days', value: 'last_14d' },
  { label: 'Last 30 days', value: 'last_30d' },
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
];

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
  const [selectedDate, setSelectedDate] = useState(dateOptions[6]); // this_month
  const [showDropdown, setShowDropdown] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSubtotal, setShowSubtotal] = useState({ Awareness: true, Traffic: true, Conversion: true });
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => { fetchData(); }, [selectedDate]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta?date_preset=${selectedDate.value}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function toggleSubtotal(grp) {
    setShowSubtotal(prev => ({ ...prev, [grp]: !prev[grp] }));
  }

  const allCampaigns = data?.campaigns || [];
  const activeCampaigns = allCampaigns.filter(c => c.status === 'ACTIVE');
  const inactiveCampaigns = allCampaigns.filter(c => c.status !== 'ACTIVE');

  const groupCampaigns = (list) =>
    list.reduce((acc, c) => {
      const grp = OBJ_GROUP[c.objective] || 'Awareness';
      if (!acc[grp]) acc[grp] = [];
      acc[grp].push(c);
      return acc;
    }, {});

  const activeGrouped = groupCampaigns(activeCampaigns);
  const inactiveGrouped = groupCampaigns(inactiveCampaigns);

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

  function renderCampaignRow(c, isActive) {
    const ci = c.insights?.data?.[0] || {};
    const cLeads = getLeads(ci.actions);
    const cLinkClicks = getLinkClicks(ci.actions);
    const cCPM = parseFloat(ci.impressions || 0) > 0 ? (parseFloat(ci.spend || 0) / parseFloat(ci.impressions)) * 1000 : null;
    const cCPC = cLinkClicks > 0 ? parseFloat(ci.spend || 0) / cLinkClicks : null;
    const cCPL = cLeads > 0 ? parseFloat(ci.spend || 0) / cLeads : null;
    const result = getResult(c, ci);

    return (
      <tr key={c.id} style={{ borderTop: '0.5px solid var(--br)', opacity: isActive ? 1 : 0.55 }}>
        <td style={{ ...tdStyle('left'), fontWeight: '500', color: 'var(--t1)' }}>{c.name}</td>
        <td style={tdStyle('center')}>
          {isActive ? (
            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(16,185,129,0.14)', color: '#10b981', fontWeight: '500', whiteSpace: 'nowrap' }}>▶ Active</span>
          ) : (
            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(115,115,115,0.14)', color: 'var(--t3)', fontWeight: '500', whiteSpace: 'nowrap' }}>■ {c.status === 'PAUSED' ? 'Paused' : 'Ended'}</span>
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
      </tr>
    );
  }

  function renderGroup(grp, rows, isActive) {
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
        <td colSpan={11} style={{ padding: '6px 14px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', background: OBJ_STYLE[grp]?.bg || 'var(--sf)', color: OBJ_STYLE[grp]?.color || 'var(--t2)' }}>{grp}</span>
            {rows.length} campaign{rows.length > 1 ? 's' : ''}
          </span>
        </td>
      </tr>,

      ...rows.map(c => renderCampaignRow(c, isActive)),

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
        </tr>
      ),

      isActive && (
        <tr key={key + '-toggle'} style={{ borderTop: '0.5px solid var(--br)', background: 'var(--sf)' }}>
          <td colSpan={11} style={{ padding: '4px 14px', textAlign: 'center' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--t1)' }}>Campaign Performance</div>
          <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>
            {loading ? 'Loading...' : `${activeCampaigns.length} active · ${inactiveCampaigns.length} inactive`}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 12px', fontSize: '13px', border: '1px solid var(--br)', borderRadius: '8px', background: 'var(--cd)', color: 'var(--t1)', cursor: 'pointer' }}>
            📅 {selectedDate.label} ▾
          </button>
          {showDropdown && (
            <div style={{ position: 'absolute', top: '38px', right: 0, zIndex: 50, background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '8px', overflow: 'hidden', minWidth: '160px' }}>
              {dateOptions.map(opt => (
                <div key={opt.value}
                  onClick={() => { setSelectedDate(opt); setShowDropdown(false); }}
                  style={{ padding: '9px 14px', fontSize: '13px', cursor: 'pointer', color: opt.value === selectedDate.value ? 'var(--ac)' : 'var(--t2)', background: opt.value === selectedDate.value ? 'var(--sf)' : 'transparent' }}>
                  {opt.label}
                </div>
              ))}
            </div>
          )}
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
        <div style={{ background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '10px', overflow: 'hidden' }}>
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
                </tr>
              </thead>
              <tbody>
                {/* ── ACTIVE CAMPAIGNS ── */}
                {activeCampaigns.length > 0 && OBJ_ORDER.map(grp => renderGroup(grp, activeGrouped[grp] || [], true))}

                {activeCampaigns.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>No active campaigns</td></tr>
                )}

                {/* ── DIVIDER + INACTIVE TOGGLE ── */}
                {inactiveCampaigns.length > 0 && (
                  <tr style={{ background: '#1a1a1a' }}>
                    <td colSpan={11} style={{ padding: '8px 14px' }}>
                      <button
                        onClick={() => setShowInactive(v => !v)}
                        style={{ fontSize: '11px', color: 'var(--t3)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px' }}>{showInactive ? '▲' : '▼'}</span>
                        {showInactive ? 'Hide' : 'Show'} inactive campaigns ({inactiveCampaigns.length})
                      </button>
                    </td>
                  </tr>
                )}

                {/* ── INACTIVE CAMPAIGNS ── */}
                {showInactive && inactiveCampaigns.length > 0 && OBJ_ORDER.map(grp => renderGroup(grp, inactiveGrouped[grp] || [], false))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
