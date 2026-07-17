'use client';

import PlatformPlaceholder from './PlatformPlaceholder';
import useIsMobile from './useIsMobile';
import { TYPE } from './typography';

/* ─────────────────────────────────────────────────────────────
   LEADS PLACEHOLDER PAGE — WILL OF D
   Shell halaman "under development" untuk section Leads Hub
   (Dashboard, Leads List, Analytics & Insights). Header sama
   pola dengan halaman Reports, konten pakai PlatformPlaceholder.
   Dipakai sampai Leads Hub v3.0 benar-benar dibangun.
   Props: pageTitle (h1), featureName (judul placeholder),
   Icon (lucide), description opsional.
   ───────────────────────────────────────────────────────────── */

const DESCRIPTION_DEFAULT =
  'We’re working on bringing Leads Hub to Baba Rafi Ad Hub — manage every lead from cold to deal, fully connected to your ads performance data. Stay tuned for future updates.';

export default function LeadsPlaceholder({ pageTitle, featureName, Icon, description }) {
  const isMobile = useIsMobile();
  const TileIcon = (props) => <Icon color="var(--cal-accent)" {...props} />;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ══ HEADER ══ */}
      <header style={ isMobile ? {
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px',
        padding: '14px 16px', flexShrink: 0, borderBottom: '1px solid var(--br)',
      } : {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', margin: '12px 16px 0', flexShrink: 0,
        background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '18px',
        boxShadow: 'var(--shadow)',
      }}>
        <div>
          <h1 style={{ ...TYPE.h1, ...(isMobile ? { fontSize: '20px' } : null) }}>{pageTitle}</h1>
          <p style={{ ...TYPE.small, marginTop: '3px' }}>Leads Hub · Under development</p>
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        padding: isMobile ? '16px' : '12px 16px 16px',
      }}>
        <PlatformPlaceholder
          platform={{ label: featureName, Icon: TileIcon }}
          title={`${featureName} is currently under development`}
          description={description || DESCRIPTION_DEFAULT}
        />
      </div>
    </div>
  );
}
