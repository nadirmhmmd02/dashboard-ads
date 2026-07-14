'use client';

import { Sparkles } from 'lucide-react';
import PlatformPlaceholder from '../components/PlatformPlaceholder';
import { TYPE } from '../components/typography';

/* ─────────────────────────────────────────────────────────────
   AI INSIGHTS — WILL OF D (placeholder under development)
   Rencana: analitik & insight berbasis AI. Halaman ini belum
   punya fitur; menampilkan empty state premium yang sama dengan
   platform selector (Google/TikTok Ads). Route tetap /reports.
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
          <h1 style={{ ...TYPE.h1 }}>AI Insights</h1>
          <p style={{ ...TYPE.small, marginTop:'3px' }}>AI Insights · Under development</p>
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', padding:'24px' }}>
        <PlatformPlaceholder
          platform={{ label: 'AI Insights', Icon: Sparkles }}
          title="AI Insights is currently under development"
          description="We’re working on bringing AI-powered analytics and insights to WILL OF D. Stay tuned for future updates."
        />
      </div>
    </div>
  );
}
