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
  campaigns/page.js      → Tabel kampanye Meta (read-only). Filter kalender dual-month. Kolom: …CPL + Total Spend. **SORT kolom** (klik header: klik1 tertinggi → klik2 terendah → klik3 default; Campaign mulai A–Z). Sort berlaku DI DALAM tiap grup objektif & tetap menghormati "active di atas"; nilai kosong (—) selalu di bawah. Chip penanda sort muncul di baris nama objektif (klik = reset). **getResult() objective-aware**: kalau objective Meta = OUTCOME_AWARENESS/BRAND_AWARENESS/REACH → result Reach/Impressions meski nama campaign mengandung "TRAFFIC" (kasus nyata "KTBR TRAFFIC - Depo Baru : Jakarta Timur"). Grup tabel tetap dari objective, metrik dashboard tetap dari NAMA (tidak diubah).
  calendar/page.js       → CRUD jadwal iklan via Supabase (tabel `campaigns`). RBAC: create/edit/delete admin-only. Pill Status di tabel = dropdown inline (admin): klik pill → pilih Draft/Running/Done langsung tanpa buka modal Edit (dropdown fixed-position biar tak kepotong scroll tabel, update optimistik). Urutan tabel (per 6 Agu 2026): grup objektif → tanggal mulai tercepat di atas. Banner reminder "N campaigns starting within 3 days" SUDAH DIHAPUS 6 Agu 2026 atas permintaan Nadir (penanda hari ini di Gantt sudah cukup) — jangan dimunculkan lagi tanpa diminta. Input Daily Budget di modal = titik ribuan otomatis saat mengetik (tampilan id-ID, state digit mentah — pola sama dgn popup Edit Budget di Campaigns).
  reports/page.js        → ANALYTICS & INSIGHTS (v1, DATA REAL): Performance Score gauge (0-100) + kartu insight otomatis dari data Meta (rule-based via insightEngine.js). Filter periode preset (default This month). Fetch pakai mode=dashboard yang sama — JANGAN diubah. Mobile: refresh via portal top bar, dropdown rata kanan.
  leads/page.js          → LEADS HUB Dashboard v3.1 "Forest Panel" (LIVE, English UI, redesain G1 18 Jul 2026 — desktop FIT 1 LAYAR). Desktop atas→bawah: KPI pair (Total Leads + sparkline harian real dari created_at · Follow-up + meter barcode) → PANEL FOREST #14382A "Leads by Status" (donut reusable + 5 tile ber-track, warna PANEL_STATUS_COLOR, Deal=lime) → baris compact Leads by Sales (strip inline per sales) + By Category → baris uang DORMANT: Total Closing & Cost&ROI abu-abu mati (bg hover + border dashed) saat deals=0, menyala + ring ROAS saat ada Deal. Rumus tetap: ROAS=closing/spend, ROI=(closing−spend)/spend, cohort by created_at. Banner Inbox admin desktop = chip "N in Black Box" di header. Mobile = layout lama (KPI 3 kartu dst). Filter tanggal (useLeadsFilter) + kategori. Spend via GET /api/leads?mode=spend.
  leads/list/page.js     → LEADS HUB Leads List v3.0 (LIVE, English UI): tab "BLACK BOX" admin (approve/reject, bulk context-aware) + All Leads. **Bulk follow-up cerdas**: tombol "Mark followed-up" & "Unmark followed-up" muncul sesuai isi centang (semua belum → Mark saja; semua sudah → Unmark saja; campuran → dua-duanya + jumlah masing-masing). **Sensor kontak role `user`**: phone 6 digit terakhir → xxxxxx, email → 2 huruf + xxxxxx + domain; tombol copy nomor disembunyikan & pencarian by phone/email dimatikan (kalau tidak, sensor bocor). Admin & marketing tetap lihat penuh. Toolbar urut: Black Box · search · All Leads (SPLIT BUTTON: klik nama=pindah tab, klik panah=filter kategori) · All Status · All Sales (di Black Box tampil disabled cursor not-allowed) · Columns (hide/show kolom, persist localStorage wd-leads-cols-hidden). Kolom: Date/Name(+label NEW merah, hilang setelah aksi apa pun via is_new)/Phone(copy)/Email/City(domicile)/Category/Campaign/Sales(warna per orang: Akmel biru, Hendra ungu, Dedik teal)/Status pill/FU/Notes/Closing; data kosong = "-". Popup Deal WAJIB nominal (deal_reason = input teks bebas opsional). Bulk: copy, FU, set status non-Deal, assign sales. Tombol "Add Leads" dropdown (Sync Meta Leads + Import from File placeholder). Header tabel kiri (kolom aksi center), row entrance stagger wdFadeUp. RLS: marketing hanya lead approved, viewer read-only.
  leads/insights/page.js → LEADS HUB Analytics & Insights (masih placeholder — belum didetailkan di MASTER PLAN).
  notes/page.js          → **NOTES (halaman, ADMIN-ONLY)**. Link di Sidebar tepat di BAWAH blok user+logout, di atas tombol Collapse (urutan ditukar 19 Agu 2026 atas permintaan Nadir; bukan di NAV_SECTIONS, tapi berperilaku sama: active state + garis indikator). Role non-admin di-redirect ke homeFor(role); marketing sudah otomatis diblokir AppShell. Catatan pribadi tersinkron antar device via Supabase tabel `notes` (RLS per pemilik). Kiri: daftar + search + pin + hapus (konfirmasi). Kanan: editor contenteditable + execCommand — bold/italic/strikethrough/heading/bullet/numbered/checklist(☐☑ klik toggle)/highlight 4 warna/clear format/salin teks. **Checklist (per 6 Agu 2026): span dibuat manual via Range API (BUKAN insertHTML — Chrome salah naruh kursor di samping span contenteditable=false, tidak bisa diketik) + Enter berperilaku ala bullet list (baris berisi → baris baru ber-checkbox; baris checkbox kosong → checkbox dihapus jadi baris polos) via onEditorKeyDown; spasi pengiring nbsp literal di kode. **Checkbox massal (15 Agu 2026): kalau ada teks yang DI-BLOCK (beberapa baris) lalu klik checkbox → tiap baris dalam seleksi dapat checkbox di awal baris (teks tidak dihapus), seperti bullet/numbered list; kalau SEMUA baris terpilih sudah ber-checkbox → dicabut (toggle). Fungsi `toggleCheckboxOnSelection` (formatBlock div → kumpulkan blok yang `range.intersectsNode`, li dalam ul/ol dihitung per item).** Auto-save 700ms. **ATURAN: innerHTML editor HANYA di-set saat catatan aktif berganti — jangan saat mengetik, kursor akan loncat ke awal.** Pembatas antara kolom daftar & editor bisa DIGESER (pola drag handle Sidebar: transparan, hover → `--br-strong` + cursor col-resize; 210–520px, diingat di localStorage `wd-notes-list-w`). **Urutan catatan bisa DIGESER atas-bawah** (drag handle GripVertical, desktop only, dalam grup pinned/biasa masing-masing) — tersimpan di kolom `notes.sort_order` (butuh `supabase-notes-update-1.sql`; kalau kolom belum ada, Notes tetap jalan + muncul hint SQL, handle disembunyikan). Catatan tanpa sort_order (baru) tampil paling atas. Mobile: satu kolom (daftar ↔ editor via tombol back), pembatas & drag handle tidak dirender. Styling editor di globals.css (`.wd-note-editor`, `.wd-check`). **TO DO ala Microsoft To Do (19 Agu 2026, digabung di halaman Notes):** panel "TO DO" menempel di BAWAH daftar catatan (kolom kiri; pembatasnya bisa digeser atas-bawah, localStorage `wd-notes-todo-h` 150–640px; mobile tinggi 44% tanpa handle). View via Dropdown: My Day (my_day_date = hari ini → otomatis kosong tiap hari baru) · Important (⭐) · Planned (punya due date, urut tenggat) · Tasks (daftar bawaan, list_id NULL) · daftar kustom (nama + warna titik; footer dropdown = New list / Rename / Delete list). Quick add "Add a task…" (Enter) — konteks view ikut (My Day → masuk My Day, Important → ⭐, Planned → due hari ini, list kustom → list itu). Baris tugas: lingkaran selesai · judul · meta (☀ My Day, 📅 due: merah overdue / aksen hari ini, "1/3 steps") · ⭐. Completed (n) dilipat di bawah. **Klik tugas → panel KANAN berganti jadi `TodoDetail`** (judul editable, selesai, ⭐, Steps/sub-tugas JSON, Add to My Day, Due date dropdown Today/Tomorrow/Next week/Pick a date (native date input)/Remove, pindah List, catatan textarea, footer Created/Completed + Delete) — klik catatan → kembali editor (loadedIdRef di-reset supaya innerHTML diisi ulang). Konfirmasi hapus SATU modal generik `confirmDelete = {kind:'note'|'task'|'list', item}`. Data: hook `useTodos.js` (optimistik + debounce 600ms utk teks; tabel `todo_lists` + `todos`, RLS per pemilik; belum ada tabel → hint "run supabase-todo-setup.sql"). Komponen: `TodoPanel.js` (BUILTIN_VIEWS, tasksForView, TaskRow di level modul — JANGAN definisikan komponen baris di dalam komponen, remount tiap render), `TodoDetail.js`, `todoSound.js`. **Tambahan 19 Agu 2026 (sore):** (a) **geser urutan tugas** — tekan kiri di baris (bukan di tombol) → kursor `grabbing` → geser >5px masuk mode drag, baris lain yang dilewati kursor memicu `td.moveTask` (tukar posisi di array global todos), lepas → `td.commitOrder` simpan `sort_order` = index semua tugas; klik sesudah geser ditelan via `suppressClick` ref; urutan load = `sort_order asc nulls first, created_at desc` (tugas baru paling atas); TIDAK berlaku di view Planned (urut tenggat) & baris selesai & mobile. (b) **minimize ala Windows** — tombol `Minus`/`ChevronUp` di header antara "TO DO" dan dropdown view; state `todoMin` (localStorage `wd-notes-todo-min`), kontainer panel `height` transisi 0.34s ke `TODO_HEADER_H` 40px (header panel `minHeight:40px`) — panel menempel di dasar kartu jadi tampak turun & mengecil ke bawah; transisi dimatikan saat pembatas digeser (`todoDragging`); saat minimized quick-add disembunyikan, daftar fade-out, pembatas nonaktif. (c) **suara selesai** — `playDoneSound()` (Web Audio sintesis E5→B5 + kilau, tanpa file audio) saat tugas ditandai selesai (bukan saat dibatalkan), `playStepSound()` lebih halus untuk sub-tugas. Tidak ada reminder/notifikasi (butuh push infra).
  api/leads/route.js     → API Leads Hub, dikunci Supabase Auth. GET mode=spend (admin/user/marketing): total spend campaign PROSPEK/KONVERSI. POST action=sync (admin): tarik leads instant form Meta (2 Pages via /me/accounts → leadgen_forms → leads, filter time_created ≥ SYNC_START '2026-07-17'), dedup meta_lead_id, deteksi kategori dari nama campaign/form (AUTOPILOT/PROVEN/SUKA/REGULER), rapikan HP (+62→08), field tak dikenal → notes, upsert campaign_ref. Leads sebelum SYNC_START = via import file (belum dibangun). maxDuration 60s.
  components/
    AuthContext.js       → SOURCE OF TRUTH: auth (Supabase Auth) + role (app_metadata) + theme (light/dark). Export homeFor(role).
    AppShell.js          → route guard (redirect ke /login kalau belum login; sidebar + main). User suggestion floating button + popup.
    Sidebar.js           → sidebar collapsible+resizable, user info + logout, logo WILL OF D. Menu = NAV_SECTIONS dua section: "Ads Hub" (Dashboard/Campaigns/Calendar/Analytics & Insights) + "Leads Hub" (Dashboard /leads, Leads List /leads/list, Analytics & Insights /leads/insights — placeholder). isActive = exact match pathname. Dipakai juga MobileNav.
    LeadsPlaceholder.js  → shell halaman "under development" Leads Hub (dipakai leads/insights). Props: pageTitle, featureName, Icon.
    leadsConfig.js       → registry Leads Hub: STATUSES, STATUS_COLOR, SALES (Akmel/Hendra/Dedik) + SALES_COLOR, CATEGORIES (value DB → label tampilan, mis. Autopilot → "Package Franchise Autopilot"), kategoriLabel(). Nambah promo/sales = edit di sini.
    Dropdown.js          → dropdown animasi halus reusable (fix bug "jendela loncat": lapisan posisi DIPISAH dari lapisan animasi wdScaleIn). Props: label/icon/options({value,label,color,icon,hint,checked})/value/onSelect/primary/align(left|right|center)/direction(down|up)/keepOpen/footer/disabled(cursor not-allowed)/title/buttonStyle/block (lebar penuh, dipakai baris aksi TodoDetail).
    useTodos.js / TodoPanel.js / TodoDetail.js → fitur To Do di halaman Notes (lihat app/notes/page.js).
    AreaChart.js         → chart "Daily Spend" (smooth area, animasi ganti metrik). Dipakai dashboard.
    ExportMenu.js        → tombol Export + laporan tersembunyi 16:9 (render PDF/JPG). Admin-only. **Palet laporan IKUT tema dashboard** (registry `REPORT_THEME` light/dark + `paletteFor(theme)`, dialirkan sebagai prop `P` ke ReportBody/DonutCard/DailyMultiCard/Pct; `html2canvas backgroundColor` juga pakai `P.BG`). Warna data (green/blue/purple/orange) sama di dua tema; yang beda cuma bg/card/border/teks/aksen/logo tile + `POS` badge % (dark `#2FB673`, light `#16A34A` = --pos). `MUTE` light sengaja `#78857D` (lebih gelap dari --t3 layar) supaya teks kecil tetap kebaca saat dicetak.
    CountUp.js           → animasi angka naik dari 0 ke target.
    Logo.js              → LOGO MARK "Control Hub" (SVG, warna via prop, ikut container/tema).
    ThemeToggle.js       → shared theme toggle button dengan animasi fade transition. Dipakai dashboard + campaigns.
    DateFilterContext.js → shared filter state (terpisah per halaman: dashboard, campaigns, reports & leads). Persist saat pindah tab, reset saat browser refresh.
    DateFilterPopup.js   → popup filter tanggal SHARED (Dashboard+Campaigns+Reports): preset kiri + custom range + kalender dual-month + baris tombol kuartal di bawah kalender + footer, ukuran "tengah" final (SIZES.compact — jangan diubah tanpa diminta). Kuartal versi Baba Rafi = 4 BULAN per kuartal (Q1 Jan–Apr, Q2 May–Aug, Q3 Sep–Dec, tahun berjalan) — klik kuartal = pilih range custom + kalender lompat ke bulan awal, tetap butuh Apply. Desktop only (mobile bottom sheet tidak diubah). Mobile otomatis jadi bottom sheet single-month. Murni tampilan; state & fetch tetap di halaman masing-masing (callback onPickRange).
    CampaignModal.js     → popup detail campaign (klik row di Campaigns): konten iklan di kiri, metrik + platform breakdown di kanan (hero Result+Total Spend, count-up, hover lift, chip brand FB/IG). **Preview konten = MEDIA ASLI full-bleed (per 15 Agu 2026)**: gambar/video (`<video>` autoplay muted loop + controls) diambil dari `ad.media` (API campaign_detail → IG media_url via `effective_instagram_media_id`; carousel → panah kiri/kanan + titik) — TANPA frame embed IG (header profil/footer). Kotak dihitung dari rasio asli media (`MediaPreview`: ResizeObserver area + naturalWidth/videoWidth) jadi portrait/feed otomatis; label kecil pojok kiri atas = platform sumber (Instagram/Facebook, klik → buka post asli); caption nama ad di bawah. **Video default BERSUARA (19 Agu 2026), tombol mute tetap di controls; kalau browser menolak autoplay bersuara → otomatis mute supaya tetap jalan.** Fallback kalau media gagal diambil: embed IG lama (masih ber-frame) + toggle portrait/feed (default portrait, keputusan 7 Agu 2026). Creative tanpa permalink IG (konten Facebook) → gambar creative + label Facebook. Strip thumbnail kalau >1 konten.
    useIsMobile.js       → hook deteksi viewport mobile ≤767px (matchMedia + fallback resize). Dipakai AppShell, dashboard, campaigns, calendar.
    MobileNav.js         → top bar mobile (hamburger morph X + logo + theme toggle) + drawer navigasi slide kiri. Punya 2 slot portal aksi per halaman: #wd-topbar-actions (kiri theme toggle: export/refresh) & #wd-topbar-actions-right (kanan: suggestions admin). Theme toggle disembunyikan di /calendar.
    PlatformSelector.js  → dropdown platform iklan di toolbar dashboard (registry PLATFORMS: Meta/Google/TikTok/All — nambah platform cukup tambah entri). Brand icon inline SVG. Pill aktif pakai --cal-accent (theme-aware).
    PlatformPlaceholder.js → empty state premium "under development" (chip Coming Soon + judul + deskripsi, props title/description bisa di-override). Dipakai dashboard (platform non-Meta) + halaman Reports.
    insightEngine.js     → mesin analisis Analytics & Insights (pure function, tanpa React): buildAnalysis(json API) → { metrics, insights[], score }. 11 rule (tren leads, CPL/CPC/CPM blended vs prev, top performer, kampanye boros vs median grup, konsentrasi budget, momentum, quiet days, reach, spend shift). Komparasi prev pakai angka blended level akun (di-label di kartu). Siap di-upgrade narasi LLM tanpa ubah halaman.
    typography.js        → TYPE: design system token teks (h1-h4, body*, small, caption, overline, table*, metric*, cardTitle, sectionTitle). Dashboard & Reports pakai ini — ubah hierarki teks global dari sini.
    CompareModal.js      → popup **Compare Periods** (Ads Hub; tombol ICON-ONLY di toolbar dashboard SETELAH Export — urutan sejak 7 Agu 2026: filter tanggal → Export icon (compact size 40) → Compare icon → Refresh). Pilih 2 periode; tombol Compare aktif kalau (a) kedua sisi sama-sama N BULAN KALENDER PENUH — Juni 30 hari vs Mei 31 hari tetap boleh — ATAU (b) jumlah harinya persis sama; dan tidak tumpang tindih. Setengah bulan (mis. Mei tapi 29 hari) hanya lolos lewat jalur (b). Helper: `fullMonthSpan()`. Pintasan periode B: previous N days / same range previous month / same range last year. Fetch `mode=dashboard` 2× (since/until). Rumus metrik DISALIN PERSIS dari app/page.js (spend/reach/impressions dari summary; traffic=link click campaign TRAFFIC; leads=campaign CONVERSION; CPM/CPC/CPL/CTR sesuai aturan final) — kalau rumus dashboard berubah, ubah juga di sini. Hasil: 9 metrik + % perubahan A vs B (biaya turun=hijau, hasil naik=hijau) + jumlah campaign & breakdown Awareness/Traffic/Conversion.
    (Notes = HALAMAN, lihat app/notes/page.js — bukan komponen popup)
    CombineModal.js      → popup hitung gabungan campaign terpilih (checkbox di tabel Campaigns → floating bar "Calculate Total"). Agregasi ikut aturan metrik final: Traffic hanya dari campaign TRAFFIC, Leads hanya CONVERSION, CPC/CPL per tipe, CPM semua.
    SuggestionsModal.js  → LAMA, tidak dipakai lagi (logika sudah pindah ke AppShell + page.js).
    BarChart.js, Navbar.js → LAMA, tidak dipakai lagi (boleh dihapus kapan2).
  api/meta/route.js      → server-side fetch Meta Graph API. DIKUNCI Supabase Auth: verifikasi Bearer token → role (GET = admin/user, POST = admin only). GET: mode=dashboard (summary/prevSummary/daily/campaigns/chartRange), mode=campaign_detail (ads+creative+platform breakdown per campaign; per 15 Agu 2026 juga `ad.media` = media asli IG {platform, type, permalink, items[{type VIDEO/IMAGE, url, thumb}]} via `effective_instagram_media_id` → `/{id}?fields=media_type,media_url,thumbnail_url,permalink,children{…}` — CDN IG CORS terbuka; gagal → ad tanpa media, klien fallback embed) & default campaigns. POST: aksi kontrol iklan — action=set_status (ACTIVE↔PAUSED) & action=set_budget (daily_budget level campaign, IDR nilai penuh, min Rp 10.000). Token System User sudah punya izin ads_management (dicek 2026-07-15).
  globals.css            → CSS variables (blok light `:root` + blok `html[data-theme="dark"]`) + keyframes animasi.
  supabase.js            → Supabase client (storage adapter "remember me") + authFetch (fetch dengan Bearer token untuk /api/meta) + setRememberSession.
  supabase-auth-setup.sql (root repo) → SQL setup auth: set role user + RLS campaigns & suggestions. Dijalankan manual di SQL Editor Supabase.
  supabase-leads-setup.sql (root repo) → SQL setup Leads Hub: tabel campaign_ref + leads + lead_history (audit trail via trigger log_lead_changes, security definer) + RLS (admin full; marketing read/update approved; user read approved; history admin-only). Sudah dijalankan 17 Jul 2026.
  supabase-leads-update-1.sql (root repo) → SQL update #1: kolom leads.sales + leads.is_new (label NEW) + trigger audit ikut mencatat sales. Sudah dijalankan 18 Jul 2026.
  supabase-notes-setup.sql (root repo) → SQL tabel `notes` (catatan pribadi + RLS per pemilik + trigger updated_at + kolom sort_order). SUDAH dijalankan (Notes hidup & tersinkron per 19 Agu 2026).
  supabase-todo-setup.sql (root repo) → SQL tabel `todo_lists` + `todos` (To Do di halaman Notes; steps = jsonb; RLS per pemilik; trigger updated_at). **STATUS: BELUM DIJALANKAN Nadir per 19 Agu 2026** — sampai dijalankan, panel To Do menampilkan hint "To Do is not set up yet…".
  supabase-notes-update-1.sql (root repo) → SQL update notes #1: kolom `sort_order` (geser urutan catatan) + trigger updated_at tidak berubah saat cuma geser urutan. Untuk yang sudah terlanjur menjalankan setup versi lama; setup versi terbaru sudah mencakup semuanya.
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
- 3 akun: `nadir.adhub@babarafi.com` (**admin** — tema default Dark, akses penuh: Export, CRUD Calendar, lihat+hapus Suggestions, Stop/Run+Edit Budget), `user.adhub@babarafi.com` (**user**/viewer — Light, read-only + kirim Suggestion; **per 19 Agu 2026 TANPA Analytics & Insights di KEDUA hub** (`/reports` & `/leads/insights`): disembunyikan via `USER_HIDDEN` di `navSectionsFor('user')` + AppShell redirect → `/`; Calendar tetap tampil), `marketing.adhub@babarafi.com` (**marketing** — Light, HANYA Leads Hub; menu Ads Hub tidak dirender, rute Ads Hub di-redirect ke /leads, landing login = /leads).
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
Atas→bawah: **HEADER CARD mengambang** (desktop: kartu putih radius 18, margin 12/16 — bukan borderBottom; mobile tetap 2 baris lama) berisi title + platform selector + filter tanggal + Export admin-only + Refresh + theme toggle + Suggestions admin-only → 5 KPI card SERAGAM putih (count-up + growth badge + sparkline) → **4 KARTU TERPISAH CPM/CPC/CPL/CTR + sparkline tren harian** (icon tile bulat kiri, grafik kanan; tren = basis blended harian level akun, angka utama tetap rumus final per tipe; mobile tetap 1 kartu merged 2x2 TANPA sparkline) → baris analitik 3 kolom `2.8fr 4.2fr 3fr` (Spend Breakdown donut **236px** · Daily Spend AreaChart · Top Campaigns — urut CTR tertinggi dulu, per 3 Agu 2026). **SPACING COMPACT (keputusan Nadir 17 Jul): gap antar kartu/baris 10px, tepi kiri-kanan 16px** — jangan dilonggarkan tanpa diminta. **Angka KPI & strip pakai format PENUH** (mis. `Rp 1.440.076`, bukan `Rp 1.4M`). Fit 1 layar tanpa scroll.
**ATURAN TINGGI BARIS (fit layar tinggi, per 4 Agu 2026)** — dulu ketiga baris dipatok maxHeight tetap (190/96/500) sehingga di layar ≥1080px tersisa pita kosong di bawah. Sekarang: KPI `flex:'1 1 0'` min 150 **max 210**; strip 4C `flex:'0 1 96px'` min 74 (**tidak melar** — isinya cuma ikon + 2 baris teks, kalau ditinggikan malah kosong); baris analitik `flex:'1 1 0'` min 260 **max 820** = penyerap utama sisa tinggi (donut/AreaChart/Top Campaigns memang dibuat mengisi tinggi). Efeknya layar ~900–1260px terisi penuh; di atas itu cap 820 sengaja menahan biar tidak melar aneh. Jangan kembalikan ke maxHeight tetap.

