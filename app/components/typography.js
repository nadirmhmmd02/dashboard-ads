/* ─────────────────────────────────────────────────────────────
   TYPOGRAPHY SYSTEM — WILL OF D
   Satu sumber kebenaran untuk hierarki teks seluruh dashboard.
   Pakai: import { TYPE } from './components/typography';
          <h1 style={{ ...TYPE.h1 }}>…</h1>
   Override warna/margin per kasus via spread:
          <span style={{ ...TYPE.body, color: 'var(--t1)' }}>
   Ukuran mengikuti desain final yang sudah live — JANGAN dinaikkan
   sembarangan; ubah di sini kalau mau menyetel hierarki global.
   ───────────────────────────────────────────────────────────── */

export const TYPE = {
  /* ── Headings ── */
  h1: { fontSize: '22px', fontWeight: 700, letterSpacing: '-0.4px', lineHeight: 1.2,  color: 'var(--t1)' },
  h2: { fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.25, color: 'var(--t1)' },
  h3: { fontSize: '15px', fontWeight: 600, letterSpacing: '-0.1px', lineHeight: 1.3,  color: 'var(--t1)' },
  h4: { fontSize: '13px', fontWeight: 600, lineHeight: 1.35, color: 'var(--t1)' },

  /* ── Body ── */
  bodyLarge: { fontSize: '14px', fontWeight: 400, lineHeight: 1.55, color: 'var(--t1)' },
  body:      { fontSize: '13px', fontWeight: 400, lineHeight: 1.5,  color: 'var(--t1)' },
  small:     { fontSize: '12px', fontWeight: 400, lineHeight: 1.45, color: 'var(--t2)' },
  caption:   { fontSize: '11px', fontWeight: 400, lineHeight: 1.4,  color: 'var(--t3)' },
  /* Label kecil uppercase (mis. "CUSTOM RANGE") */
  overline:  { fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--t3)' },

  /* ── Tabel ── */
  tableHeader:     { fontSize: '11px', fontWeight: 500, color: 'var(--t2)' },
  tableCell:       { fontSize: '12px', fontWeight: 400, color: 'var(--t2)' },
  tableCellStrong: { fontSize: '12px', fontWeight: 500, color: 'var(--t1)' },

  /* ── Metrik / KPI ── */
  metricLabel:   { fontSize: '14px', fontWeight: 500, color: 'var(--t2)' },
  metricValue:   { fontSize: '34px', fontWeight: 700, letterSpacing: '-1px',   lineHeight: 1, color: 'var(--t1)' },
  metricValueSm: { fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1, color: 'var(--t1)' },
  metricSub:     { fontSize: '11px', fontWeight: 400, color: 'var(--t3)' },

  /* ── Judul kartu & section ── */
  cardTitle:    { fontSize: '15px', fontWeight: 600, color: 'var(--t1)' },
  sectionTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--t1)' },
};

export default TYPE;
