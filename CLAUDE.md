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
- **Hosting:** Vercel — live `https://dashboard-ads-six.vercel.app` (auto-deploy tiap push).
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
  login/page.js          → Halaman login (tema amber/light, kartu putih).
  campaigns/page.js      → Tabel kampanye Meta (read-only). Filter kalender dual-month. Kolom: …CPL + Total Spend.
  calendar/page.js       → CRUD jadwal iklan via Supabase (tabel `campaigns`). RBAC: create/edit/delete admin-only.
  reports/page.js        → ANALYTICS & INSIGHTS (v1, DATA REAL): Performance Score gauge (0-100) + kartu insight otomatis dari data Meta (rule-based via insightEngine.js). Filter periode preset (default This month). Fetch pakai mode=dashboard yang sama — JANGAN diubah. Mobile: refresh via portal top bar, dropdown rata kanan.
  components/
    AuthContext.js       → SOURCE OF TRUTH: auth + role + theme (light/dark). localStorage/sessionStorage.
    AppShell.js          → route guard (redirect ke /login kalau belum login; sidebar + main). User suggestion floating button + popup.
    Sidebar.js           → sidebar collapsible+resizable, user info + logout, logo WILL OF D.
    AreaChart.js         → chart "Daily Spend" (smooth area, animasi ganti metrik). Dipakai dashboard.
    ExportMenu.js        → tombol Export + laporan tersembunyi 16:9 (render PDF/JPG). Admin-only.
    CountUp.js           → animasi angka naik dari 0 ke target.
    Logo.js              → LOGO MARK "Control Hub" (SVG, warna via prop, ikut container/tema).
    ThemeToggle.js       → shared theme toggle button dengan animasi fade transition. Dipakai dashboard + campaigns.
    DateFilterContext.js → shared filter state (terpisah per halaman: dashboard, campaigns & reports). Persist saat pindah tab, reset saat browser refresh.
    DateFilterPopup.js   → popup filter tanggal SHARED (Dashboard+Campaigns+Reports): preset kiri + custom range + kalender dual-month + footer, ukuran "tengah" final 614x367 (SIZES.compact — jangan diubah tanpa diminta). Mobile otomatis jadi bottom sheet single-month. Murni tampilan; state & fetch tetap di halaman masing-masing.
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
  api/meta/route.js      → server-side fetch Meta Graph API. GET: mode=dashboard (summary/prevSummary/daily/campaigns/chartRange), mode=campaign_detail (ads+creative+platform breakdown per campaign) & default campaigns. POST: aksi kontrol iklan — action=set_status (ACTIVE↔PAUSED) & action=set_budget (daily_budget level campaign, IDR nilai penuh, min Rp 10.000). Token System User sudah punya izin ads_management (dicek 2026-07-15).
  globals.css            → CSS variables (blok light `:root` + blok `html[data-theme="dark"]`) + keyframes animasi.
  supabase.js            → Supabase client.
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

## AUTH & ROLE (client-side sederhana — dikelola AuthContext)

- **Admin** → `Dozan` / `Dozan213` — default tema **Dark**, akses penuh (Export, Create/Edit/Delete Calendar, lihat+hapus Suggestions).
- **User** → `user` / `babarafi123` — default tema **Light**, read-only (tanpa Export, tanpa CRUD Calendar, bisa kirim Suggestion).
- Tema terakhir yang dipilih user menimpa default saat login ulang (tersimpan per-role).
- ⚠️ Auth ini CLIENT-SIDE (password kelihatan di kode) — belum production-secure. Upgrade ke Supabase Auth kalau perlu.

---

## TEMA & DESAIN (palet final — semua via CSS var di `globals.css`)

Dua tema: light (`:root`) & dark (`html[data-theme="dark"]`).
- **Light:** bg `#F7F8FA`, card `#FFF`, border `#E5E7EB`, teks `#111827`/`#6B7280`; **sidebar aksen amber**.
- **Dark (final, jangan diubah):** bg `#090A0C`, card `#121417`, border `#23262C`, teks `#FFF`/`#9CA3AF`; **sidebar aksen hijau**.
- **Aksen umum:** green `#8BE34D`, blue `#3B82F6`, purple `#8B5CF6`, orange/amber `#F59E0B`.

### Dashboard (`app/page.js`) — DATA REAL
Atas→bawah: header (title + filter tanggal + Export admin-only + Refresh + theme toggle + Suggestions admin-only) → 5 KPI card (Total Spend, Reach, Impressions, Traffic, Leads — count-up + growth badge vs periode sebelumnya + sparkline) → strip 4 metrik (CPM/CPC/CPL/CTR) → baris analitik 3 kolom (Spend Breakdown donut · Daily Spend AreaChart · Top Campaigns). **Angka KPI & strip pakai format PENUH** (mis. `Rp 1.440.076`, bukan `Rp 1.4M`). Fit 1 layar tanpa scroll.

