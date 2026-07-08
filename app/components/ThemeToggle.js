'use client';

import { useRef, useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function ThemeToggle({ size = 40, iconSize = 15 }) {
  const { theme, toggleTheme } = useAuth();
  const dark = theme !== 'light';
  const busy = useRef(false);

  const handleClick = useCallback(() => {
    if (busy.current) return;
    busy.current = true;

    const root = document.documentElement;
    root.style.transition = 'opacity 0.1s ease-out';
    root.style.opacity = '0';

    setTimeout(() => {
      toggleTheme();
      requestAnimationFrame(() => {
        root.style.transition = 'opacity 0.15s ease-in';
        root.style.opacity = '1';
        setTimeout(() => {
          root.style.transition = '';
          root.style.opacity = '';
          busy.current = false;
        }, 180);
      });
    }, 110);
  }, [toggleTheme]);

  return (
    <button
      onClick={handleClick}
      title={dark ? 'Switch to light' : 'Switch to dark'}
      style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cd)', border: '1px solid var(--br)',
        borderRadius: size <= 36 ? '9px' : '10px',
        cursor: 'pointer', transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--br-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}
    >
      {dark
        ? <Moon size={iconSize} color="var(--t2)" />
        : <Sun size={iconSize} color="#F59E0B" />
      }
    </button>
  );
}
