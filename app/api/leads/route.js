import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Sync pertama menarik ratusan lead (banyak panggilan Graph API) —
// beri batas waktu maksimal yang diizinkan Vercel (60 detik).
export const maxDuration = 60;

/* Tanggal mulai sync (go-live Leads Hub, keputusan Nadir 17 Jul 2026):
   hanya lead yang masuk SEJAK tanggal ini yang ditarik dari API —
   lead sebelum ini akan masuk lewat fitur import file export (gelombang 2). */
const SYNC_START = '2026-07-17';
const SYNC_START_UNIX = Math.floor(new Date(SYNC_START + 'T00:00:00+07:00').getTime() / 1000);

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GRAPH = 'https://graph.facebook.com/v19.0';

/* ─── Auth guard (pola sama dengan /api/meta) ───
   GET mode=spend  → admin, user, marketing (angka agregat spend konversi
                     untuk Dashboard Leads Hub — TANPA data campaign lain).
   POST action=sync → admin only (tarik leads Meta → insert Supabase).
   Insert/update Supabase memakai token user pemanggil → RLS tetap berlaku. */
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getAuth(request) {
  const header = request.headers.get('authorization') || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { role: null, token: null };
  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) return { role: null, token: null };
    return { role: data.user.app_metadata?.role || 'user', token };
  } catch (e) {
    return { role: null, token: null };
  }
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized — silakan login ulang' }, { status: 401 });
}

/* ─── Deteksi kategori promo dari nama campaign/form ───
   Sesuai MASTER PLAN: penamaan campaign menyebut kategori; bisa dikoreksi
   manual oleh admin kalau meleset. */
function detectKategori(...names) {
  const s = names.filter(Boolean).join(' ').toUpperCase();
  if (s.includes('AUTOPILOT')) return 'Autopilot';
  if (s.includes('PROVEN'))    return 'Proven';
  if (s.includes('SUKA'))      return 'Suka Suka';
  if (s.includes('REGULER'))   return 'Reguler';
  return null;
}

/* ─── Mapping field instant form → kolom leads ───
   Nama field di form Meta bervariasi; sisanya masuk notes agar tidak hilang. */
const FIELD_MAP = {
  full_name: 'name', name: 'name', nama: 'name', nama_lengkap: 'name',
  phone: 'phone', phone_number: 'phone', no_hp: 'phone', nomor_hp: 'phone', whatsapp: 'phone',
  email: 'email',
  city: 'domicile', kota: 'domicile', domisili: 'domicile', domicile: 'domicile',
  kota_domisili: 'domicile', asal_kota: 'domicile',
};

function mapFieldData(fieldData) {
  const row = { name: '', phone: '', email: null, domicile: null };
  const extra = [];
  for (const fd of fieldData || []) {
    const key = (fd.name || '').toLowerCase();
    const val = ((fd.values || [])[0] || '').toString().trim();
    if (!val) continue;
    const col = FIELD_MAP[key];
    if (col && !row[col]) row[col] = val;
    else if (!col) extra.push(`${fd.name}: ${val}`);
  }
  return { ...row, extraNotes: extra.length ? extra.join('\n') : null };
}

