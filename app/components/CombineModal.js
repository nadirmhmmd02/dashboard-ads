'use client';
import { useState, useEffect } from 'react';
import { X, Calculator, Users, Eye, MousePointerClick, UserPlus, Gauge, Coins, Wallet, Banknote } from 'lucide-react';
import CountUp from './CountUp';

/* ─── Helpers metrik (mengikuti LOGIKA BISNIS METRIK final — jangan diubah) ─── */
function getActionValue(actions, types) {
  if (!actions) return null;
  for (const type of types) {
    const a = actions.find(x => x.action_type === type);
    if (a) return parseInt(a.value);
  }
  return null;
}
function getLeads(actions)      { return getActionValue(actions, ['lead', 'onsite_conversion.lead_grouped']); }
function getLinkClicks(actions) { return getActionValue(actions, ['link_click']); }

function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC')) return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}

function fmtNum(v) {
  if (!v && v !== 0) return '—';
  const n = parseFloat(v);
  if (!n) return '—';
  return n.toLocaleString('id-ID');
}
function fmtRpFull(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return 'Rp ' + Math.round(parseFloat(v)).toLocaleString('id-ID');
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
  Awareness:  { bg: 'rgba(91,127,212,0.14)', color: '#5b8fd4' },
  Traffic:    { bg: 'rgba(245,158,11,0.14)', color: '#f59e0b' },
  Conversion: { bg: 'rgba(16,185,129,0.14)', color: '#10b981' },
};

