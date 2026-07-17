'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, setRememberSession } from '../supabase';

/* ─── Auth via Supabase Auth (upgrade 2026) ───
   Login pakai email internal (mis. nadir.adhub@babarafi.com) + password yang
   tersimpan terenkripsi di server Supabase — tidak ada kredensial di kode.
   Role dibaca dari app_metadata.role di JWT (di-set via SQL, tidak bisa
   diubah dari sisi klien). Kelola user: dashboard Supabase (bukan di app). */

const DEFAULT_THEME = { admin: 'dark', user: 'light', marketing: 'light' };
const LAST_ROLE_KEY = 'wd-last-role'; // untuk no-flash theme script di layout.js

// Halaman pendaratan per role (marketing tidak punya akses Ads Hub)
export function homeFor(role) {
  return role === 'marketing' ? '/leads' : '/';
}

function toUser(session) {
  if (!session?.user) return null;
  const email = session.user.email || '';
  const role  = session.user.app_metadata?.role || 'user';
  return {
    email,
    // Nama tampilan: potongan depan email ("nadir.adhub@…" → "nadir")
    username: email.split('@')[0].split('.')[0] || email,
    role,
  };
}

const AuthContext = createContext(null);

function themeKey(role) { return 'wd-theme-' + role; }

// Theme terakhir yang dipilih role ini; kalau belum ada pakai default role
function resolveTheme(role) {
  try {
    const saved = localStorage.getItem(themeKey(role));
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (e) {}
  return DEFAULT_THEME[role] || 'light';
}

function applyThemeAttr(theme, animate) {
  const root = document.documentElement;
  if (animate) root.classList.add('theme-switching');
  root.setAttribute('data-theme', theme);
  if (animate) {
    void root.offsetHeight; // reflow → var() ter-resolve tanpa stale
    setTimeout(() => root.classList.remove('theme-switching'), 60);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [theme, setTheme] = useState('dark');
  const [ready, setReady] = useState(false);
  const lastRoleRef = useRef(null);
  const router = useRouter();

  const applySession = useCallback((session) => {
    const u = toUser(session);
    setUser(u);
    if (u) {
      try { localStorage.setItem(LAST_ROLE_KEY, u.role); } catch (e) {}
      // Theme hanya di-resolve saat role berubah (token refresh jangan reset toggle)
      if (lastRoleRef.current !== u.role) {
        lastRoleRef.current = u.role;
        const t = resolveTheme(u.role);
        try { if (!localStorage.getItem(themeKey(u.role))) localStorage.setItem(themeKey(u.role), t); } catch (e) {}
        setTheme(t);
        applyThemeAttr(t, false);
      }
    } else {
      lastRoleRef.current = null;
    }
  }, []);

  // Restore sesi saat mount + ikuti perubahan auth (login/logout/refresh token)
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      applySession(data?.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) applySession(session);
    });
    return () => { mounted = false; sub?.subscription?.unsubscribe(); };
  }, [applySession]);

  const login = useCallback(async (email, password, remember) => {
    setRememberSession(remember);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: (email || '').trim().toLowerCase(),
      password: password || '',
    });
    if (error || !data?.session) {
      const msg = /invalid login credentials/i.test(error?.message || '')
        ? 'Email atau password salah'
        : (error?.message || 'Login gagal — coba lagi');
      return { ok: false, error: msg };
    }
    applySession(data.session);
    return { ok: true, role: toUser(data.session)?.role };
  }, [applySession]);

  const logout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
    try { localStorage.removeItem(LAST_ROLE_KEY); } catch (e) {}
    setUser(null);
    lastRoleRef.current = null;
    router.replace('/login');
  }, [router]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyThemeAttr(next, true);
      try { if (user) localStorage.setItem(themeKey(user.role), next); } catch (e) {}
      return next;
    });
  }, [user]);

  const value = {
    user,
    role: user?.role || null,
    isAdmin: user?.role === 'admin',
    theme,
    ready,
    login,
    logout,
    toggleTheme,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext) || {};
}
