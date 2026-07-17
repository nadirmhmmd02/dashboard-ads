-- ═══════════════════════════════════════════════════════════════════
-- UPDATE LEADS HUB #1 (17 Jul 2026) — kolom sales + label NEW
-- Jalankan SEKALI di Supabase → SQL Editor → New query → paste → Run.
-- ═══════════════════════════════════════════════════════════════════

-- Kolom sales: siapa yang meng-handle lead (Akmel / Hendra / Dedik).
alter table public.leads add column if not exists sales text;

-- Penanda lead baru: true saat masuk, jadi false begitu ada aksi apa pun
-- (copy nomor, ubah status, follow-up, notes, assign sales, dst).
alter table public.leads add column if not exists is_new boolean not null default true;

-- Catat perubahan sales di audit trail juga
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
  if new.sales is distinct from old.sales then
    insert into public.lead_history (lead_id, changed_by, field, old_value, new_value)
      values (old.id, auth.uid(), 'sales', old.sales, new.sales);
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

-- Cek hasil: harus muncul kolom sales & is_new
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'leads'
  and column_name in ('sales','is_new');
