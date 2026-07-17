# CLAUDE.md — Dashboard Ads "WILL OF D" (Baba Rafi)

Panduan konteks untuk Claude Code. Baca file ini dulu sebelum mengerjakan apa pun.
Status: **project aktif & sudah live dengan data real** (bukan lagi tahap dummy/mockup).

---

## SIAPA & GAYA KERJA

- **User: Nadir** — Performance Marketing specialist di Kebab Turki Baba Rafi (PT Baba Rafi Internasional). GitHub: `nadirmhmmd02`.
- **TIDAK TEKNIS.** Selalu butuh instruksi/penjelasan super eksplisit dan sabar. Kalau memberi langkah manual, gunakan format jelas: "Buka file X → Ctrl+A → hapus → paste ini → Ctrl+S".
- **Workflow deploy:** default **langsung commit → push ke GitHub → Vercel auto-deploy**, TANPA nunggu konfirmasi. Pengecualian: kalau Nadir bilang "test di lokal dulu", baru test di localhost & tunggu approval sebelum push. (Lihat memory [[deploy-workflow]].)
- **JANGAN langsung coding** kalau user masih mode ngumpulin requirement. Tunggu user bilang siap.
- **Kalau ada keputusan penting, TANYA dulu — jangan asumsi sendiri.**
- Bahasa campur Indonesia-Inggris santai oke.
- `.claude/` JANGAN ikut di-commit (config lokal).

---

## TECH STACK & AKSES

- **Next.js 16** (App Router, JavaScript — NO TypeScript, no `src` dir, **Turbopack aktif**). Styling: CSS variables di `globals.css` + inline style (bukan Tailwind class-based, walau Tailwind ada).
- **Icon: `lucide-react`.** CATATAN: versi lucide ini MINIM brand icon — `Facebook`, `Chrome` TIDAK ADA. Meta = `Square` (fill biru), Google = `Globe`. Selalu cek icon ada sebelum pakai.
- **GitHub:** `nadirmhmmd02/dashboard-ads` (branch `main`, trunk-based — tiap commit langsung ke main).
- **Hosting:** Vercel — live `https://dashboard-ads-babarafi.vercel.app` (auto-deploy tiap push; domain diganti Nadir 17 Jul 2026, alamat lama dashboard-ads-six sudah mati).
- **Database:** Supabase (ref `tduskxqmsqcgurvxnjzo`, region Tokyo) — dipakai halaman Calendar + Suggestions.
- **Meta Ads API:** Graph v19.0, account `act_433644183932983`.
- **Local:** `C:\Users\Nadir.Muhammad\Desktop\dashboard-ads`, VS Code.

### ENV (`.env.local` — TIDAK di-commit; juga di Vercel → Settings → Env Variables, Production+Preview. Setelah edit env di Vercel harus Redeploy)
```
NEXT_PUBLIC_SUPABASE_URL=https://tduskxqmsqcgurvxnjzo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dari .env.local user>
META_ACCESS_TOKEN=<System User token permanen Meta — dari .env.local user>
META_AD_ACCOUNT_ID=act_433644183932983
```
Kredensial asli ada di `.env.local` user. JANGAN reproduksi dari ingatan — minta user kalau butuh.

---

## STRUKTUR FILE (KONDISI TERKINI)

