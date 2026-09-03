'use client';
import { useState, useEffect } from 'react';
import { X, UserPlus, FileText, Globe, MessageCircle } from 'lucide-react';
import CountUp from './CountUp';

const GREEN = '#2FB673';

/* Popup rincian Leads — dibuka dari kartu KPI "Leads" di dashboard.
   Angka di sini SELALU berjumlah sama dengan angka di kartu (sumbernya
   campaign CONVERSION yang sama), supaya tidak terlihat pincang. */
export default function LeadsBreakdownModal({ breakdown, periodLabel, onClose }) {
  const [closing, setClosing] = useState(false);

  function close() {
    setClosing(true);
    setTimeout(onClose, 200);   // = durasi wdFadeOut / wdSlideDown
  }
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const b     = breakdown || { instant: 0, web: 0, wa: 0, total: 0 };
  const total = b.total || 0;
  const rows  = [
    { label: 'Instant Form', hint: 'Meta lead form',        icon: FileText,      value: b.instant || 0 },
    { label: 'Website Form', hint: 'Form on our website',   icon: Globe,         value: b.web     || 0 },
    { label: 'WhatsApp',     hint: 'Click-to-WhatsApp ads',  icon: MessageCircle, value: b.wa      || 0 },
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
        width: 'min(420px, 92vw)', maxHeight: '90vh',
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
          padding: '16px 20px', borderBottom: '1px solid var(--br)', background: 'var(--sf)',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <span style={{
            width: '36px', height: '36px', borderRadius: '11px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: GREEN + '22',
          }}>
            <UserPlus size={18} color={GREEN} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>
              Leads Breakdown
            </span>
            <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--t3)', marginTop: '2px' }}>
              {periodLabel || 'Selected period'}
            </span>
          </span>
          <button
            onClick={close}
            aria-label="Close"
            style={{
              width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
              border: '1px solid var(--br)', background: 'var(--cd)', color: 'var(--t2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Total ── */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--br)' }}>
          <div style={{ fontSize: '11px', color: 'var(--t3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Total Leads
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--t1)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            <CountUp value={total} display={total.toLocaleString('id-ID')} delay={80} />
          </div>
        </div>

        {/* ── Rincian per sumber ── */}
        <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map((r, i) => {
            const pct  = total > 0 ? (r.value / total) * 100 : 0;
            const zero = !r.value;
            return (
              <div key={r.label} style={{ animation: 'wdFadeUp 0.36s cubic-bezier(0.4,0,0.2,1) ' + (120 + i * 60) + 'ms backwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '9px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: zero ? 'var(--sf)' : GREEN + '1A',
                  }}>
                    <r.icon size={14} color={zero ? 'var(--t3)' : GREEN} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: zero ? 'var(--t3)' : 'var(--t1)' }}>
                      {r.label}
                    </span>
                    <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--t3)', marginTop: '1px' }}>
                      {r.hint}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{
                      display: 'block', fontSize: '15px', fontWeight: 700,
                      color: zero ? 'var(--t3)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {r.value.toLocaleString('id-ID')}
                    </span>
                    <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>
                      {pct.toFixed(1)}%
                    </span>
                  </span>
                </div>
                {/* share bar — pola sama dgn CombineModal/CampaignModal: tumbuh via
                    transform scaleX (wdGrowX), BUKAN transisi width (bikin layout thrash) */}
                <div style={{ height: '4px', borderRadius: '3px', background: 'var(--track)', marginTop: '7px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: pct + '%', borderRadius: '3px',
                    background: zero ? 'transparent' : GREEN, transformOrigin: 'left',
                    animation: 'wdGrowX 0.6s cubic-bezier(0.4,0,0.2,1) ' + (0.2 + i * 0.08) + 's backwards',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
