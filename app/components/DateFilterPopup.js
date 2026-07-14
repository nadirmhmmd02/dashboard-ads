'use client';

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { TYPE } from './typography';

/* ─────────────────────────────────────────────────────────────
   DATE FILTER POPUP — WILL OF D (versi compact, shared)
   Satu komponen untuk Dashboard, Campaigns, dan Analytics &
   Insights. MURNI TAMPILAN — semua state & logika filter tetap
   di halaman masing-masing (props callback). Elemen lengkap:
   preset kiri + custom range + kalender dual-month + footer.
   Desktop: popup anchored kanan. Mobile: bottom sheet.
   ───────────────────────────────────────────────────────────── */

const CAL_DOW = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const CAL_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TXT  = 'var(--t1)';
const SUB  = 'var(--t2)';
const MUTE = 'var(--t3)';
const BORDER = 'var(--br)';

function pad2(n) { return String(n).padStart(2, '0'); }
function toYMD(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function monthGrid(y, m) {
  const start = new Date(y, m, 1).getDay();
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

/* Ukuran kalender: compact (desktop) vs touch (mobile).
   Compact disetel "tengah-tengah" — antara versi lama (232/32/30)
   dan versi paling kecil (196/26/24), sesuai selera Nadir. */
const SIZES = {
  compact: { width: 217, cellH: 29, btn: 27, font: 12, dowFont: 10.5 },
  touch:   { width: 238, cellH: 33, btn: 31, font: 12.5, dowFont: 11 },
};

export default function DateFilterPopup({
  presets, dateOpt, isCustom, customSince, customUntil,
  calY, calM, isMobile,
  onSelectPreset, onPickDay, onShiftCal, onApply, onClose,
}) {
  const rangeReady = customSince && customUntil;

  function renderMonth(y, m, t) {
    const todayStr = toYMD(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    return (
      <div style={{ width: `${t.width}px` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: '1px' }}>
          {CAL_DOW.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: `${t.dowFont}px`, color: MUTE, paddingBottom: '5px' }}>{d}</div>
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
              <div key={i} style={{ position: 'relative', height: `${t.cellH}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(hasLeft || hasRight) && (
                  <span style={{ position: 'absolute', top: '2px', bottom: '2px',
                    left: hasLeft ? 0 : '50%', right: hasRight ? 0 : '50%',
                    background: 'var(--cal-range)' }} />
                )}
                {endpoint && (
                  <span style={{ position: 'absolute', width: `${t.btn}px`, height: `${t.btn}px`, borderRadius: '50%',
                    background: 'var(--cal-accent)', boxShadow: '0 2px 8px var(--cal-glow)' }} />
                )}
                <button onClick={() => onPickDay(ds)} style={{
                  position: 'relative', width: `${t.btn}px`, height: `${t.btn}px`, borderRadius: '50%',
                  border: isToday && !endpoint ? '1px solid var(--cal-accent-line)' : '1px solid transparent',
                  background: 'transparent', cursor: 'pointer', fontSize: `${t.font}px`, fontFamily: 'inherit',
                  fontWeight: endpoint ? 700 : 400,
                  color: endpoint ? 'var(--cal-accent-fg)' : isToday ? 'var(--cal-accent-line)' : inRange ? TXT : SUB,
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

  /* ══ MOBILE: bottom sheet ══ */
  if (isMobile) {
    return (
      <>
        <div style={{
          position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.45)',
          animation: 'wdFadeIn 0.2s ease',
        }} />
        <div data-filter data-filter-dropdown style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 96,
          background: 'var(--cd)', borderTop: `1px solid ${BORDER}`,
          borderRadius: '18px 18px 0 0', boxShadow: 'var(--pop-shadow)',
          maxHeight: '88vh', overflowY: 'auto',
          padding: '6px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          animation: 'wdSheetUp 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--br-strong)', margin: '8px auto 14px' }} />

          <div style={{ ...TYPE.overline, padding: '0 2px 8px' }}>Quick Select</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {presets.map(opt => {
              const active = !isCustom && opt.value === dateOpt.value;
              return (
                <button key={opt.value} onClick={() => onSelectPreset(opt)} style={{
                  padding: '8px 13px', borderRadius: '999px', fontSize: '12.5px', fontFamily: 'inherit',
                  fontWeight: active ? 600 : 400, cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--cal-accent-line)' : BORDER}`,
                  background: active ? 'var(--cal-accent-soft)' : 'transparent',
                  color: active ? 'var(--cal-accent-line)' : SUB,
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}>{opt.label}</button>
              );
            })}
          </div>

          <div style={{ ...TYPE.overline, padding: '0 2px 8px' }}>Custom Range</div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <button onClick={() => onShiftCal(-1)} style={{
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${BORDER}`, borderRadius: '9px', background: 'transparent', cursor: 'pointer', flexShrink: 0,
            }}><ChevronLeft size={17} color={SUB} /></button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 600, color: TXT }}>
              {CAL_MON[calM]} <span style={{ color: SUB, fontWeight: 400 }}>{calY}</span>
            </div>
            <button onClick={() => onShiftCal(1)} style={{
              width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${BORDER}`, borderRadius: '9px', background: 'transparent', cursor: 'pointer', flexShrink: 0,
            }}><ChevronRight size={17} color={SUB} /></button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {renderMonth(calY, calM, SIZES.touch)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', color: customSince ? TXT : MUTE }}>
              {customSince ? `${fmtNice(customSince)}${customUntil ? '  –  ' + fmtNice(customUntil) : ''}` : 'Select a date range'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '11px 0', fontSize: '13px', fontWeight: 500, borderRadius: '10px', fontFamily: 'inherit',
                border: `1px solid ${BORDER}`, background: 'transparent', color: TXT, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={onApply} disabled={!rangeReady} style={{
                flex: 1, padding: '11px 0', fontSize: '13px', fontWeight: 600, borderRadius: '10px', border: 'none', fontFamily: 'inherit',
                background: rangeReady ? 'var(--cal-accent)' : 'var(--hover)',
                color:      rangeReady ? 'var(--cal-accent-fg)' : SUB,
                cursor:     rangeReady ? 'pointer' : 'default',
              }}>Apply</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ══ DESKTOP: popup compact ══ */
  const rd = new Date(calY, calM + 1, 1);
  const rY = rd.getFullYear(), rM = rd.getMonth();
  const navBtn = {
    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${BORDER}`, borderRadius: '8px', background: 'transparent',
    cursor: 'pointer', flexShrink: 0, transition: 'background 0.12s',
  };
  const t = SIZES.compact;

  return (
    <div data-filter data-filter-dropdown style={{
      position: 'absolute', top: '46px', right: 0, zIndex: 50,
      background: 'var(--cd)', border: `1px solid ${BORDER}`,
      borderRadius: '13px', boxShadow: 'var(--pop-shadow)', overflow: 'hidden',
      animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex' }}>
        {/* ── Presets kiri ── */}
        <div style={{ width: '162px', borderRight: `1px solid ${BORDER}`, padding: '9px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {presets.map(opt => {
            const active = !isCustom && opt.value === dateOpt.value;
            return (
              <div key={opt.value} onClick={() => onSelectPreset(opt)} style={{
                padding: '7px 11px', fontSize: '13px', cursor: 'pointer', borderRadius: '8px',
                color: active ? 'var(--cal-accent-line)' : SUB,
                background: active ? 'var(--cal-accent-soft)' : 'transparent',
                fontWeight: active ? 600 : 400, transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >{opt.label}</div>
            );
          })}
          <div style={{ borderTop: `1px solid ${BORDER}`, margin: '7px 3px 0' }} />
          <div style={{ ...TYPE.overline, padding: '10px 7px 7px' }}>Custom Range</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '9px',
            border: `1px solid ${isCustom ? 'var(--cal-accent-line)' : BORDER}`, background: 'var(--data-bg)' }}>
            <Calendar size={14} color={SUB} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '11.5px', lineHeight: 1.5 }}>
              <div style={{ color: customSince ? TXT : MUTE }}>{fmtNice(customSince)}</div>
              <div style={{ color: customUntil ? TXT : MUTE }}>{fmtNice(customUntil)}</div>
            </div>
          </div>
        </div>

        {/* ── Kalender kanan (2 bulan) ── */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <button onClick={() => onShiftCal(-1)} style={navBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronLeft size={16} color={SUB} />
            </button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: TXT }}>
              {CAL_MON[calM]} <span style={{ color: SUB, fontWeight: 400 }}>{calY}</span>
            </div>
            <div style={{ width: '14px', flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', fontWeight: 600, color: TXT }}>
              {CAL_MON[rM]} <span style={{ color: SUB, fontWeight: 400 }}>{rY}</span>
            </div>
            <button onClick={() => onShiftCal(1)} style={navBtn}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <ChevronRight size={16} color={SUB} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            {renderMonth(calY, calM, t)}
            {renderMonth(rY, rM, t)}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: customSince ? TXT : MUTE }}>
          {customSince ? `${fmtNice(customSince)}${customUntil ? '  –  ' + fmtNice(customUntil) : ''}` : 'Select a date range'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{
            padding: '7px 16px', fontSize: '13px', fontWeight: 500, borderRadius: '9px', fontFamily: 'inherit',
            border: `1px solid ${BORDER}`, background: 'transparent', color: TXT, cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >Cancel</button>
          <button onClick={onApply} disabled={!rangeReady} style={{
            padding: '7px 20px', fontSize: '13px', fontWeight: 600, borderRadius: '9px', border: 'none', fontFamily: 'inherit',
            background: rangeReady ? 'var(--cal-accent)' : 'var(--hover)',
            color:      rangeReady ? 'var(--cal-accent-fg)' : SUB,
            cursor:     rangeReady ? 'pointer' : 'default',
          }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
