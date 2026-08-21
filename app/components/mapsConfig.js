/* ─────────────────────────────────────────────────────────────
   MAPS HUB — registry konfigurasi (pola sama dgn leadsConfig.js).
   Nilai status HARUS sama persis dengan dropdown "Profile Bisnis"
   di Google Sheets. Nambah provinsi/status = edit di sini.
   ───────────────────────────────────────────────────────────── */

// Warna ikut keluarga warna data project (sama di dua tema)
export const MAPS_STATUS = [
  { value: 'Sudah di Daftarkan', label: 'Registered',    color: '#2FB673' },
  { value: 'Belum di Daftarkan', label: 'Not Registered', color: '#F59E0B' },
  { value: 'Perlu Klaim Bisnis', label: 'Needs Claim',   color: '#3B82F6' },
];

export const STATUS_COLOR = Object.fromEntries(MAPS_STATUS.map(s => [s.value, s.color]));
export const STATUS_LABEL = Object.fromEntries(MAPS_STATUS.map(s => [s.value, s.label]));

// Outlet dengan koordinat rusak / status tak dikenal
export const REVIEW_COLOR = '#EF4444';
export const UNKNOWN_COLOR = '#9CA3AF';

export function statusColor(status, coordBroken) {
  if (coordBroken) return REVIEW_COLOR;
  return STATUS_COLOR[status] || UNKNOWN_COLOR;
}

// 38 provinsi Indonesia (untuk dropdown mapping Depo → Provinsi)
export const PROVINSI = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
  'Jambi', 'Bengkulu', 'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Lampung',
  'Banten', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara',
  'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan',
];

export const UNMAPPED_PROVINSI = 'Belum dipetakan';

// Tile peta: CARTO basemaps (gratis + atribusi wajib), varian per tema
export const TILE = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
};

// Pusat peta default: Indonesia
export const MAP_CENTER = [-2.5, 117.5];
export const MAP_ZOOM = 5;