```
app/
  layout.js              → AuthProvider + DateFilterProvider + AppShell + no-flash theme script. <html data-theme> di-set dari role+preferensi.
  page.js                → DASHBOARD (DATA REAL Meta). Semua logika kalkulasi metrik ada di sini. + Platform selector (Meta default; platform lain tampil placeholder).
  login/page.js          → Halaman login (light + aksen forest/emerald, kartu putih).
  campaigns/page.js      → Tabel kampanye Meta (read-only). Filter kalender dual-month. Kolom: …CPL + Total Spend.
  calendar/page.js       → CRUD jadwal iklan via Supabase (tabel `campaigns`). RBAC: create/edit/delete admin-only.
  reports/page.js        → ANALYTICS & INSIGHTS (v1, DATA REAL): Performance Score gauge (0-100) + kartu insight otomatis dari data Meta (rule-based via insightEngine.js). Filter periode preset (default This month). Fetch pakai mode=dashboard yang sama — JANGAN diubah. Mobile: refresh via portal top bar, dropdown rata kanan.
  leads/page.js          → LEADS HUB Dashboard (placeholder "under development" via LeadsPlaceholder, sampai v3.0 dibangun).
  leads/list/page.js     → LEADS HUB Leads List (placeholder, sama).
  leads/insights/page.js → LEADS HUB Analytics & Insights (placeholder, sama).
  components/
    AuthContext.js       → SOURCE OF TRUTH: auth (Supabase Auth) + role (app_metadata) + theme (light/dark). Export homeFor(role).
    AppShell.js          → route guard (redirect ke /login kalau belum login; sidebar + main). User suggestion floating button + popup.
    Sidebar.js           → sidebar collapsible+resizable, user info + logout, logo WILL OF D. Menu = NAV_SECTIONS dua section: "Ads Hub" (Dashboard/Campaigns/Calendar/Analytics & Insights) + "Leads Hub" (Dashboard /leads, Leads List /leads/list, Analytics & Insights /leads/insights — placeholder). isActive = exact match pathname. Dipakai juga MobileNav.
    LeadsPlaceholder.js  → shell halaman "under development" Leads Hub (header pola Reports + PlatformPlaceholder). Props: pageTitle, featureName, Icon.
    AreaChart.js         → chart "Daily Spend" (smooth area, animasi ganti metrik). Dipakai dashboard.
    ExportMenu.js        → tombol Export + laporan tersembunyi 16:9 (render PDF/JPG). Admin-only.
    CountUp.js           → animasi angka naik dari 0 ke target.
    Logo.js              → LOGO MARK "Control Hub" (SVG, warna via prop, ikut container/tema).
    ThemeToggle.js       → shared theme toggle button dengan animasi fade transition. Dipakai dashboard + campaigns.
    DateFilterContext.js → shared filter state (terpisah per halaman: dashboard, campaigns & reports). Persist saat pindah tab, reset saat browser refresh.
    DateFilterPopup.js   → popup filter tanggal SHARED (Dashboard+Campaigns+Reports): preset kiri + custom range + kalender dual-month + baris tombol kuartal di bawah kalender + footer, ukuran "tengah" final (SIZES.compact — jangan diubah tanpa diminta). Kuartal versi Baba Rafi = 4 BULAN per kuartal (Q1 Jan–Apr, Q2 May–Aug, Q3 Sep–Dec, tahun berjalan) — klik kuartal = pilih range custom + kalender lompat ke bulan awal, tetap butuh Apply. Desktop only (mobile bottom sheet tidak diubah). Mobile otomatis jadi bottom sheet single-month. Murni tampilan; state & fetch tetap di halaman masing-masing (callback onPickRange).
    CampaignModal.js     → popup detail campaign (klik row di Campaigns): konten iklan IG embed di kiri (auto feed 1:1 / portrait 9:16, strip thumbnail kalau >1), metrik + platform breakdown di kanan (hero Result+Total Spend, count-up, hover lift, chip brand FB/IG).
    useIsMobile.js       → hook deteksi viewport mobile ≤767px (matchMedia + fallback resize). Dipakai AppShell, dashboard, campaigns, calendar.
    MobileNav.js         → top bar mobile (hamburger morph X + logo + theme toggle) + drawer navigasi slide kiri. Punya 2 slot portal aksi per halaman: #wd-topbar-actions (kiri theme toggle: export/refresh) & #wd-topbar-actions-right (kanan: suggestions admin). Theme toggle disembunyikan di /calendar.
    PlatformSelector.js  → dropdown platform iklan di toolbar dashboard (registry PLATFORMS: Meta/Google/TikTok/All — nambah platform cukup tambah entri). Brand icon inline SVG. Pill aktif pakai --cal-accent (theme-aware).
    PlatformPlaceholder.js → empty state premium "under development" (chip Coming Soon + judul + deskripsi, props title/description bisa di-override). Dipakai dashboard (platform non-Meta) + halaman Reports.
    insightEngine.js     → mesin analisis Analytics & Insights (pure function, tanpa React): buildAnalysis(json API) → { metrics, insights[], score }. 11 rule (tren leads, CPL/CPC/CPM blended vs prev, top performer, kampanye boros vs median grup, konsentrasi budget, momentum, quiet days, reach, spend shift). Komparasi prev pakai angka blended level akun (di-label di kartu). Siap di-upgrade narasi LLM tanpa ubah halaman.
    typography.js        → TYPE: design system token teks (h1-h4, body*, small, caption, overline, table*, metric*, cardTitle, sectionTitle). Dashboard & Reports pakai ini — ubah hierarki teks global dari sini.
    CombineModal.js      → popup hitung gabungan campaign terpilih (checkbox di tabel Campaigns → floating bar "Calculate Total"). Agregasi ikut aturan metrik final: Traffic hanya dari campaign TRAFFIC, Leads hanya CONVERSION, CPC/CPL per tipe, CPM semua.
    SuggestionsModal.js  → LAMA, tidak dipakai lagi (logika sudah pindah ke AppShell + page.js).
    BarChart.js, Navbar.js → LAMA, tidak dipakai lagi (boleh dihapus kapan2).
  api/meta/route.js      → server-side fetch Meta Graph API. DIKUNCI Supabase Auth: verifikasi Bearer token → role (GET = admin/user, POST = admin only). GET: mode=dashboard (summary/prevSummary/daily/campaigns/chartRange), mode=campaign_detail (ads+creative+platform breakdown per campaign) & default campaigns. POST: aksi kontrol iklan — action=set_status (ACTIVE↔PAUSED) & action=set_budget (daily_budget level campaign, IDR nilai penuh, min Rp 10.000). Token System User sudah punya izin ads_management (dicek 2026-07-15).
  globals.css            → CSS variables (blok light `:root` + blok `html[data-theme="dark"]`) + keyframes animasi.
  supabase.js            → Supabase client (storage adapter "remember me") + authFetch (fetch dengan Bearer token untuk /api/meta) + setRememberSession.
  supabase-auth-setup.sql (root repo) → SQL setup auth: set role user + RLS campaigns & suggestions. Dijalankan manual di SQL Editor Supabase.
  icon.svg, apple-icon.svg → favicon + touch icon (Control Hub, square gelap + mark putih).
```

