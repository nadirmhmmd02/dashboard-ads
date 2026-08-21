/* ─────────────────────────────────────────────────────────────
   MAPS HUB — mesin sync (pure function, tanpa React/DB).
   Dipakai app/api/maps/route.js. Dipisah supaya bisa dites di
   Node tanpa server (pola insightEngine.js).

   Alur: CSV (gviz Google Sheets) → outletsFromCsv() → diffOutlets()
   vs snapshot DB → route yang menulis hasilnya ke Supabase.
   Lihat MAPS-HUB-PLAN.md Section 3-5 untuk aturan lengkap.
   ───────────────────────────────────────────────────────────── */

// ── Parser CSV sadar-kutip (format gviz: semua field di-quote) ──
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ── Parser "Titik Ordinat" ──
   Sheet berisi lat,lng dalam SATU cell (LATITUDE DULU). Varian nyata
   di data (lihat MAPS-HUB-PLAN.md Section 5): normal, koma desimal
   Indonesia, derajat DMS, berkurung, spasi tanpa koma, koma buntut.
   Return { lat, lng, error } — error terisi = Needs Review. */
const LAT_MIN = -11, LAT_MAX = 6, LNG_MIN = 94, LNG_MAX = 142; // rentang Indonesia

export function parseOrdinat(raw) {
  const bad = (error) => ({ lat: null, lng: null, error });
  let s = (raw || '').trim();
  if (!s) return bad('Koordinat kosong');

  // Berkurung: (-7.93, 112.63)
  s = s.replace(/^\(/, '').replace(/\)$/, '').trim();

  // Derajat DMS: 7°32'16.2"S 112°15'01.4"E
  const dms = s.match(/(\d+)\s*°\s*(\d+)\s*['’]\s*([\d.]+)\s*["”]?\s*([NSns])[\s,]+(\d+)\s*°\s*(\d+)\s*['’]\s*([\d.]+)\s*["”]?\s*([EWew])/);
  if (dms) {
    let lat = (+dms[1]) + (+dms[2]) / 60 + (+dms[3]) / 3600;
    let lng = (+dms[5]) + (+dms[6]) / 60 + (+dms[7]) / 3600;
    if (/s/i.test(dms[4])) lat = -lat;
    if (/w/i.test(dms[8])) lng = -lng;
    return validate(lat, lng, raw);
  }

  let parts = s.split(',').map(p => p.trim()).filter(Boolean); // filter → koma buntut aman
  if (parts.length === 1) parts = s.split(/\s+/).map(p => p.trim()).filter(Boolean); // spasi tanpa koma
  if (parts.length === 4 && parts.every(p => /^-?\d+$/.test(p))) {
    // Koma desimal Indonesia: "-6,2433080, 106,9944750" → gabung berpasangan
    parts = [parts[0] + '.' + parts[1], parts[2] + '.' + parts[3]];
  }
  if (parts.length !== 2) return bad('Format tidak dikenali');

  const lat = parseFloat(parts[0].replace(/\s/g, ''));
  const lng = parseFloat(parts[1].replace(/\s/g, ''));
  return validate(lat, lng, raw);

  function validate(la, ln) {
    if (!isFinite(la) || !isFinite(ln)) return bad('Bukan angka');
    if (la < LAT_MIN || la > LAT_MAX) return bad(`Latitude ${la} di luar rentang Indonesia`);
    if (ln < LNG_MIN || ln > LNG_MAX) return bad(`Longitude ${ln} di luar rentang Indonesia`);
    return { lat: la, lng: ln, error: null };
  }
}

// Kunci cache geocode: koordinat dibulatkan 5 desimal (±1 meter)
export function coordKey(lat, lng) {
  return lat.toFixed(5) + ',' + lng.toFixed(5);
}

/* ── Kota dari ALAMAT (sumber utama, keputusan Nadir 21 Agu 2026) ──
   Alamat format Google Maps memuat "Kota X" / "Kabupaten X" / "Kab. X"
   / "X Regency" (Bali). Tingkat yang diambil = KOTA/KABUPATEN (bukan
   kecamatan); Jakarta dipecah per wilayah administrasi. Alamat tanpa
   pola → null → fallback reverse-geocode OpenStreetMap.
   Kamus singkatan yang nyata ada di sheet: SBY, Bks, dsb. */
const KOTA_ALIAS = {
  'sby': 'Surabaya', 'bks': 'Bekasi', 'bdg': 'Bandung', 'smg': 'Semarang',
  'jkt': 'Jakarta', 'mlg': 'Malang', 'sda': 'Sidoarjo', 'yk': 'Yogyakarta',
  'jogja': 'Yogyakarta', 'tangsel': 'Tangerang Selatan',
  'jaksel': 'Jakarta Selatan', 'jaktim': 'Jakarta Timur', 'jakbar': 'Jakarta Barat',
  'jakut': 'Jakarta Utara', 'jakpus': 'Jakarta Pusat',
};
// Nama provinsi sebagai pembatas akhir nama kota. "Lampung" SENGAJA tidak
// ada (Bandar Lampung / Lampung Tengah adalah nama kota/kabupaten).
const PROV_STOP = '(?:Jawa|Bali|Banten|DKI|Daerah|Sumatera|Sumatra|Nusa|Kalimantan|Sulawesi|Riau|Jambi|Aceh|Maluku|Papua|Gorontalo|Kepulauan|Indonesia)';
const RE_KOTA = new RegExp(
  '\\b(?:Kota|Kabupaten|Kab\\.?)\\s+(?:Adm\\.?\\s+|Administrasi\\s+)?' +
  '([A-Za-z][A-Za-z\'.\\-]*(?:\\s+[A-Za-z][A-Za-z\'.\\-]*){0,2}?)' +
  '(?=\\s*,|\\s*\\d{5}|\\s+' + PROV_STOP + '\\b|\\s+kode\\s*pos\\b|\\s*$)', 'i');
// Format Inggris Google Maps: "Badung Regency, Indonesia", "Malang City, East Java".
// WAJIB diikuti koma — kalau tidak, nama perumahan ikut tertangkap
// ("Ruko Permata Regency Kavling 1", "Manyar Garden Regency Kav 29").
const RE_REGENCY = /\b([A-Z][A-Za-z'.\-]+(?:\s+[A-Z][A-Za-z'.\-]+)?)\s+(?:Regency|City)\s*,/;
// Arah Inggris hanya untuk kota yang memang bernama arah (bukan provinsi "East Java")
const RE_EN_DIR  = /\b((?:West|North|Central|South|East)\s+(?:Jakarta|Lampung))\b/;
const EN_DIR = { west: 'Barat', north: 'Utara', central: 'Tengah', south: 'Selatan', east: 'Timur' };

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s\-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

export function kotaFromAlamat(alamat) {
  const s = (alamat || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  let name = null;
  const m = s.match(RE_KOTA);
  if (m) name = m[1].trim();
  else {
    const r = s.match(RE_REGENCY) || s.match(RE_EN_DIR);
    if (r) name = r[1].trim();
  }
  if (!name) return null;
  name = name.replace(/[.,]+$/, '').replace(/\s*(kode\s*pos|kodepos)$/i, '').trim();
  if (!name || /^\d/.test(name)) return null;

  const alias = KOTA_ALIAS[name.toLowerCase()];
  if (alias) return alias;

  // "West Jakarta" → "Jakarta Barat"; "Central Lampung" → "Lampung Tengah"; "Central Jakarta" → "Jakarta Pusat"
  const en = name.match(/^(West|North|Central|South|East)\s+(.+)$/i);
  if (en) {
    const base = titleCase(en[2]);
    const dir = en[1].toLowerCase() === 'central' && /^jakarta$/i.test(base) ? 'Pusat' : EN_DIR[en[1].toLowerCase()];
    return `${base} ${dir}`;
  }
  return titleCase(name); // "bogor" / "SURABAYA" → "Bogor" / "Surabaya"
}

/* ── CSV → daftar outlet ──
   Kolom dibaca BERDASARKAN NAMA HEADER (baris 1) — tahan kolom
   geser/tambah. Baris tanpa Nama Outlet dilewati (dihitung).
   Nama duplikat TIDAK diproses (dua-duanya keluar dari daftar),
   dilaporkan sebagai Data Quality. */
export function outletsFromCsv(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) return { outlets: [], skipped: 0, duplicates: [], error: 'CSV kosong' };

  const idx = {};
  rows[0].forEach((h, i) => { const k = (h || '').trim(); if (k && idx[k] === undefined) idx[k] = i; });
  const need = ['Nama Outlet', 'Depo', 'Alamat', 'Titik Ordinat', 'Profile Bisnis'];
  const missing = need.filter(k => idx[k] === undefined);
  if (missing.length) {
    return { outlets: [], skipped: 0, duplicates: [], error: 'Header sheet berubah — kolom tidak ketemu: ' + missing.join(', ') };
  }
  const col = (r, name) => {
    const i = idx[name];
    return i === undefined ? '' : (r[i] || '').trim();
  };

  const data = rows.slice(1).filter(r => r.some(c => c && c.trim() !== ''));
  let skipped = 0;
  const list = [];
  for (const r of data) {
    const nama = col(r, 'Nama Outlet');
    if (!nama) { skipped++; continue; }
    const ordinatRaw = col(r, 'Titik Ordinat');
    const coord = parseOrdinat(ordinatRaw);
    const alamat = col(r, 'Alamat');
    list.push({
      nama,
      depo:        col(r, 'Depo'),
      alamat,
      kota_alamat: kotaFromAlamat(alamat),   // null = perlu reverse-geocode
      ordinat_raw: ordinatRaw,
      lat:         coord.lat,
      lng:         coord.lng,
      coord_error: coord.error,
      nomor_hp:    col(r, 'Nomor HP'),
      nama_lama:   col(r, 'Nama Lama'),
      nama_gmaps:  col(r, 'Nama Google Maps'),
      status:      col(r, 'Profile Bisnis'),
      link_gmaps:  col(r, 'Link Google Maps'),
      catatan:     col(r, 'Catatan'),
      row_no:      col(r, 'No'),
    });
  }

  // Duplikat: keluarkan SEMUA baris bernama kembar dari proses diff
  const count = {};
  list.forEach(o => { count[o.nama] = (count[o.nama] || 0) + 1; });
  const duplicates = Object.keys(count).filter(n => count[n] > 1).sort();
  const outlets = list.filter(o => count[o.nama] === 1);

  return { outlets, skipped, duplicates, error: null };
}

/* ── Diff data baru vs snapshot DB ──
   existing = array baris maps_outlets. Return instruksi tulis untuk
   route: inserts (outlet baru), updates ({nama, fields}), alerts,
   reappeared (nama yang tadinya hilang → muncul lagi).
   Field pemicu alert perubahan_info HANYA: alamat, ordinat_raw,
   nama_gmaps (keputusan Nadir — status/link/catatan tidak). */
const WATCHED = ['alamat', 'ordinat_raw', 'nama_gmaps'];
const COPY_FIELDS = ['depo', 'alamat', 'ordinat_raw', 'lat', 'lng', 'coord_error',
  'nomor_hp', 'nama_lama', 'nama_gmaps', 'status', 'link_gmaps', 'catatan', 'row_no'];

/* opts.resetKota = true → kota hasil geocode LAMA dibuang (diisi ulang),
   dipakai sekali saat aturan penentuan kota berubah (KOTA_VERSION naik). */
export function diffOutlets(fresh, existing, opts = {}) {
  const byName = new Map(existing.map(e => [e.nama, e]));
  const seen = new Set();
  const inserts = [], updates = [], alerts = [], reappeared = [];
  const now = new Date().toISOString();
  // Kota: dari alamat kalau ada (menimpa apa pun), kalau tidak → pertahankan
  // hasil geocode yang sudah ada (kecuali reset), kalau belum ada → null (pending)
  const kotaFor = (f, cur) => f.kota_alamat || (opts.resetKota ? null : (cur?.kota || null));

  for (const f of fresh) {
    const cur = byName.get(f.nama);
    if (cur) {
      seen.add(f.nama);
      const changed = WATCHED
        .filter(k => (cur[k] || '') !== (f[k] || ''))
        .map(k => ({ field: k, from: cur[k] || '', to: f[k] || '' }));
      if (changed.length) {
        alerts.push({ outlet_nama: f.nama, type: 'perubahan_info', detail: { changed } });
      }
      if (cur.missing_since) reappeared.push(f.nama);
      updates.push({
        nama: f.nama,
        fields: { ...pick(f, COPY_FIELDS), kota: kotaFor(f, cur), last_seen_at: now, missing_since: null, updated_at: now },
      });
      continue;
    }

    // Nama baru: relokasi (Nama Lama cocok dgn snapshot) atau outlet baru
    const lama = (f.nama_lama || '').trim();
    const relokasiDari = lama && byName.get(lama);
    if (relokasiDari && !seen.has(lama) && !fresh.some(x => x.nama === lama)) {
      // Baris yang sama di-rename: update row lama → nama baru
      seen.add(lama);
      updates.push({
        nama: lama,
        fields: { nama: f.nama, ...pick(f, COPY_FIELDS), kota: kotaFor(f, relokasiDari), last_seen_at: now, missing_since: null, updated_at: now },
      });
      alerts.push({ outlet_nama: f.nama, type: 'relokasi', detail: { dari: lama, ke: f.nama, alamat_baru: f.alamat } });
      if (relokasiDari.missing_since) reappeared.push(f.nama);
      continue;
    }

    inserts.push({ ...pick(f, COPY_FIELDS), nama: f.nama, kota: f.kota_alamat || null, first_seen_at: now, last_seen_at: now, updated_at: now });
  }

  // Hilang dari sheet: ada di snapshot, tidak ada di data baru → alert 1x
  const hilang = [];
  for (const e of existing) {
    if (seen.has(e.nama) || fresh.some(f => f.nama === e.nama)) continue;
    if (!e.missing_since) {
      hilang.push(e.nama);
      alerts.push({ outlet_nama: e.nama, type: 'hilang', detail: { depo: e.depo, alamat: e.alamat } });
    }
  }

  const firstSync = existing.length === 0;
  return {
    inserts,
    updates,
    // Sync pertama: semua baris = "baru" — jangan banjiri alert
    alerts: firstSync ? [] : alerts,
    reappeared,
    hilang,
    summary: {
      total: fresh.length,
      kota_dari_alamat: fresh.filter(f => f.kota_alamat).length,
      baru: inserts.length,
      relokasi: firstSync ? 0 : alerts.filter(a => a.type === 'relokasi').length,
      berubah:  firstSync ? 0 : alerts.filter(a => a.type === 'perubahan_info').length,
      hilang: firstSync ? 0 : hilang.length,
    },
  };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k] ?? null;
  return out;
}