export default function CombineModal({ campaigns, periodLabel, onClose }) {
  const [closing, setClosing] = useState(false);

  function close() {
    setClosing(true);
    setTimeout(onClose, 200);   // = durasi wdSlideDown/wdFadeOut
  }
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Agregasi (ikut aturan dashboard):
     Spend/Reach/Impressions = semua campaign terpilih
     Traffic = hanya campaign TRAFFIC · Leads = hanya CONVERSION
     CPM = spend semua / impressions semua × 1000
     CPC = spend TRAFFIC / clicks TRAFFIC · CPL = spend CONVERSION / leads CONVERSION ── */
  const rows = campaigns.map(c => {
    const ci = c.insights?.data?.[0] || {};
    return {
      c, ci,
      type:   getCampaignType(c.name),
      spend:  parseFloat(ci.spend || 0),
      reach:  parseFloat(ci.reach || 0),
      impr:   parseFloat(ci.impressions || 0),
      clicks: getLinkClicks(ci.actions) || 0,
      leads:  getLeads(ci.actions) || 0,
      budget: c.daily_budget ? parseInt(c.daily_budget) : 0,
    };
  });

  const totalSpend  = rows.reduce((s, r) => s + r.spend, 0);
  const totalReach  = rows.reduce((s, r) => s + r.reach, 0);
  const totalImpr   = rows.reduce((s, r) => s + r.impr, 0);
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);

  const trafficRows  = rows.filter(r => r.type === 'TRAFFIC');
  const convRows     = rows.filter(r => r.type === 'CONVERSION');
  const totalTraffic = trafficRows.reduce((s, r) => s + r.clicks, 0);
  const totalLeads   = convRows.reduce((s, r) => s + r.leads, 0);
  const trafficSpend = trafficRows.reduce((s, r) => s + r.spend, 0);
  const convSpend    = convRows.reduce((s, r) => s + r.spend, 0);

  const cpm = totalImpr    > 0 ? (totalSpend / totalImpr) * 1000 : null;
  const cpc = totalTraffic > 0 ? trafficSpend / totalTraffic : null;
  const cpl = totalLeads   > 0 ? convSpend / totalLeads : null;

  /* ── Styles (sama dengan CampaignModal biar konsisten) ── */
  const sectionLabel = {
    fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase',
    color: 'var(--t3)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '7px',
  };
  const accentDash = <span style={{ width: '14px', height: '2px', borderRadius: '1px', background: 'var(--cal-accent)', display: 'inline-block' }} />;
  const tile = (delay = 0) => ({
    background: 'var(--data-bg)', border: '1px solid var(--data-br)', borderRadius: '10px',
    padding: '11px 13px', animation: `wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1) ${delay}s backwards`,
  });
  const tileLabel = { fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' };
  const tileValue = { fontSize: '15px', fontWeight: 600, color: 'var(--t1)' };
  const liftOn  = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--cal-accent-line)'; e.currentTarget.style.boxShadow = '0 4px 14px var(--cal-glow)'; };
  const liftOff = (e) => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.borderColor = 'var(--data-br)';         e.currentTarget.style.boxShadow = 'none'; };

  const deliveryTiles = [
    { label: 'Reach',       Icon: Users,             raw: totalReach,   display: fmtNum(totalReach) },
    { label: 'Impressions', Icon: Eye,               raw: totalImpr,    display: fmtNum(totalImpr) },
    { label: 'Traffic',     Icon: MousePointerClick, raw: totalTraffic, display: totalTraffic > 0 ? fmtNum(totalTraffic) : '—' },
    { label: 'Leads',       Icon: UserPlus,          raw: totalLeads,   display: totalLeads > 0 ? fmtNum(totalLeads) : '—' },
  ];
  const costTiles = [
    { label: 'CPM',          Icon: Gauge,    raw: cpm,         display: fmtRpFull(cpm) },
    { label: 'CPC',          Icon: Coins,    raw: cpc,         display: fmtRpFull(cpc) },
    { label: 'CPL',          Icon: Wallet,   raw: cpl,         display: fmtRpFull(cpl) },
    { label: 'Daily Budget', Icon: Banknote, raw: totalBudget, display: totalBudget > 0 ? fmtRpFull(totalBudget) : '—' },
  ];

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5,7,10,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px',
        animation: closing ? 'wdFadeOut 0.2s ease forwards' : 'wdFadeIn 0.2s ease',
      }}
    >
      <div style={{
        position: 'relative',
        width: 'min(680px, 92vw)', maxHeight: 'min(660px, 90vh)',
        background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '18px',
        boxShadow: 'var(--pop-shadow)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: closing
          ? 'wdSlideDown 0.2s cubic-bezier(0.4,0,0.2,1) forwards'
          : 'wdSlideUp 0.24s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* hairline aksen atas */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px', zIndex: 1,
          background: 'linear-gradient(90deg, transparent, var(--cal-accent), transparent)',
          transformOrigin: 'left', animation: 'wdGrowX 0.7s cubic-bezier(0.4,0,0.2,1) 0.15s backwards',
        }} />

        {/* ── Header ── */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid var(--br)', background: 'var(--sf)',
          display: 'flex', alignItems: 'center', gap: '13px', flexShrink: 0,
        }}>
          <span style={{
            width: '36px', height: '36px', borderRadius: '11px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
            boxShadow: '0 4px 14px var(--cal-glow)',
          }}>
            <Calculator size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--t1)' }}>Combined Performance</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>
              {campaigns.length} campaigns · {periodLabel}
            </div>
          </div>
          <button
            onClick={close}
            style={{
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--br)', borderRadius: '9px', background: 'transparent', cursor: 'pointer',
              transition: 'background 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={15} color="var(--t2)" />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>

          {/* HERO: Total Spend gabungan */}
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: '14px', border: '1px solid var(--cal-accent-soft)',
            background: 'linear-gradient(135deg, var(--cal-accent-soft) 0%, transparent 62%)',
            padding: '16px 18px', marginBottom: '14px',
            animation: 'wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1) 0.02s backwards',
          }}>
            <div style={{
              position: 'absolute', top: '-46px', right: '-46px', width: '150px', height: '150px',
              borderRadius: '50%', background: 'var(--cal-glow)', filter: 'blur(46px)', opacity: 0.55, pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...tileLabel, color: 'var(--cal-accent-line)', marginBottom: '2px' }}>Combined Total Spend</div>
                <div style={{ fontSize: '25px', fontWeight: 700, color: 'var(--t1)', lineHeight: 1.15 }}>
                  {totalSpend > 0 ? <CountUp value={totalSpend} display={fmtRpFull(totalSpend)} duration={800} delay={150} /> : fmtRpFull(totalSpend)}
                </div>
              </div>
              <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--br)', flexShrink: 0 }} />
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ ...tileLabel, marginBottom: '2px' }}>Campaigns</div>
                <div style={{ fontSize: '21px', fontWeight: 700, color: 'var(--cal-accent-line)', lineHeight: 1.2 }}>{campaigns.length}</div>
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '9px' }}>
            {deliveryTiles.map((m, i) => (
              <div key={m.label}
                onMouseEnter={liftOn} onMouseLeave={liftOff}
                style={{ ...tile(0.08 + i * 0.04), display: 'flex', alignItems: 'center', gap: '11px', transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s' }}>
                <span style={{
                  width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--cal-accent-soft)', color: 'var(--cal-accent-line)',
                }}>
                  <m.Icon size={15} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={tileLabel}>{m.label}</div>
                  <div style={tileValue}>
                    {m.raw > 0 ? <CountUp value={m.raw} display={m.display} duration={800} delay={200 + i * 60} /> : m.display}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cost efficiency */}
          <div style={{ ...sectionLabel, marginTop: '18px' }}>{accentDash}Cost Efficiency</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '9px' }}>
            {costTiles.map((m, i) => (
              <div key={m.label}
                onMouseEnter={liftOn} onMouseLeave={liftOff}
                style={{ ...tile(0.22 + i * 0.04), display: 'flex', alignItems: 'center', gap: '11px', transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s' }}>
                <span style={{
                  width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--hover)', color: 'var(--t2)',
                }}>
                  <m.Icon size={15} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={tileLabel}>{m.label}</div>
                  <div style={tileValue}>
                    {m.raw ? <CountUp value={m.raw} display={m.display} duration={800} delay={280 + i * 60} /> : m.display}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Campaign yang digabung */}
          <div style={{ ...sectionLabel, marginTop: '18px' }}>{accentDash}Included Campaigns</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((r, i) => {
              const grp   = OBJ_GROUP[r.c.objective] || 'Awareness';
              const gs    = OBJ_STYLE[grp];
              const share = totalSpend > 0 ? (r.spend / totalSpend) * 100 : 0;
              return (
                <div key={r.c.id} style={{ ...tile(0.36 + i * 0.05), padding: '11px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
                    <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 500, background: gs.bg, color: gs.color, flexShrink: 0 }}>{grp}</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--t1)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.c.name}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)', flexShrink: 0 }}>{fmtRpFull(r.spend)}</span>
                    <span style={{ fontSize: '10.5px', color: 'var(--t3)', width: '38px', textAlign: 'right', flexShrink: 0 }}>{share.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: '4px', borderRadius: '2px', background: 'var(--track)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${share}%`, height: '100%', borderRadius: '2px',
                      background: 'var(--cal-accent)', transformOrigin: 'left',
                      animation: `wdGrowX 0.6s cubic-bezier(0.4,0,0.2,1) ${0.4 + i * 0.08}s backwards`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
