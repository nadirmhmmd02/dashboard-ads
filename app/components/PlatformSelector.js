'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Layers } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   PLATFORM SELECTOR — WILL OF D
   Dropdown pemilih platform iklan di toolbar Dashboard.
   Nambah platform baru cukup tambah 1 entri di PLATFORMS
   (id unik + label + icon + available). Platform dengan
   available:false otomatis tampil placeholder "under development"
   di Dashboard (lihat PlatformPlaceholder.js).
   ───────────────────────────────────────────────────────────── */

/* Brand icons — lucide minim brand icon (Facebook/Chrome tidak ada),
   jadi pakai inline SVG. Ukuran ikut prop size, warna brand asli. */

function MetaIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#0668E1" aria-hidden="true">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/>
    </svg>
  );
}

function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
    </svg>
  );
}

function TikTokIcon({ size = 16, color = 'var(--t1)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}

function AllPlatformsIcon({ size = 16, color = 'var(--t2)' }) {
  return <Layers size={size} color={color} />;
}

/* ── Registry platform — SATU-SATUNYA tempat nambah platform baru ──
   (LinkedIn/X/YouTube/Shopee/Tokopedia tinggal ditambah di sini) */
export const PLATFORMS = [
  { id: 'meta',   label: 'Meta Ads',      Icon: MetaIcon,         available: true  },
  { id: 'google', label: 'Google Ads',    Icon: GoogleIcon,       available: false },
  { id: 'tiktok', label: 'TikTok Ads',    Icon: TikTokIcon,       available: false },
  { id: 'all',    label: 'All Platforms', Icon: AllPlatformsIcon, available: false },
];

export const DEFAULT_PLATFORM = PLATFORMS[0]; // Meta Ads

/* ── Komponen dropdown — visual identik dengan tombol Date Filter ── */
export default function PlatformSelector({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const SelIcon = selected.Icon;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(prev => !prev)} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '9px 14px',
        background: 'var(--cd)',
        border: `1px solid ${open ? 'var(--br-strong)' : 'var(--br)'}`,
        borderRadius: '10px', fontSize: '13px',
        color: 'var(--t1)', cursor: 'pointer', transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--br-strong)'}
      onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--br)'; }}
      >
        <SelIcon size={15} />
        {selected.label}
        <ChevronDown size={13} color="var(--t2)" style={{
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }}/>
      </button>

      {open && (
        /* Lapisan POSISI (rata tengah thd tombol) dipisah dari lapisan ANIMASI —
           wdScaleIn pakai transform, kalau digabung translateX(-50%) popup meleset. */
        <div style={{
          position: 'absolute', top: '46px', left: '50%', transform: 'translateX(-50%)', zIndex: 50,
        }}>
        <div style={{
          minWidth: '200px', padding: '6px',
          background: 'var(--cd)', border: '1px solid var(--br)',
          borderRadius: '14px', boxShadow: 'var(--pop-shadow)',
          animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column', gap: '2px',
        }}>
          {PLATFORMS.map(p => {
            const active = p.id === selected.id;
            const Icon = p.Icon;
            return (
              <div key={p.id}
                onClick={() => { onSelect(p); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '9px', cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--cal-accent-fg)' : 'var(--t1)',
                  background: active ? 'var(--cal-accent)' : 'transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={15} color={active ? 'var(--cal-accent-fg)' : undefined} />
                <span style={{ flex: 1 }}>{p.label}</span>
                {active && <Check size={14} color="var(--cal-accent-fg)" strokeWidth={2.5} />}
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