---

## LOGIKA BISNIS METRIK (FINAL — JANGAN DIUBAH SATU BARIS PUN)

Tipe campaign berdasarkan NAMA:
- Mengandung `"TRAFFIC"` → Traffic
- Mengandung `"PROSPEK"`/`"KONVERSI"` → Conversion
- Selainnya → Awareness

Deteksi result per campaign: nama mengandung `"AWR REACH"` → Reach; `"AWR IMPR"`/`"AWR"` → Impressions; `"TRAFFIC"` → Link Clicks; `"PROSPEK"/"KONVERSI"` → Leads.

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
- Link clicks dari actions: `action_type === 'link_click'`
- Chart harian: insights pakai `time_increment=1`
- **Semua metrik (termasuk kolom Total Spend di Campaigns) IKUT rentang filter tanggal yang dipilih** — bukan lifetime.

Subtotal toggle per grup (Awareness/Traffic/Conversion) di tabel campaigns — jangan dirusak.

---

## AUTH & ROLE (Supabase Auth — upgrade Jul 2026)

- Login pakai **email internal "seakan-akan"** (bukan email aktif beneran) + password tersimpan terenkripsi di Supabase. TIDAK ADA kredensial di kode/repo — password dipegang Nadir, JANGAN tulis password di file mana pun.
- 3 akun: `nadir.adhub@babarafi.com` (**admin** — tema default Dark, akses penuh: Export, CRUD Calendar, lihat+hapus Suggestions, Stop/Run+Edit Budget), `user.adhub@babarafi.com` (**user**/viewer — Light, read-only + kirim Suggestion), `marketing.adhub@babarafi.com` (**marketing** — Light, HANYA Leads Hub; menu Ads Hub tidak dirender, rute Ads Hub di-redirect ke /leads, landing login = /leads).
- Role dari `app_metadata.role` di JWT (di-set via SQL `supabase-auth-setup.sql`, klien tidak bisa ubah). Tambah user & reset password = Nadir manual via dashboard Supabase (TIDAK ada signup/User Management di app; "Allow new users to sign up" di Supabase HARUS off).
- `/api/meta` dikunci server-side: klien kirim access token via `authFetch()` (app/supabase.js); GET = role admin/user, POST = admin saja.
- RLS aktif: `campaigns` (read admin+user, write admin), `suggestions` (insert semua yang login, read/delete admin). Lihat `supabase-auth-setup.sql`.
- Tema terakhir yang dipilih user menimpa default saat login ulang (tersimpan per-role, no-flash script baca `wd-last-role`). "Remember me" = sesi di localStorage vs sessionStorage (flag `wd-remember`).

