# MAPS HUB — Rencana Eksekusi Final

Status: **DIEKSEKUSI 21 Agu 2026 — kode selesai & di-push.** Tinggal 2 langkah manual Nadir: jalankan `supabase-maps-setup.sql` + tambah env `MAPS_SHEET_ID` di Vercel (lihat CLAUDE.md bagian pending).
Sumber: `Baba_Rafi_Maps_Hub_Brief_Final.md` (Downloads) + sesi pematangan bersama Claude Code, 21 Agu 2026 (semua keputusan di bawah sudah disetujui Nadir).

**Deviasi eksekusi (21 Agu 2026):** geocoding kota TIDAK jadi via script lokal (opsi A) — script lokal tidak bisa menulis ke Supabase tanpa kredensial admin (password dipegang Nadir, tidak boleh ditulis di file). Gantinya: tombol **"Geocode now"** di halaman /maps — klien memanggil API berulang (batch 35 outlet/panggilan, 1.1 detik/outlet sesuai rate limit Nominatim, progress bar + tombol Stop, hasil di-cache permanen). Efeknya sama (sekali jalan ±8 menit), UX lebih baik, tetap patuh limit 60 detik Vercel.

---

## 1. RINGKASAN

Modul baru di Baba Rafi Ad Hub untuk memvisualisasikan & memonitor status pendaftaran Google Maps 500+ outlet Kebab Turki Baba Rafi. Data dari Google Sheets (read-only), sync manual via tombol, peta Leaflet + clustering. Fase 1: admin-only.

## 2. SUMBER DATA (SUDAH DIVERIFIKASI LANGSUNG 21 Agu 2026)

- Spreadsheet: "Google My Business Outlet Kebab Turki Baba Rafi", **tab `GOOGLE MAPS OUTLET` SAJA** (tab GOOGLE MAPS MITRA = fase berikutnya, keputusan Nadir).
- **Akses TANPA service account**: sheet sudah "anyone with link can view" → server baca via endpoint gviz CSV (`https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet=GOOGLE%20MAPS%20OUTLET`). Sudah dites & berhasil (516 baris, 211KB).
- **Sheet ID JANGAN di-commit ke repo** → simpan di `.env.local` + Vercel env sebagai `MAPS_SHEET_ID`. (Sudah ditambahkan ke `.env.local` 21 Agu 2026; saat eksekusi jangan lupa tambah juga di Vercel → Settings → Env Variables → Redeploy.)
- Kalau suatu saat sharing sheet diketatkan → sync berhenti → baru upgrade ke Google service account (disetujui Nadir).
- Header di **baris 1**, data mulai baris 2. **Baca kolom BERDASARKAN NAMA HEADER**, bukan posisi (tahan kolom geser/tambah). Kolom dipakai: No, Nama Outlet, Depo, Alamat, Titik Ordinat, Nomor HP, Nama Lama, Nama Google Maps, Profile Bisnis, Link Google Maps, Catatan. Kolom ekstra yang ADA di sheet tapi TIDAK dipakai fase 1: Nomor GM, Tipe Outlet, Jam Buka, Umroh, Email.
- Fakta data per 21 Agu 2026: 516 baris (500 bernama), status 465 "Sudah di Daftarkan" / 30 "Belum di Daftarkan" / 5 "Perlu Klaim Bisnis" (persis 3 nilai dropdown, bersih), 111 baris Nama Lama terisi (riwayat relokasi lama — aman untuk logika diff, tidak akan salah tembak), ±25 depo.

## 3. SYNC ENGINE (tombol "Sync Sekarang", manual)

Kunci matching antar sync = **Nama Outlet** (tidak bikin ID baru, tidak nulis apa pun ke sheet).

