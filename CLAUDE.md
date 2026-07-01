# CLAUDE.md — Dashboard Ads "WILL OF D" (Baba Rafi)

Panduan konteks untuk Claude Code. Baca file ini dulu sebelum mengerjakan apa pun.

---

## SIAPA & GAYA KERJA

- **User: Nadir** — Performance Marketing specialist di Kebab Turki Baba Rafi (PT Baba Rafi Internasional). GitHub: `nadirmhmmd02`.
- **TIDAK TEKNIS.** Selalu butuh instruksi/penjelasan super eksplisit dan sabar. Kalau memberi langkah manual, gunakan format jelas: "Buka file X → Ctrl+A → hapus → paste ini → Ctrl+S".
- Workflow standar: edit lokal → test di localhost → konfirmasi dari user → push GitHub → Vercel auto-deploy → verifikasi web live.
- **JANGAN langsung coding** kalau user masih mode ngumpulin requirement. Tunggu user bilang siap.
- **Kalau ada keputusan penting, TANYA dulu — jangan asumsi sendiri.**
- Bahasa campur Indonesia-Inggris santai oke.
- Selalu **test tiap langkah sebelum lanjut**. Satu perubahan, satu test.

---

## TECH STACK & AKSES

- **Next.js** (App Router, JavaScript — NO TypeScript, Tailwind CSS, no `src` dir, no Turbopack)
- **Icon library: `lucide-react`** (sudah terinstall). CATATAN PENTING: versi lucide user ini MINIM brand icon — `Facebook`, `Chrome` TIDAK ADA. Untuk platform pakai: Meta = `Square` (fill biru #3b82f6), Google = `Globe`. Selalu cek icon ada sebelum pakai.
- **GitHub:** `nadirmhmmd02/dashboard-ads` (branch `main`)
- **Hosting:** Vercel — live di `https://dashboard-ads-six.vercel.app`
- **Database:** Supabase (project ref `tduskxqmsqcgurvxnjzo`, region Tokyo)
- **Local path:** `C:\Users\Nadir.Muhammad\Desktop\dashboard-ads`, dibuka di VS Code

### ENV VARIABLES (`.env.local` — TIDAK di-commit; ada juga di Vercel → Settings → Environment Variables, Production+Preview. Setelah edit env di Vercel harus Redeploy)
```
NEXT_PUBLIC_SUPABASE_URL=https://tduskxqmsqcgurvxnjzo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ambil dari .env.local user>
META_ACCESS_TOKEN=<System User token permanen Meta — ambil dari .env.local user>
META_AD_ACCOUNT_ID=act_433644183932983
```
Kredensial asli ada di file `.env.local` user. JANGAN reproduksi dari ingatan — minta user kalau dibutuhkan.

---

## STRUKTUR FILE SAAT INI (setelah redesign UI)

```
app/
  page.js               → DASHBOARD BARU (kartu + bar chart + donut + platform). Pakai DATA DUMMY sementara.
  campaigns/page.js     → isi page.js LAMA (tabel Meta Ads real). Logika TIDAK diubah, cuma dipindah.
  calendar/page.js      → Ads Calendar (CRUD Supabase) — TIDAK BERUBAH
  reports/page.js        → BELUM DIBUAT (placeholder, next step)
  components/
    Sidebar.js          → sidebar collapsible+resizable (pengganti Navbar). SUDAH JADI & JALAN.
    CountUp.js           → komponen animasi angka naik dari 0
    BarChart.js          → bar chart toggle 4 metrik, Y-axis, grid, today highlight, tooltip
    Navbar.js            → LAMA, sudah tidak dipakai (boleh dihapus nanti)
  layout.js             → wrapper: Sidebar + main flex full-width. data-theme="dark". maxWidth 1400px SUDAH DIBUANG.
  globals.css           → tema abu (dark aktif) + keyframes animasi
  supabase.js           → Supabase client
  api/meta/route.js     → server-side fetch Meta Graph API
```

---

## LOGIKA BISNIS METRIK (FINAL — JANGAN DIUBAH SATU BARIS PUN)

Ini ada di `app/campaigns/page.js`. Jangan sentuh logikanya.

Tipe campaign berdasarkan NAMA:
- Mengandung `"TRAFFIC"` → Traffic
- Mengandung `"PROSPEK"`/`"KONVERSI"` → Conversion
- Selainnya → Awareness

Deteksi result per campaign (dari kode asli, lebih detail): nama mengandung `"AWR REACH"` → Reach; `"AWR IMPR"` atau `"AWR"` → Impressions; `"TRAFFIC"` → Link Clicks; `"PROSPEK"/"KONVERSI"` → Leads.

Kalkulasi:
- Total Spend, Reach, Impressions → SEMUA campaign
- Traffic (link clicks) → HANYA campaign TRAFFIC
- Leads → HANYA campaign CONVERSION
- CPM = spend semua / impressions semua × 1000
- CPC = spend TRAFFIC / link clicks TRAFFIC
- CPL = spend CONVERSION / leads CONVERSION
- CTR = clicks CONVERSION / impressions CONVERSION × 100
- `daily_budget` dari API sudah Rupiah penuh (JANGAN dibagi 100/1000)
- Leads dari actions array: `action_type === 'lead'` ATAU `'onsite_conversion.lead_grouped'`
- Link clicks dari actions array: `action_type === 'link_click'`
- Chart harian: query insights pakai `time_increment=1`

Ada fitur subtotal toggle per grup (Awareness/Traffic/Conversion) di tabel campaigns — jangan dirusak.

---

## TEMA & DESAIN (palet abu mockup v5)

Dark mode default via `html[data-theme="dark"]`. Variabel di `globals.css`:
- background `#1a1a1a`, sidebar `#141414`, card `#222`, border `#2a2a2a`
- Aksen: biru `#3b82f6`, amber `#f59e0b`, hijau `#10b981`, merah `#ef4444`, ungu `#8b5cf6`
- Variabel lama dipetakan ke abu: `--pg #1a1a1a`, `--cd #222`, `--sf #1a1a1a`, `--s2 #252525`, `--br #2a2a2a`, `--ac #f59e0b`, `--t1 #e5e5e5`, `--t2 #a3a3a3`, `--t3 #737373`.

### Sidebar (SUDAH JADI)
- Default 200px, min 130px, max 360px. Resizable via drag handle tepi kanan (amber `#f59e0b` saat hover).
- Collapse ke icon-only 64px. Animasi 0.28s cubic-bezier(0.4,0,0.2,1). Chevron rotate 180°, teks fade + width:0.
- Saat collapsed: drag handle `display:none` total; padding item `10px 0`; span teks `width:0` (biar icon tidak ke-clip — ini fix penting).
- Active nav: AMBER — bg `rgba(245,158,11,0.16)`, text+icon `#f5b53f`. Hover non-aktif: bg `rgba(245,158,11,0.09)`, text+icon `#d9a441`, geser padding-left 16px.
- Active state OTOMATIS via `usePathname()`.
- Logo "WILL OF D" + icon petir (`Zap`) kotak amber dengan glow napas (`wdSpinGlow`). Tanpa branding Baba Rafi.

### Dashboard (`app/page.js`) — DATA MASIH DUMMY
Urut atas-bawah: topbar (title + filter This month + Compare DISABLED + theme toggle) → 5 big cards (Total Spend, Reach, Impressions, Traffic, Leads — count-up + badge naik/turun) → 4 small cards (CPM, CPC, CPL, CTR) → bar chart full-width → 2 kolom (donut spend breakdown interaktif | platform breakdown: Meta connected+pulse+scanning line, Google not connected).

---

## PRINSIP WAJIB (DITEKANKAN USER)

1. **SPACING PROPORSIONAL** — setiap halaman & elemen HARUS punya jarak/padding proporsional sesuai mockup. JANGAN mepet ke sidebar atau tepi. Topbar `14px 20px`, konten `18px 20px`, gap antar kartu `12px`. Konten butuh "nafas".

2. **ANIMASI = DNA PROJECT** — seluruh dashboard harus punya animasi mulus "memanjakan mata": count-up angka, bar grow dari bawah, donut draw, hover interaktif di mana-mana, glow logo. Pertahankan di semua elemen baru. Keyframes tersedia di globals.css: `wdSpinGlow`, `wdGrowBar`, `wdFadeUp`, `wdPulseDot`, `wdSweep`.

3. **RESPONSIVE FULL-WIDTH** — dashboard fit kanan-kiri penuh di monitor desktop lebar berapa pun. Layout fluid: main `flex:1` + `minWidth:0`, grid pakai `minmax(0,1fr)`, hindari lebar fixed. Fokus desktop; mobile bukan prioritas.

4. **DASHBOARD FIT-TO-SCREEN (khusus halaman Dashboard)** — SEMUA konten dashboard diusahakan muat 1 layar tanpa scroll (kanan-kiri-atas-bawah), termasuk kalau nanti nambah visual. Pakai `height:100vh` + flex column; bar chart `flex:1` mengisi ruang kosong. TAPI kalau layar pendek, boleh scroll dikit demi proporsi (`minHeight` sebagai batas). Ini KHUSUS dashboard, bukan halaman lain.

---

## STATUS SEKARANG (titik berhenti)

SUDAH SELESAI:
1. ✅ Install lucide-react
2. ✅ Pindah page.js lama → campaigns/page.js (logika utuh)
3. ✅ Sidebar.js (collapsible, resizable, hover, active state, icon fix)
4. ✅ layout.js (Navbar→Sidebar, full-width, dark default)
5. ✅ globals.css (tema abu + animasi)
6. ✅ Dashboard baru (page.js) + CountUp.js + BarChart.js — DATA DUMMY
7. ✅ Dashboard fit-to-screen (baru diterapkan, PERLU DITEST hasil akhirnya)

NEXT STEPS (belum dikerjakan):
- [ ] Test hasil dashboard fit-to-screen; perbaiki kalau ada elemen mampet
- [ ] Buat `app/reports/page.js` (placeholder kosong)
- [ ] Kasih padding wrapper ke `campaigns/page.js` biar tidak mepet sidebar (efek samping hapus maxWidth di layout)
- [ ] Pastikan `calendar/page.js` masih jalan
- [ ] SAMBUNGKAN DASHBOARD KE DATA REAL Meta API (ganti data dummy) — perlu API kembalikan data harian time_increment=1 + breakdown per objective
- [ ] Theme toggle light/dark: sekarang cuma visual (icon morph), belum benar-benar ganti tema. Perlu implementasi ganti `data-theme` di `<html>`.

PENDING (JANGAN dikerjakan tanpa diminta):
- Fitur Compare (tombol ada tapi disabled — format tampilan belum diputuskan)
- Notifikasi lonceng (hardcoded)
- Export CSV/Excel di Calendar (belum ada handler)
- Google Ads integration (placeholder)
- Halaman login/proteksi (belum ada)
- Verifikasi akurasi data vs Meta Ads Manager

---

## MOCKUP

Mockup HTML final (v5) sudah di-approve user. Semua spesifikasi visual & animasi di atas adalah hasil iterasi mockup itu. File mockup: `will_of_d_dashboard_v5_mockup.html` (kalau user melampirkannya). Terjemahkan mockup → komponen Next.js + Tailwind + inline style.
