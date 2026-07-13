'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Megaphone,
  CalendarDays,
  FileChartColumn,
  ChevronsLeft,
  LogOut,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from './AuthContext';

// Dipakai juga oleh MobileNav.js (drawer mobile) — satu sumber menu
export const NAV_ITEMS = [
  { href: '/',          label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/calendar',  label: 'Calendar',  icon: CalendarDays },
  { href: '/reports',   label: 'Reports',   icon: FileChartColumn },
];

const MIN_WIDTH       = 180;
const MAX_WIDTH       = 360;
const DEFAULT_WIDTH   = 240;
const COLLAPSED_WIDTH = 64;
const EASE            = 'cubic-bezier(0.4,0,0.2,1)';

const ACTIVE_BG = 'var(--nav-accent-soft)';   // hijau (dark) / amber (light)
const ACTIVE_HV = 'var(--nav-accent-hover)';
const ACTIVE_FG = 'var(--nav-accent-fg)';

export default function Sidebar() {
  const pathname  = usePathname();
  const { user, role, logout } = useAuth();
  // Default: tertutup (collapsed) saat web pertama dibuka
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth]         = useState(COLLAPSED_WIDTH);
  const [hovered, setHovered]     = useState(null);
  const [dragHover, setDragHover] = useState(false);
  const [animate, setAnimate]     = useState(true);
  const lastWidth  = useRef(DEFAULT_WIDTH);
  const dragging   = useRef(false);
  const sidebarRef = useRef(null);

  function isActive(href) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function toggleCollapse() {
    setAnimate(true);
    if (!collapsed) {
      lastWidth.current = width;
      setCollapsed(true);
      setWidth(COLLAPSED_WIDTH);
    } else {
      setCollapsed(false);
      setWidth(lastWidth.current);
    }
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current || !sidebarRef.current) return;
      const left = sidebarRef.current.getBoundingClientRect().left;
      let w = e.clientX - left;
      if (w < MIN_WIDTH) w = MIN_WIDTH;
      if (w > MAX_WIDTH) w = MAX_WIDTH;
      setWidth(w);
    }
    function onUp() {
      if (dragging.current) {
        dragging.current = false;
        setAnimate(true);
        document.body.style.userSelect = '';
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startDrag(e) {
    if (collapsed) return;
    dragging.current = true;
    setAnimate(false);
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  const textVisible = !collapsed;

  return (
    <aside
      ref={sidebarRef}
      style={{
        width: width + 'px',
        background: 'var(--nav)',
        borderRight: '1px solid var(--divider)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        transition: animate ? `width 0.28s ${EASE}` : 'none',
        flexShrink: 0,
        height: '100vh',
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? '0' : '10px',
        padding: collapsed ? '20px 0' : '20px 18px',
        borderBottom: '1px solid var(--divider)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: `gap 0.28s ${EASE}, padding 0.28s ${EASE}`,
      }}>
        <div className="wd-logo" style={{
          width: '28px', height: '28px',
          borderRadius: '7px',
          background: 'var(--nav-logo-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Logo size={18} color="var(--nav-logo-fg)" style={{ flexShrink: 0, minWidth: 18 }} />
        </div>
        <span style={{
          fontSize: '13px', fontWeight: '700',
          letterSpacing: '0.8px', color: 'var(--logo-text)',
          opacity: textVisible ? 1 : 0,
          width: collapsed ? 0 : 'auto',
          overflow: 'hidden',
          transition: 'opacity 0.2s',
          textTransform: 'uppercase',
        }}>
          WILL OF D
        </span>
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>

        {/* Section label */}
        {!collapsed && (
          <div style={{
            fontSize: '9px', fontWeight: '700', letterSpacing: '1.4px',
            color: 'var(--menu-label)', textTransform: 'uppercase',
            padding: '6px 10px 8px',
          }}>
            Menu
          </div>
        )}

        {NAV_ITEMS.map((item) => {
          const active  = isActive(item.href);
          const isHover = hovered === item.href && !active;
          const Icon    = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHovered(item.href)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? '0' : '10px',
                padding: collapsed ? '11px 0' : '9px 10px',
                borderRadius: '9px',
                background: active ? ACTIVE_BG : isHover ? ACTIVE_HV : 'transparent',
                color: active ? ACTIVE_FG : isHover ? 'var(--nav-hover-tx)' : 'var(--nav-tx)',
                fontSize: '13px',
                fontWeight: active ? '600' : '400',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                transition: `background 0.18s ${EASE}, color 0.18s`,
                position: 'relative',
              }}
            >
              {/* Active indicator line */}
              {active && !collapsed && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '60%', borderRadius: '0 2px 2px 0',
                  background: ACTIVE_FG,
                }} />
              )}
              <Icon
                size={18}
                color={active ? ACTIVE_FG : isHover ? 'var(--nav-hover-tx)' : 'var(--nav-icon)'}
                style={{ flexShrink: 0, minWidth: 18, transition: 'color 0.18s' }}
              />
              <span style={{
                opacity: textVisible ? 1 : 0,
                width: collapsed ? 0 : 'auto',
                overflow: 'hidden',
                transition: 'opacity 0.2s',
                letterSpacing: '-0.1px',
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ── User + logout ── */}
      {user && (
        <div style={{ padding: collapsed ? '0 0 8px' : '0 10px 8px' }}>
          {!collapsed ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: '10px',
              background: 'var(--data-bg)', border: '1px solid var(--data-br)',
            }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                background: ACTIVE_BG, color: ACTIVE_FG,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
              }}>{user.username?.[0] || '?'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)', textTransform: 'capitalize',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</div>
                <div style={{ fontSize: '10px', color: ACTIVE_FG, fontWeight: 600, textTransform: 'capitalize' }}>{role}</div>
              </div>
              <button onClick={logout} title="Logout" style={{
                background: 'none', border: 'none', display: 'flex', cursor: 'pointer', padding: '5px',
                borderRadius: '7px', color: 'var(--nav-tx)', flexShrink: 0, transition: 'color 0.15s, background 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--nav-tx)'; e.currentTarget.style.background = 'none'; }}
              ><LogOut size={16} /></button>
            </div>
          ) : (
            <button onClick={logout} title="Logout" style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '11px 0', borderRadius: '9px', background: 'transparent', border: 'none',
              color: 'var(--nav-tx)', cursor: 'pointer', transition: 'color 0.15s, background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--nav-tx)'; e.currentTarget.style.background = 'transparent'; }}
            ><LogOut size={18} /></button>
          )}
        </div>
      )}

      {/* ── Collapse button ── */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--divider)' }}>
        <button
          onClick={toggleCollapse}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? '0' : '10px',
            width: '100%',
            padding: collapsed ? '11px 0' : '9px 10px',
            borderRadius: '9px',
            background: 'transparent',
            border: 'none',
            color: 'var(--collapse-tx)',
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            transition: `gap 0.28s ${EASE}, color 0.18s`,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--data-time)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--collapse-tx)'}
        >
          <ChevronsLeft
            size={18}
            style={{
              flexShrink: 0, minWidth: 18,
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: `transform 0.28s ${EASE}`,
            }}
          />
          <span style={{
            opacity: textVisible ? 1 : 0,
            width: collapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: 'opacity 0.2s',
          }}>
            Collapse
          </span>
        </button>
      </div>

      {/* ── Drag handle ── */}
      {!collapsed && (
        <div
          onMouseDown={startDrag}
          onMouseEnter={() => setDragHover(true)}
          onMouseLeave={() => setDragHover(false)}
          style={{
            position: 'absolute', top: 0, right: '-3px',
            width: '6px', height: '100%',
            cursor: 'col-resize', zIndex: 10,
            background: dragHover ? 'var(--nav-drag)' : 'transparent',
            transition: 'background 0.15s',
          }}
        />
      )}
    </aside>
  );
}
