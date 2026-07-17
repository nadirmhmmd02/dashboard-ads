-- ═══════════════════════════════════════════════════════════════════
-- SETUP DATABASE LEADS HUB v3.0 — Baba Rafi AdHub (Jul 2026)
-- Sesuai ERD MASTER PLAN Bagian 4 (revisi 16 Jul 2026).
-- Jalankan SEKALI di Supabase → SQL Editor → New query → paste → Run.
-- Aman dijalankan ulang (pakai IF NOT EXISTS / DROP IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. TABEL campaign_ref ──────────────────────────────────────────
-- Referensi campaign asal lead (ID Meta = string angka panjang).
-- Data performa TIDAK disimpan di sini (tetap live dari API).
-- CATATAN: beda dengan tabel `campaigns` (jadwal Calendar) — jangan diganggu.
create table if not exists public.campaign_ref (
  id       text primary key,                -- ID campaign dari Meta
  platform text not null default 'Meta',    -- Meta / Google / TikTok
  name     text not null default ''         -- nama campaign (sumber deteksi kategori promo)
);

-- ── 2. TABEL leads ─────────────────────────────────────────────────
create table if not exists public.leads (
  id                bigint generated always as identity primary key,
  meta_lead_id      text unique,            -- ID lead dari Meta API (anti-duplikat saat tarik ulang)
  campaign_id       text references public.campaign_ref(id),
  assigned_to       uuid references auth.users(id),
  name              text not null default '',
  phone             text not null default '',
  email             text,
  domicile          text,
  kategori_promo    text,                   -- Reguler / Proven / Suka Suka / Autopilot (auto dari nama campaign, bisa dikoreksi)
  verification      text not null default 'unverified'
                    check (verification in ('unverified','approved','rejected')),
  source            text not null default 'meta_api'
                    check (source in ('meta_api','import_spreadsheet','manual')),
  status            text not null default 'No Status'
                    check (status in ('No Status','Cold','Warm','Hot','Deal')),
  followed_up       boolean not null default false,
  notes             text,
  closing_amount    numeric,                -- diisi saat Deal (popup otomatis)
  deal_date         date,                   -- tanggal closing (beda dari created_at)
  deal_reason       text,                   -- dropdown + isian bebas
  status_updated_at timestamptz,
  created_at        timestamptz not null default now()  -- tanggal lead masuk = anchor atribusi cohort
);

create index if not exists leads_created_at_idx   on public.leads (created_at);
create index if not exists leads_verification_idx on public.leads (verification);
create index if not exists leads_kategori_idx     on public.leads (kategori_promo);

-- ── 3. TABEL lead_history (audit trail) ────────────────────────────
create table if not exists public.lead_history (
  id         bigint generated always as identity primary key,
  lead_id    bigint not null references public.leads(id) on delete cascade,
  changed_by uuid,
  field      text not null,
  old_value  text,
  new_value  text,
  changed_at timestamptz not null default now()
);

create index if not exists lead_history_lead_idx on public.lead_history (lead_id);

-- ── 4. TRIGGER audit trail + status_updated_at otomatis ────────────
-- Setiap perubahan kolom penting dicatat: siapa, kolom apa, dari → ke.
create or replace function public.log_lead_changes()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_history (lead_id, changed_by, field, old_value, new_value)
      values (old.id, auth.uid(), 'status', old.status, new.status);
    new.status_updated_at := now();
  end if;
  if new.followed_up is distinct from old.followed_up then
    insert into public.lead_history (lead_id, changed_by, field, old_value, new_value)
      values (old.id, auth.uid(), 'followed_up', old.followed_up::text, new.followed_up::text);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_history (lead_id, changed_by, field, old_value, new_value)
      values (old.id, auth.uid(), 'assigned_to', old.assigned_to::text, new.assigned_to::text);
  end if;
  if new.verification is distinct from old.verification then
    insert into public.lead_history (lead_id, changed_by, field, old_value, new_value)
      values (old.id, auth.uid(), 'verification', old.verification, new.verification);
  end if;
  if new.closing_amount is distinct from old.closing_amount then
    insert into public.lead_history (lead_id, changed_by, field, old_value, new_value)
      values (old.id, auth.uid(), 'closing_amount', old.closing_amount::text, new.closing_amount::text);
  end if;
  if new.notes is distinct from old.notes then
    insert into public.lead_history (lead_id, changed_by, field, old_value, new_value)
      values (old.id, auth.uid(), 'notes', old.notes, new.notes);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lead_history on public.leads;
create trigger trg_lead_history
  before update on public.leads
  for each row execute function public.log_lead_changes();

-- ── 5. RLS ─────────────────────────────────────────────────────────
-- Role dari JWT: admin / user (viewer) / marketing.
alter table public.campaign_ref enable row level security;
alter table public.leads        enable row level security;
alter table public.lead_history enable row level security;

-- campaign_ref: semua yang login boleh baca (butuh nama campaign);
-- tulis hanya admin (di-upsert saat tarik leads dari API).
drop policy if exists "campaign_ref_read"        on public.campaign_ref;
drop policy if exists "campaign_ref_admin_write" on public.campaign_ref;

create policy "campaign_ref_read" on public.campaign_ref
  for select to authenticated using (true);

create policy "campaign_ref_admin_write" on public.campaign_ref
  for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- leads:
--   Admin     → semua baris, semua aksi (termasuk Inbox unverified).
--   Marketing → baca & update HANYA lead approved (kolom kerja: status,
--               followed_up, notes, closing_amount, dll — dibatasi di UI).
--   User      → baca lead approved saja (dashboard read-only), tanpa edit.
drop policy if exists "leads_admin_all"        on public.leads;
drop policy if exists "leads_read_approved"    on public.leads;
drop policy if exists "leads_marketing_update" on public.leads;

create policy "leads_admin_all" on public.leads
  for all to authenticated
  using      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "leads_read_approved" on public.leads
  for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('user','marketing')
    and verification = 'approved'
  );

create policy "leads_marketing_update" on public.leads
  for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'marketing'
    and verification = 'approved'
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'marketing'
    and verification = 'approved'
  );

-- lead_history: hanya admin yang baca. Insert dilakukan trigger
-- (security definer) — tidak butuh policy insert.
drop policy if exists "lead_history_admin_read" on public.lead_history;

create policy "lead_history_admin_read" on public.lead_history
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 6. CEK HASIL (opsional) ────────────────────────────────────────
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('campaign_ref','leads','lead_history')
order by table_name;
