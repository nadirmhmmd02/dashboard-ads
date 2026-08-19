'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   DROPDOWN — menu animasi halus (pengganti <select> native yang
   patah). Dipakai Leads Hub (filter kategori/status/sales, sync,
   kolom, dsb).

   PENTING (fix bug "jendela loncat"): lapisan POSISI (wrapper,
   boleh pakai translate) DIPISAH dari lapisan ANIMASI (inner,
   wdScaleIn yang meng-animate transform). Kalau digabung, animasi
   scale menimpa translate → menu muncul geser lalu lompat.

   Props:
   - label        : isi tombol (string / node)
   - icon         : lucide icon di kiri label (opsional)
   - options      : [{ value, label, color?, icon?, hint? }]
   - value        : value terpilih (untuk tanda ✓)
   - onSelect     : (value) => void
   - primary      : tombol hijau aksen (default outline)
   - align        : 'left' | 'right' | 'center'  (default left)
   - direction    : 'down' | 'up'                (default down)
   - minWidth     : lebar minimum menu (default 160)
   - showCheck    : tampilkan ✓ pada value terpilih (default true)
   - keepOpen     : menu tidak menutup setelah pilih (utk multi)
   - footer       : node kecil di bawah menu (opsional)
   - buttonStyle  : override style tombol
   ───────────────────────────────────────────────────────────── */

export default function Dropdown({
  label, icon: Icon, options = [], value, onSelect,
  primary = false, align = 'left', direction = 'down',
  minWidth = 160, showCheck = true, keepOpen = false,
  footer = null, buttonStyle = {}, disabled = false, title,
  block = false,   // true = wrapper & tombol lebar penuh (baris aksi, mis. TodoDetail)
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Lapisan posisi (tanpa animasi)
  const pos = { position: 'absolute', zIndex: 45 };
  if (direction === 'down') pos.top = 'calc(100% + 6px)'; else pos.bottom = 'calc(100% + 6px)';
  if (align === 'right') pos.right = 0;
  else if (align === 'center') { pos.left = '50%'; pos.transform = 'translateX(-50%)'; }
  else pos.left = 0;

  const origin = `${direction === 'down' ? 'top' : 'bottom'} ${align === 'right' ? 'right' : align === 'center' ? 'center' : 'left'}`;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: block ? 'flex' : 'inline-flex', width: block ? '100%' : undefined }}>
      <button
        onClick={() => { if (!disabled) setOpen(v => !v); }}
        title={title}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px', ...(block ? { width: '100%' } : null),
          padding: '8px 12px', borderRadius: '10px',
          border: primary ? 'none' : '1px solid var(--br)',
          background: primary ? 'var(--cal-accent)' : 'var(--cd)',
          color: primary ? 'var(--cal-accent-fg)' : 'var(--t1)',
          fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
          transition: 'border-color 0.15s, background 0.15s, opacity 0.15s',
          // Disabled: abu-abu + kursor "not-allowed" (tanda tidak bisa diklik)
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          ...buttonStyle,
        }}
        onMouseEnter={e => { if (!primary && !disabled) e.currentTarget.style.borderColor = 'var(--br-strong)'; }}
        onMouseLeave={e => { if (!primary && !disabled) e.currentTarget.style.borderColor = 'var(--br)'; }}
      >
        {Icon && <Icon size={14} />}
        {label}
        <ChevronDown size={12} style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
        }} />
      </button>

      {open && (
        <div style={pos}>{/* wrapper posisi — tidak dianimasikan */}
          <div style={{
            background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '12px',
            boxShadow: 'var(--pop-shadow)', padding: '5px', minWidth: `${minWidth}px`,
            animation: 'wdScaleIn 0.16s cubic-bezier(0.4,0,0.2,1)',
            transformOrigin: origin,
            maxHeight: '320px', overflowY: 'auto',
          }}>
            {options.map(opt => {
              // opt.checked (boolean) = mode multi-check (mis. toggle kolom);
              // kalau tidak diisi, pakai perbandingan value biasa
              const active = opt.checked !== undefined ? opt.checked : (value !== undefined && opt.value === value);
              const OptIcon = opt.icon;
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => { onSelect?.(opt.value); if (!keepOpen) setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 10px', borderRadius: '8px', border: 'none',
                    background: active ? 'var(--hover)' : 'transparent',
                    color: opt.color || 'var(--t1)', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
                    transition: 'background 0.13s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = active ? 'var(--hover)' : 'transparent'}
                >
                  {opt.color && !OptIcon && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                  )}
                  {OptIcon && <OptIcon size={14} style={{ flexShrink: 0 }} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                  {opt.hint && <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--t3)' }}>{opt.hint}</span>}
                  {showCheck && active && <Check size={13} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
            {footer && (
              <div style={{ borderTop: '1px solid var(--br)', marginTop: '4px', padding: '6px 10px 4px' }}>
                {footer}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
