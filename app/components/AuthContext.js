'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/* ─── Akun demo (login sederhana berbasis role) ───
   Ganti username/password di sini kalau perlu. Ini auth sisi-klien
   (tanpa backend) — cocok untuk demo/internal, bukan keamanan produksi. */
const CREDENTIALS = {
  dozan:    { password: 'Dozan213',    role: 'admin' },
  babarafi: { password: 'babarafi123', role: 'user'  },
};

const DEFAULT_THEME = { admin: 'dark', user: 'light' };
const AUTH_KEY = 'wd-auth';

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
  const [user, setUser]       = useState(null);
  const [theme, setTheme]     = useState('dark');
  const [ready, setReady]     = useState(false);
  const router = useRouter();

  // Restore sesi saat mount
  useEffect(() => {
    let s = null;
    try {
      const raw = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {}
    if (s && s.role) {
      setUser(s);
      const t = resolveTheme(s.role);
      setTheme(t);
      applyThemeAttr(t, false);
    }
    setReady(true);
  }, []);

  const login = useCallback((username, password, remember) => {
    const key = (username || '').toLowerCase().trim();
    const acc = CREDENTIALS[key];
    if (!acc || acc.password !== password) {
      return { ok: false, error: 'Username atau password salah' };
    }
    const u = { username: key, role: acc.role };
    setUser(u);

    // Simpan sesi: remember → localStorage (persist), else sessionStorage
    try {
      const json = JSON.stringify(u);
      if (remember) { localStorage.setItem(AUTH_KEY, json); sessionStorage.removeItem(AUTH_KEY); }
      else          { sessionStorage.setItem(AUTH_KEY, json); localStorage.removeItem(AUTH_KEY); }
    } catch (e) {}

    // Theme: pakai preferensi tersimpan, kalau belum ada pakai default role & simpan
    const t = resolveTheme(u.role);
    try { if (!localStorage.getItem(themeKey(u.role))) localStorage.setItem(themeKey(u.role), t); } catch (e) {}
    setTheme(t);
    applyThemeAttr(t, false);

    return { ok: true, role: u.role };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
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
