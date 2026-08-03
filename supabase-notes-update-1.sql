-- ============================================================
-- BABA RAFI AD HUB — UPDATE #1 TABEL "NOTES"
-- Fitur: geser urutan catatan (drag handle di daftar Notes).
--
-- CARA PAKAI (sekali saja):
-- Buka Supabase → SQL Editor → New query → paste semua isi file
-- ini → Run. Setelah itu refresh halaman Notes di dashboard.
--
-- Kalau supabase-notes-setup.sql versi terbaru baru saja
-- dijalankan, file ini tetap AMAN dijalankan (tidak dobel).
-- ============================================================

-- Kolom urutan manual hasil geser (angka kecil = paling atas)
alter table public.notes add column if not exists sort_order integer;

-- Trigger updated_at diperbarui: kalau yang berubah CUMA urutan
-- (sort_order), jangan sentuh updated_at — supaya label "Edited
-- X min ago" tidak ikut berubah hanya karena catatan digeser.
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
