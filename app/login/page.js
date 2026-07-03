'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../components/AuthContext';

/* Login page — light + amber accent (mengikuti desain referensi).
   Warna di-hardcode terang supaya tampilan login konsisten apapun tema tersimpan. */
const AMBER   = '#F59E0B';
const AMBER_2 = '#FBBF24';
const INK     = '#111827';
const SUB     = '#6B7280';
const BORDER  = '#E5E7EB';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = login(username, password, remember);
    if (res.ok) {
      router.replace('/');
    } else {
      setError(res.error || 'Login gagal');
      setBusy(false);
    }
  }

  const inputWrap = {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '12px',
    padding: '0 14px', height: '52px', transition: 'border-color 0.18s, box-shadow 0.18s',
  };
  function focusOn(e)  { e.currentTarget.style.borderColor = AMBER; e.currentTarget.style.boxShadow = `0 0 0 4px rgba(245,158,11,0.14)`; }
  function focusOff(e) { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = 'none'; }
  const inputEl = {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: '14px', color: INK, fontFamily: 'inherit', height: '100%',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#FFFDF9',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
      animation: 'wdFadeIn 0.5s ease',
    }}>
      {/* Dekor amber di sudut */}
      <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '45%', height: '55%',
        background: 'radial-gradient(circle at 30% 30%, rgba(245,158,11,0.22), transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '55%', height: '70%',
        background: 'radial-gradient(circle at 70% 70%, rgba(251,191,36,0.28), transparent 62%)', pointerEvents: 'none' }} />

      {/* Card */}
      <form onSubmit={submit} style={{
        position: 'relative', width: '100%', maxWidth: '440px', margin: '24px',
        background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(245,158,11,0.10), 0 4px 16px rgba(16,24,40,0.06)',
        padding: '44px 40px 36px',
        animation: 'wdScaleIn 0.4s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: `linear-gradient(135deg, ${AMBER_2}, ${AMBER})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 22px rgba(245,158,11,0.35)',
          }}>
            <Zap size={30} color="#fff" fill="#fff" />
          </div>
        </div>

        {/* Title */}
        <h1 style={{ textAlign: 'center', fontSize: '30px', fontWeight: 800, color: INK, letterSpacing: '-0.6px' }}>
          Welcome <span style={{ color: AMBER }}>back</span>
        </h1>
        <p style={{ textAlign: 'center', fontSize: '14px', color: SUB, marginTop: '8px', marginBottom: '30px' }}>
          Sign in to access your dashboard
        </p>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#DC2626', fontSize: '13px',
          }}>{error}</div>
        )}

        {/* Username */}
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: INK, marginBottom: '8px' }}>Username</label>
        <div style={{ ...inputWrap, marginBottom: '20px' }} onFocus={focusOn} onBlur={focusOff}>
          <User size={18} color={SUB} />
          <input style={inputEl} type="text" autoComplete="username" placeholder="Enter your username"
            value={username} onChange={e => setUsername(e.target.value)} />
        </div>

        {/* Password */}
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: INK, marginBottom: '8px' }}>Password</label>
        <div style={{ ...inputWrap, marginBottom: '18px' }} onFocus={focusOn} onBlur={focusOff}>
          <Lock size={18} color={SUB} />
          <input style={inputEl} type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password"
            value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
            style={{ background: 'none', border: 'none', display: 'flex', cursor: 'pointer', padding: '4px' }}>
            {show ? <EyeOff size={18} color={SUB} /> : <Eye size={18} color={SUB} />}
          </button>
        </div>

        {/* Remember + Forgot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: SUB, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: AMBER, cursor: 'pointer' }} />
            Remember me
          </label>
          <button type="button"
            onClick={() => setError('Hubungi admin untuk reset password.')}
            style={{ background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: AMBER, cursor: 'pointer' }}>
            Forgot password?
          </button>
        </div>

        {/* Sign in */}
        <button type="submit" disabled={busy} style={{
          width: '100%', height: '52px', border: 'none', borderRadius: '12px',
          background: `linear-gradient(135deg, ${AMBER_2}, ${AMBER})`,
          color: '#3d2a00', fontSize: '15px', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          boxShadow: '0 8px 22px rgba(245,158,11,0.32)',
          transition: 'transform 0.12s ease, box-shadow 0.18s ease, opacity 0.18s',
          opacity: busy ? 0.7 : 1,
        }}
          onMouseEnter={e => { if (!busy) e.currentTarget.style.boxShadow = '0 10px 28px rgba(245,158,11,0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 8px 22px rgba(245,158,11,0.32)'; }}
          onMouseDown={e => { if (!busy) e.currentTarget.style.transform = 'scale(0.985)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {/* Footer */}
      <div style={{ position: 'relative', fontSize: '13px', color: SUB, marginTop: '28px', paddingBottom: '12px' }}>
        © 2026 All rights reserved.
      </div>
    </div>
  );
}
