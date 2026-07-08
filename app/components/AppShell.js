'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from './AuthContext';
import SuggestionsModal from './SuggestionsModal';
import { supabase } from '../supabase';

const LAST_SEEN_KEY = 'wd-suggest-seen';

export default function AppShell({ children }) {
  const { user, role, ready } = useAuth();
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [showAdminPopup, setShowAdminPopup] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const popupRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!ready) return;
    if (!user && !isLogin) router.replace('/login');
    if (user && isLogin)   router.replace('/');
  }, [ready, user, isLogin, router]);

  useEffect(() => {
    if (role !== 'admin') return;
    (async () => {
      const { data } = await supabase
        .from('suggestions').select('created_at').order('created_at', { ascending: false }).limit(1);
      if (data && data.length > 0) {
        const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
        if (!lastSeen || new Date(data[0].created_at) > new Date(lastSeen)) {
          setHasUnread(true);
        }
      }
    })();
  }, [role]);

  useEffect(() => {
    if (!showAdminPopup) return;
    (async () => {
      const { data, error } = await supabase
        .from('suggestions').select('*').order('created_at', { ascending: false });
      if (!error && data) setSuggestions(data);
    })();
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    setHasUnread(false);
  }, [showAdminPopup]);

  useEffect(() => {
    if (!showAdminPopup) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) setShowAdminPopup(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAdminPopup]);

  async function handleDeleteSuggestion(id) {
    const { error } = await supabase.from('suggestions').delete().eq('id', id);
    if (!error) setSuggestions(prev => prev.filter(s => s.id !== id));
  }

  if (isLogin) return children;
  if (!ready || !user) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', position: 'relative' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>

      {/* Admin: Suggestions icon top-right */}
      {role === 'admin' && (
        <div ref={popupRef} style={{ position: 'absolute', top: '18px', right: '18px', zIndex: 60 }}>
          <button
            onClick={() => setShowAdminPopup(prev => !prev)}
            title="Suggestions"
            style={{
              width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--cd)', border: `1px solid ${showAdminPopup ? 'var(--cal-accent-line)' : 'var(--br)'}`,
              borderRadius: '10px', cursor: 'pointer', position: 'relative',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--br-strong)'}
            onMouseLeave={e => { if (!showAdminPopup) e.currentTarget.style.borderColor = 'var(--br)'; }}
          >
            <MessageSquare size={15} color="var(--t2)" />
            {hasUnread && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#EF4444', border: '2px solid var(--cd)',
                animation: 'wdPulseDot 1.5s ease-in-out infinite',
              }} />
            )}
          </button>

          {showAdminPopup && (
            <div style={{
              position: 'absolute', top: '48px', right: 0,
              width: '380px', maxHeight: '440px',
              background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '14px',
              boxShadow: 'var(--pop-shadow)', overflow: 'hidden',
              animation: 'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid var(--br)', background: 'var(--sf)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <MessageSquare size={16} color="var(--t2)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>User Suggestions</span>
                <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: 'auto' }}>{suggestions.length} total</span>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
                {suggestions.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '13px', padding: '24px 0' }}>
                    No suggestions yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {suggestions.map(s => (
                      <div key={s.id} style={{
                        padding: '12px', borderRadius: '10px',
                        border: '1px solid var(--br)', background: 'var(--data-bg)',
                        animation: 'wdFadeUp 0.2s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)', textTransform: 'capitalize' }}>{s.author}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--t3)' }}>
                              {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button onClick={() => handleDeleteSuggestion(s.id)} title="Delete" style={{
                              background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444',
                              display: 'flex', alignItems: 'center', opacity: 0.6, transition: 'opacity 0.15s', padding: 0,
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--t1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{s.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User: Floating button bottom-right */}
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

      {/* User suggestion modal */}
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
