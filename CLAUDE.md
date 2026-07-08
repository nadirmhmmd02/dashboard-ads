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
- **Database:** Supabase (ref `tduskxqmsqcgurvxnjzo`, region Tokyo) — dipakai halaman Calendar.
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
  layout.js              → AuthProvider + AppShell + no-flash theme script. <html data-theme> di-set dari role+preferensi.
  page.js                → DASHBOARD (DATA REAL Meta). Semua logika kalkulasi metrik ada di sini.
  login/page.js          → Halaman login (tema amber/light, kartu putih).
  campaigns/page.js      → Tabel kampanye Meta (read-only). Filter kalender dual-month. Kolom: …CPL + Total Spend.
  calendar/page.js       → CRUD jadwal iklan via Supabase (tabel `campaigns`). RBAC: create/edit/delete admin-only.
  reports/               → BELUM DIBUAT → nav "Reports" masih 404. (Next step.)
  components/
    AuthContext.js       → SOURCE OF TRUTH: auth + role + theme (light/dark). localStorage/sessionStorage.
    AppShell.js          → route guard (redirect ke /login kalau belum login; sidebar + main).
    Sidebar.js           → sidebar collapsible+resizable, user info + logout, logo Control Hub + glow.
    AreaChart.js         → chart "Daily Spend" (smooth area, animasi ganti metrik). Dipakai dashboard.
    ExportMenu.js        → tombol Export + laporan tersembunyi 16:9 (render PDF/JPG). Admin-only.
    CountUp.js           → animasi angka naik dari 0 ke target.
    Logo.js              → LOGO MARK "Control Hub" (SVG, warna via prop, ikut container/tema).
    BarChart.js, Navbar.js → LAMA, tidak dipakai lagi (boleh dihapus kapan2).
  api/meta/route.js      → server-side fetch Meta Graph API. mode=dashboard (summary/prevSummary/daily/campaigns/chartRange) & default campaigns.
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

- **Admin** → `Dozan` / `Dozan213` — default tema **Dark**, akses penuh (Export, Create/Edit/Delete Calendar).
- **User** → `babarafi` / `babarafi123` — default tema **Light**, read-only (tanpa Export, tanpa CRUD Calendar).
- Tema terakhir yang dipilih user menimpa default saat login ulang (tersimpan per-role).
- ⚠️ Auth ini CLIENT-SIDE (password kelihatan di kode) — belum production-secure. Upgrade ke Supabase Auth kalau perlu.

---

## TEMA & DESAIN (palet final — semua via CSS var di `globals.css`)

Dua tema: light (`:root`) & dark (`html[data-theme="dark"]`).
- **Light:** bg `#F7F8FA`, card `#FFF`, border `#E5E7EB`, teks `#111827`/`#6B7280`; **sidebar aksen amber**.
- **Dark (final, jangan diubah):** bg `#090A0C`, card `#121417`, border `#23262C`, teks `#FFF`/`#9CA3AF`; **sidebar aksen hijau**.
- **Aksen umum:** green `#8BE34D`, blue `#3B82F6`, purple `#8B5CF6`, orange/amber `#F59E0B`.

### Dashboard (`app/page.js`) — DATA REAL
Atas→bawah: header (title + filter tanggal + Export admin-only + Refresh + theme toggle) → 5 KPI card (Total Spend, Reach, Impressions, Traffic, Leads — count-up + growth badge vs periode sebelumnya + sparkline) → strip 4 metrik (CPM/CPC/CPL/CTR) → baris analitik 3 kolom (Spend Breakdown donut · Daily Spend AreaChart · Top Campaigns). **Angka KPI & strip pakai format PENUH** (mis. `Rp 1.440.076`, bukan `Rp 1.4M`). Fit 1 layar tanpa scroll.

