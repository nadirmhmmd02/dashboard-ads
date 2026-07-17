import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* "Remember me" di login: sesi Supabase disimpan di localStorage (persist,
   tetap login setelah browser ditutup) atau sessionStorage (hilang saat
   browser ditutup) — dipilih lewat flag wd-remember yang di-set login(). */
const REMEMBER_KEY = 'wd-remember';

function store() {
  return localStorage.getItem(REMEMBER_KEY) === 'no' ? sessionStorage : localStorage;
}

const authStorage = typeof window === 'undefined' ? undefined : {
  getItem:    (k) => store().getItem(k),
  setItem:    (k, v) => store().setItem(k, v),
  // Hapus dari dua-duanya supaya tidak ada sesi nyangkut saat ganti mode remember
  removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};

export function setRememberSession(remember) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? 'yes' : 'no');
    // Bersihkan sisa sesi di storage lain agar tidak dobel
    const other = remember ? sessionStorage : localStorage;
    Object.keys(other)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => other.removeItem(k));
  } catch (e) {}
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: authStorage },
});

/* fetch dengan Authorization header (access token Supabase) —
   dipakai semua panggilan /api/meta karena endpoint itu sekarang dikunci. */
export async function authFetch(url, options = {}) {
  let token = '';
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || '';
  } catch (e) {}
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
