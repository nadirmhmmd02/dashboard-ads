'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from './AuthContext';
import SuggestionsModal from './SuggestionsModal';

export default function AppShell({ children }) {
  const { user, role, ready } = useAuth();
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!ready) return;
    if (!user && !isLogin) router.replace('/login');
    if (user && isLogin)   router.replace('/');
  }, [ready, user, isLogin, router]);

  if (isLogin) return children;
  if (!ready || !user) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', position: 'relative' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>

      {/* Floating button for User */}
      {role === 'user' && (
        <button
          onClick={() => setIsSuggestOpen(true)}
          title="Send a Suggestion"
          style={{
            position: 'absolute', bottom: '24px', right: '24px', zIndex: 50,
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
            border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
        >
          <MessageSquare size={22} />
        </button>
      )}

      {/* User suggestion modal (user role only) */}
      {role === 'user' && (
        <SuggestionsModal
          isOpen={isSuggestOpen}
          onClose={() => setIsSuggestOpen(false)}
          isAdmin={false}
          user={user}
        />
      )}
    </div>
  );
}
