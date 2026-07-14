'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, Calendar, ChevronDown, RefreshCw,
  TrendingUp, TrendingDown, TriangleAlert, Award, Activity,
  Zap, Target, Wallet, BadgeCheck, CircleAlert, Crosshair,
} from 'lucide-react';
import CountUp from '../components/CountUp';
import useIsMobile from '../components/useIsMobile';
import DateFilterPopup from '../components/DateFilterPopup';
import { useReportsFilter, DATE_PRESETS_DASHBOARD } from '../components/DateFilterContext';
import { TYPE } from '../components/typography';
import { buildAnalysis, fmtRp, fmtNum, fmtPct } from '../components/insightEngine';

/* ─────────────────────────────────────────────────────────────
   ANALYTICS & INSIGHTS — WILL OF D
   Insight otomatis dari data Meta Ads yang sedang berjalan.
   Analisis dihitung insightEngine.js (rule-based dari data real);
   struktur siap di-upgrade ke narasi LLM nanti.
   Route tetap /reports. Logika fetch = mode=dashboard (sama
   dengan halaman Dashboard) — JANGAN diubah.
   ───────────────────────────────────────────────────────────── */

const BG     = 'var(--pg)';
const CARD   = 'var(--cd)';
const BORDER = 'var(--br)';
const TXT    = 'var(--t1)';
const SUB    = 'var(--t2)';
const MUTE   = 'var(--t3)';

const CARD_BASE = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '18px',
  boxShadow: 'var(--shadow)',
};

/* Severity → warna semantik (positif ikut var tema: hijau dark / hijau emerald light) */
const SEV = {
  critical: { color: '#EF4444',     soft: 'rgba(239,68,68,0.12)',  fg: '#EF4444',          label: 'Critical' },
  warning:  { color: '#F59E0B',     soft: 'rgba(245,158,11,0.14)', fg: '#B45309',          label: 'Warning'  },
  positive: { color: 'var(--pos)',  soft: 'var(--pos-soft)',       fg: 'var(--accent-fg)', label: 'Positive' },
  info:     { color: '#3B82F6',     soft: 'rgba(59,130,246,0.13)', fg: '#3B82F6',          label: 'Info'     },
};

const ICONS = {
  TrendingUp, TrendingDown, TriangleAlert, Award, Activity,
  Zap, Target, Wallet, BadgeCheck, CircleAlert, Crosshair,
};

/* ─── Mini sparkline (pola sama dengan dashboard) ─── */
function Spark({ data, color, h = 26 }) {
  const pts = (data || []).filter(v => v != null && v >= 0);
  if (pts.length < 2) return null;
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
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" style={{ opacity: 0.75 }} />
    </svg>
  );
}

/* ─── Delta badge kecil (pola Badge dashboard) ─── */
function Delta({ pct, invert = false }) {
  if (pct == null) return null;
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
      background: good ? 'var(--pos-soft)' : 'var(--neg-soft)',
      color: good ? 'var(--accent-fg)' : '#EF4444',
    }}>
      <span style={{ fontSize: '8px' }}>{pct >= 0 ? '▲' : '▼'}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/* ─── Gauge skor (ring SVG, animasi via transition dashoffset) ─── */
function ScoreGauge({ score, size = 132 }) {
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProg(score), 150);
    return () => clearTimeout(t);
  }, [score]);
  const R = 56, C = 2 * Math.PI * R;
  const color = score >= 68 ? 'var(--pos)' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 132 132" style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
        <circle cx="66" cy="66" r={R} fill="none" stroke="var(--track)" strokeWidth="11" />
        <circle cx="66" cy="66" r={R} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (prog / 100) * C}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '32px', fontWeight: 700, color: TXT, letterSpacing: '-1px', lineHeight: 1 }}>
          <CountUp value={score} display={String(score)} delay={150} />
        </div>
        <div style={{ ...TYPE.caption, marginTop: '3px' }}>/ 100</div>
      </div>
    </div>
  );
}

