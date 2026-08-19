-- ============================================================
-- BABA RAFI AD HUB — SETUP TABEL "TO DO" (daftar tugas di halaman Notes)
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
--
-- Dua tabel:
--   todo_lists : daftar kustom (mis. "Kerja", "Pribadi") — daftar
--                bawaan "Tasks" tidak disimpan (list_id NULL).
--   todos      : tugas. Steps/sub-tugas disimpan sebagai JSON di
--                kolom steps: [{ "id": "...", "title": "...", "done": false }]
-- Semua PRIBADI per akun (RLS: hanya pemilik baris), sama seperti notes.
-- ============================================================

create table if not exists public.todo_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default 'Untitled list',
  color       text,                                   -- hex warna penanda (opsional)
  sort_order  integer,
  created_at  timestamptz not null default now()
);

create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id     uuid references public.todo_lists(id) on delete cascade,   -- NULL = daftar bawaan "Tasks"
  title       text not null default '',
  notes       text not null default '',
  done        boolean not null default false,
  done_at     timestamptz,
  starred     boolean not null default false,          -- ⭐ penting
  due_date    date,                                    -- tenggat
  my_day_date date,                                    -- tanggal saat dimasukkan ke "My Day" (My Day = my_day_date = hari ini)
  steps       jsonb not null default '[]'::jsonb,      -- sub-tugas
  sort_order  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists todos_user_idx      on public.todos (user_id, done, created_at desc);
create index if not exists todo_lists_user_idx on public.todo_lists (user_id, sort_order);

alter table public.todo_lists enable row level security;
alter table public.todos      enable row level security;

drop policy if exists "todo_lists owner full access" on public.todo_lists;
create policy "todo_lists owner full access" on public.todo_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "todos owner full access" on public.todos;
create policy "todos owner full access" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at otomatis
create or replace function public.touch_todos_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists todos_touch_updated_at on public.todos;
create trigger todos_touch_updated_at
  before update on public.todos
  for each row execute function public.touch_todos_updated_at();