Deteksi perubahan (bandingkan vs snapshot terakhir di Supabase):
1. **Outlet Baru** — nama baru muncul, Nama Lama kosong.
2. **Relokasi** — nama baru muncul, Nama Lama-nya cocok dengan nama di snapshot lama → outlet sama, perlu update listing Maps.
3. **Perubahan Info** — nama sama, tapi berubah di kolom: **Alamat, Titik Ordinat, atau Nama Google Maps SAJA** (perubahan Status/Link/Catatan/HP tetap tersimpan tapi TIDAK memicu alert — keputusan Nadir, biar alert tidak jadi sampah).
4. **Hilang dari sheet** — nama ada di snapshot lama tapi tidak ada di data baru → JANGAN auto-hapus; alert "Hilang dari sheet — cek manual".
5. **Baris tanpa Nama Outlet** → dilewati, tapi jumlahnya dilaporkan di ringkasan sync (per 21 Agu 2026 ada 16 baris begini — data parkiran Nadir, akan dipindah/dibersihkan).

## 4. ALERT

Dua jenis alert:

**A. Alert kerjaan Google Maps** (dari status + sync):
| Kondisi | Alert |
|---|---|
| Profile Bisnis = "Belum di Daftarkan" | Perlu didaftarkan (hilang sendiri saat status diubah di sheet) |
| Profile Bisnis = "Perlu Klaim Bisnis" | Perlu diklaim (hilang sendiri saat status diubah) |
| Relokasi terdeteksi | Perlu update listing Maps |
| Perubahan Info terdeteksi | Perlu cek/update info di Maps |
| Hilang dari sheet | Cek manual |

Alert Relokasi / Perubahan Info / Hilang punya tombol **"Mark as done"** — nulis ke database Maps Hub SENDIRI, BUKAN ke sheet (prinsip read-only sheet tetap terjaga; keputusan Nadir).

**B. Alert Data Quality** (fitur tambahan hasil diskusi — keputusan Nadir, supaya bisa bersih-bersih sheet bertahap):
- Nama Outlet duplikat (duplikat TIDAK diproses diff, ditampilkan sebagai peringatan; per 21 Agu 2026 ada 7 pasang — lihat Section 8)
- Koordinat gagal parse / di luar rentang Indonesia
- Depo kosong
- Jumlah baris dilewati (tanpa Nama Outlet)

## 5. KOORDINAT

Format sheet: lat,lng dalam satu cell (LATITUDE DULU). **Parser pintar wajib menangani** (semua varian ini NYATA ada di data):
- Normal: `-8.6981934,114.62...`
- Koma desimal Indonesia: `-6,2433080, 106,9944750` (split koma → 4 bagian → gabungkan berpasangan)
- Derajat DMS: `7°32'16.2"S 112°15'01.4"E` (konversi ke desimal)
- Berkurung: `(-7.9393159, 112.6351585)`
- Spasi tanpa koma: `-7.515385 112.565427`
- Koma buntut: `-7.4916944,112.2268014,`

Validasi: lat -11..6, lng 94..142 (rentang Indonesia). Gagal parse / di luar rentang / kosong → **Needs Review** (bagian Data Quality), tidak ditampilkan sebagai marker di lokasi salah. Per 21 Agu 2026 tersisa 2 baris tak terselamatkan: SPBU Sumobito (kosong) & Gempol Rest Area ("non online") — outlet offline, biarkan di Needs Review.

## 6. WILAYAH & PETA

- **Depo** — langsung dari kolom Depo.
- **Provinsi** — mapping Depo → Provinsi disimpan di **tabel Supabase + UI dropdown di Maps Hub sendiri** (BUKAN file config di kode — keputusan Nadir karena depo terus berkembang). Depo baru terdeteksi otomatis saat sync → peringatan "N depo belum dipetakan" → Nadir pilih provinsi dari dropdown. Outlet depo tak terpetakan tetap tampil, provinsinya "Belum dipetakan".
- **Kota** — reverse-geocode Nominatim (OSM) **1x via SCRIPT LOKAL saat development** (BUKAN serverless — 500 req × 1 detik ≈ 9 menit > limit 60 detik Vercel; keputusan Nadir opsi A), hasil cache di Supabase. Outlet baru berikutnya di-geocode maks ±30 per sync (muat di 60s). Rate limit 1 req/detik + User-Agent jelas + atribusi OpenStreetMap WAJIB.
- **Peta**: Leaflet + OpenStreetMap tiles + **clustering wajib** (react-leaflet, dynamic import `ssr:false` — Leaflet tidak bisa SSR). Klik marker → detail: Nama Outlet, Depo, Alamat, Status, Link Google Maps, Catatan (+ Nomor HP opsional). Tile tema dark: putuskan saat eksekusi (opsi: Carto dark / tetap terang).

