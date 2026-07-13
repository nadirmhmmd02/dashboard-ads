'use client';

import { TYPE } from './typography';

/* ─────────────────────────────────────────────────────────────
   PLATFORM PLACEHOLDER — WILL OF D
   Empty state premium untuk fitur/platform yang belum tersedia
   (platform available:false di PlatformSelector, halaman Reports,
   dst). Mengisi area konten, header/toolbar tetap tampil.
   Props: platform {label, Icon} wajib; title & description
   opsional untuk override teks default.
   ───────────────────────────────────────────────────────────── */

export default function PlatformPlaceholder({ platform, title, description }) {
  const Icon = platform.Icon;
  const heading = title || `${platform.label} is currently under development`;
  const body = description ||
    'We’re working on bringing this advertising platform to WILL OF D. Stay tuned for future updates.';

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--cd)', border: '1px solid var(--br)',
      borderRadius: '18px', boxShadow: 'var(--shadow)',
      padding: '40px 24px', textAlign: 'center',
      animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards',
    }}>
      {/* Ikon platform dalam tile soft accent */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '20px',
        background: 'var(--cal-accent-soft)',
        border: '1px solid var(--br)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '22px',
        animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 60ms backwards',
      }}>
        <Icon size={32} />
      </div>

      {/* Chip status */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '5px 12px', borderRadius: '999px',
        background: 'var(--cal-accent-soft)',
        marginBottom: '18px',
        animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 120ms backwards',
      }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: 'var(--cal-accent)',
          animation: 'wdPulseDot 1.5s ease-in-out infinite',
        }}/>
        <span style={{ ...TYPE.caption, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--cal-accent-line)' }}>
          Coming soon
        </span>
      </div>

      {/* Judul + deskripsi */}
      <div style={{ ...TYPE.h2, marginBottom: '10px', animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 180ms backwards' }}>
        {heading}
      </div>
      <div style={{
        ...TYPE.body, color: 'var(--t2)', maxWidth: '420px',
        animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 240ms backwards',
      }}>
        {body}
      </div>
    </div>
  );
}