### Filter Tanggal (Dashboard, Campaigns & Reports) — kalender dual-month via DateFilterPopup.js
Preset di kiri + kalender 2 bulan di kanan (pilih range langsung) + footer Cancel/Apply. Default **"This month"**. Preset Dashboard & Reports: Today…Last month. Preset Campaigns sama + tambahan "Last 3 days". State dikelola `DateFilterContext` (terpisah per halaman) — persist saat pindah tab via client-side navigation, reset ke "This month" saat browser refresh. Tombol Refresh hanya refresh data, TIDAK reset filter. Custom range → `/api/meta?...&since=&until=`. **Logika fetch JANGAN diubah.**

---

## PRINSIP WAJIB (DITEKANKAN USER)

1. **AKSEN FOREST/LIME KONSISTEN DUA TEMA** (menggantikan aturan lama aksen-per-tema, 17 Jul 2026) — light = emerald `#1E6B4B`, dark = lime `#C8F169`, satu keluarga hijau. Jangan hardcode warna aksen di komponen; SELALU pakai CSS var theme-aware (`--cal-*`, `--nav-accent-*`, `--ac`, `--accent-*` di globals.css). Lihat memory [[accent-per-theme]].
2. **SPACING PROPORSIONAL** — jarak/padding proporsional, jangan mepet sidebar/tepi. Konten butuh "nafas".
3. **ANIMASI = DNA PROJECT** — count-up, area/donut draw, hover interaktif, glow logo, theme fade transition, suggestion slide-up. Keyframes di globals.css: `wdSpinGlow`, `wdSpinGlowGreen`, `wdFadeUp`, `wdPulseDot`, `wdScaleIn`, `wdSlideUp`, `wdSweep`, `wdSpin`, + keyframe TUTUP `wdFadeOut`, `wdSlideDown`, `wdDrawerOut` (19 Agu 2026). **ATURAN animasi tutup popup: WAJIB keyframe terpisah — `animation-direction: reverse` pada animasi masuk yang sudah selesai TIDAK diputar ulang browser (popup langsung hilang); dulu CampaignModal/CombineModal/Suggestions/drawer mobile kena bug ini.** Durasi setTimeout sebelum unmount = durasi keyframe tutup (200ms / drawer 230ms). Theme transition = opacity fade di `ThemeToggle.js`.
4. **RESPONSIVE FULL-WIDTH** — fit kanan-kiri penuh di desktop lebar berapa pun. Layout fluid (`flex:1` + `minWidth:0`, grid `minmax(0,1fr)`). Versi mobile (≤767px via `useIsMobile`) SUDAH ADA dan final — perubahan mobile TIDAK BOLEH mempengaruhi desktop sedikit pun (selalu gate dengan `isMobile`).
5. **DASHBOARD FIT-TO-SCREEN** (khusus halaman Dashboard) — konten muat 1 layar tanpa scroll (`height:100vh` + flex column, chart `flex:1`). Boleh scroll dikit di layar pendek. KHUSUS dashboard, bukan halaman lain.

