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
  const [showSubtotal, setShowSubtotal] = useState(true);

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

  // Calculate metrics by campaign type
  const trafficCampaigns = activeCampaigns.filter(c => getCampaignType(c.name) === 'TRAFFIC');
  const conversionCampaigns = activeCampaigns.filter(c => getCampaignType(c.name) === 'CONVERSION');

  // Overall insights from API
  const apiInsights = data?.insights?.[0] || {};

  // Total spend all campaigns
  const totalSpend = parseFloat(apiInsights.spend || 0);

  // Reach & Impressions from all campaigns
  const totalReach = parseFloat(apiInsights.reach || 0);
  const totalImpressions = parseFloat(apiInsights.impressions || 0);

  // Traffic metrics - from traffic campaigns only
  const trafficSpend = trafficCampaigns.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
  const trafficClicks = trafficCampaigns.reduce((s, c) => {
    const clicks = getLinkClicks(c.insights?.data?.[0]?.actions);
    return s + (clicks || 0);
  }, 0);

  // Conversion metrics - from conversion campaigns only
  const conversionSpend = conversionCampaigns.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
  const conversionLeads = conversionCampaigns.reduce((s, c) => {
    const leads = getLeads(c.insights?.data?.[0]?.actions);
    return s + (leads || 0);
  }, 0);
  const conversionImpressions = conversionCampaigns.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
  const conversionClicks = conversionCampaigns.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.clicks || 0), 0);

  // Calculated metrics
  const calcCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null;
  const calcCPC = trafficClicks > 0 ? trafficSpend / trafficClicks : null;
  const calcCPL = conversionLeads > 0 ? conversionSpend / conversionLeads : null;
  const calcCTR = conversionImpressions > 0 ? (conversionClicks / conversionImpressions) * 100 : null;

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
                {fmtRp(totalSpend)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '14px' }}>
                Total budget spent · {selectedDate.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '0.5px solid var(--br)', paddingTop: '13px' }}>
                {[
                  ['CPM', fmtRp(calcCPM)],
                  ['CPC', fmtRp(calcCPC)],
                  ['CPL', fmtRp(calcCPL)],
                  ['Leads', conversionLeads || '—'],
                ].map(([label, val], i) => (
                  <div key={label} style={{ textAlign: 'center', borderRight: i < 3 ? '0.5px solid var(--br)' : 'none' }}>
                    <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '3px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--t1)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Google Ads Card */}
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
              ['Total Spend', fmtRp(totalSpend), 'All campaigns'],
              ['Reach', fmtNum(totalReach), 'All campaigns'],
              ['Impressions', fmtNum(totalImpressions), 'All campaigns'],
              ['Traffic', fmtNum(trafficClicks), 'Traffic campaigns only'],
              ['Leads', conversionLeads || '—', 'Conversion campaigns only'],
              ['CPM', fmtRp(calcCPM), 'Total spend / impressions'],
              ['CPC', fmtRp(calcCPC), 'Traffic spend / clicks'],
              ['CPL', fmtRp(calcCPL), 'Conversion spend / leads'],
              ['CTR', calcCTR ? fmtPct(calcCTR) : '—', 'Conversion campaigns only'],
              ['Total Leads', conversionLeads || '—', 'Conversion campaigns only'],
            ].map(([label, val, hint]) => (
              <div key={label} style={{ background: 'var(--sf)', borderRadius: '14px', padding: '14px 15px' }}>
                <div style={{ fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: '500', color: 'var(--t1)', marginBottom: '4px' }}>{val}</div>
                <div style={{ fontSize: '9px', color: 'var(--t3)', fontStyle: 'italic' }}>{hint}</div>
              </div>
            ))}
          </div>

          <div style={{ height: '0.5px', background: 'var(--br)', margin: '8px 0 20px' }}></div>

          {/* Campaign Performance Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <SectionLabel color="#1877F2" text={`Meta Ads campaign performance (${activeCampaigns.length} active campaigns)`} />
            <button
              onClick={() => setShowSubtotal(!showSubtotal)}
              style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--bs)', background: showSubtotal ? 'var(--ac)' : 'var(--cd)', color: showSubtotal ? '#fff' : 'var(--t2)', cursor: 'pointer', fontWeight: '500', marginBottom: '10px' }}>
              {showSubtotal ? '✓ Subtotal On' : 'Subtotal Off'}
            </button>
          </div>

          <div style={{ background: 'var(--cd)', border: '0.5px solid var(--br)', borderRadius: '18px', overflow: 'hidden', marginBottom: '20px' }}>
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
                  {OBJ_ORDER.map(grp => {
                    const rows = grouped[grp] || [];
                    if (!rows.length) return null;
                    const subtotalBudget = rows.reduce((s, c) => s + (c.daily_budget ? parseInt(c.daily_budget) : 0), 0);

                    return [
                      <tr key={grp + '-hdr'} style={{ background: 'var(--s2)' }}>
                        <td colSpan={11} style={{ padding: '6px 14px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: '500', background: OBJ_STYLE[grp]?.bg, color: OBJ_STYLE[grp]?.color }}>{grp}</span>
                            {rows.length} campaign{rows.length > 1 ? 's' : ''}
                          </span>
                        </td>
                      </tr>,
                      ...rows.map(c => {
                        const ci = c.insights?.data?.[0] || {};
                        const cLeads = getLeads(ci.actions);
                        const cLinkClicks = getLinkClicks(ci.actions);
                        const cCPM = ci.impressions > 0 ? (parseFloat(ci.spend || 0) / parseFloat(ci.impressions)) * 1000 : null;
                        const cCPC = cLinkClicks > 0 ? parseFloat(ci.spend || 0) / cLinkClicks : null;
                        const cCPL = cLeads > 0 ? parseFloat(ci.spend || 0) / cLeads : null;
                        const result = getResult(c, ci);

                        // Check if campaign is active but ended
                        const isEnded = ci.date_stop && new Date(ci.date_stop) < new Date();

                        return (
                          <tr key={c.id} style={{ borderTop: '0.5px solid var(--br)' }}>
                            <td style={{ ...tdStyle('left'), fontWeight: '500', color: 'var(--t1)' }}>{c.name}</td>
                            <td style={tdStyle('center')}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'var(--pr-bg)', color: 'var(--pr-tx)', fontWeight: '500', whiteSpace: 'nowrap' }}>▶ Active</span>
                                {isEnded && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '9px', background: 'var(--pd-bg)', color: 'var(--pd-tx)', fontWeight: '500', whiteSpace: 'nowrap' }}>Ended</span>}
                              </div>
                            </td>
                            <td style={tdStyle()}>{c.daily_budget ? fmtRp(parseInt(c.daily_budget)) : '—'}</td>
                            <td style={tdStyle()}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: '10px', color: 'var(--t3)' }}>{result.label}</span>
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
                      }),
                      showSubtotal && (
                        <tr key={grp + '-sub'} style={{ borderTop: '0.5px solid var(--br)', background: 'var(--sf)' }}>
                          <td colSpan={2} style={{ padding: '8px 12px', fontWeight: '600', color: 'var(--t1)', fontSize: '11px', fontStyle: 'italic' }}>Subtotal {grp}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--t1)', fontSize: '11px' }}>{fmtRp(subtotalBudget)}</td>
                          <td colSpan={8}></td>
                        </tr>
                      ),
                    ].filter(Boolean);
                  })}
                  <tr style={{ borderTop: '0.5px solid var(--br)', background: 'var(--s2)' }}>
                    <td colSpan={2} style={{ padding: '9px 12px', fontWeight: '600', color: 'var(--t1)' }}>Total</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: 'var(--t1)' }}>
                      {fmtRp(activeCampaigns.reduce((s, c) => s + (c.daily_budget ? parseInt(c.daily_budget) : 0), 0))}
                    </td>
                    <td colSpan={8}></td>
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