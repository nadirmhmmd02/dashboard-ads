-- ============================================================
-- BABA RAFI AD HUB — SETUP MAPS HUB (monitoring Google Maps outlet)
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
--
-- Lihat MAPS-HUB-PLAN.md untuk konteks lengkap. Semua tabel
-- ADMIN-ONLY (fase 1) — dijaga RLS via app_metadata.role di JWT.
-- Sumber data = Google Sheets (read-only); tabel ini hanya
-- snapshot + hasil olahan Maps Hub sendiri.
-- ============================================================

-- ── 1. Snapshot outlet (hasil sync terakhir) ─────────────────
create table if not exists public.maps_outlets (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null unique,          -- kunci matching antar sync
  depo          text,
  alamat        text,
  ordinat_raw   text,                          -- isi cell apa adanya (audit)
  lat           double precision,              -- hasil parse (null = gagal)
  lng           double precision,
  coord_error   text,                          -- alasan gagal parse / di luar Indonesia
  nomor_hp      text,
  nama_lama     text,
  nama_gmaps    text,
  status        text,                          -- kolom "Profile Bisnis" apa adanya
  link_gmaps    text,
  catatan       text,
  kota          text,                          -- hasil reverse-geocode (cache)
  row_no        text,                          -- kolom "No" di sheet (bantuan cari baris)
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  missing_since timestamptz,                   -- terisi kalau hilang dari sheet
  updated_at    timestamptz not null default now()
);

create index if not exists maps_outlets_depo_idx   on public.maps_outlets (depo);
create index if not exists maps_outlets_status_idx on public.maps_outlets (status);

-- ── 2. Alert (relokasi / perubahan info / hilang) ────────────
-- Alert "Belum di Daftarkan" & "Perlu Klaim" TIDAK disimpan di sini —
-- dihitung langsung dari kolom status (hilang sendiri saat sheet diubah).
create table if not exists public.maps_alerts (
  id          uuid primary key default gen_random_uuid(),
  outlet_nama text not null,
  type        text not null check (type in ('relokasi','perubahan_info','hilang')),
  detail      jsonb,                           -- field yang berubah, nama lama, dsb.
  status      text not null default 'open' check (status in ('open','done')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists maps_alerts_open_idx on public.maps_alerts (status, created_at desc);

-- ── 3. Mapping Depo → Provinsi (diisi via UI Maps Hub) ───────
create table if not exists public.maps_depo_provinsi (
  depo       text primary key,
  provinsi   text not null,
  updated_at timestamptz not null default now()
);

-- ── 4. Cache reverse-geocode kota (Nominatim, 1x per koordinat) ──
create table if not exists public.maps_geocode_cache (
  coord_key  text primary key,                 -- "lat,lng" dibulatkan 5 desimal
  kota       text,                             -- null = sudah dicoba tapi tak ketemu
  created_at timestamptz not null default now()
);

-- ── 5. Log sync (ringkasan tiap tekan "Sync") ────────────────
create table if not exists public.maps_sync_log (
  id      uuid primary key default gen_random_uuid(),
  run_at  timestamptz not null default now(),
  summary jsonb not null                        -- {baru, relokasi, berubah, hilang, dilewati, duplikat, total}
);

create index if not exists maps_sync_log_run_idx on public.maps_sync_log (run_at desc);

-- ── 6. RLS: SEMUA tabel admin-only (fase 1) ──────────────────
alter table public.maps_outlets       enable row level security;
alter table public.maps_alerts        enable row level security;
alter table public.maps_depo_provinsi enable row level security;
alter table public.maps_geocode_cache enable row level security;
alter table public.maps_sync_log      enable row level security;

drop policy if exists "maps_outlets_admin"       on public.maps_outlets;
drop policy if exists "maps_alerts_admin"        on public.maps_alerts;
drop policy if exists "maps_depo_provinsi_admin" on public.maps_depo_provinsi;
drop policy if exists "maps_geocode_cache_admin" on public.maps_geocode_cache;
drop policy if exists "maps_sync_log_admin"      on public.maps_sync_log;

create policy "maps_outlets_admin" on public.maps_outlets
  for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "maps_alerts_admin" on public.maps_alerts
  for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "maps_depo_provinsi_admin" on public.maps_depo_provinsi
  for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "maps_geocode_cache_admin" on public.maps_geocode_cache
  for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "maps_sync_log_admin" on public.maps_sync_log
  for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 7. CEK HASIL (opsional) ──────────────────────────────────
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'maps_%'
order by table_name;
