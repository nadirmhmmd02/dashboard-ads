'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox, Users, RefreshCw, Download, Search, Copy, Check, X,
  ChevronDown, Pencil, CheckCircle2, CircleAlert,
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import { supabase, authFetch } from '../../supabase';
import useIsMobile from '../../components/useIsMobile';
import ThemeToggle from '../../components/ThemeToggle';
import { TYPE } from '../../components/typography';

/* ─────────────────────────────────────────────────────────────
   LEADS HUB — LEADS LIST + INBOX VERIFIKASI (v3.0)
   Admin  : tab Inbox (approve/reject lead unverified) + All Leads,
            tombol Sync (tarik leads Meta via POST /api/leads).
   Marketing: All Leads saja (RLS: hanya lead approved) — update
            status/FU/notes/closing.
   User   : read-only.
   Data langsung dari Supabase (RLS per role). Aturan bisnis:
   status Deal wajib isi nominal closing (popup otomatis).
   ───────────────────────────────────────────────────────────── */

const STATUSES = ['No Status', 'Cold', 'Warm', 'Hot', 'Deal'];
const STATUS_COLOR = {
  'No Status': { fg: 'var(--t3)',  bg: 'var(--hover)' },
  Cold:        { fg: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  Warm:        { fg: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  Hot:         { fg: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  Deal:        { fg: '#2FB673', bg: 'rgba(47,182,115,0.14)' },
};
const KATEGORIS = ['Reguler', 'Proven', 'Suka Suka', 'Autopilot'];
const DEAL_REASONS = ['Attractive promo', 'Price fits budget', 'Strategic location', 'Referral', 'Other'];
const PAGE_SIZE = 50;

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRp(v) {
  if (v == null || v === '') return '—';
  return 'Rp ' + Math.round(parseFloat(v)).toLocaleString('id-ID');
}

/* Badge kategori promo */
function KategoriBadge({ value }) {
  if (!value) return <span style={{ ...TYPE.caption }}>—</span>;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: '999px',
      background: 'var(--cal-accent-soft, var(--hover))', color: 'var(--ac)',
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{value}</span>
  );
}

export default function LeadsListPage() {
  const { role, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = role === 'admin' || role === 'marketing';

  const [tab, setTab] = useState('list');            // 'inbox' | 'list' (inbox admin-only)
  const [rows, setRows] = useState(null);            // data tab aktif
  const [inboxCount, setInboxCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  // Filter & seleksi
  const [q, setQ] = useState('');
  const [fKategori, setFKategori] = useState('Semua');
  const [fStatus, setFStatus] = useState('Semua');
  const [selected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(1);

  // Popup
  const [dealLead, setDealLead] = useState(null);    // lead yang mau di-set Deal
  const [notesLead, setNotesLead] = useState(null);  // lead yang notes-nya diedit
  const [openStatusFor, setOpenStatusFor] = useState(null); // id lead dropdown status terbuka

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2600);
  }

  /* ── Data ── */
  const fetchRows = useCallback(async (activeTab = tab) => {
    setLoading(true); setError(null);
    const verif = activeTab === 'inbox' ? 'unverified' : 'approved';
    const { data, error } = await supabase
      .from('leads')
      .select('*, campaign_ref(name)')
      .eq('verification', verif)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) setError(error.message);
    else setRows(data || []);
    setLoading(false);
  }, [tab]);

  const fetchInboxCount = useCallback(async () => {
    if (!isAdmin) return;
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('verification', 'unverified');
    setInboxCount(count || 0);
  }, [isAdmin]);

  useEffect(() => {
    if (!role) return;
    fetchRows();
    fetchInboxCount();
    setSelected(new Set());
    setPage(1);
  }, [role, tab, fetchRows, fetchInboxCount]);

  /* ── Sync leads dari Meta (admin) ── */
  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res  = await authFetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync' }) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      showToast(`Sync complete — ${json.inserted} new lead${json.inserted === 1 ? '' : 's'} in Inbox`);
      await fetchRows();
      await fetchInboxCount();
    } catch (err) {
      showToast('Sync failed: ' + err.message, true);
    }
    setSyncing(false);
  }

  /* ── Update helper (optimistik) ── */
  async function updateLead(id, patch, successMsg) {
    const { error } = await supabase.from('leads').update(patch).eq('id', id);
    if (error) { showToast('Failed: ' + error.message, true); return false; }
    setRows(prev => prev ? prev.map(r => (r.id === id ? { ...r, ...patch } : r)) : prev);
    if (successMsg) showToast(successMsg);
    return true;
  }

  async function verify(id, to) {
    const ok = await updateLead(id, { verification: to });
    if (ok) {
      setRows(prev => prev.filter(r => r.id !== id));
      setInboxCount(c => Math.max(0, c - 1));
      showToast(to === 'approved' ? 'Lead approved → moved to Leads List' : 'Lead rejected');
    }
  }

  async function bulkVerify(to) {
    const ids = [...selected];
    if (!ids.length) return;
    const { error } = await supabase.from('leads').update({ verification: to }).in('id', ids);
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.filter(r => !selected.has(r.id)));
    setInboxCount(c => Math.max(0, c - ids.length));
    setSelected(new Set());
    showToast(`${ids.length} lead${ids.length === 1 ? '' : 's'} ${to === 'approved' ? 'approved' : 'rejected'}`);
  }

  async function bulkFollowUp() {
    const ids = [...selected];
    if (!ids.length) return;
    const { error } = await supabase.from('leads').update({ followed_up: true }).in('id', ids);
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.map(r => (selected.has(r.id) ? { ...r, followed_up: true } : r)));
    setSelected(new Set());
    showToast(`${ids.length} lead${ids.length === 1 ? '' : 's'} marked as followed up`);
  }

  // Bulk ubah status (Deal dikecualikan — wajib isi nominal per lead)
  async function bulkStatus(s) {
    const ids = [...selected];
    if (!ids.length) return;
    const { error } = await supabase.from('leads').update({ status: s }).in('id', ids);
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.map(r => (selected.has(r.id) ? { ...r, status: s } : r)));
    setSelected(new Set());
    showToast(`${ids.length} lead${ids.length === 1 ? '' : 's'} → ${s}`);
  }

  function bulkCopy() {
    const list = (rows || []).filter(r => selected.has(r.id));
    if (!list.length) return;
    const text = list.map(r => `${r.name}\t${r.phone}`).join('\n');
    navigator.clipboard?.writeText(text);
    showToast(`${list.length} name${list.length === 1 ? '' : 's'} + number${list.length === 1 ? '' : 's'} copied — ready to paste`);
  }

  function copyPhone(r) {
    navigator.clipboard?.writeText(r.phone || '');
    showToast(`${r.name || 'Lead'}'s number copied`);
  }

  function pickStatus(r, s) {
    setOpenStatusFor(null);
    if (s === r.status) return;
    if (s === 'Deal') { setDealLead(r); return; } // wajib isi nominal closing
    updateLead(r.id, { status: s }, `Status → ${s}`);
  }

  const [openBulkStatus, setOpenBulkStatus] = useState(false);
  useEffect(() => { setOpenBulkStatus(false); }, [selected.size, tab]);

  /* ── Filter client-side ── */
  const filtered = useMemo(() => {
    let list = rows || [];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(s) ||
        (r.phone || '').includes(s) ||
        (r.email || '').toLowerCase().includes(s));
    }
    if (fKategori !== 'Semua') list = list.filter(r => (r.kategori_promo || '—') === fKategori);
    if (tab === 'list' && fStatus !== 'Semua') list = list.filter(r => r.status === fStatus);
    return list;
  }, [rows, q, fKategori, fStatus, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
  function toggleAllPage() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageRows.forEach(r => next.delete(r.id));
      else pageRows.forEach(r => next.add(r.id));
      return next;
    });
  }
  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Styles bersama ── */
  const card = {
    background: 'var(--cd)', border: '1px solid var(--br)',
    borderRadius: '18px', boxShadow: 'var(--shadow)',
  };
  const btn = (primary) => ({
    display: 'flex', alignItems: 'center', gap: '7px',
    padding: '8px 14px', borderRadius: '10px', border: primary ? 'none' : '1px solid var(--br)',
    background: primary ? 'var(--cal-accent)' : 'var(--cd)',
    color: primary ? 'var(--cal-accent-fg)' : 'var(--t1)',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'opacity 0.15s, background 0.15s',
  });
  const thStyle = (align = 'left') => ({
    ...TYPE.tableHeader, textAlign: align, padding: '9px 10px',
    borderBottom: '1px solid var(--br)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, background: 'var(--cd)', zIndex: 2,
  });
  const tdStyle = (align = 'left') => ({
    ...TYPE.tableCell, textAlign: align, padding: '8px 10px',
    borderBottom: '1px solid var(--br)', verticalAlign: 'middle',
  });
  const selectStyle = {
    padding: '7px 10px', borderRadius: '9px', border: '1px solid var(--br)',
    background: 'var(--cd)', color: 'var(--t1)', fontSize: '12px', fontWeight: 500,
    outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
  };

  if (!role) return null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>

      {/* ══ HEADER CARD ══ */}
      <header style={isMobile ? {
        display: 'flex', flexDirection: 'column', gap: '10px',
        padding: '14px 16px', flexShrink: 0, borderBottom: '1px solid var(--br)',
      } : {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: '12px 20px', margin: '12px 16px 0', flexShrink: 0, ...card,
      }}>
        <div>
          <h1 style={{ ...TYPE.h1, ...(isMobile ? { fontSize: '20px' } : null) }}>Leads List</h1>
          <p style={{ ...TYPE.small, marginTop: '3px' }}>
            Leads Hub · {rows === null ? '…' : `${filtered.length} leads`}
            {isAdmin && inboxCount > 0 && tab !== 'inbox' ? ` · ${inboxCount} awaiting verification` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} style={{ ...btn(true), opacity: syncing ? 0.65 : 1 }}>
              <Download size={14} style={syncing ? { animation: 'wdSpin 1s linear infinite' } : null} />
              {syncing ? 'Syncing…' : 'Sync Meta Leads'}
            </button>
          )}
          <button onClick={() => { fetchRows(); fetchInboxCount(); }} title="Refresh" style={btn(false)}>
            <RefreshCw size={14} />
            {!isMobile && 'Refresh'}
          </button>
          {!isMobile && <ThemeToggle size={34} iconSize={14} />}
        </div>
      </header>

      {/* ══ TOOLBAR: tabs + filter ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: isMobile ? '12px 16px 0' : '10px 16px 0', flexShrink: 0,
      }}>
        {/* Tabs (admin) */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: 'var(--hover)' }}>
            {[
              { key: 'inbox', label: 'Inbox', Icon: Inbox, badge: inboxCount },
              { key: 'list',  label: 'All Leads', Icon: Users },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '7px 14px', borderRadius: '9px', border: 'none',
                background: tab === t.key ? 'var(--cd)' : 'transparent',
                color: tab === t.key ? 'var(--t1)' : 'var(--t2)',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                boxShadow: tab === t.key ? 'var(--shadow)' : 'none',
                transition: 'background 0.18s, color 0.18s',
              }}>
                <t.Icon size={14} />
                {t.label}
                {t.badge > 0 && (
                  <span style={{
                    minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px',
                    background: tab === t.key ? 'var(--cal-accent)' : 'var(--t3)',
                    color: tab === t.key ? 'var(--cal-accent-fg)' : 'var(--cd)',
                    fontSize: '10px', fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? '1 1 100%' : '0 1 260px',
          padding: '0 12px', height: '34px', borderRadius: '10px',
          border: '1px solid var(--br)', background: 'var(--cd)',
        }}>
          <Search size={14} color="var(--t3)" />
          <input
            value={q} onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Search name / phone / email…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '12px', color: 'var(--t1)', fontFamily: 'inherit' }}
          />
          {q && <button onClick={() => setQ('')} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 0 }}><X size={13} /></button>}
        </div>

        {/* Filter kategori */}
        <select value={fKategori} onChange={e => { setFKategori(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="Semua">All Categories</option>
          {KATEGORIS.map(k => <option key={k}>{k}</option>)}
          <option value="—">Uncategorized</option>
        </select>

        {/* Filter status (hanya tab list) */}
        {tab === 'list' && (
          <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="Semua">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* ══ TABEL ══ */}
      <div style={{ flex: 1, minHeight: 0, padding: isMobile ? '12px 16px 16px' : '10px 16px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...card, flex: 1, minHeight: 0, overflow: 'auto' }}>
          {error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '48px 20px' }}>
              <CircleAlert size={32} color="#EF4444" />
              <div style={{ ...TYPE.body }}>Failed to load leads: {error}</div>
            </div>
          ) : loading ? (
            /* Skeleton rows */
            <div style={{ padding: '14px 16px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  height: '38px', borderRadius: '9px', marginBottom: '8px',
                  background: 'var(--hover)', opacity: 1 - i * 0.09,
                  animation: 'wdPulseDot 1.4s ease-in-out infinite', animationDelay: `${i * 90}ms`,
                }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '56px 20px', textAlign: 'center' }}>
              {tab === 'inbox' ? <CheckCircle2 size={36} color="var(--cal-accent)" /> : <Users size={36} color="var(--t3)" />}
              <div style={{ ...TYPE.h3 }}>
                {tab === 'inbox' ? 'Inbox clear — every lead has been verified' : (rows?.length ? 'No leads match your filters' : 'No leads yet')}
              </div>
              <div style={{ ...TYPE.small, maxWidth: '380px' }}>
                {tab === 'inbox'
                  ? 'New leads from Meta instant forms will appear here after a Sync. Approve them to move them into the Leads List.'
                  : (rows?.length ? 'Try a different keyword or reset the category/status filters.' : (isAdmin ? 'Click "Sync Meta Leads" to pull leads from your instant forms, then approve them from the Inbox tab.' : 'Leads verified by the admin will show up here.'))}
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '860px' : 'auto' }}>
              <thead>
                <tr>
                  {canEdit && (
                    <th style={{ ...thStyle('center'), width: '36px' }}>
                      <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--cal-accent)', cursor: 'pointer' }} />
                    </th>
                  )}
                  <th style={thStyle()}>Date</th>
                  <th style={thStyle()}>Name</th>
                  <th style={thStyle()}>Phone</th>
                  <th style={thStyle()}>Email</th>
                  <th style={thStyle()}>Category</th>
                  <th style={thStyle()}>Campaign</th>
                  {tab === 'inbox' ? (
                    <th style={thStyle('center')}>Verify</th>
                  ) : (
                    <>
                      <th style={thStyle('center')}>Status</th>
                      <th style={thStyle('center')}>Follow-up</th>
                      <th style={thStyle('center')}>Notes</th>
                      <th style={thStyle('right')}>Closing</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.id}
                    style={{ background: selected.has(r.id) ? 'var(--hover)' : 'transparent', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!selected.has(r.id)) e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={e => { if (!selected.has(r.id)) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {canEdit && (
                      <td style={{ ...tdStyle('center'), width: '36px' }}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--cal-accent)', cursor: 'pointer' }} />
                      </td>
                    )}
                    <td style={{ ...tdStyle(), whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td style={{ ...tdStyle(), ...TYPE.tableCellStrong, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name || '—'}</td>
                    <td style={{ ...tdStyle(), whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {r.phone || '—'}
                        {r.phone && (
                          <button onClick={() => copyPhone(r)} title="Copy number" style={{
                            display: 'inline-flex', background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--t3)', padding: '2px', borderRadius: '5px',
                          }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--ac)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
                          ><Copy size={12} /></button>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdStyle(), maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.email || ''}>{r.email || '—'}</td>
                    <td style={tdStyle()}><KategoriBadge value={r.kategori_promo} /></td>
                    <td style={{ ...tdStyle(), maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.campaign_ref?.name || ''}>
                      {r.campaign_ref?.name || '—'}
                    </td>

                    {tab === 'inbox' ? (
                      <td style={{ ...tdStyle('center'), whiteSpace: 'nowrap' }}>
                        <button onClick={() => verify(r.id, 'approved')} style={{
                          padding: '5px 12px', borderRadius: '8px', border: 'none', marginRight: '6px',
                          background: 'rgba(47,182,115,0.14)', color: '#2FB673',
                          fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                        }}>✓ Approve</button>
                        <button onClick={() => verify(r.id, 'rejected')} style={{
                          padding: '5px 12px', borderRadius: '8px', border: 'none',
                          background: 'rgba(239,68,68,0.10)', color: '#EF4444',
                          fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                        }}>✕ Reject</button>
                      </td>
                    ) : (
                      <>
                        {/* Status dropdown */}
                        <td style={{ ...tdStyle('center'), position: 'relative', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => canEdit && setOpenStatusFor(openStatusFor === r.id ? null : r.id)}
                            title={r.status === 'Deal' && r.closing_amount ? `Closing: ${fmtRp(r.closing_amount)}` : undefined}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '4px 10px', borderRadius: '999px', border: 'none',
                              background: STATUS_COLOR[r.status]?.bg, color: STATUS_COLOR[r.status]?.fg,
                              fontSize: '11px', fontWeight: 700, cursor: canEdit ? 'pointer' : 'default',
                            }}>
                            {r.status}
                            {canEdit && <ChevronDown size={11} />}
                          </button>
                          {openStatusFor === r.id && (
                            <>
                              <div onClick={() => setOpenStatusFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                              <div style={{
                                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 31,
                                background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '11px',
                                boxShadow: 'var(--pop-shadow)', padding: '5px', minWidth: '120px',
                                animation: 'wdScaleIn 0.14s cubic-bezier(0.4,0,0.2,1)',
                              }}>
                                {STATUSES.map(s => (
                                  <button key={s} onClick={() => pickStatus(r, s)} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                    padding: '7px 10px', borderRadius: '8px', border: 'none',
                                    background: s === r.status ? 'var(--hover)' : 'transparent',
                                    color: STATUS_COLOR[s]?.fg, fontSize: '12px', fontWeight: 600,
                                    cursor: 'pointer', textAlign: 'left',
                                  }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = s === r.status ? 'var(--hover)' : 'transparent'}
                                  >
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: STATUS_COLOR[s]?.fg }} />
                                    {s}
                                    {s === r.status && <Check size={12} style={{ marginLeft: 'auto' }} />}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </td>

                        {/* Followed up toggle */}
                        <td style={tdStyle('center')}>
                          <button
                            onClick={() => canEdit && updateLead(r.id, { followed_up: !r.followed_up }, r.followed_up ? 'Follow-up unmarked' : 'Marked as followed up')}
                            title={r.followed_up ? 'Followed up (click to undo)' : 'Not followed up yet (click to mark)'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '8px',
                              border: r.followed_up ? 'none' : '1px dashed var(--br)',
                              background: r.followed_up ? 'rgba(47,182,115,0.14)' : 'transparent',
                              color: r.followed_up ? '#2FB673' : 'var(--t3)',
                              cursor: canEdit ? 'pointer' : 'default', transition: 'background 0.15s',
                            }}>
                            <Check size={14} />
                          </button>
                        </td>

                        {/* Notes */}
                        <td style={tdStyle('center')}>
                          <button
                            onClick={() => canEdit && setNotesLead(r)}
                            title={r.notes || 'Add a note'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '26px', height: '26px', borderRadius: '8px', border: 'none',
                              background: r.notes ? 'var(--cal-accent-soft, var(--hover))' : 'transparent',
                              color: r.notes ? 'var(--ac)' : 'var(--t3)',
                              cursor: canEdit ? 'pointer' : 'default',
                            }}>
                            <Pencil size={13} />
                          </button>
                        </td>

                        {/* Closing */}
                        <td style={{ ...tdStyle('right'), ...(r.closing_amount ? { color: '#2FB673', fontWeight: 600 } : null), whiteSpace: 'nowrap' }}>
                          {r.status === 'Deal' ? fmtRp(r.closing_amount) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', paddingTop: '10px', flexShrink: 0 }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ ...btn(false), opacity: page === 1 ? 0.45 : 1 }}>‹ Prev</button>
            <span style={{ ...TYPE.small }}>Page {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ ...btn(false), opacity: page === totalPages ? 0.45 : 1 }}>Next ›</button>
          </div>
        )}
      </div>

      {/* ══ BULK BAR ══ */}
      {canEdit && selected.size > 0 && (
        <div style={{
          position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)', zIndex: 40,
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
          padding: '10px 14px', borderRadius: '14px',
          background: 'var(--cd)', border: '1px solid var(--br)', boxShadow: 'var(--pop-shadow)',
          animation: 'wdSlideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
          maxWidth: 'calc(100% - 32px)',
        }}>
          <span style={{ ...TYPE.small, fontWeight: 600, color: 'var(--t1)' }}>
            {selected.size === filtered.length && filtered.length > 0 ? `All ${selected.size} selected` : `${selected.size} selected`}
          </span>
          {tab === 'inbox' ? (
            <>
              {/* Label menyesuaikan konteks: semua tercentang → "all", sebagian → jumlah */}
              <button onClick={() => bulkVerify('approved')} style={{ ...btn(true) }}>
                ✓ {selected.size === filtered.length && filtered.length > 0 ? 'Approve all' : `Approve (${selected.size})`}
              </button>
              <button onClick={() => bulkVerify('rejected')} style={{ ...btn(false), color: '#EF4444' }}>
                ✕ {selected.size === filtered.length && filtered.length > 0 ? 'Reject all' : `Reject (${selected.size})`}
              </button>
            </>
          ) : (
            <>
              <button onClick={bulkCopy} style={btn(true)}><Copy size={13} /> Copy name + number</button>
              <button onClick={bulkFollowUp} style={btn(false)}><Check size={13} /> Mark followed-up</button>

              {/* Bulk set status (Deal dikecualikan — closing wajib per lead) */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setOpenBulkStatus(v => !v)} style={btn(false)}>
                  Set status <ChevronDown size={12} style={{ transform: openBulkStatus ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
                </button>
                {openBulkStatus && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '11px',
                    boxShadow: 'var(--pop-shadow)', padding: '5px', minWidth: '130px', zIndex: 41,
                    animation: 'wdScaleIn 0.14s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    {STATUSES.filter(s => s !== 'Deal').map(s => (
                      <button key={s} onClick={() => bulkStatus(s)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                        padding: '7px 10px', borderRadius: '8px', border: 'none', background: 'transparent',
                        color: STATUS_COLOR[s]?.fg, fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: STATUS_COLOR[s]?.fg }} />
                        {s}
                      </button>
                    ))}
                    <div style={{ ...TYPE.caption, padding: '6px 10px 4px', borderTop: '1px solid var(--br)', marginTop: '4px' }}>
                      Deal is set per lead (closing amount required)
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          <button onClick={() => setSelected(new Set())} style={{ ...btn(false), padding: '8px 10px' }}><X size={13} /></button>
        </div>
      )}

      {/* ══ MODAL DEAL (nominal closing wajib) ══ */}
      {dealLead && (
        <DealModal
          lead={dealLead}
          onClose={() => setDealLead(null)}
          onSave={async (patch) => {
            const ok = await updateLead(dealLead.id, { status: 'Deal', ...patch }, `Deal closed! ${fmtRp(patch.closing_amount)} 🎉`);
            if (ok) setDealLead(null);
          }}
        />
      )}

      {/* ══ MODAL NOTES ══ */}
      {notesLead && (
        <NotesModal
          lead={notesLead}
          onClose={() => setNotesLead(null)}
          onSave={async (notes) => {
            const ok = await updateLead(notesLead.id, { notes: notes || null }, 'Notes saved');
            if (ok) setNotesLead(null);
          }}
        />
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: '18px', right: '18px', zIndex: 60,
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '11px 16px', borderRadius: '12px',
          background: toast.isError ? '#EF4444' : 'var(--cal-accent)',
          color: toast.isError ? '#fff' : 'var(--cal-accent-fg)',
          fontSize: '13px', fontWeight: 600, boxShadow: 'var(--pop-shadow)',
          animation: 'wdSlideUp 0.22s cubic-bezier(0.4,0,0.2,1)', maxWidth: '360px',
        }}>
          {toast.isError ? <CircleAlert size={15} /> : <CheckCircle2 size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ─── Modal umum: backdrop + kartu tengah ─── */
function ModalShell({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      animation: 'wdFadeIn 0.18s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '18px',
        boxShadow: 'var(--pop-shadow)', overflow: 'hidden',
        animation: 'wdScaleIn 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--br)', background: 'var(--sf)',
        }}>
          <span style={{ ...TYPE.h4 }}>{title}</span>
          <button onClick={onClose} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '18px' }}>{children}</div>
      </div>
    </div>
  );
}

const fieldLabel = { ...TYPE.small, fontWeight: 600, color: 'var(--t1)', display: 'block', marginBottom: '6px' };
const fieldInput = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  border: '1px solid var(--br)', background: 'var(--data-bg)', color: 'var(--t1)',
  fontSize: '13px', fontFamily: 'inherit', outline: 'none',
};

/* ─── Popup Deal: nominal closing (wajib) + tanggal + alasan ─── */
function DealModal({ lead, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(DEAL_REASONS[0]);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const numeric = parseInt((amount || '').replace(/\D/g, '') || '0');
  function handleAmount(e) {
    const n = e.target.value.replace(/\D/g, '');
    setAmount(n ? parseInt(n).toLocaleString('id-ID') : '');
  }

  async function save() {
    if (!numeric || busy) return;
    setBusy(true);
    await onSave({
      closing_amount: numeric,
      deal_date: date,
      deal_reason: detail.trim() ? `${reason} — ${detail.trim()}` : reason,
    });
    setBusy(false);
  }

  return (
    <ModalShell title={`Deal — ${lead.name || 'Lead'}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={fieldLabel}>Closing amount (required)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...fieldInput, padding: '0 12px' }}>
            <span style={{ ...TYPE.small, fontWeight: 700, color: 'var(--t2)' }}>Rp</span>
            <input value={amount} onChange={handleAmount} placeholder="0" autoFocus inputMode="numeric"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--t1)', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit', padding: '10px 0' }} />
          </div>
        </div>
        <div>
          <label style={fieldLabel}>Closing date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <label style={fieldLabel}>Why did it close?</label>
          <select value={reason} onChange={e => setReason(e.target.value)} style={{ ...fieldInput, cursor: 'pointer' }}>
            {DEAL_REASONS.map(r => <option key={r}>{r}</option>)}
          </select>
          <input value={detail} onChange={e => setDetail(e.target.value)} placeholder="Additional detail (optional)…"
            style={{ ...fieldInput, marginTop: '8px' }} />
        </div>
        <button onClick={save} disabled={!numeric || busy} style={{
          padding: '12px', borderRadius: '11px', border: 'none',
          background: numeric ? '#2FB673' : 'var(--hover)',
          color: numeric ? '#fff' : 'var(--t3)',
          fontSize: '13px', fontWeight: 700, cursor: numeric ? 'pointer' : 'default',
          transition: 'background 0.15s', opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'Saving…' : `Save Deal${numeric ? ' — Rp ' + numeric.toLocaleString('id-ID') : ''}`}
        </button>
      </div>
    </ModalShell>
  );
}

/* ─── Popup Notes ─── */
function NotesModal({ lead, onClose, onSave }) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [busy, setBusy] = useState(false);

  return (
    <ModalShell title={`Notes — ${lead.name || 'Lead'}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} autoFocus
          placeholder="Short note for team handover…"
          style={{ ...fieldInput, minHeight: '110px', resize: 'vertical', lineHeight: 1.5 }} />
        <button onClick={async () => { setBusy(true); await onSave(notes.trim()); setBusy(false); }} disabled={busy} style={{
          padding: '12px', borderRadius: '11px', border: 'none',
          background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </ModalShell>
  );
}
