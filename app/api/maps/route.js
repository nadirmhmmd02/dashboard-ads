import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { outletsFromCsv, diffOutlets, coordKey } from '../../components/mapsSync';

/* ─────────────────────────────────────────────────────────────
   API MAPS HUB — dikunci Supabase Auth, ADMIN ONLY (fase 1).
   GET               → outlets + alerts + mapping depo + log sync.
   POST action=sync         → tarik Google Sheets (gviz CSV) → diff → tulis.
   POST action=mark_done    → tandai alert selesai.
   POST action=set_provinsi → mapping Depo → Provinsi.
   POST action=geocode      → reverse-geocode kota (Nominatim, batch ≤35,
                              1 req/detik — klien memanggil berulang).
   Lihat MAPS-HUB-PLAN.md. Sheet READ-ONLY — tidak pernah ditulis.
   ───────────────────────────────────────────────────────────── */

export const maxDuration = 60;

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SHEET_ID      = process.env.MAPS_SHEET_ID;
const SHEET_TAB     = 'GOOGLE MAPS OUTLET';

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

function dbFor(token) {
  // Client atas nama admin pemanggil — RLS tetap berlaku
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Tabel belum dibuat (supabase-maps-setup.sql belum dijalankan)
function isMissingTable(error) {
  const m = (error?.message || '') + ' ' + (error?.code || '');
  return /42P01|PGRST205|does not exist|Could not find the table/i.test(m);
}

/* ─── GET: semua data untuk halaman ─── */
export async function GET(request) {
  const { role, token } = await getAuth(request);
  if (role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const db = dbFor(token);

  const [outlets, alerts, mapping, log] = await Promise.all([
    db.from('maps_outlets').select('*').order('nama').limit(2000),
    db.from('maps_alerts').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(500),
    db.from('maps_depo_provinsi').select('*'),
    db.from('maps_sync_log').select('*').order('run_at', { ascending: false }).limit(1),
  ]);

  const err = outlets.error || alerts.error || mapping.error || log.error;
  if (err) {
    if (isMissingTable(err)) return NextResponse.json({ needsSetup: true });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({
    outlets: outlets.data || [],
    alerts: alerts.data || [],
    depoProvinsi: mapping.data || [],
    lastSync: (log.data || [])[0] || null,
  });
}

/* ─── POST: sync / mark_done / set_provinsi / geocode ─── */
export async function POST(request) {
  const { role, token } = await getAuth(request);
  if (role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const db = dbFor(token);

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const action = body.action;

  try {
    if (action === 'sync')         return await doSync(db);
    if (action === 'mark_done')    return await doMarkDone(db, body);
    if (action === 'set_provinsi') return await doSetProvinsi(db, body);
    if (action === 'geocode')      return await doGeocode(db, body);
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ needsSetup: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* ─── SYNC ─── */
async function doSync(db) {
  if (!SHEET_ID) {
    return NextResponse.json({ error: 'MAPS_SHEET_ID belum di-set di environment variables (Vercel → Settings → Env Variables, lalu Redeploy).' }, { status: 500 });
  }

  // 1. Tarik CSV dari Google Sheets (read-only, tanpa login)
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith('<')) {
    // Halaman HTML = sheet tidak lagi shareable via link (atau ID salah)
    throw new Error('Sheet tidak bisa dibaca. Cek: sharing sheet masih "Anyone with the link → Viewer"? (Kalau sharing memang diketatkan, saatnya upgrade ke service account — lihat MAPS-HUB-PLAN.md.)');
  }

  // 2. Parse + validasi
  const parsed = outletsFromCsv(text);
  if (parsed.error) throw new Error(parsed.error);

  // 3. Snapshot lama
  const { data: existing, error: exErr } = await db.from('maps_outlets').select('*').limit(2000);
  if (exErr) throw exErr;

  // 4. Diff
  const diff = diffOutlets(parsed.outlets, existing || []);

  // 5. Tulis: insert baru (batch), update biasa (upsert batch), rename (satu-satu)
  for (let i = 0; i < diff.inserts.length; i += 500) {
    const { error } = await db.from('maps_outlets').insert(diff.inserts.slice(i, i + 500));
    if (error) throw new Error('insert outlets: ' + error.message);
  }
  const renames = diff.updates.filter(u => u.fields.nama && u.fields.nama !== u.nama);
  const normals = diff.updates.filter(u => !u.fields.nama || u.fields.nama === u.nama);
  for (let i = 0; i < normals.length; i += 500) {
    const batch = normals.slice(i, i + 500).map(u => ({ nama: u.nama, ...u.fields }));
    const { error } = await db.from('maps_outlets').upsert(batch, { onConflict: 'nama' });
    if (error) throw new Error('update outlets: ' + error.message);
  }
  for (const u of renames) {
    const { error } = await db.from('maps_outlets').update(u.fields).eq('nama', u.nama);
    if (error) throw new Error('rename outlet: ' + error.message);
  }

  // 6. Tandai yang hilang dari sheet
  if (diff.hilang.length) {
    const { error } = await db.from('maps_outlets')
      .update({ missing_since: new Date().toISOString() })
      .in('nama', diff.hilang);
    if (error) throw new Error('missing outlets: ' + error.message);
  }

  // 7. Alerts: jangan dobel (outlet+type yang masih open dilewati);
  //    outlet yang muncul lagi → alert "hilang"-nya otomatis selesai
  const { data: openAlerts } = await db.from('maps_alerts').select('id,outlet_nama,type').eq('status', 'open');
  const openKey = new Set((openAlerts || []).map(a => a.outlet_nama + '|' + a.type));
  const newAlerts = diff.alerts.filter(a => !openKey.has(a.outlet_nama + '|' + a.type));
  if (newAlerts.length) {
    const { error } = await db.from('maps_alerts').insert(newAlerts);
    if (error) throw new Error('alerts: ' + error.message);
  }
  if (diff.reappeared.length) {
    await db.from('maps_alerts')
      .update({ status: 'done', resolved_at: new Date().toISOString() })
      .eq('status', 'open').eq('type', 'hilang').in('outlet_nama', diff.reappeared);
  }

  // 8. Log ringkasan
  const needsReview = parsed.outlets.filter(o => o.coord_error).length;
  const summary = {
    ...diff.summary,
    dilewati: parsed.skipped,
    duplikat: parsed.duplicates,
    needs_review: needsReview,
  };
  await db.from('maps_sync_log').insert({ summary });

  return NextResponse.json({ success: true, summary });
}

/* ─── MARK DONE ─── */
async function doMarkDone(db, body) {
  if (!body.alert_id) return NextResponse.json({ error: 'alert_id wajib' }, { status: 400 });
  const { error } = await db.from('maps_alerts')
    .update({ status: 'done', resolved_at: new Date().toISOString() })
    .eq('id', body.alert_id);
  if (error) throw error;
  return NextResponse.json({ success: true });
}

/* ─── SET PROVINSI ─── */
async function doSetProvinsi(db, body) {
  if (!body.depo || !body.provinsi) return NextResponse.json({ error: 'depo & provinsi wajib' }, { status: 400 });
  const { error } = await db.from('maps_depo_provinsi')
    .upsert({ depo: body.depo, provinsi: body.provinsi, updated_at: new Date().toISOString() }, { onConflict: 'depo' });
  if (error) throw error;
  return NextResponse.json({ success: true });
}

/* ─── GEOCODE (Nominatim — hormati rate limit 1 req/detik) ───
   Batch kecil supaya muat di limit 60 detik Vercel; klien memanggil
   berulang sampai remaining = 0. Hasil di-cache (maps_geocode_cache)
   supaya tiap koordinat cuma pernah ditanya SEKALI seumur hidup. */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Batch BERBASIS WAKTU, bukan jumlah: Nominatim menjawab ±2-3 detik per
   request (+ jeda wajib 1 detik + tulis DB), jadi 35 outlet ≈ 2 menit —
   melewati limit 60 detik Vercel dan fungsinya dipotong di tengah jalan
   (bug 21 Agu 2026). Sekarang: kerjakan selama ±40 detik, lapor, klien
   lanjut memanggil sampai remaining = 0. */
const TIME_BUDGET_MS = 40000;

async function doGeocode(db, body) {
  const started = Date.now();
  const limit = Math.min(Math.max(parseInt(body.limit) || 60, 1), 80);

  const { data: pending, error: pErr } = await db.from('maps_outlets')
    .select('id,nama,lat,lng')
    .not('lat', 'is', null).is('kota', null)
    .limit(limit);
  if (pErr) throw pErr;
  if (!pending || !pending.length) return NextResponse.json({ processed: 0, remaining: 0 });

  // Cek cache dulu (koordinat sama = kota sama, gratis tanpa request)
  const keys = pending.map(o => coordKey(o.lat, o.lng));
  const { data: cached } = await db.from('maps_geocode_cache').select('*').in('coord_key', keys);
  const cacheMap = new Map((cached || []).map(c => [c.coord_key, c]));

  let processed = 0;
  let blocked = false;
  let lastReqAt = 0;
  for (const o of pending) {
    if (Date.now() - started > TIME_BUDGET_MS) break; // sisanya putaran berikut
    const key = coordKey(o.lat, o.lng);
    let kota;
    const hit = cacheMap.get(key);
    if (hit) {
      kota = hit.kota || '-';
    } else {
      // Nominatim: maks 1 request/detik — hitung dari AWAL request sebelumnya
      // (kalau jawabannya sendiri sudah >1 detik, tidak perlu menunggu lagi)
      const wait = 1000 - (Date.now() - lastReqAt);
      if (wait > 0) await sleep(wait);
      lastReqAt = Date.now();
      kota = await nominatimKota(o.lat, o.lng);
      if (kota === undefined) { blocked = true; break; } // rate-limited / jaringan → stop putaran ini
      await db.from('maps_geocode_cache').upsert(
        { coord_key: key, kota: kota === '-' ? null : kota }, { onConflict: 'coord_key' });
      cacheMap.set(key, { coord_key: key, kota: kota === '-' ? null : kota });
    }
    const { error } = await db.from('maps_outlets').update({ kota }).eq('id', o.id);
    if (error) throw error;
    processed++;
  }

  const { count } = await db.from('maps_outlets')
    .select('id', { count: 'exact', head: true })
    .not('lat', 'is', null).is('kota', null);

  return NextResponse.json({ processed, remaining: count || 0, blocked, elapsed: Date.now() - started });
}

async function nominatimKota(lat, lng) {
  try {
    // Batasi 12 detik per request supaya satu jawaban lambat tidak menghabiskan jatah waktu
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=id`,
      { headers: { 'User-Agent': 'BabaRafiAdHub-MapsHub/1.0 (https://dashboard-ads-babarafi.vercel.app)' }, signal: ctrl.signal }
    ).finally(() => clearTimeout(timer));
    if (res.status === 429 || res.status === 403) return undefined; // dibatasi → stop putaran ini
    if (!res.ok) return '-';
    const json = await res.json();
    const a = json.address || {};
    const raw = a.city || a.town || a.municipality || a.county || a.state_district || a.village || '';
    if (!raw) return '-';
    // "Kota Surabaya" / "Kabupaten Sidoarjo" → "Surabaya" / "Sidoarjo"
    return raw.replace(/^(Kota|Kabupaten|Kab\.)\s+/i, '').trim() || '-';
  } catch (e) {
    return undefined;
  }
}
