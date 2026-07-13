'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import useIsMobile from './useIsMobile';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';

export default function AppShell({ children }) {
  const { user, role, ready } = useAuth();
  const isMobile = useIsMobile();
  const [showSuggest, setShowSuggest] = useState(false);
  const [text, setText] = useState('');
  const [success, setSuccess] = useState(false);
  const [closing, setClosing] = useState(false);
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
    if (showSuggest) {
      setText('');
      setSuccess(false);
    }
  }, [showSuggest]);

  useEffect(() => {
    if (!showSuggest) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) closePopup();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggest]);

  function closePopup() {
    setClosing(true);
    setTimeout(() => {
      setShowSuggest(false);
      setClosing(false);
    }, 180);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const { error } = await supabase
      .from('suggestions')
      .insert([{ text: text.trim(), author: user?.username || 'user' }]);
    if (!error) {
      setText('');
      setSuccess(true);
      setTimeout(() => closePopup(), 1200);
    }
  }

  if (isLogin) return children;
  if (!ready || !user) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100vh', width: '100%', overflow: 'hidden', position: 'relative',
    }}>
      {isMobile ? <MobileNav /> : <Sidebar />}
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>

      {/* User: Floating suggest button + popup */}
      {role === 'user' && (
        <div ref={popupRef} style={{
          position: 'absolute', zIndex: 50,
          bottom: isMobile ? '16px' : '24px',
          right:  isMobile ? '16px' : '24px',
        }}>

          {showSuggest && (
            <div style={{
              position: 'absolute', bottom: '58px', right: 0,
              width: isMobile ? 'min(360px, calc(100vw - 32px))' : '360px',
              background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '14px',
              boxShadow: 'var(--pop-shadow)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              animation: closing
                ? 'wdSlideUp 0.18s cubic-bezier(0.4,0,0.2,1) reverse forwards'
                : 'wdSlideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
            }}>
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid var(--br)', background: 'var(--sf)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <MessageSquare size={16} color="var(--t2)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Send a Suggestion</span>
              </div>

              <div style={{ padding: '16px' }}>
                {success ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '10px',
                    animation: 'wdFadeUp 0.25s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    <CheckCircle2 size={36} color="#10B981" />
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--t1)' }}>Suggestion sent!</div>
                    <div style={{ fontSize: '12px', color: 'var(--t2)' }}>Thank you for your feedback.</div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--t2)', lineHeight: 1.5 }}>
                      Have an idea or found something to improve? Let us know!
                    </div>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder="Describe your suggestion here..."
                      autoFocus
                      style={{
                        width: '100%', minHeight: '100px', padding: '12px',
                        borderRadius: '10px', border: '1px solid var(--br)',
                        background: 'var(--data-bg)', color: 'var(--t1)', fontSize: '13px',
                        fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--cal-accent-line)'}
                      onBlur={e => e.target.style.borderColor = 'var(--br)'}
                    />
                    <button type="submit" disabled={!text.trim()} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '10px 16px', borderRadius: '9px', border: 'none',
                      background: text.trim() ? 'var(--cal-accent)' : 'var(--hover)',
                      color: text.trim() ? 'var(--cal-accent-fg)' : 'var(--t3)',
                      fontSize: '13px', fontWeight: 600,
                      cursor: text.trim() ? 'pointer' : 'default',
                      transition: 'background 0.15s, color 0.15s',
                    }}>
                      <Send size={15} />
                      Submit
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => { if (showSuggest) closePopup(); else setShowSuggest(true); }}
            title="Send a Suggestion"
            style={{
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
        </div>
      )}
    </div>
  );
}
