'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox, Users, RefreshCw, Download, Upload, Search, Copy, Check, X,
  Pencil, CheckCircle2, CircleAlert, SlidersHorizontal, UserRound, Plus,
} from 'lucide-react';
import { useAuth } from '../../components/AuthContext';
import { supabase, authFetch } from '../../supabase';
import useIsMobile from '../../components/useIsMobile';
import ThemeToggle from '../../components/ThemeToggle';
import Dropdown from '../../components/Dropdown';
import { STATUSES, STATUS_COLOR, SALES, SALES_COLOR, CATEGORIES, kategoriLabel } from '../../components/leadsConfig';
import { TYPE } from '../../components/typography';

/* ─────────────────────────────────────────────────────────────
   LEADS HUB — LEADS LIST + BLACK BOX (v3.0)
   Admin  : tab Black Box (verifikasi lead Meta) + All Leads,
            tombol Add Leads (Sync Meta / Import from File).
   Marketing: All Leads saja (RLS: hanya lead approved).
   User   : read-only.
   Fitur: label NEW (hilang setelah aksi apa pun), kolom City &
   Sales, hide/show kolom (persist), filter kategori/status/sales,
   bulk copy / follow-up / set status / assign sales, popup Deal
   wajib nominal. Urutan selalu terbaru di atas.
   ───────────────────────────────────────────────────────────── */

const PAGE_SIZE = 50;
const COLS_KEY = 'wd-leads-cols-hidden';

// Kolom tabel All Leads yang bisa disembunyikan lewat tombol Columns
const ALL_COLUMNS = [
  { key: 'date',     label: 'Date' },
  { key: 'name',     label: 'Name' },
  { key: 'phone',    label: 'Phone' },
  { key: 'email',    label: 'Email' },
  { key: 'city',     label: 'City' },
  { key: 'category', label: 'Category' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'sales',    label: 'Sales' },
  { key: 'status',   label: 'Status' },
  { key: 'fu',       label: 'Follow-up' },
  { key: 'notes',    label: 'Notes' },
  { key: 'closing',  label: 'Closing' },
];

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtRp(v) {
  if (v == null || v === '') return '-';
  return 'Rp ' + Math.round(parseFloat(v)).toLocaleString('id-ID');
}
// Clean display: data kosong dari form → "-"
function dash(v) { return v && String(v).trim() ? v : '-'; }

/* ─── Sensor kontak untuk role viewer (user) ───
   Viewer boleh melihat volume & kualitas lead, tapi bukan data kontak yang bisa
   dipakai menghubungi calon mitra di luar jalur sales. */
function maskPhone(v) {
  if (!v) return v;
  const s = String(v).trim();
  if (s.length <= 6) return 'x'.repeat(s.length);
  return s.slice(0, s.length - 6) + 'xxxxxx';
}
function maskEmail(v) {
  if (!v) return v;
  const s = String(v).trim();
  const at = s.indexOf('@');
  if (at <= 0) return s.slice(0, 2) + 'xxxxxx';
  return s.slice(0, Math.min(2, at)) + 'xxxxxx' + s.slice(at);
}

function KategoriBadge({ value }) {
  if (!value) return <span style={{ ...TYPE.tableCell }}>-</span>;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: '999px',
      background: 'var(--cal-accent-soft, var(--hover))', color: 'var(--ac)',
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
    }}>{kategoriLabel(value)}</span>
  );
}