// Rapikan nomor HP: buang spasi/strip, seragamkan awalan ke 08…
function tidyPhone(p) {
  let s = (p || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+62')) s = '0' + s.slice(3);
  else if (s.startsWith('62')) s = '0' + s.slice(2);
  return s;
}

async function graphJson(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Meta API error');
  return json;
}

/* ─── GET mode=spend — total spend campaign konversi (untuk kartu
   Spend/CPD/ROI di Dashboard Leads Hub) ─── */
export async function GET(request) {
  const { role } = await getAuth(request);
  if (!role) return unauthorized();

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'spend';
  if (mode !== 'spend') {
    return NextResponse.json({ error: 'unknown mode' }, { status: 400 });
  }

  const since = searchParams.get('since') || '';
  const until = searchParams.get('until') || '';
  const datePreset = searchParams.get('date_preset') || 'this_month';
  const dateField = since && until
    ? `time_range({'since':'${since}','until':'${until}'})`
    : `date_preset(${datePreset})`;

  try {
    const json = await graphJson(
      `${GRAPH}/${AD_ACCOUNT_ID}/campaigns?fields=id,name,insights.${dateField}{spend}&access_token=${ACCESS_TOKEN}&limit=100`
    );
    let spend = 0;
    for (const c of json.data || []) {
      const nm = (c.name || '').toUpperCase();
      if (!nm.includes('PROSPEK') && !nm.includes('KONVERSI')) continue;
      spend += parseFloat(c.insights?.data?.[0]?.spend || 0);
    }
    return NextResponse.json({ spend });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* ─── POST action=sync — tarik semua leads instant form → Supabase ───
   Dedup via kolom meta_lead_id (upsert ignoreDuplicates), jadi aman
   dijalankan berulang. Lead baru masuk berstatus 'unverified' (Inbox). */
export async function POST(request) {
  const { role, token } = await getAuth(request);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang boleh sync leads' }, { status: 403 });
  }

  // Client Supabase atas nama admin pemanggil (RLS tetap jalan)
  const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  try {
    // 1. Semua Page yang bisa diakses token (Franchise + Baba Rafi, dst)
    const pages = (await graphJson(`${GRAPH}/me/accounts?fields=id,name,access_token&limit=25&access_token=${ACCESS_TOKEN}`)).data || [];

    let formsScanned = 0;
    let fetched = 0;
    const rows = [];
    const campaignRefs = new Map();

    for (const page of pages) {
      const pageToken = page.access_token || ACCESS_TOKEN;
      const forms = (await graphJson(`${GRAPH}/${page.id}/leadgen_forms?fields=id,name,status,leads_count&limit=100&access_token=${pageToken}`)).data || [];

      for (const form of forms) {
        if (!form.leads_count) continue;
        formsScanned++;

        // 2. Tarik leads per form SEJAK tanggal go-live (filter di sisi Meta),
        //    ikuti pagination (cap 100 halaman ≈ 10rb lead)
        const filtering = encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: SYNC_START_UNIX - 1 }]));
        let url = `${GRAPH}/${form.id}/leads?fields=id,created_time,field_data,campaign_id,campaign_name&filtering=${filtering}&limit=100&access_token=${pageToken}`;
        for (let i = 0; i < 100 && url; i++) {
          const json = await graphJson(url);
          for (const lead of json.data || []) {
            // Pengaman ganda: lewati lead sebelum tanggal go-live
            if (lead.created_time && new Date(lead.created_time).getTime() / 1000 < SYNC_START_UNIX) continue;
            fetched++;
            const mapped = mapFieldData(lead.field_data);
            const kategori = detectKategori(lead.campaign_name, form.name);
            if (lead.campaign_id) {
              campaignRefs.set(lead.campaign_id, { id: lead.campaign_id, platform: 'Meta', name: lead.campaign_name || '' });
            }
            rows.push({
              meta_lead_id: lead.id,
              campaign_id: lead.campaign_id || null,
              name: mapped.name,
              phone: tidyPhone(mapped.phone),
              email: mapped.email,
              domicile: mapped.domicile,
              kategori_promo: kategori,
              notes: mapped.extraNotes,
              source: 'meta_api',
              created_at: lead.created_time,
            });
          }
          url = json.paging?.next || null;
        }
      }
    }

    // 3. Simpan referensi campaign (untuk nama campaign di tabel leads)
    if (campaignRefs.size) {
      const { error } = await db.from('campaign_ref').upsert([...campaignRefs.values()], { onConflict: 'id' });
      if (error) throw new Error('campaign_ref: ' + error.message);
    }

    // 4. Insert leads per batch, duplikat (sudah pernah ditarik) dilewati
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { data, error } = await db
        .from('leads')
        .upsert(batch, { onConflict: 'meta_lead_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw new Error('leads: ' + error.message);
      inserted += (data || []).length;
    }

    return NextResponse.json({ success: true, pages: pages.length, forms: formsScanned, fetched, inserted });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
