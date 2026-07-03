'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { useAuth } from './AuthContext';

export default function AppShell({ children }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!ready) return;
    if (!user && !isLogin) router.replace('/login');
    if (user && isLogin)   router.replace('/');
  }, [ready, user, isLogin, router]);

  // Halaman login: full-screen, tanpa sidebar
  if (isLogin) return children;

  // Belum tahu status auth / belum login → jangan flash dashboard
  if (!ready || !user) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