/* ─── Kartu insight ─── */
function InsightCard({ insight, index }) {
  const [hover, setHover] = useState(false);
  const sev = SEV[insight.severity];
  const Icon = ICONS[insight.icon] || Sparkles;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...CARD_BASE,
        borderColor: hover ? 'var(--br-strong)' : BORDER,
        padding: '18px',
        display: 'flex', flexDirection: 'column', gap: '12px',
        animation: `wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) ${120 + index * 60}ms backwards`,
        transition: 'border-color 0.2s',
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
          background: sev.soft, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={17} color={sev.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: TXT, lineHeight: 1.3 }}>{insight.title}</div>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
          color: sev.fg, background: sev.soft, padding: '3px 8px', borderRadius: '999px', flexShrink: 0,
        }}>{sev.label}</span>
      </div>

      {/* body */}
      <div style={{ fontSize: '12.5px', color: SUB, lineHeight: 1.65 }}>{insight.body}</div>

      {/* chips */}
      {insight.chips?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {insight.chips.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: '6px',
              padding: '6px 10px', borderRadius: '8px',
              background: 'var(--data-bg)', border: '1px solid var(--data-br)',
            }}>
              <span style={{ fontSize: '10.5px', color: MUTE }}>{c.label}</span>
              <span style={{
                fontSize: '12.5px', fontWeight: 600,
                color: c.tone === 'pos' ? 'var(--accent-fg)' : c.tone === 'neg' ? '#EF4444' : TXT,
              }}>{c.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* sparkline */}
      {insight.spark && (
        <div style={{ marginTop: 'auto' }}>
          <Spark data={insight.spark} color={sev.color} />
        </div>
      )}
    </div>
  );
}