export default function LeadsListPage() {
  const { role, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const canEdit = role === 'admin' || role === 'marketing';
  // Viewer (role user): nomor & email disensor, tombol copy nomor disembunyikan
  const maskContacts = role === 'user';

  const [tab, setTab] = useState('list');            // 'inbox' (Black Box) | 'list'
  const [rows, setRows] = useState(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  // Filter & seleksi
  const [q, setQ] = useState('');
  const [fKategori, setFKategori] = useState('Semua');
  const [fStatus, setFStatus] = useState('Semua');
  const [fSales, setFSales] = useState('Semua');
  const [selected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(1);

  // Kolom tersembunyi (persist di localStorage)
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLS_KEY) || '[]');
      if (Array.isArray(saved)) setHiddenCols(new Set(saved));
    } catch (e) {}
  }, []);
  function toggleCol(key) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(COLS_KEY, JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  }
  const col = (key) => tab === 'inbox' || !hiddenCols.has(key);

  // Popup
  const [dealLead, setDealLead] = useState(null);
  const [notesLead, setNotesLead] = useState(null);
  const [showImport, setShowImport] = useState(false);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2600);
  }

  /* ── Data (urutan selalu terbaru di atas) ── */
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
      showToast(`Sync complete — ${json.inserted} new lead${json.inserted === 1 ? '' : 's'} in Black Box`);
      await fetchRows();
      await fetchInboxCount();
    } catch (err) {
      showToast('Sync failed: ' + err.message, true);
    }
    setSyncing(false);
  }

  /* ── Update helper (optimistik) ──
     Setiap aksi apa pun menghapus label NEW (is_new → false). */
  async function updateLead(id, patch, successMsg) {
    const full = { ...patch, is_new: false };
    const { error } = await supabase.from('leads').update(full).eq('id', id);
    if (error) { showToast('Failed: ' + error.message, true); return false; }
    setRows(prev => prev ? prev.map(r => (r.id === id ? { ...r, ...full } : r)) : prev);
    if (successMsg) showToast(successMsg);
    return true;
  }

  async function verify(id, to) {
    // Approve/reject TIDAK menghapus NEW — biar di All Leads masih ketahuan lead baru
    const { error } = await supabase.from('leads').update({ verification: to }).eq('id', id);
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    setInboxCount(c => Math.max(0, c - 1));
    showToast(to === 'approved' ? 'Lead approved → moved to All Leads' : 'Lead rejected');
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

  async function bulkPatch(patch, msg) {
    const ids = [...selected];
    if (!ids.length) return;
    const full = { ...patch, is_new: false };
    const { error } = await supabase.from('leads').update(full).in('id', ids);
    if (error) { showToast('Failed: ' + error.message, true); return; }
    setRows(prev => prev.map(r => (selected.has(r.id) ? { ...r, ...full } : r)));
    setSelected(new Set());
    showToast(msg(ids.length));
  }

  function bulkCopy() {
    const list = (rows || []).filter(r => selected.has(r.id));
    if (!list.length) return;
    navigator.clipboard?.writeText(list.map(r => `${r.name}\t${r.phone}`).join('\n'));
    const ids = list.map(r => r.id);
    supabase.from('leads').update({ is_new: false }).in('id', ids).then(() => {});
    setRows(prev => prev.map(r => (selected.has(r.id) ? { ...r, is_new: false } : r)));
    setSelected(new Set());
    showToast(`${list.length} name${list.length === 1 ? '' : 's'} + number${list.length === 1 ? '' : 's'} copied — ready to paste`);
  }

  function copyPhone(r) {
    navigator.clipboard?.writeText(r.phone || '');
    if (r.is_new) {
      supabase.from('leads').update({ is_new: false }).eq('id', r.id).then(() => {});
      setRows(prev => prev.map(x => (x.id === r.id ? { ...x, is_new: false } : x)));
    }
    showToast(`${r.name || 'Lead'}'s number copied`);
  }

  function pickStatus(r, s) {
    if (s === r.status) return;
    if (s === 'Deal') { setDealLead(r); return; } // wajib isi nominal closing
    updateLead(r.id, { status: s }, `Status → ${s}`);
  }

  /* ── Filter client-side ── */
  const filtered = useMemo(() => {
    let list = rows || [];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      // Viewer tidak bisa mencari lewat nomor/email — kalau bisa, sensornya jadi percuma
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(s) ||
        (!maskContacts && (r.phone || '').includes(s)) ||
        (!maskContacts && (r.email || '').toLowerCase().includes(s)));
    }
    if (fKategori !== 'Semua') list = list.filter(r => r.kategori_promo === fKategori);
    if (tab === 'list' && fStatus !== 'Semua') list = list.filter(r => r.status === fStatus);
    if (tab === 'list' && fSales !== 'Semua') {
      list = fSales === 'none' ? list.filter(r => !r.sales) : list.filter(r => r.sales === fSales);
    }
    return list;
  }, [rows, q, fKategori, fStatus, fSales, tab, maskContacts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id));
  const allSelected = selected.size === filtered.length && filtered.length > 0;

  /* Status follow-up baris terpilih → menentukan tombol bulk mana yang ditampilkan:
     semua belum di-mark → hanya "Mark", semua sudah → hanya "Unmark", campuran → dua-duanya. */
  const selectedFu = useMemo(() => {
    const list = (rows || []).filter(r => selected.has(r.id));
    const marked = list.filter(r => r.followed_up).length;
    const unmarked = list.length - marked;
    return { marked, unmarked, hasMarked: marked > 0, hasUnmarked: unmarked > 0, mixed: marked > 0 && unmarked > 0 };
  }, [rows, selected]);
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
  // Header kolom data rata kiri; kolom aksi (Sales/Status/FU/Notes) tetap center
  const thStyle = (align = 'left') => ({
    ...TYPE.tableHeader, textAlign: align, padding: '9px 10px',
    borderBottom: '1px solid var(--br)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, background: 'var(--cd)', zIndex: 2,
  });
  const tdStyle = (align = 'left') => ({
    ...TYPE.tableCell, textAlign: align, padding: '8px 10px',
    borderBottom: '1px solid var(--br)', verticalAlign: 'middle',
  });
  const tabBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: '7px',
    padding: '8px 14px', borderRadius: '10px',
    border: active ? 'none' : '1px solid var(--br)',
    background: active ? 'var(--cal-accent)' : 'var(--cd)',
    color: active ? 'var(--cal-accent-fg)' : 'var(--t1)',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'background 0.18s, color 0.18s',
  });

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
            {isAdmin && inboxCount > 0 && tab !== 'inbox' ? ` · ${inboxCount} in Black Box` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <Dropdown
              primary
              icon={Plus}
              label={syncing ? 'Syncing…' : 'Add Leads'}
              minWidth={190}
              align="right"
              showCheck={false}
              options={[
                { value: 'sync',   label: 'Sync Meta Leads', icon: Download, hint: 'instant form' },
                { value: 'import', label: 'Import from File', icon: Upload, hint: 'xlsx / csv' },
              ]}
              onSelect={(v) => { if (v === 'sync') handleSync(); else setShowImport(true); }}
            />
          )}
          <button onClick={() => { fetchRows(); fetchInboxCount(); }} title="Refresh" style={{ ...btn(false), padding: '8px 10px' }}>
            <RefreshCw size={14} style={syncing ? { animation: 'wdSpin 1s linear infinite' } : null} />
          </button>
          {!isMobile && <ThemeToggle size={34} iconSize={14} />}
        </div>
      </header>

      {/* ══ TOOLBAR: Black Box · search · All Leads · All Status · Followed by ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        padding: isMobile ? '12px 16px 0' : '10px 16px 0', flexShrink: 0,
      }}>
        {/* 1. Black Box (admin) */}
        {isAdmin && (
          <button onClick={() => setTab('inbox')} style={tabBtn(tab === 'inbox')}>
            <Inbox size={14} />
            Black Box
            {inboxCount > 0 && (
              <span style={{
                minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px',
                background: tab === 'inbox' ? 'var(--cal-accent-fg)' : '#EF4444',
                color: tab === 'inbox' ? 'var(--cal-accent)' : '#fff',
                fontSize: '10px', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{inboxCount}</span>
            )}
          </button>
        )}

        {/* 2. Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? '1 1 100%' : '0 1 240px',
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

        {/* 3. All Leads — SPLIT BUTTON: klik nama = langsung pindah tab,
              klik panah = pilih kategori (UX request Nadir) */}
        <div style={{ display: 'inline-flex' }}>
          <button
            onClick={() => setTab('list')}
            style={{
              ...tabBtn(tab === 'list'),
              borderRadius: '10px 0 0 10px',
              ...(tab === 'list' ? {} : { borderRight: 'none' }),
            }}
          >
            <Users size={14} />
            {fKategori === 'Semua' ? 'All Leads' : kategoriLabel(fKategori)}
          </button>
          <Dropdown
            label=""
            value={fKategori}
            minWidth={220}
            align="center"
            buttonStyle={{
              padding: '8px 8px', borderRadius: '0 10px 10px 0', gap: 0,
              ...(tab === 'list'
                ? { border: 'none', background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)', boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.14)' }
                : { borderLeft: '1px solid var(--br)' }),
            }}
            options={[
              { value: 'Semua', label: 'All Leads' },
              ...CATEGORIES.map(c => ({ value: c.value, label: c.label })),
            ]}
            onSelect={(v) => { setTab('list'); setFKategori(v); setPage(1); }}
          />
        </div>

        {/* 4. All Status (di Black Box tampil tapi nonaktif) */}
        <Dropdown
          label={fStatus === 'Semua' ? 'All Status' : fStatus}
          value={fStatus}
          minWidth={140}
          align="center"
          disabled={tab === 'inbox'}
          title={tab === 'inbox' ? 'Only available in All Leads' : undefined}
          options={[
            { value: 'Semua', label: 'All Status' },
            ...STATUSES.map(s => ({ value: s, label: s, color: STATUS_COLOR[s]?.fg })),
          ]}
          onSelect={(v) => { setFStatus(v); setPage(1); }}
        />

        {/* 5. Followed by / sales (di Black Box tampil tapi nonaktif) */}
        <Dropdown
          icon={UserRound}
          label={fSales === 'Semua' ? 'All Sales' : fSales === 'none' ? 'Unassigned' : fSales}
          value={fSales}
          minWidth={150}
          align="center"
          disabled={tab === 'inbox'}
          title={tab === 'inbox' ? 'Only available in All Leads' : undefined}
          options={[
            { value: 'Semua', label: 'All Sales' },
            ...SALES.map(s => ({ value: s, label: s, color: SALES_COLOR[s]?.fg })),
            { value: 'none', label: 'Unassigned' },
          ]}
          onSelect={(v) => { setFSales(v); setPage(1); }}
        />

        {/* Columns (hide/show) — paling kanan */}
        {tab === 'list' && !isMobile && (
          <div style={{ marginLeft: 'auto' }}>
            <Dropdown
              icon={SlidersHorizontal}
              label="Columns"
              align="right"
              minWidth={160}
              keepOpen
              options={ALL_COLUMNS.map(c => ({ value: c.key, label: c.label, checked: !hiddenCols.has(c.key) }))}
              onSelect={toggleCol}
              footer={<span style={{ ...TYPE.caption }}>Click to show / hide</span>}
            />
          </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '56px 20px', textAlign: 'center' }}>
              {tab === 'inbox' ? <CheckCircle2 size={36} color="var(--cal-accent)" /> : <Users size={36} color="var(--t3)" />}
              <div style={{ ...TYPE.h3 }}>
                {tab === 'inbox' ? 'Black Box clear — every lead has been verified' : (rows?.length ? 'No leads match your filters' : 'No leads yet')}
              </div>
              <div style={{ ...TYPE.small, maxWidth: '380px' }}>
                {tab === 'inbox'
                  ? 'New leads from Meta instant forms will appear here after a Sync. Approve them to move them into All Leads.'
                  : (rows?.length ? 'Try a different keyword or reset the filters.' : (isAdmin ? 'Click "Add Leads" → Sync Meta Leads to pull leads from your instant forms, then approve them from Black Box.' : 'Leads verified by the admin will show up here.'))}
              </div>
            </div>
          ) : (
            <table key={`${tab}-${page}`} style={{ width: '100%', borderCollapse: 'collapse', minWidth: tab === 'list' ? '1080px' : '860px', animation: 'wdFadeUp 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
              <thead>
                <tr>
                  {canEdit && (
                    <th style={{ ...thStyle('center'), width: '36px' }}>
                      <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--cal-accent)', cursor: 'pointer' }} />
                    </th>
                  )}
                  {col('date')     && <th style={thStyle()}>Date</th>}
                  {col('name')     && <th style={thStyle()}>Name</th>}
                  {col('phone')    && <th style={thStyle()}>Phone</th>}
                  {col('email')    && <th style={thStyle()}>Email</th>}
                  {col('city')     && <th style={thStyle()}>City</th>}
                  {col('category') && <th style={thStyle()}>Category</th>}
                  {col('campaign') && <th style={thStyle()}>Campaign</th>}
                  {tab === 'inbox' ? (
                    <th style={thStyle('center')}>Verify</th>
                  ) : (
                    <>
                      {col('sales')   && <th style={thStyle('center')}>Sales</th>}
                      {col('status')  && <th style={thStyle('center')}>Status</th>}
                      {col('fu')      && <th style={thStyle('center')}>Follow-up</th>}
                      {col('notes')   && <th style={thStyle('center')}>Notes</th>}
                      {col('closing') && <th style={thStyle('right')}>Closing</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, ri) => (
                  <tr key={r.id}
                    style={{
                      background: selected.has(r.id) ? 'var(--hover)' : 'transparent', transition: 'background 0.15s',
                      // Entrance stagger — hanya ~15 baris pertama biar tetap ringan
                      animation: `wdFadeUp 0.26s cubic-bezier(0.4,0,0.2,1) ${Math.min(ri, 15) * 26}ms backwards`,
                    }}
                    onMouseEnter={e => { if (!selected.has(r.id)) e.currentTarget.style.background = 'var(--hover)'; }}
                    onMouseLeave={e => { if (!selected.has(r.id)) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {canEdit && (
                      <td style={{ ...tdStyle('center'), width: '36px' }}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--cal-accent)', cursor: 'pointer' }} />
                      </td>
                    )}
                    {col('date') && <td style={{ ...tdStyle(), whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>}
                    {col('name') && (
                      <td style={{ ...tdStyle(), ...TYPE.tableCellStrong, maxWidth: '190px', whiteSpace: 'nowrap' }} title={r.name}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dash(r.name)}</span>
                          {r.is_new && (
                            <span style={{
                              padding: '2px 6px', borderRadius: '999px', flexShrink: 0,
                              background: '#EF4444', color: '#fff',
                              fontSize: '9px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
                            }}>New</span>
                          )}
                        </span>
                      </td>
                    )}
                    {col('phone') && (
                      <td style={{ ...tdStyle(), whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={maskContacts && r.phone ? { letterSpacing: '0.3px', color: 'var(--t2)' } : undefined}>
                            {dash(maskContacts ? maskPhone(r.phone) : r.phone)}
                          </span>
                          {r.phone && !maskContacts && (
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
                    )}
                    {col('email') && (
                      <td
                        style={{ ...tdStyle(), maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={(maskContacts ? maskEmail(r.email) : r.email) || ''}
                      >{dash(maskContacts ? maskEmail(r.email) : r.email)}</td>
                    )}
                    {col('city') && <td style={{ ...tdStyle(), whiteSpace: 'nowrap' }}>{dash(r.domicile)}</td>}
                    {col('category') && <td style={tdStyle()}><KategoriBadge value={r.kategori_promo} /></td>}
                    {col('campaign') && (
                      <td style={{ ...tdStyle(), maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.campaign_ref?.name || ''}>
                        {dash(r.campaign_ref?.name)}
                      </td>
                    )}

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
                        {/* Sales (siapa yang handle) */}
                        {col('sales') && (
                          <td style={{ ...tdStyle('center'), whiteSpace: 'nowrap' }}>
                            {canEdit ? (
                              <Dropdown
                                label={r.sales || '-'}
                                value={r.sales || 'none'}
                                align="center"
                                minWidth={130}
                                buttonStyle={{
                                  padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                                  border: 'none',
                                  background: r.sales ? (SALES_COLOR[r.sales]?.bg || 'var(--hover)') : 'var(--hover)',
                                  color: r.sales ? (SALES_COLOR[r.sales]?.fg || 'var(--t1)') : 'var(--t3)',
                                }}
                                options={[
                                  ...SALES.map(s => ({ value: s, label: s, color: SALES_COLOR[s]?.fg })),
                                  { value: 'none', label: 'Unassigned' },
                                ]}
                                onSelect={(v) => updateLead(r.id, { sales: v === 'none' ? null : v }, v === 'none' ? 'Sales unassigned' : `Assigned to ${v}`)}
                              />
                            ) : (
                              <span style={{
                                ...TYPE.tableCell,
                                ...(r.sales ? {
                                  display: 'inline-flex', padding: '4px 10px', borderRadius: '999px',
                                  background: SALES_COLOR[r.sales]?.bg, color: SALES_COLOR[r.sales]?.fg,
                                  fontSize: '11px', fontWeight: 700,
                                } : null),
                              }}>{dash(r.sales)}</span>
                            )}
                          </td>
                        )}

                        {/* Status pill dropdown */}
                        {col('status') && (
                          <td style={{ ...tdStyle('center'), whiteSpace: 'nowrap' }}>
                            {canEdit ? (
                              <Dropdown
                                label={r.status}
                                value={r.status}
                                align="center"
                                minWidth={130}
                                buttonStyle={{
                                  padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                                  border: 'none',
                                  background: STATUS_COLOR[r.status]?.bg, color: STATUS_COLOR[r.status]?.fg,
                                }}
                                options={STATUSES.map(s => ({ value: s, label: s, color: STATUS_COLOR[s]?.fg }))}
                                onSelect={(v) => pickStatus(r, v)}
                              />
                            ) : (
                              <span style={{
                                display: 'inline-flex', padding: '4px 10px', borderRadius: '999px',
                                background: STATUS_COLOR[r.status]?.bg, color: STATUS_COLOR[r.status]?.fg,
                                fontSize: '11px', fontWeight: 700,
                              }}>{r.status}</span>
                            )}
                          </td>
                        )}

                        {/* Followed up toggle */}
                        {col('fu') && (
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
                        )}

                        {/* Notes */}
                        {col('notes') && (
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
                        )}

                        {/* Closing */}
                        {col('closing') && (
                          <td style={{ ...tdStyle('right'), ...(r.closing_amount ? { color: '#2FB673', fontWeight: 600 } : null), whiteSpace: 'nowrap' }}>
                            {r.status === 'Deal' ? fmtRp(r.closing_amount) : '-'}
                          </td>
                        )}
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

      {/* ══ BULK BAR ══
          Lapisan POSISI (wrapper full-width center) DIPISAH dari lapisan ANIMASI
          (wdSlideUp pakai transform — kalau digabung dgn translateX(-50%) bar
          nongol di kanan dulu baru lompat ke tengah). */}
      {canEdit && selected.size > 0 && (
        <div style={{
          position: 'absolute', bottom: '18px', left: 0, right: 0, zIndex: 40,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          padding: '0 16px',
        }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
          padding: '10px 14px', borderRadius: '14px', pointerEvents: 'auto',
          background: 'var(--cd)', border: '1px solid var(--br)', boxShadow: 'var(--pop-shadow)',
          animation: 'wdSlideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
          maxWidth: '100%',
        }}>
          <span style={{ ...TYPE.small, fontWeight: 600, color: 'var(--t1)' }}>
            {allSelected ? `All ${selected.size} selected` : `${selected.size} selected`}
          </span>
          {tab === 'inbox' ? (
            <>
              <button onClick={() => bulkVerify('approved')} style={{ ...btn(true) }}>
                ✓ {allSelected ? 'Approve all' : `Approve (${selected.size})`}
              </button>
              <button onClick={() => bulkVerify('rejected')} style={{ ...btn(false), color: '#EF4444' }}>
                ✕ {allSelected ? 'Reject all' : `Reject (${selected.size})`}
              </button>
            </>
          ) : (
            <>
              <button onClick={bulkCopy} style={btn(true)}><Copy size={13} /> Copy name + number</button>
              {/* Tombol follow-up context-aware: yang muncul hanya aksi yang masuk akal
                  untuk baris terpilih. Campuran → dua-duanya muncul. */}
              {selectedFu.hasUnmarked && (
                <button onClick={() => bulkPatch({ followed_up: true }, n => `${n} lead${n === 1 ? '' : 's'} marked as followed up`)} style={btn(false)}>
                  <Check size={13} /> Mark followed-up{selectedFu.mixed ? ` (${selectedFu.unmarked})` : ''}
                </button>
              )}
              {selectedFu.hasMarked && (
                <button onClick={() => bulkPatch({ followed_up: false }, n => `${n} lead${n === 1 ? '' : 's'} follow-up unmarked`)} style={btn(false)}>
                  <X size={13} /> Unmark followed-up{selectedFu.mixed ? ` (${selectedFu.marked})` : ''}
                </button>
              )}
              <Dropdown
                label="Set status"
                direction="up"
                align="center"
                minWidth={140}
                showCheck={false}
                options={STATUSES.filter(s => s !== 'Deal').map(s => ({ value: s, label: s, color: STATUS_COLOR[s]?.fg }))}
                onSelect={(s) => bulkPatch({ status: s }, n => `${n} lead${n === 1 ? '' : 's'} → ${s}`)}
                footer={<span style={{ ...TYPE.caption }}>Deal is set per lead (closing amount)</span>}
              />
              <Dropdown
                label="Assign sales"
                icon={UserRound}
                direction="up"
                align="center"
                minWidth={140}
                showCheck={false}
                options={[
                  ...SALES.map(s => ({ value: s, label: s, color: SALES_COLOR[s]?.fg })),
                  { value: 'none', label: 'Unassigned' },
                ]}
                onSelect={(v) => bulkPatch({ sales: v === 'none' ? null : v }, n => v === 'none' ? `${n} lead${n === 1 ? '' : 's'} unassigned` : `${n} lead${n === 1 ? '' : 's'} → ${v}`)}
              />
            </>
          )}
          <button onClick={() => setSelected(new Set())} style={{ ...btn(false), padding: '8px 10px' }}><X size={13} /></button>
        </div>
        </div>
      )}

      {/* ══ MODAL DEAL ══ */}
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

      {/* ══ MODAL IMPORT (placeholder — dibangun setelah file contoh dari Nadir) ══ */}
      {showImport && (
        <ModalShell title="Import from File" onClose={() => setShowImport(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0 4px', textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              background: 'var(--cal-accent-soft, var(--hover))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={24} color="var(--ac)" />
            </div>
            <div style={{ ...TYPE.h4 }}>Smart Import is on the way</div>
            <div style={{ ...TYPE.small, maxWidth: '300px', lineHeight: 1.55 }}>
              Upload your spreadsheet, then map its columns to Leads List fields with a guided
              data-cleaning step (just like Meta&apos;s import flow) before anything is saved.
            </div>
            <div style={{ ...TYPE.caption }}>Coming in the next update.</div>
          </div>
        </ModalShell>
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
  const [reason, setReason] = useState('');
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
      deal_reason: reason.trim() || null,
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
          <label style={fieldLabel}>Why did it close? (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. promo discount, strategic location…"
            style={fieldInput} />
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
