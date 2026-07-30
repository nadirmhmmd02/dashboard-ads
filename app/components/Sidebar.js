'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Megaphone,
  CalendarDays,
  Sparkles,
  Users,
  ChevronsLeft,
  LogOut,
  NotebookPen,
} from 'lucide-react';
import Logo from './Logo';
import { useAuth } from './AuthContext';

// Dipakai juga oleh MobileNav.js (drawer mobile) — satu sumber menu.
// Dua section: Ads Hub (fitur live) + Leads Hub (placeholder, v3.0).
export const NAV_SECTIONS = [
  {
    label: 'Ads Hub',
    items: [
      { href: '/',          label: 'Dashboard', icon: LayoutDashboard },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/calendar',  label: 'Calendar',  icon: CalendarDays },
      { href: '/reports',   label: 'Analytics & Insights', icon: Sparkles },
    ],
  },
  {
    label: 'Leads Hub',
    items: [
      { href: '/leads',          label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads/list',     label: 'Leads List', icon: Users },
      { href: '/leads/insights', label: 'Analytics & Insights', icon: Sparkles },
    ],
  },
];

// Menu per role: marketing hanya Leads Hub, role lain lihat semua
export function navSectionsFor(role) {
  if (role === 'marketing') return NAV_SECTIONS.filter(s => s.label === 'Leads Hub');
  return NAV_SECTIONS;
}

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
  // Redesain 2026: brand tunggal untuk semua role
  const brand = 'Baba Rafi Ad Hub';
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
    // Exact match — '/leads' tidak boleh ikut aktif saat di '/leads/list'
    return pathname === href;
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
      {/* ── Logo ──
          Anti patah-patah: layout TIDAK lompat saat collapse. justifyContent tetap flex-start,
          padding tetap 18px (logo 28px otomatis center di lebar 64px), teks menyusut via
          max-width (animatable) + opacity — bukan width auto→0 yang nge-snap. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: collapsed ? '0px' : '10px',
        padding: '20px 18px',
        borderBottom: '1px solid var(--divider)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: `gap 0.28s ${EASE}`,
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
          maxWidth: collapsed ? '0px' : '180px',
          overflow: 'hidden',
          transition: `opacity 0.22s ease, max-width 0.28s ${EASE}`,
          textTransform: 'uppercase',
        }}>
          {brand}
        </span>
      </div>

      {/* ── Nav (per section: Ads Hub / Leads Hub) ── */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {navSectionsFor(role).map((section, si) => (
        <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: si > 0 ? '14px' : 0 }}>

        {/* Section label (expanded) / divider (collapsed, antar section).
            Tinggi slot KONSTAN di dua state supaya item nav tidak lompat vertikal saat collapse. */}
        <div style={{ height: '24px', display: 'flex', alignItems: 'center', padding: '0 10px', overflow: 'hidden' }}>
          {!collapsed ? (
            <span style={{
              fontSize: '9px', fontWeight: '700', letterSpacing: '1.4px',
              color: 'var(--menu-label)', textTransform: 'uppercase',
              opacity: textVisible ? 1 : 0, transition: 'opacity 0.22s ease',
              whiteSpace: 'nowrap',
            }}>
              {section.label}
            </span>
          ) : si > 0 ? (
            <div style={{ height: '1px', background: 'var(--divider)', flex: 1, margin: '0 2px' }} />
          ) : null}
        </div>

        {section.items.map((item) => {
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
                justifyContent: 'flex-start',
                gap: collapsed ? '0px' : '10px',
                // Collapsed: paddingLeft 15px → icon 18px persis center di lebar 64px (8+15+9=32)
                padding: collapsed ? '11px 0 11px 15px' : '9px 10px',
                borderRadius: '9px',
                background: active ? ACTIVE_BG : isHover ? ACTIVE_HV : 'transparent',
                color: active ? ACTIVE_FG : isHover ? 'var(--nav-hover-tx)' : 'var(--nav-tx)',
                fontSize: '13px',
                fontWeight: active ? '600' : '400',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                transition: `background 0.18s ${EASE}, color 0.18s, padding 0.28s ${EASE}, gap 0.28s ${EASE}`,
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
                maxWidth: collapsed ? '0px' : '200px',
                overflow: 'hidden',
                transition: `opacity 0.22s ease, max-width 0.28s ${EASE}`,
                letterSpacing: '-0.1px',
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}
        </div>
        ))}
      </nav>

      {/* ── Notes (admin) — halaman /notes, tepat di atas blok user + logout ── */}
      {role === 'admin' && (() => {
        const active = isActive('/notes');
        const isHover = hovered === '/notes' && !active;
        return (
          <div style={{ padding: '0 8px 6px' }}>
            <Link
              href="/notes"
              onMouseEnter={() => setHovered('/notes')}
              onMouseLeave={() => setHovered(null)}
              title="Notes"
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'flex-start',
                gap: collapsed ? '0px' : '10px',
                padding: collapsed ? '11px 0 11px 15px' : '9px 10px',
                borderRadius: '9px', position: 'relative',
                background: active ? ACTIVE_BG : isHover ? ACTIVE_HV : 'transparent',
                color: active ? ACTIVE_FG : isHover ? 'var(--nav-hover-tx)' : 'var(--nav-tx)',
                fontSize: '13px', fontWeight: active ? '600' : '400',
                whiteSpace: 'nowrap', overflow: 'hidden',
                transition: `background 0.18s ${EASE}, color 0.18s, padding 0.28s ${EASE}, gap 0.28s ${EASE}`,
              }}
            >
              {active && !collapsed && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '60%', borderRadius: '0 2px 2px 0', background: ACTIVE_FG,
                }} />
              )}
              <NotebookPen
                size={18}
                color={active ? ACTIVE_FG : isHover ? 'var(--nav-hover-tx)' : 'var(--nav-icon)'}
                style={{ flexShrink: 0, minWidth: 18, transition: 'color 0.18s' }}
              />
              <span style={{
                opacity: textVisible ? 1 : 0,
                maxWidth: collapsed ? '0px' : '200px',
                overflow: 'hidden',
                transition: `opacity 0.22s ease, max-width 0.28s ${EASE}`,
                letterSpacing: '-0.1px',
              }}>Notes</span>
            </Link>
          </div>
        );
      })()}

      {/* ── User + logout ── */}
      {user && (
        <div style={{ padding: '0 8px 8px' }}>
          {!collapsed ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: '10px',
              background: 'var(--data-bg)', border: '1px solid var(--data-br)',
              animation: 'wdFadeIn 0.3s ease',
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
              animation: 'wdFadeIn 0.3s ease',
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
            justifyContent: 'flex-start',
            gap: collapsed ? '0px' : '10px',
            width: '100%',
            padding: collapsed ? '11px 0 11px 15px' : '9px 10px',
            borderRadius: '9px',
            background: 'transparent',
            border: 'none',
            color: 'var(--collapse-tx)',
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            transition: `gap 0.28s ${EASE}, padding 0.28s ${EASE}, color 0.18s`,
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
            maxWidth: collapsed ? '0px' : '200px',
            overflow: 'hidden',
            transition: `opacity 0.22s ease, max-width 0.28s ${EASE}`,
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