/* ═══ MAIN ═══ */
export default function ReportsPage() {
  const isMobile = useIsMobile();
  const { dateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, selectPreset, applyCustom } = useReportsFilter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [analysis, setAnalysis]   = useState(null);

  // Bulan kiri kalender (UI only) — default: bulan lalu + bulan ini
  const _initCal = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const [calY, setCalY] = useState(_initCal.getFullYear());
  const [calM, setCalM] = useState(_initCal.getMonth());

  // Slot top bar mobile — refresh pindah ke atas via portal
  const [topbarSlot, setTopbarSlot] = useState(null);
  useEffect(() => {
    setTopbarSlot(isMobile ? document.getElementById('wd-topbar-actions') : null);
  }, [isMobile]);

  useEffect(() => { if (!isCustom) fetchData(); }, [dateOpt, isCustom]);
  // Restore custom range yang persist di context saat balik ke tab ini
  useEffect(() => { if (isCustom && customSince && customUntil) fetchData(customSince, customUntil); }, []);

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
      setAnalysis(buildAnalysis(json));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function refresh() {
    if (isCustom && customSince && customUntil) fetchData(customSince, customUntil);
    else fetchData();
  }

  // ── Handler filter (pola sama dengan Dashboard) ──
  function openFilter() {
    const next = !showDropdown;
    if (next && customSince) {
      const p = customSince.split('-');
      setCalY(+p[0]); setCalM(+p[1] - 1);
    }
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
  function filterLabel() {
    if (isCustom && customSince && customUntil) {
      const fmt = d => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
      return `${fmt(customSince)} – ${fmt(customUntil)}`;
    }
    return dateOpt.label;
  }

  const refreshButton = (
    <button onClick={refresh} title="Refresh" style={{
      width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: isMobile ? '9px' : '10px',
      cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--br-strong)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
    >
      <RefreshCw size={15} color={SUB} style={loading ? { animation: 'wdSpin 0.8s linear infinite' } : undefined} />
    </button>
  );

  const m = analysis?.metrics;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: BG }}>

      {/* ══ HEADER ══ */}
      <header style={ isMobile ? {
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px',
        padding: '14px 16px', flexShrink: 0, borderBottom: `1px solid ${BORDER}`,
      } : {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '72px', flexShrink: 0, borderBottom: `1px solid ${BORDER}`,
      }}>
        <div>
          <h1 style={{ ...TYPE.h1, ...(isMobile ? { fontSize: '20px' } : null) }}>Analytics &amp; Insights</h1>
          <p style={{ ...TYPE.small, marginTop: '3px' }}>
            {loading ? 'Analyzing…' : analysis
              ? `${analysis.insights.length} insights · ${analysis.campaignCount} campaigns analyzed · ${filterLabel()}`
              : 'Auto-generated from Meta Ads data'}
          </p>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px',
          justifyContent: isMobile ? 'flex-end' : 'flex-start',
        }}>
          {/* Date filter (sama dengan Dashboard & Campaigns) */}
          <div style={{ position: 'relative' }} data-filter>
            <button onClick={openFilter} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 14px',
              background: CARD, border: `1px solid ${isCustom ? 'var(--cal-accent)' : BORDER}`,
              borderRadius: '10px', fontSize: '13px',
              color: TXT, cursor: 'pointer', transition: 'border-color 0.15s',
            }}>
              <Calendar size={14} color={SUB} />
              {filterLabel()}
              <ChevronDown size={13} color={SUB} />
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
                onShiftCal={shiftCal}
                onApply={applyCustomRange}
                onClose={() => setShowDropdown(false)}
              />
            )}
          </div>

          {!isMobile && refreshButton}
          {isMobile && topbarSlot && createPortal(refreshButton, topbarSlot)}
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: isMobile ? '16px' : '24px',
        display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px',
      }}>

        {loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              background: 'var(--cal-accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'wdPulseDot 1.6s ease-in-out infinite',
            }}>
              <Sparkles size={24} color="var(--cal-accent-line)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ ...TYPE.h4 }}>Analyzing your campaign data…</div>
              <div style={{ ...TYPE.caption, marginTop: '5px' }}>Reading Meta Ads performance · {filterLabel()}</div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#EF4444', fontSize: '12px' }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && analysis && (<>

          {/* ══ HERO: PERFORMANCE SCORE ══ */}
          <div style={{
            ...CARD_BASE, flexShrink: 0,
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center', gap: isMobile ? '18px' : '28px',
            padding: isMobile ? '22px 18px' : '22px 28px',
            animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards',
          }}>
            <ScoreGauge score={analysis.score.value} size={isMobile ? 120 : 132} />

            <div style={{ flex: 1, minWidth: 0, textAlign: isMobile ? 'center' : 'left' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 12px', borderRadius: '999px',
                background: SEV[analysis.score.value >= 68 ? 'positive' : analysis.score.value >= 50 ? 'warning' : 'critical'].soft,
                color:      SEV[analysis.score.value >= 68 ? 'positive' : analysis.score.value >= 50 ? 'warning' : 'critical'].fg,
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
              }}>
                <Sparkles size={12} />
                {analysis.score.label}
              </span>
              <div style={{ fontSize: isMobile ? '15px' : '16px', fontWeight: 600, color: TXT, lineHeight: 1.45, marginTop: '10px' }}>
                {analysis.score.verdict}
              </div>
              <div style={{ ...TYPE.caption, marginTop: '8px' }}>
                Performance score · auto-generated from your Meta Ads data · {filterLabel()} vs previous period
              </div>
            </div>

            {/* mini stats */}
            <div style={{
              display: 'flex', flexDirection: isMobile ? 'row' : 'column',
              gap: isMobile ? '10px' : '12px', flexShrink: 0,
              width: isMobile ? '100%' : 'auto',
              borderLeft: isMobile ? 'none' : `1px solid ${BORDER}`,
              borderTop:  isMobile ? `1px solid ${BORDER}` : 'none',
              paddingLeft: isMobile ? 0 : '28px',
              paddingTop:  isMobile ? '16px' : 0,
              justifyContent: isMobile ? 'space-between' : 'center',
            }}>
              {[
                { label: 'Leads',       value: fmtNum(m.leads),  pct: m.dLeads, invert: false },
                { label: 'Blended CPL', value: m.blCPL != null ? fmtRp(m.blCPL) : '—', pct: m.dCPL, invert: true },
                { label: 'Total Spend', value: fmtRp(m.spend),   pct: m.dSpend, invert: false },
              ].map(s => (
                <div key={s.label} style={{ minWidth: isMobile ? 0 : '150px', flex: isMobile ? 1 : 'none' }}>
                  <div style={{ ...TYPE.caption }}>{s.label}</div>
                  <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: 700, color: TXT, letterSpacing: '-0.3px', margin: '3px 0 4px' }}>{s.value}</div>
                  <Delta pct={s.pct} invert={s.invert} />
                </div>
              ))}
            </div>
          </div>

          {/* ══ INSIGHT CARDS ══ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginTop: '2px' }}>
            <span style={{ ...TYPE.cardTitle }}>Generated Insights</span>
            <span style={{
              ...TYPE.caption, padding: '3px 10px', borderRadius: '999px',
              background: 'var(--data-bg)', border: '1px solid var(--data-br)',
            }}>From live Meta Ads data</span>
          </div>

          {analysis.insights.length === 0 ? (
            <div style={{
              ...CARD_BASE, flexShrink: 0, padding: '36px 24px', textAlign: 'center',
              animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 120ms backwards',
            }}>
              <div style={{ ...TYPE.h4 }}>All quiet — no notable signals this period</div>
              <div style={{ ...TYPE.small, marginTop: '6px', color: MUTE }}>
                Metrics are stable compared to the previous period. Check back after a few days of new data.
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid', flexShrink: 0,
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px', paddingBottom: '8px',
            }}>
              {analysis.insights.map((ins, i) => (
                <InsightCard key={ins.id} insight={ins} index={i} />
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