### Filter Tanggal (Dashboard & Campaigns) — kalender dual-month inline
Preset di kiri + kalender 2 bulan di kanan (pilih range langsung) + footer Cancel/Apply. Default **"This month"**. Preset Dashboard: Today…Last month. Preset Campaigns sama + tambahan "Last 3 days". State: `customSince/customUntil` (format `YYYY-MM-DD`), `isCustom`. Custom range → `/api/meta?...&since=&until=`. **Logika fetch JANGAN diubah.**

---

## PRINSIP WAJIB (DITEKANKAN USER)

1. **AKSEN PER TEMA** — dark mode = aksen **hijau** (`#8BE34D`), light mode = aksen **oren/amber** (`#F59E0B`, teks amber gelap `#B45309`). Berlaku untuk SEMUA komponen. Jangan hardcode hijau untuk elemen aksen; pakai CSS var theme-aware (pola `--cal-*` di globals.css untuk kalender). Lihat memory [[accent-per-theme]].
2. **SPACING PROPORSIONAL** — jarak/padding proporsional, jangan mepet sidebar/tepi. Konten butuh "nafas".
3. **ANIMASI = DNA PROJECT** — count-up, area/donut draw, hover interaktif, glow logo. Keyframes di globals.css: `wdSpinGlow`, `wdSpinGlowGreen`, `wdFadeUp`, `wdPulseDot`, `wdScaleIn`, `wdSweep`, `wdSpin`.
4. **RESPONSIVE FULL-WIDTH** — fit kanan-kiri penuh di desktop lebar berapa pun. Layout fluid (`flex:1` + `minWidth:0`, grid `minmax(0,1fr)`). Fokus desktop; mobile bukan prioritas.
5. **DASHBOARD FIT-TO-SCREEN** (khusus halaman Dashboard) — konten muat 1 layar tanpa scroll (`height:100vh` + flex column, chart `flex:1`). Boleh scroll dikit di layar pendek. KHUSUS dashboard, bukan halaman lain.

---

## FITUR YANG SUDAH SELESAI (semua live)

- ✅ Dashboard KPI real (5 card + growth badge + sparkline), strip CPM/CPC/CPL/CTR, Spend Breakdown donut (interaktif, angka penuh), Daily Spend AreaChart, Top Campaigns.
- ✅ Filter tanggal kalender dual-month inline (Dashboard + Campaigns), default This month.
- ✅ Campaigns: tabel per grup (Awareness→Traffic→Conversion), subtotal toggle, kolom Total Spend (paling kanan, setelah CPL).
- ✅ Export laporan PDF/JPG 16:9 (admin-only).
- ✅ Light/Dark mode (CSS var, satu source of truth di AuthContext), toggle di header dashboard.
- ✅ Auth + Role (admin/user) + route guard.
- ✅ Rebranding logo **Control Hub** (ganti ikon petir lama) di sidebar, login, export, favicon.

## BELUM / PENDING (JANGAN dikerjakan tanpa diminta)

- [ ] `app/reports/page.js` belum dibuat → nav Reports 404.
- [ ] Supabase RLS: tabel `public.campaigns` RLS mati (advisor CRITICAL). Sengaja dibiarkan dulu (data tidak sensitif). Lihat memory [[supabase-rls-deferred]].
- [ ] Theme toggle belum ada di halaman Campaigns (cuma di Dashboard) — tema ikut pilihan terakhir.
- [ ] Fitur Compare (tombol disabled), notifikasi lonceng, Export CSV/Excel Calendar, Google Ads integration — placeholder.
- [ ] Verifikasi akurasi angka vs Meta Ads Manager.
- [ ] Upgrade auth ke Supabase Auth (kalau perlu production-secure).

---

## CATATAN VERIFIKASI (sesi ini)

Tool screenshot preview SERING timeout di environment ini. Kalau begitu, verifikasi lewat `preview_eval` (baca computed style / teks DOM / cek network request) — sudah terbukti reliable. Build cek: `npm run build`.
