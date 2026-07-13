'use client';

import { FileChartColumn } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import PlatformPlaceholder from '../components/PlatformPlaceholder';
import { TYPE } from '../components/typography';

/* ─────────────────────────────────────────────────────────────
   REPORTS — WILL OF D (placeholder under development)
   Halaman ini belum punya fitur; menampilkan empty state premium
   yang sama dengan platform selector (Google/TikTok Ads).
   Theme-aware penuh: ikut CSS var light/dark seperti halaman lain.
   ───────────────────────────────────────────────────────────── */

export default function ReportsPage() {
  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'var(--pg)' }}>

      {/* ══ HEADER (72px — sama dengan Dashboard) ══ */}
      <header style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 24px', height:'72px', flexShrink:0,
        borderBottom:'1px solid var(--br)',
      }}>
        <div>
          <h1 style={{ ...TYPE.h1 }}>Reports</h1>
          <p style={{ ...TYPE.small, marginTop:'3px' }}>Reports · Under development</p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <ThemeToggle/>
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'24px' }}>
        <PlatformPlaceholder
          platform={{ label: 'Reports', Icon: FileChartColumn }}
          title="Reports is currently under development"
          description="We’re working on bringing automated reports to WILL OF D. Stay tuned for future updates."
        />
      </div>
    </div>
  );
}