## 7. AKSES & INTEGRASI KE AD HUB

- **ADMIN-ONLY fase 1** (pola halaman Notes: non-admin di-redirect). Role user menyusul kalau sistem sudah matang — keputusan Nadir.
- Sidebar: section baru "MAPS HUB" di bawah LEADS HUB.
- Rencana file: `app/maps/page.js`, `app/api/maps/route.js` (GET data+alerts; POST action=sync / mark_done / set_provinsi — dikunci Supabase Auth pola `api/leads`), `supabase-maps-setup.sql` (tabel: `maps_outlets` snapshot, `maps_alerts`, `maps_geocode_cache`, `maps_depo_provinsi`; RLS admin-only).
- Desain ikut DNA project: forest/lime dua tema, header card, animasi, CSS var — lihat CLAUDE.md.

## 8. PR BERSIH-BERSIH SHEET (Nadir, dicicil — TIDAK memblokir eksekusi)

- [ ] 7 duplikat Nama Outlet: SPBU Al Ma'soem Ceuri (No 15 vs 324 → yg 324 = Balen), SPBU Raya Bojongsoang (16 vs 18 → yg 18 = Amir Machmud Cimahi), Semeru (100 Malang vs 404 Mojokerto), Wahidin (178 Sidoarjo vs 358 Pasuruan) → rename biar unik; RC Veteran 4 (282 vs 326), Karang Tengah (357 vs 378), Alfamidi Margacinta (483 vs 485) → alamat sama persis, cek dobel entry.
- [ ] Depo seragam: "Jakarta" (No 393, 394) = "DKI Jakarta"; "Tangerang Kota" (No 441) = "Kota Tangerang"; depo kosong (No 383). Sebelum rapi: filter depo menampilkan dua varian, tapi provinsi tetap benar via mapping.
- [x] 16 baris tanpa Nama Outlet → SUDAH dibersihkan Nadir (21 Agu 2026 sore, terverifikasi — tinggal 1 baris).
- [x] "mataram" → sudah diganti (21 Agu 2026).
- [x] 2 koordinat tanpa minus (Indomaret Pesantren Jombang, SPBU Mondoroko) → sudah dibenerin (21 Agu 2026, diverifikasi).
- [ ] TEMUAN BARU: "Indomart Pandu Raya 2" koordinatnya berformat **Plus Code Google** (`CR68+XC Tegal Gundil…`) — bukan lat,lng, tidak bisa diparse → Needs Review. Ganti di sheet dengan koordinat biasa (klik kanan titik di Google Maps → angka lat,lng → copy).

## 9. DITUNDA / IDE TERSIMPAN (JANGAN dikerjakan tanpa diminta)

- Popup detail menampilkan **Tipe Outlet & Jam Buka** (usulan Claude; Nadir bilang gausah dulu, simpan di sini).
- **Deteksi outlet tutup**: kolom Tipe Outlet berisi ±12 tanda "Tutup/Closed/Tidak Ada Outletnya" padahal sebagian statusnya masih "Sudah di Daftarkan" → alert "outlet tutup tapi listing Maps masih aktif". Nadir: skip dulu.
- Tab **GOOGLE MAPS MITRA**.
- Fase 2 brief asli: import PDF rating QC/Audit, edit status dari Maps Hub, multi-user/role, location intelligence.
- Upgrade ke Google service account (hanya kalau sharing sheet diketatkan).
