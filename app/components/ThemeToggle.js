'use client';

import { useRef, useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function ThemeToggle({ size = 40, iconSize = 15 }) {
  const { theme, toggleTheme } = useAuth();
  const dark = theme !== 'light';
  const btnRef = useRef(null);
  const busy = useRef(false);

  const handleClick = useCallback(() => {
    if (busy.current) return;
    busy.current = true;

    const root = document.documentElement;

    root.style.transition = 'filter 0.3s cubic-bezier(0.4,0,0.2,1)';
    root.style.filter = 'blur(6px) brightness(0.85)';

    setTimeout(() => {
      toggleTheme();

      setTimeout(() => {
        root.style.filter = 'blur(0px) brightness(1)';

        const onEnd = () => {
          root.style.transition = '';
          root.style.filter = '';
          busy.current = false;
          root.removeEventListener('transitionend', onEnd);
        };
        root.addEventListener('transitionend', onEnd, { once: true });

        setTimeout(() => {
          root.style.transition = '';
          root.style.filter = '';
          busy.current = false;
        }, 400);
      }, 30);
    }, 300);
  }, [toggleTheme]);

  return (
    <button
      ref={btnRef}
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