---

## TEMA & DESAIN (palet redesain 2026 "forest & lime" — semua via CSS var di `globals.css`)

Dua tema: light (`:root`) & dark (`html[data-theme="dark"]`). **Aksen SATU keluarga (forest/emerald/lime) di KEDUA tema** — aturan lama "amber di light" sudah usang (diganti 17 Jul 2026).
- **Light:** bg off-white kehijauan `#F1F2EF`, card `#FFF`, border `#E7E9E4`, teks `#101915`/`#5F6B63`; aksen **emerald `#1E6B4B`**, logo tile forest `#14382A` + mark lime.
- **Dark ("dark forest premium"):** bg `#0C110E`, card `#131A15`, border `#242E27`, teks `#F4F7F3`/`#9EABA2`; aksen **lime `#C8F169`** (cal-accent-fg gelap `#14251A`).
- **Warna data (sama dua tema):** conversion/green `#2FB673` (emerald), blue `#3B82F6`, purple `#8B5CF6` (awareness), orange `#F59E0B` (traffic).
- Token hero card `--hero-*` tersedia di globals.css tapi TIDAK dipakai (kartu gelap Total Spend DITOLAK Nadir — jangan diterapkan lagi tanpa diminta).
- **Login:** light + aksen forest/emerald (hardcode di `login/page.js`, seragam dengan dashboard).

### Dashboard (`app/page.js`) — DATA REAL (final redesain 17 Jul 2026, acuan visual semua halaman)
Atas→bawah: **HEADER CARD mengambang** (desktop: kartu putih radius 18, margin 12/16 — bukan borderBottom; mobile tetap 2 baris lama) berisi title + platform selector + filter tanggal + Export admin-only + Refresh + theme toggle + Suggestions admin-only → 5 KPI card SERAGAM putih (count-up + growth badge + sparkline) → **4 KARTU TERPISAH CPM/CPC/CPL/CTR + sparkline tren harian** (icon tile bulat kiri, grafik kanan; tren = basis blended harian level akun, angka utama tetap rumus final per tipe; mobile tetap 1 kartu merged 2x2 TANPA sparkline) → baris analitik 3 kolom `2.8fr 4.2fr 3fr` (Spend Breakdown donut **236px** · Daily Spend AreaChart · Top Campaigns). **SPACING COMPACT (keputusan Nadir 17 Jul): gap antar kartu/baris 10px, tepi kiri-kanan 16px** — jangan dilonggarkan tanpa diminta. **Angka KPI & strip pakai format PENUH** (mis. `Rp 1.440.076`, bukan `Rp 1.4M`). Fit 1 layar tanpa scroll.

### Filter Tanggal (Dashboard, Campaigns & Reports) — kalender dual-month via DateFilterPopup.js
Preset di kiri + kalender 2 bulan di kanan (pilih range langsung) + footer Cancel/Apply. Default **"This month"**. Preset Dashboard & Reports: Today…Last month. Preset Campaigns sama + tambahan "Last 3 days". State dikelola `DateFilterContext` (terpisah per halaman) — persist saat pindah tab via client-side navigation, reset ke "This month" saat browser refresh. Tombol Refresh hanya refresh data, TIDAK reset filter. Custom range → `/api/meta?...&since=&until=`. **Logika fetch JANGAN diubah.**

---

## PRINSIP WAJIB (DITEKANKAN USER)