---

## FITUR YANG SUDAH SELESAI (semua live)

- ✅ Dashboard KPI real (5 card + growth badge + sparkline), strip CPM/CPC/CPL/CTR, Spend Breakdown donut (interaktif, angka penuh), Daily Spend AreaChart, Top Campaigns.
- ✅ Filter tanggal kalender dual-month inline (Dashboard + Campaigns), default This month. Filter terpisah per halaman, persist saat pindah tab, reset saat browser refresh.
- ✅ Campaigns: tabel per grup (Awareness→Traffic→Conversion), subtotal toggle (default hidden), kolom Total Spend. Status "Stop" (bukan "Paused"), tampilan non-active normal (tidak abu-abu), urutan active di atas.
- ✅ Export laporan PDF/JPG 16:9 (admin-only) — hasil export mengikuti tema dashboard yang sedang aktif (terang → laporan terang, gelap → laporan gelap), per 4 Agu 2026.
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
- ✅ Compare Periods (Ads Hub): bandingkan 2 periode berdurasi sama, 9 metrik + % perubahan + jumlah campaign & breakdown objektif. Lihat `CompareModal.js`.
- ✅ Notes admin (HALAMAN `/notes`, link di Sidebar atas logout): catatan pribadi tersinkron antar device via Supabase — butuh `supabase-notes-setup.sql` dijalankan dulu.
- ✅ Popup toolbar dashboard rata tengah terhadap tombolnya (Platform selector & Export). CATATAN TEKNIS: lapisan POSISI (`translateX(-50%)`) WAJIB dipisah dari lapisan ANIMASI (`wdScaleIn`/`wdSlideUp` pakai transform) — kalau digabung, popup nongol meleset dulu baru lompat. Pola sama dipakai bulk bar Leads List.
- ✅ Platform selector di toolbar dashboard (Meta Ads default; Google/TikTok/All Platforms tampil placeholder "under development"). Registry di `PlatformSelector.js`.
- ✅ Typography system (`typography.js`) diterapkan ke Dashboard + Reports — ukuran visual tidak berubah, cuma distandarkan lewat token.
- ✅ Analytics & Insights v1 (route /reports, icon Sparkles): Performance Score gauge + insight cards otomatis dari data Meta real (insightEngine.js), filter periode, severity critical→warning→positive→info, desktop grid 3 kolom / mobile stack.
- ✅ Kontrol iklan admin-only di Campaigns: kolom Actions (setelah Status) dengan tombol Stop/Run (ACTIVE↔PAUSED, popup konfirmasi merah/hijau) + Edit Daily Budget (popup input format Rupiah, min Rp 10.000, level campaign sesuai SOP Nadir — TIDAK PERNAH level ad set). Setelah sukses: update lokal optimistik + toast. Role user tidak melihat kolom ini. Status Ended tidak bisa di-run lagi. Endpoint POST /api/meta sudah diamankan server-side (admin only, via Supabase Auth token).
- ✅ Sidebar dua section: "ADS HUB" (menu lama) + "LEADS HUB" (Dashboard, Leads List, Analytics & Insights — 3 halaman placeholder "under development" via LeadsPlaceholder.js). Berlaku desktop (Sidebar) & mobile (drawer MobileNav). Nama produk fix: **"Baba Rafi Ad Hub"** (pakai spasi). Leads Hub beneran = rencana v3.0 (lihat BRD/PRD Nadir).
- ✅ Versi mobile (≤767px, desktop tak berubah): top bar hamburger→drawer, KPI carousel swipe scroll-snap, strip 2x2, analytics stack, date filter bottom sheet. Top bar dashboard (kanan→kiri): Suggestions · theme · Refresh · Export icon (via portal ke slot MobileNav). Campaigns: refresh di top bar, filter rata kanan. Calendar: tanpa theme toggle, tombol rata kanan, tabel Gantt scroll horizontal (minWidth 920px).

