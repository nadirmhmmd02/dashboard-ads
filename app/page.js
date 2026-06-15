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

function getLeads(actions) {
  if (!actions) return null;
  const a = actions.find(x => x.action_type === 'lead' || x.action_type === 'onsite_conversion.lead_grouped');
  return a ? parseInt(a.value) : null;
}

function getCPL(spend, leads) {
  if (!spend || !leads) return null;
  return parseFloat(spend) / leads;
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
  Awareness: { bg: 'rgba(91,127,212,0.14)', color: '#3A5FAD' },
  Traffic: { bg: 'rgba(242,168,48,0.14)', color: '#9A6800' },
  Conversion: { bg: 'rgba(61,170,106,0.14)', color: '#1E7A45' },
};

const OBJ_ORDER = ['Awareness', 'Traffic', 'Conversion'];

function SectionLabel({ color, text }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
      {text}
    </div>
  );
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(dateOptions[6]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const activeCampaigns = data?.campaigns?.filter(c => c.status === 'ACTIVE') || [];
  const insights = data?.insights?.[0] || {};

  const totalLeads = getLeads(insights.actions);
  const totalCPL = getCPL(insights.spend, totalLeads);

  const grouped = activeCampaigns.reduce((acc, c) => {
    const grp = OBJ_GROUP[c.objective] || 'Other';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(c);
    return acc;
  }, {});

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

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowDropdown(!showDropdown)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', border: '1.5px solid var(--bs)', borderRadius: '12px', background: 'var(--cd)', color: 'var(--t1)', cursor: 'pointer' }}>
            📅 {selectedDate.label} ▾
          </button>
          {showDropdown && (
            <div style={{ position: 'absolute', top: '42px', right: 0, zIndex: 50, background: 'var(--cd)', border: '1px solid var(--bs)', borderRadius: '12px', overflow: 'hidden', minWidth: '180px' }}>
              {dateOptions.map(opt => (
                <div key={opt.value} onClick={() => { setSelectedDate(opt); setShowDropdown(false); }}
                  style={{ padding: '10px 16px', fontSize: '13px', cursor: 'pointer', color: opt.value === selectedDate.value ? 'var(--ac)' : 'var(--t2)', fontWeight: opt.value === selectedDate.value ? '500' : '400', background: opt.value === selectedDate.value ? 'var(--sf)' : 'transparent' }}>
                  {opt.value === selectedDate.value ? '● ' : '○ '}{opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--t3)', fontSize: '14px' }}>
          ⏳ Loading data from Meta Ads...
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'rgba(220,50,50,0.1)', borderRadius: '12px', color: '#C62828', fontSize: '13px', marginBottom: '20px' }}>
          ⚠️ Error: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Breakdown per Platform */}
          <SectionLabel color="#1877F2" text="Breakdown by platform" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {/* Meta Ads Card */}
            <div style={{ background: 'var(--cd)', border: '0.5px solid var(--br)', borderRadius: '18px', padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: '500', color: 'var(--t1)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1877F2', display: 'inline-block' }}></span>
                  Meta Ads
                </div>
                <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '20px', background: 'var(--pr-bg)', color: 'var(--pr-tx)', fontWeight: '500' }}>
                  {activeCampaigns.length} active campaigns
                </span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: '500', color: 'var(--t1)', lineHeight: 1, marginBottom: '3px' }}>
                {fmtRp(insights.spend)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '14px' }}>
                Total budget spent · {selectedDate.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '0.5px solid var(--br)', paddingTop: '13px' }}>
                {[
                  ['CPM', fmtRp(insights.cpm)],
                  ['CPC', fmtRp(insights.cpc)],
                  ['CPL', fmtRp(totalCPL)],
                  ['Leads', totalLeads ?? '—'],
                ].map(([label, val], i) => (
                  <div key={label} style={{ textAlign: 'center', borderRight: i < 3 ? '0.5px solid var(--br)' : 'none' }}>
                    <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '3px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--t1)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Google Ads Card - placeholder */}
            <div style={{ background: 'var(--cd)', border: '0.5px solid var(--br)', borderRadius: '18px', padding: '18px 20px', opacity: 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: '500', color: 'var(--t1)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EA4335', display: 'inline-block' }}></span>
                  Google Ads
                </div>
                <span style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '20px', background: 'var(--pd-bg)', color: 'var(--pd-tx)', fontWeight: '500' }}>
                  Not connected
                </span>
              </div>
              <div style={{ fontSize: '30px', fontWeight: '500', color: 'var(--t1)', lineHeight: 1, marginBottom: '3px' }}>—</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '14px' }}>Total budget spent · {selectedDate.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '0.5px solid var(--br)', paddingTop: '13px' }}>
                {['CPM', 'CPC', 'CPL', 'Leads'].map((label, i) => (
                  <div key={label} style={{ textAlign: 'center', borderRight: i < 3 ? '0.5px solid var(--br)' : 'none' }}>
                    <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '3px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--t1)' }}>—</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ height: '0.5px', background: 'var(--br)', margin: '8px 0 20px' }}></div>

          {/* Overall Metrics */}
          <SectionLabel color="#1877F2" text={`Meta Ads overall metrics · ${selectedDate.label}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '24px' }}>
            {[
              ['Total Spend', fmtRp(insights.spend)],
              ['Reach', fmtNum(insights.reach)],
              ['Impressions', fmtNum(insights.impressions)],
              ['Traffic (Clicks)', fmtNum(insights.clicks)],
              ['Leads', totalLeads ?? '—'],
              ['CPM', fmtRp(insights.cpm)],
              ['CPC', fmtRp(insights.cpc)],
              ['CPL', fmtRp(totalCPL)],
              ['CTR', fmtPct(insights.ctr)],
              ['Total Leads', totalLeads ?? '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--sf)', borderRadius: '14px', padding: '14px 15px' }}>
                <div style={{ fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: '500', color: 'var(--t1)' }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ height: '0.5px', background: 'var(--br)', margin: '8px 0 20px' }}></div>

          {/* Campaign Performance Table */}
          <SectionLabel color="#1877F2" text={`Meta Ads campaign performance (${activeCampaigns.length} active campaigns)`} />
          <div style={{ background: 'var(--cd)', border: '0.5px solid var(--br)', borderRadius: '18px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--sf)' }}>
                    <th style={thStyle('left')}>Campaign</th>
                    <th style={thStyle('center')}>Status</th>
                    <th style={thStyle()}>Daily Budget</th>
                    <th style={thStyle()}>Impressions</th>
                    <th style={thStyle()}>Traffic</th>
                    <th style={thStyle()}>CTR</th>
                    <th style={thStyle()}>CPM</th>
                    <th style={thStyle()}>CPC</th>
                    <th style={thStyle()}>Leads</th>
                    <th style={thStyle()}>CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {OBJ_ORDER.map(grp => {
                    const rows = grouped[grp] || [];
                    if (!rows.length) return null;
                    const subtotalBudget = rows.reduce((s, c) => s + (c.daily_budget ? parseInt(c.daily_budget) : 0), 0);
                    return [
                      <tr key={grp + '-hdr'} style={{ background: 'var(--s2)' }}>
                        <td colSpan={10} style={{ padding: '6px 14px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', background: OBJ_STYLE[grp]?.bg, color: OBJ_STYLE[grp]?.color }}>{grp}</span>
                            {rows.length} campaign{rows.length > 1 ? 's' : ''}
                          </span>
                        </td>
                      </tr>,
                      ...rows.map(c => {
                        const ci = c.insights?.data?.[0] || {};
                        const cLeads = getLeads(ci.actions);
                        const cCPL = getCPL(ci.spend, cLeads);
                        return (
                          <tr key={c.id} style={{ borderTop: '0.5px solid var(--br)' }}>
                            <td style={{ ...tdStyle('left'), fontWeight: '500', color: 'var(--t1)' }}>{c.name}</td>
                            <td style={tdStyle('center')}>
                              <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'var(--pr-bg)', color: 'var(--pr-tx)', fontWeight: '500' }}>▶ Active</span>
                            </td>
                            <td style={tdStyle()}>{c.daily_budget ? fmtRp(parseInt(c.daily_budget)) : '—'}</td>
                            <td style={tdStyle()}>{fmtNum(ci.impressions)}</td>
                            <td style={tdStyle()}>{fmtNum(ci.clicks)}</td>
                            <td style={tdStyle()}>{fmtPct(ci.ctr)}</td>
                            <td style={tdStyle()}>{fmtRp(ci.cpm)}</td>
                            <td style={tdStyle()}>{fmtRp(ci.cpc)}</td>
                            <td style={tdStyle()}>{cLeads ?? '—'}</td>
                            <td style={tdStyle()}>{fmtRp(cCPL)}</td>
                          </tr>
                        );
                      }),
                      <tr key={grp + '-sub'} style={{ borderTop: '0.5px solid var(--br)', background: 'var(--sf)' }}>
                        <td colSpan={2} style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--t1)', fontSize: '11px', fontStyle: 'italic' }}>Subtotal {grp}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtRp(subtotalBudget)}</td>
                        <td colSpan={7}></td>
                      </tr>
                    ];
                  })}
                  <tr style={{ borderTop: '0.5px solid var(--br)', background: 'var(--s2)' }}>
                    <td colSpan={2} style={{ padding: '9px 12px', fontWeight: '600', color: 'var(--t1)' }}>Total</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: 'var(--t1)' }}>
                      {fmtRp(activeCampaigns.reduce((s, c) => s + (c.daily_budget ? parseInt(c.daily_budget) : 0), 0))}
                    </td>
                    <td colSpan={7}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}