### Filter Tanggal (Dashboard, Campaigns & Reports) — kalender dual-month via DateFilterPopup.js
Preset di kiri + kalender 2 bulan di kanan (pilih range langsung) + footer Cancel/Apply. Default **"This month"**. Preset Dashboard & Reports: Today…Last month. Preset Campaigns sama + tambahan "Last 3 days". State dikelola `DateFilterContext` (terpisah per halaman) — persist saat pindah tab via client-side navigation, reset ke "This month" saat browser refresh. Tombol Refresh hanya refresh data, TIDAK reset filter. Custom range → `/api/meta?...&since=&until=`. **Logika fetch JANGAN diubah.**

---

## PRINSIP WAJIB (DITEKANKAN USER)

1. **AKSEN PER TEMA** — dark mode = aksen **hijau** (`#8BE34D`), light mode = aksen **oren/amber** (`#F59E0B`, teks amber gelap `#B45309`). Berlaku untuk SEMUA komponen. Jangan hardcode hijau untuk elemen aksen; pakai CSS var theme-aware (pola `--cal-*` di globals.css untuk kalender). Lihat memory [[accent-per-theme]].
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
- ✅ Rebranding logo **WILL OF D** di sidebar, login, export, favicon. Brand di samping logo (Sidebar + MobileNav) per role: admin = "WILL OF D", user = "Baba Rafi Ad Hub".
- ✅ Suggestions (Supabase tabel `suggestions`): user kirim saran via floating button + popup (slide-up, click outside to close); admin lihat+hapus saran via ikon di header dashboard (dengan red dot unread indicator + Clear all).
- ✅ Campaign detail popup (`CampaignModal.js`): klik row campaign → konten iklan (embed post/reels Instagram asli) + metrik lengkap format penuh + "Running On" platform breakdown dengan share bar. CountUp punya fallback settle (anti macet "0" saat tab hidden).
- ✅ Hitung gabungan campaign (`CombineModal.js`): checkbox per row → floating bar bawah (count + total spend live + Calculate Total) → popup Combined Performance (hero total spend, delivery, cost efficiency, included campaigns + share bar).
- ✅ Kolom Campaign resizable: handle drag di batas kolom Campaign|Status (150–620px), nama panjang terpotong ellipsis + tooltip. Sidebar default collapsed saat web pertama dibuka.
- ✅ Platform selector di toolbar dashboard (Meta Ads default; Google/TikTok/All Platforms tampil placeholder "under development"). Registry di `PlatformSelector.js`.
- ✅ Typography system (`typography.js`) diterapkan ke Dashboard + Reports — ukuran visual tidak berubah, cuma distandarkan lewat token.
- ✅ Analytics & Insights v1 (route /reports, icon Sparkles): Performance Score gauge + insight cards otomatis dari data Meta real (insightEngine.js), filter periode, severity critical→warning→positive→info, desktop grid 3 kolom / mobile stack.
- ✅ Kontrol iklan admin-only di Campaigns: kolom Actions (setelah Status) dengan tombol Stop/Run (ACTIVE↔PAUSED, popup konfirmasi merah/hijau) + Edit Daily Budget (popup input format Rupiah, min Rp 10.000, level campaign sesuai SOP Nadir — TIDAK PERNAH level ad set). Setelah sukses: update lokal optimistik + toast. Role user tidak melihat kolom ini. Status Ended tidak bisa di-run lagi. ⚠️ Endpoint POST /api/meta tidak ada server-side auth (konsisten dgn auth client-side) — kalau upgrade Supabase Auth, amankan endpoint ini juga.
- ✅ Versi mobile (≤767px, desktop tak berubah): top bar hamburger→drawer, KPI carousel swipe scroll-snap, strip 2x2, analytics stack, date filter bottom sheet. Top bar dashboard (kanan→kiri): Suggestions · theme · Refresh · Export icon (via portal ke slot MobileNav). Campaigns: refresh di top bar, filter rata kanan. Calendar: tanpa theme toggle, tombol rata kanan, tabel Gantt scroll horizontal (minWidth 920px).

## BELUM / PENDING (JANGAN dikerjakan tanpa diminta)

- [ ] Analytics & Insights: upgrade narasi ke LLM asli (Claude API) — v1 rule-based sudah live; butuh API key kalau mau.
- [ ] Integrasi Google Ads / TikTok Ads / All Platforms (selector sudah ada, masih placeholder).
- [ ] Supabase RLS: tabel `public.campaigns` & `public.suggestions` RLS mati. Sengaja dibiarkan dulu. Lihat memory [[supabase-rls-deferred]].
- [ ] Fitur Compare (tombol disabled), notifikasi lonceng, Export CSV/Excel Calendar — placeholder.
- [ ] Verifikasi akurasi angka vs Meta Ads Manager.
- [ ] Upgrade auth ke Supabase Auth (kalau perlu production-secure).
- [ ] Hapus file lama tidak terpakai: `SuggestionsModal.js`, `BarChart.js`, `Navbar.js`.

---

## CATATAN VERIFIKASI (sesi ini)

Tool screenshot preview SERING timeout di environment ini. Kalau begitu, verifikasi lewat `preview_eval` (baca computed style / teks DOM / cek network request) — sudah terbukti reliable. Build cek: `npm run build`.
