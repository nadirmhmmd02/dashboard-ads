// WILL OF D — "Control Hub" logo mark.
// Dua elemen geometris (simetri 180°) yang mengapit ruang negatif di tengah,
// membentuk siluet heksagonal. Sesuai brand guideline (fokus, kendali, pusat).
// Warna ikut container/tema lewat prop `color` (default currentColor).
export default function Logo({ size = 24, color = 'currentColor', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden="true"
    >
      {/* elemen kiri-atas */}
      <path d="M5 14 L24 3 L24 22 L21 26 L21 43 L5 34 Z" fill={color} />
      {/* elemen kanan-bawah (rotasi 180°) */}
      <path d="M43 34 L24 45 L24 26 L27 22 L27 5 L43 14 Z" fill={color} />
    </svg>
  );
}
