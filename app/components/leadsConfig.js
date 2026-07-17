/* ─────────────────────────────────────────────────────────────
   LEADS HUB CONFIG — satu sumber kebenaran untuk registry
   status, sales, dan kategori promo. Dipakai Dashboard Leads Hub
   + Leads List. Nambah promo/sales baru cukup edit di sini.
   ───────────────────────────────────────────────────────────── */

export const STATUSES = ['No Status', 'Cold', 'Warm', 'Hot', 'Deal'];

export const STATUS_COLOR = {
  'No Status': { fg: 'var(--t3)',  bg: 'var(--hover)' },
  Cold:        { fg: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  Warm:        { fg: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  Hot:         { fg: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  Deal:        { fg: '#2FB673', bg: 'rgba(47,182,115,0.14)' },
};

// Tim sales yang meng-handle leads (filter + kolom Sales + bulk assign)
export const SALES = ['Akmel', 'Hendra', 'Dedik'];

// Warna khas per sales (dibedakan dari warna status biar tidak ketukar)
export const SALES_COLOR = {
  Akmel:  { fg: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },  // biru
  Hendra: { fg: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },  // ungu
  Dedik:  { fg: '#14B8A6', bg: 'rgba(20,184,166,0.13)' },  // teal
};

/* Kategori promo AKTIF yang tampil di dropdown.
   value = nilai tersimpan di DB (hasil deteksi nama campaign),
   label = nama tampilan (keputusan Nadir 17 Jul 2026).
   Promo baru jalan → tambah entri baru di sini. */
export const CATEGORIES = [
  { value: 'Autopilot', label: 'Package Franchise Autopilot' },
];

export function kategoriLabel(value) {
  if (!value) return 'Uncategorized';
  return CATEGORIES.find(c => c.value === value)?.label || value;
}
