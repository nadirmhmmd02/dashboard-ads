'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { useAuth } from './AuthContext';
import { NAV_SECTIONS } from './Sidebar';

/* ─────────────────────────────────────────────────────────────
   MOBILE NAV — WILL OF D
   Top bar (56px): hamburger garis-3 (morph jadi X saat terbuka)
   + logo + ThemeToggle. Drawer slide dari kiri dengan backdrop
   dim (tanpa blur), nav besar ramah jempol, user info + logout.
   Hanya dirender AppShell saat viewport mobile (useIsMobile).
   ───────────────────────────────────────────────────────────── */

const EASE = 'cubic-bezier(0.4,0,0.2,1)';

/* Hamburger 3 garis → X (morph murni CSS transform, smooth semua browser) */
function Hamburger({ open, onClick }) {
  const line = {
    position: 'absolute', left: '11px', width: '18px', height: '2px',
    borderRadius: '2px', background: 'var(--t1)',
    transition: `transform 0.25s ${EASE}, opacity 0.2s, top 0.25s ${EASE}`,
  };
  return (
    <button onClick={onClick} aria-label="Menu" style={{
      position: 'relative', width: '40px', height: '40px', flexShrink: 0,
      background: 'transparent', border: 'none', borderRadius: '10px',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{ ...line, top: open ? '19px' : '13px', transform: open ? 'rotate(45deg)'  : 'none' }} />
      <span style={{ ...line, top: '19px', opacity: open ? 0 : 1, transform: open ? 'scaleX(0.4)' : 'none' }} />
      <span style={{ ...line, top: open ? '19px' : '25px', transform: open ? 'rotate(-45deg)' : 'none' }} />
    </button>
  );
}

export default function MobileNav() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  // Brand per role: admin = WILL OF D, user = Baba Rafi Ad Hub
  const brand = role === 'user' ? 'Baba Rafi Ad Hub' : 'WILL OF D';
  const [open, setOpen]       = useState(false);
  const [closing, setClosing] = useState(false);

  function closeDrawer() {
    if (!open || closing) return;
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 230);
  }

  // Pindah halaman → drawer langsung tutup
  useEffect(() => { setOpen(false); setClosing(false); }, [pathname]);

  // Drawer terbuka → kunci scroll di belakangnya
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function isActive(href) {
    // Exact match — '/leads' tidak boleh ikut aktif saat di '/leads/list'
    return pathname === href;
  }

  const showX = open && !closing;

  return (
    <>
      {/* ══ TOP BAR ══ */}
      <header style={{
        height: '56px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 10px',
        background: 'var(--nav)', borderBottom: '1px solid var(--divider)',
      }}>
        <Hamburger open={showX} onClick={() => (open ? closeDrawer() : setOpen(true))} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <div className="wd-logo" style={{
            width: '26px', height: '26px', borderRadius: '7px',
            background: 'var(--nav-logo-bg)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Logo size={16} color="var(--nav-logo-fg)" />
          </div>
          <span style={{
            fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px',
            color: 'var(--logo-text)', textTransform: 'uppercase', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{brand}</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Slot aksi per-halaman (diisi via portal oleh halaman aktif):
              kiri theme toggle = export/refresh, kanan theme toggle = suggestions admin.
              Toggle disembunyikan di /calendar (permintaan Nadir). */}
          <div id="wd-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} />
          {!pathname.startsWith('/calendar') && <ThemeToggle size={36} iconSize={14} />}
          <div id="wd-topbar-actions-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} />
        </div>
      </header>

      {/* ══ DRAWER + BACKDROP ══ */}
      {open && (
        <>
          <div onClick={closeDrawer} style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.5)',
            animation: closing
              ? 'wdFadeIn 0.2s ease reverse forwards'
              : 'wdFadeIn 0.22s ease',
          }} />

          <aside style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 91,
            width: '280px', maxWidth: '82vw',
            background: 'var(--nav)', borderRight: '1px solid var(--divider)',
            boxShadow: 'var(--pop-shadow)',
            display: 'flex', flexDirection: 'column',
            animation: closing
              ? `wdDrawerIn 0.22s ${EASE} reverse forwards`
              : `wdDrawerIn 0.26s ${EASE}`,
          }}>
            {/* Logo header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '20px 18px', borderBottom: '1px solid var(--divider)',
            }}>
              <div className="wd-logo" style={{
                width: '28px', height: '28px', borderRadius: '7px',
                background: 'var(--nav-logo-bg)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Logo size={18} color="var(--nav-logo-fg)" />
              </div>
              <span style={{
                fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px',
                color: 'var(--logo-text)', textTransform: 'uppercase',
              }}>{brand}</span>
            </div>

            {/* Nav — touch target besar, per section Ads Hub / Leads Hub */}
            <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
              {NAV_SECTIONS.map((section, si) => (
              <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: si > 0 ? '14px' : 0 }}>
              <div style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '1.4px',
                color: 'var(--menu-label)', textTransform: 'uppercase', padding: '6px 12px 8px',
              }}>{section.label}</div>

              {section.items.map((item, ii) => {
                const i = si * 4 + ii; // delay stagger animasi berlanjut antar section
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={closeDrawer} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '13px 14px', borderRadius: '11px',
                    background: active ? 'var(--nav-accent-soft)' : 'transparent',
                    color: active ? 'var(--nav-accent-fg)' : 'var(--nav-tx)',
                    fontSize: '14px', fontWeight: active ? 600 : 400,
                    position: 'relative', WebkitTapHighlightColor: 'transparent',
                    animation: `wdFadeUp 0.3s ${EASE} ${60 + i * 40}ms backwards`,
                  }}>
                    {active && (
                      <span style={{
                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                        width: '3px', height: '60%', borderRadius: '0 2px 2px 0',
                        background: 'var(--nav-accent-fg)',
                      }} />
                    )}
                    <Icon size={19} color={active ? 'var(--nav-accent-fg)' : 'var(--nav-icon)'} style={{ flexShrink: 0 }} />
                    {item.label}
                  </Link>
                );
              })}
              </div>
              ))}
            </nav>

            {/* User + logout */}
            {user && (
              <div style={{ padding: '0 10px 14px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '11px',
                  background: 'var(--data-bg)', border: '1px solid var(--data-br)',
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                    background: 'var(--nav-accent-soft)', color: 'var(--nav-accent-fg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
                  }}>{user.username?.[0] || '?'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)', textTransform: 'capitalize',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</div>
                    <div style={{ fontSize: '10px', color: 'var(--nav-accent-fg)', fontWeight: 600, textTransform: 'capitalize' }}>{role}</div>
                  </div>
                  <button onClick={logout} title="Logout" style={{
                    background: 'none', border: 'none', display: 'flex', cursor: 'pointer',
                    padding: '8px', borderRadius: '8px', color: 'var(--nav-tx)', flexShrink: 0,
                  }}><LogOut size={17} /></button>
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