## BELUM / PENDING (JANGAN dikerjakan tanpa diminta)

- [ ] Leads Hub: IMPORT file export spreadsheet lama (leads < 17 Jul 2026) + smart grouping — Nadir akan kirim file CSV/Excel.
- [ ] Leads Hub: REDESAIN dashboard & list (Nadir cari referensi Pinterest; usulkan design dulu → approve → terapkan; UI sekarang = fondasi fungsional).
- [ ] Leads Hub: Analytics & Insights (placeholder; kemungkinan AI-generated, belum didetailkan).
- [ ] Leads Hub: kolom assigned_to sudah ada di DB tapi belum ada UI-nya (nunggu ada banyak akun marketing).
- [ ] Analytics & Insights Ads Hub: upgrade narasi ke LLM asli (Claude API) — v1 rule-based sudah live; butuh API key kalau mau.
- [ ] Integrasi Google Ads / TikTok Ads / All Platforms (selector sudah ada, masih placeholder).
- [ ] Notifikasi lonceng — placeholder. (Tombol Export di Calendar SUDAH DIHAPUS 4 Agu 2026 atas permintaan Nadir — jangan dimunculkan lagi tanpa diminta.)
- [ ] **To Do: Nadir jalankan `supabase-todo-setup.sql` di Supabase SQL Editor** (sekali saja) supaya panel To Do di halaman Notes hidup.
- [ ] Verifikasi akurasi angka vs Meta Ads Manager.
- [ ] Hapus file lama tidak terpakai: `SuggestionsModal.js`, `BarChart.js`, `Navbar.js`.

---

## CATATAN VERIFIKASI (sesi ini)

Tool screenshot preview SERING timeout di environment ini. Kalau begitu, verifikasi lewat `preview_eval` (baca computed style / teks DOM / cek network request) — sudah terbukti reliable. Build cek: `npm run build`.