1. **AKSEN FOREST/LIME KONSISTEN DUA TEMA** (menggantikan aturan lama aksen-per-tema, 17 Jul 2026) — light = emerald `#1E6B4B`, dark = lime `#C8F169`, satu keluarga hijau. Jangan hardcode warna aksen di komponen; SELALU pakai CSS var theme-aware (`--cal-*`, `--nav-accent-*`, `--ac`, `--accent-*` di globals.css). Lihat memory [[accent-per-theme]].
2. **SPACING PROPORSIONAL** — jarak/padding proporsional, jangan mepet sidebar/tepi. Konten butuh "nafas".
3. **ANIMASI = DNA PROJECT** — count-up, area/donut draw, hover interaktif, glow logo, theme fade transition, suggestion slide-up. Keyframes di globals.css: `wdSpinGlow`, `wdSpinGlowGreen`, `wdFadeUp`, `wdPulseDot`, `wdScaleIn`, `wdSlideUp`, `wdSweep`, `wdSpin`. Theme transition = opacity fade di `ThemeToggle.js`.
4. **RESPONSIVE FULL-WIDTH** — fit kanan-kiri penuh di desktop lebar berapa pun. Layout fluid (`flex:1` + `minWidth:0`, grid `minmax(0,1fr)`). Versi mobile (≤767px via `useIsMobile`) SUDAH ADA dan final — perubahan mobile TIDAK BOLEH mempengaruhi desktop sedikit pun (selalu gate dengan `isMobile`).
5. **DASHBOARD FIT-TO-SCREEN** (khusus halaman Dashboard) — konten muat 1 layar tanpa scroll (`height:100vh` + flex column, chart `flex:1`). Boleh scroll dikit di layar pendek. KHUSUS dashboard, bukan halaman lain.

---

## FITUR YANG SUDAH SELESAI (semua live)

