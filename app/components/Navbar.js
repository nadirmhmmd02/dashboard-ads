'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [dark, setDark] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : '');
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  };

  return (
    <nav style={{
      background: 'var(--nav)',
      borderBottom: '0.5px solid var(--br)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      height: '54px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link href="/" style={{
        fontSize: '15px', fontWeight: '500', color: 'var(--t1)',
        display: 'flex', alignItems: 'center', gap: '9px', marginRight: '28px',
      }}>
        <div style={{
          width: '30px', height: '30px', background: 'var(--ac)',
          borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        Dashboard Ads
      </Link>

      <Link href="/calendar" style={{
        height: '54px', padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: '5px',
        fontSize: '13px',
        color: pathname === '/calendar' ? 'var(--ac)' : 'var(--t3)',
        borderBottom: pathname === '/calendar' ? '2.5px solid var(--ac)' : '2.5px solid transparent',
        fontWeight: pathname === '/calendar' ? '500' : '400',
      }}>
        📅 Ads Calendar
      </Link>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={toggleTheme} style={{
          width: '34px', height: '34px', borderRadius: '10px',
          border: '1px solid var(--bs)', background: 'transparent',
          fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {dark ? '☀️' : '🌙'}
        </button>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px',
          border: '1px solid var(--bs)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative', fontSize: '15px',
        }}>
          🔔
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#E24B4A', color: '#fff', fontSize: '9px',
            width: '14px', height: '14px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500',
          }}>2</span>
        </div>
      </div>
    </nav>
  );
}