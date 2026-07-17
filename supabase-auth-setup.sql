-- ═══════════════════════════════════════════════════════════════════
-- SETUP SUPABASE AUTH — Baba Rafi AdHub (Jul 2026)
-- Jalankan SEKALI di Supabase → SQL Editor → New query → paste → Run.
-- PENTING: jalankan SETELAH 3 user dibuat di Authentication → Users.
-- File ini tidak berisi password — aman disimpan di repo.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. SET ROLE TIAP USER ──────────────────────────────────────────
-- Role disimpan di app_metadata (masuk ke JWT, tidak bisa diubah user).
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
  where email = 'nadir.adhub@babarafi.com';

update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"user"}'
  where email = 'user.adhub@babarafi.com';

update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"marketing"}'
  where email = 'marketing.adhub@babarafi.com';

-- CATATAN: kalau nanti menambah user baru lewat dashboard, jalankan lagi
-- satu UPDATE seperti di atas dengan email + role user barunya
-- (pilihan role: 'admin' / 'user' / 'marketing').

-- ── 2. RLS TABEL campaigns (jadwal Calendar) ───────────────────────
-- Baca: admin + user (viewer). Tulis/edit/hapus: admin saja.
-- Marketing & orang tanpa login: tidak bisa apa-apa.
alter table public.campaigns enable row level security;

drop policy if exists "campaigns_read"         on public.campaigns;
drop policy if exists "campaigns_admin_insert" on public.campaigns;
drop policy if exists "campaigns_admin_update" on public.campaigns;
drop policy if exists "campaigns_admin_delete" on public.campaigns;

create policy "campaigns_read" on public.campaigns
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'user'));

create policy "campaigns_admin_insert" on public.campaigns
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "campaigns_admin_update" on public.campaigns
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "campaigns_admin_delete" on public.campaigns
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 3. RLS TABEL suggestions ───────────────────────────────────────
-- Kirim saran: semua yang login. Lihat & hapus: admin saja.
alter table public.suggestions enable row level security;

drop policy if exists "suggestions_insert"       on public.suggestions;
drop policy if exists "suggestions_admin_read"   on public.suggestions;
drop policy if exists "suggestions_admin_delete" on public.suggestions;

create policy "suggestions_insert" on public.suggestions
  for insert to authenticated
  with check (true);

create policy "suggestions_admin_read" on public.suggestions
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "suggestions_admin_delete" on public.suggestions
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 4. CEK HASIL (opsional) ────────────────────────────────────────
-- Jalankan ini untuk memastikan role sudah terpasang di 3 user:
select email, raw_app_meta_data ->> 'role' as role from auth.users order by email;