- ✅ Dashboard KPI real (5 card + growth badge + sparkline), strip CPM/CPC/CPL/CTR, Spend Breakdown donut (interaktif, angka penuh), Daily Spend AreaChart, Top Campaigns.
- ✅ Filter tanggal kalender dual-month inline (Dashboard + Campaigns), default This month. Filter terpisah per halaman, persist saat pindah tab, reset saat browser refresh.
- ✅ Campaigns: tabel per grup (Awareness→Traffic→Conversion), subtotal toggle (default hidden), kolom Total Spend. Status "Stop" (bukan "Paused"), tampilan non-active normal (tidak abu-abu), urutan active di atas.
- ✅ Export laporan PDF/JPG 16:9 (admin-only).
- ✅ Light/Dark mode (CSS var, satu source of truth di AuthContext), toggle di header dashboard + campaigns. Animasi fade transition saat swap tema.
- ✅ Auth + Role (admin=`Dozan`, user=`user`) + route guard.
- ✅ Rebranding logo **WILL OF D** di sidebar, login, export, favicon. Brand di samping logo (Sidebar + MobileNav): **"Baba Rafi Ad Hub" untuk SEMUA role** (per 16 Jul 2026 — "WILL OF D" tinggal codename dev di kode). Title tab browser: "Baba Rafi Ad Hub".
- ✅ Font resmi: **Plus Jakarta Sans** via next/font di layout.js (redesain tahap 1).
- ✅ Redesain tahap 2 (17 Jul 2026, LIVE): palet forest/lime dua tema di seluruh web (dashboard, campaigns, calendar, reports, login, export PDF) + strip CPM/CPC/CPL/CTR jadi 4 kartu terpisah di Dashboard desktop. Kartu hero gelap Total Spend DITOLAK.
- ✅ Redesain tahap 3 FINAL (17 Jul 2026, LIVE — proyek redesain SELESAI, Nadir puas): Dashboard = header card mengambang + sparkline di 4 kartu C + donut 236px + spacing compact (gap 10px, tepi 16px). Nuansa yang sama diterapkan ke SEMUA halaman (desktop; mobile tetap): Campaigns & Calendar (topbar jadi card, tabel radius 18 + shadow, padding compact), Reports & LeadsPlaceholder (header card + padding compact). Redesain layout berikutnya hanya kalau Nadir dapat ide baru.
- ✅ Suggestions (Supabase tabel `suggestions`): user kirim saran via floating button + popup (slide-up, click outside to close); admin lihat+hapus saran via ikon di header dashboard (dengan red dot unread indicator + Clear all).
- ✅ Campaign detail popup (`CampaignModal.js`): klik row campaign → konten iklan (embed post/reels Instagram asli) + metrik lengkap format penuh + "Running On" platform breakdown dengan share bar. CountUp punya fallback settle (anti macet "0" saat tab hidden).
- ✅ Hitung gabungan campaign (`CombineModal.js`): checkbox per row → floating bar bawah (count + total spend live + Calculate Total) → popup Combined Performance (hero total spend, delivery, cost efficiency, included campaigns + share bar).
- ✅ Kolom Campaign resizable: handle drag di batas kolom Campaign|Status (150–620px), nama panjang terpotong ellipsis + tooltip. Sidebar default collapsed saat web pertama dibuka.
- ✅ Platform selector di toolbar dashboard (Meta Ads default; Google/TikTok/All Platforms tampil placeholder "under development"). Registry di `PlatformSelector.js`.
- ✅ Typography system (`typography.js`) diterapkan ke Dashboard + Reports — ukuran visual tidak berubah, cuma distandarkan lewat token.
- ✅ Analytics & Insights v1 (route /reports, icon Sparkles): Performance Score gauge + insight cards otomatis dari data Meta real (insightEngine.js), filter periode, severity critical→warning→positive→info, desktop grid 3 kolom / mobile stack.
- ✅ Kontrol iklan admin-only di Campaigns: kolom Actions (setelah Status) dengan tombol Stop/Run (ACTIVE↔PAUSED, popup konfirmasi merah/hijau) + Edit Daily Budget (popup input format Rupiah, min Rp 10.000, level campaign sesuai SOP Nadir — TIDAK PERNAH level ad set). Setelah sukses: update lokal optimistik + toast. Role user tidak melihat kolom ini. Status Ended tidak bisa di-run lagi. Endpoint POST /api/meta sudah diamankan server-side (admin only, via Supabase Auth token).
- ✅ Sidebar dua section: "ADS HUB" (menu lama) + "LEADS HUB" (Dashboard, Leads List, Analytics & Insights — 3 halaman placeholder "under development" via LeadsPlaceholder.js). Berlaku desktop (Sidebar) & mobile (drawer MobileNav). Nama produk fix: **"Baba Rafi Ad Hub"** (pakai spasi). Leads Hub beneran = rencana v3.0 (lihat BRD/PRD Nadir).
- ✅ Versi mobile (≤767px, desktop tak berubah): top bar hamburger→drawer, KPI carousel swipe scroll-snap, strip 2x2, analytics stack, date filter bottom sheet. Top bar dashboard (kanan→kiri): Suggestions · theme · Refresh · Export icon (via portal ke slot MobileNav). Campaigns: refresh di top bar, filter rata kanan. Calendar: tanpa theme toggle, tombol rata kanan, tabel Gantt scroll horizontal (minWidth 920px).

## BELUM / PENDING (JANGAN dikerjakan tanpa diminta)

- [ ] Analytics & Insights: upgrade narasi ke LLM asli (Claude API) — v1 rule-based sudah live; butuh API key kalau mau.
- [ ] Integrasi Google Ads / TikTok Ads / All Platforms (selector sudah ada, masih placeholder).
- [ ] Fitur Compare (tombol disabled), notifikasi lonceng, Export CSV/Excel Calendar — placeholder.
- [ ] Verifikasi akurasi angka vs Meta Ads Manager.
- [ ] Hapus file lama tidak terpakai: `SuggestionsModal.js`, `BarChart.js`, `Navbar.js`.
- [ ] v3.0 Leads Hub (fase berikutnya setelah auth live — lihat MASTER PLAN Bagian 3).

---

## CATATAN VERIFIKASI (sesi ini)

Tool screenshot preview SERING timeout di environment ini. Kalau begitu, verifikasi lewat `preview_eval` (baca computed style / teks DOM / cek network request) — sudah terbukti reliable. Build cek: `npm run build`.
