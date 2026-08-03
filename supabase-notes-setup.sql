-- ============================================================
-- BABA RAFI AD HUB — SETUP TABEL "NOTES" (catatan pribadi)
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
--
-- Catatan bersifat PRIBADI per akun: baris hanya bisa dibaca &
-- diubah oleh pemiliknya sendiri (dijaga RLS, bukan oleh kode
-- di browser), jadi akun lain tidak bisa mengintip meskipun
-- mereka tahu ID barisnya.
-- ============================================================

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default 'Untitled note',
  content     text not null default '',          -- HTML hasil editor
  pinned      boolean not null default false,
  sort_order  integer,                           -- urutan manual hasil geser (kecil = atas)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Jaga-jaga kalau tabel sudah dibuat dari versi lama file ini
alter table public.notes add column if not exists sort_order integer;

-- Urutan tampil: pinned dulu, lalu yang terakhir diubah
create index if not exists notes_user_idx on public.notes (user_id, pinned desc, updated_at desc);

alter table public.notes enable row level security;

-- Satu policy untuk semua aksi: hanya pemilik baris
drop policy if exists "notes owner full access" on public.notes;
create policy "notes owner full access" on public.notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at ikut terisi otomatis tiap kali baris diubah.
-- Pengecualian: kalau yang berubah CUMA sort_order (geser urutan),
-- updated_at dibiarkan — supaya label "Edited X min ago" tidak berubah.
create or replace function public.touch_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.title = old.title and new.content = old.content and new.pinned = old.pinned then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_notes_updated_at();
