'use client';

import { useRef, useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from './AuthContext';

const DURATION = 600;
const LIGHT_BG = '#F7F8FA';
const DARK_BG  = '#090A0C';

export default function ThemeToggle({ size = 40, iconSize = 15 }) {
  const { theme, toggleTheme } = useAuth();
  const dark = theme !== 'light';
  const btnRef = useRef(null);
  const busy = useRef(false);

  const handleClick = useCallback(() => {
    if (busy.current) return;
    busy.current = true;

    const rect = btnRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy),
    );

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999; pointer-events:none;
      background:${dark ? LIGHT_BG : DARK_BG};
      clip-path:circle(0px at ${cx}px ${cy}px);
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.transition = `clip-path ${DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      overlay.style.clipPath = `circle(${maxR}px at ${cx}px ${cy}px)`;
    });

    setTimeout(() => {
      toggleTheme();
      setTimeout(() => {
        overlay.remove();
        busy.current = false;
      }, 50);
    }, DURATION * 0.6);
  }, [dark, toggleTheme]);

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
