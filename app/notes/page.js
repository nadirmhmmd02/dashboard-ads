'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Plus, Search, Pin, Trash2, Copy, Check, ChevronLeft,
  Bold, Italic, Strikethrough, List, ListOrdered,
  Highlighter, SquareCheck, Type, CircleAlert, RefreshCw,
} from 'lucide-react';
import { useAuth, homeFor } from '../components/AuthContext';
import { supabase } from '../supabase';
import useIsMobile from '../components/useIsMobile';
import ThemeToggle from '../components/ThemeToggle';
import { TYPE } from '../components/typography';

/* ─────────────────────────────────────────────────────────────
   NOTES — catatan pribadi admin (halaman penuh, /notes)
   Tersimpan di Supabase (tabel `notes`, RLS per pemilik) sehingga
   catatan yang sama ikut terbuka dari perangkat lain selama login
   dengan akun yang sama. Auto-save 700 ms setelah berhenti mengetik.

   Editor pakai contenteditable + document.execCommand: cukup untuk
   catatan kerja dan tidak menambah dependency baru. ATURAN PENTING —
   innerHTML editor HANYA di-set ulang saat catatan yang dibuka
   berganti, JANGAN saat mengetik, kalau tidak kursor melompat ke awal.
   ───────────────────────────────────────────────────────────── */

const HIGHLIGHTS = [
  { name: 'Yellow', value: '#FDE68A' },
  { name: 'Green',  value: '#BBF7D0' },
  { name: 'Blue',   value: '#BFDBFE' },
  { name: 'Pink',   value: '#FBCFE8' },
];

const AUTOSAVE_MS = 700;

/* Lebar kolom daftar bisa digeser (pola sama dengan drag handle Sidebar):
   garisnya transparan, hanya kursor yang berubah saat disentuh. */
const LIST_MIN = 210, LIST_MAX = 520, LIST_DEFAULT = 286;
const LIST_W_KEY = 'wd-notes-list-w';

function plainText(html) {
  if (typeof document === 'undefined') return '';
  const el = document.createElement('div');
  el.innerHTML = html || '';
  el.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
  el.querySelectorAll('div,p,li').forEach(b => b.append('\n'));
  return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotesPage() {
  const { role, ready } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [notes, setNotes] = useState(null);      // null = loading
  const [activeId, setActiveId] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');      // 'saving' | 'saved' | ''
  const [copied, setCopied] = useState(false);
  const [showHl, setShowHl] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // mobile: 'list' | 'editor'

  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const saveTimer = useRef(null);
  const loadedIdRef = useRef(null);

  // Lebar kolom daftar (drag) — diingat di localStorage supaya tidak reset tiap buka
  const [listWidth, setListWidth] = useState(LIST_DEFAULT);
  const [dragHover, setDragHover] = useState(false);
  const contentRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(LIST_W_KEY) || '', 10);
    if (saved >= LIST_MIN && saved <= LIST_MAX) setListWidth(saved);
  }, []);

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current || !contentRef.current) return;
      const left = contentRef.current.getBoundingClientRect().left + 16; // padding kiri container
      let w = e.clientX - left;
      if (w < LIST_MIN) w = LIST_MIN;
      if (w > LIST_MAX) w = LIST_MAX;
      setListWidth(w);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';
      setListWidth(w => { localStorage.setItem(LIST_W_KEY, String(Math.round(w))); return w; });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startDrag(e) {
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  // Catatan pribadi — hanya admin
  useEffect(() => {
    if (ready && role && role !== 'admin') router.replace(homeFor(role));
  }, [ready, role, router]);

  const active = useMemo(
    () => (notes || []).find(n => n.id === activeId) || null,
    [notes, activeId],
  );

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('notes')
      .select('id,title,content,pinned,updated_at')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (err) {
      const missingTable = err.code === 'PGRST205' || err.code === '42P01'
        || /could not find the table|does not exist/i.test(err.message || '');
      setError(missingTable
        ? 'Notes is not set up yet — run the notes SQL once in the Supabase SQL Editor, then refresh this page.'
        : err.message);
      setNotes([]);
      return;
    }
    setNotes(data || []);
    setActiveId(prev => prev || data?.[0]?.id || null);
  }, []);

  useEffect(() => { if (role === 'admin') load(); }, [role, load]);

  /* Isi editor HANYA saat catatan aktif berganti */
  useEffect(() => {
    if (!editorRef.current) return;
    if (loadedIdRef.current === activeId) return;
    editorRef.current.innerHTML = active?.content || '';
    loadedIdRef.current = activeId;
    setStatus('');
  }, [activeId, active, mobileView]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function queueSave(patch) {
    if (!activeId) return;
    setStatus('saving');
    setNotes(prev => (prev || []).map(n => (n.id === activeId ? { ...n, ...patch } : n)));
    clearTimeout(saveTimer.current);
    const id = activeId;
    saveTimer.current = setTimeout(async () => {
      const { error: err } = await supabase.from('notes').update(patch).eq('id', id);
      if (err) { setError(err.message); setStatus(''); return; }
      setStatus('saved');
      setNotes(prev => (prev || []).map(n => (n.id === id ? { ...n, updated_at: new Date().toISOString() } : n)));
      setTimeout(() => setStatus(s => (s === 'saved' ? '' : s)), 1600);
    }, AUTOSAVE_MS);
  }

  async function createNote() {
    const { data, error: err } = await supabase
      .from('notes')
      .insert({ title: 'Untitled note', content: '' })
      .select('id,title,content,pinned,updated_at')
      .single();
    if (err) { setError(err.message); return; }
    setNotes(prev => [data, ...(prev || [])]);
    setActiveId(data.id);
    loadedIdRef.current = null;
    setMobileView('editor');
    setTimeout(() => titleRef.current?.focus(), 60);
  }

  async function removeNote(id) {
    const { error: err } = await supabase.from('notes').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    const rest = (notes || []).filter(n => n.id !== id);
    setNotes(rest);
    setConfirmDelete(null);
    if (activeId === id) { setActiveId(rest[0]?.id || null); loadedIdRef.current = null; }
  }

  async function togglePin(n) {
    const next = !n.pinned;
    setNotes(prev => (prev || []).map(x => (x.id === n.id ? { ...x, pinned: next } : x)));
    const { error: err } = await supabase.from('notes').update({ pinned: next }).eq('id', n.id);
    if (err) setError(err.message);
  }

  function copyNote() {
    if (!editorRef.current) return;
    navigator.clipboard?.writeText(plainText(editorRef.current.innerHTML));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function exec(cmd, value) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    queueSave({ content: editorRef.current.innerHTML });
  }

  function insertCheckbox() {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      '<span class="wd-check" data-done="0" contenteditable="false">☐</span>&nbsp;');
    queueSave({ content: editorRef.current.innerHTML });
  }

  function onEditorClick(e) {
    const box = e.target.closest?.('.wd-check');
    if (!box) return;
    const done = box.getAttribute('data-done') === '1';
    box.setAttribute('data-done', done ? '0' : '1');
    box.textContent = done ? '☐' : '☑';
    queueSave({ content: editorRef.current.innerHTML });
  }

  const visible = useMemo(() => {
    const list = notes || [];
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter(n =>
      (n.title || '').toLowerCase().includes(s) ||
      plainText(n.content).toLowerCase().includes(s));
  }, [notes, q]);

  const pinned = visible.filter(n => n.pinned);
  const rest = visible.filter(n => !n.pinned);

  if (!role || role !== 'admin') return null;

  const card = {
    background: 'var(--cd)', border: '1px solid var(--br)',
    borderRadius: '18px', boxShadow: 'var(--shadow)',
  };

  const toolBtn = (onClick, title, children, extra) => (
    <button
      onMouseDown={e => e.preventDefault()}   // jaga seleksi teks
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
        background: 'transparent', border: '1px solid transparent',
        color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background 0.12s, color 0.12s', ...extra,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--t1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t2)'; }}
    >{children}</button>
  );

  function NoteRow({ n }) {
    const isActive = n.id === activeId && (!isMobile || mobileView === 'editor');
    const preview = plainText(n.content).slice(0, 60);
    return (
      <div
        onClick={() => { setActiveId(n.id); if (isMobile) setMobileView('editor'); }}
        style={{
          padding: '10px 11px', borderRadius: '11px', cursor: 'pointer',
          background: isActive ? 'var(--hover)' : 'transparent',
          border: `1px solid ${isActive ? 'var(--br)' : 'transparent'}`,
          display: 'flex', flexDirection: 'column', gap: '3px',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--hover)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            ...TYPE.small, fontWeight: isActive ? 700 : 600, flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{n.title || 'Untitled note'}</span>
          <button
            onClick={e => { e.stopPropagation(); togglePin(n); }}
            title={n.pinned ? 'Unpin' : 'Pin to top'}
            style={{
              display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
              color: n.pinned ? 'var(--ac)' : 'var(--t3)', flexShrink: 0,
            }}
          ><Pin size={12} fill={n.pinned ? 'currentColor' : 'none'} /></button>
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(n); }}
            title="Delete note"
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--t3)', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
          ><Trash2 size={12} /></button>
        </div>
        <span style={{ ...TYPE.caption, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {preview || 'Empty note'} · {relativeTime(n.updated_at)}
        </span>
      </div>
    );
  }

  const showList   = !isMobile || mobileView === 'list';
  const showEditor = !isMobile || mobileView === 'editor';

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ══ HEADER CARD ══ */}
      <header style={isMobile ? {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px', flexShrink: 0, borderBottom: '1px solid var(--br)',
      } : {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', margin: '12px 16px 0', flexShrink: 0, ...card,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {isMobile && mobileView === 'editor' && (
            <button onClick={() => setMobileView('list')} title="Back to list" style={{
              display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', padding: '4px',
            }}><ChevronLeft size={20} /></button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ ...TYPE.h1, ...(isMobile ? { fontSize: '20px' } : null) }}>Notes</h1>
            <p style={{ ...TYPE.small, marginTop: '3px' }}>
              {notes === null ? 'Loading…' : `${notes.length} note${notes.length === 1 ? '' : 's'} · synced across your devices`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={createNote} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '9px 14px', borderRadius: '10px', border: 'none',
            background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}><Plus size={14} strokeWidth={3} /> New note</button>
          {!isMobile && <ThemeToggle />}
        </div>
      </header>

      {/* ══ CONTENT ══ */}
      <div ref={contentRef} style={{
        flex: 1, minHeight: 0, display: 'flex', gap: '10px',
        padding: isMobile ? '12px 16px 16px' : '10px 16px 16px',
      }}>

        {/* ── Daftar catatan ── */}
        {showList && (
          <div style={{
            ...card, width: isMobile ? '100%' : `${listWidth}px`, flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) backwards',
          }}>
            <div style={{ padding: '12px 12px 10px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 11px',
                background: 'var(--bg)', border: '1px solid var(--br)', borderRadius: '10px',
              }}>
                <Search size={13} color="var(--t3)" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search notes…"
                  style={{
                    flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: '12.5px', color: 'var(--t1)', fontFamily: 'inherit',
                  }}
                />
                {q && (
                  <button onClick={() => setQ('')} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 0 }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {notes === null && <div style={{ ...TYPE.caption, padding: '10px 6px' }}>Loading…</div>}
              {notes !== null && visible.length === 0 && (
                <div style={{ ...TYPE.caption, padding: '10px 6px', lineHeight: 1.6 }}>
                  {q ? 'No note matches your search.' : 'No notes yet — hit New note to write your first one.'}
                </div>
              )}
              {pinned.length > 0 && (
                <div style={{ ...TYPE.caption, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', padding: '8px 6px 4px', color: 'var(--t3)' }}>Pinned</div>
              )}
              {pinned.map(n => <NoteRow key={n.id} n={n} />)}
              {pinned.length > 0 && rest.length > 0 && (
                <div style={{ ...TYPE.caption, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', padding: '10px 6px 4px', color: 'var(--t3)' }}>All notes</div>
              )}
              {rest.map(n => <NoteRow key={n.id} n={n} />)}
            </div>
          </div>
        )}

        {/* ── Pembatas geser (desktop) — tak terlihat, hanya kursor yang berubah ── */}
        {!isMobile && showList && showEditor && (
          <div
            onMouseDown={startDrag}
            onMouseEnter={() => setDragHover(true)}
            onMouseLeave={() => setDragHover(false)}
            title="Drag to resize"
            style={{
              width: '6px', margin: '0 -8px', flexShrink: 0, zIndex: 5,
              cursor: 'col-resize', borderRadius: '999px',
              background: dragHover || draggingRef.current ? 'var(--br-strong)' : 'transparent',
              transition: 'background 0.15s',
            }}
          />
        )}

        {/* ── Editor ── */}
        {showEditor && (
          <div style={{
            ...card, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 60ms backwards',
          }}>
            {active ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', borderBottom: '1px solid var(--br)' }}>
                  <input
                    ref={titleRef}
                    value={active.title || ''}
                    onChange={e => queueSave({ title: e.target.value })}
                    placeholder="Note title"
                    style={{
                      flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                      ...TYPE.h4, color: 'var(--t1)', fontFamily: 'inherit',
                    }}
                  />
                  <span style={{ ...TYPE.caption, whiteSpace: 'nowrap', color: status === 'saving' ? 'var(--t3)' : 'var(--ac)' }}>
                    {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : `Edited ${relativeTime(active.updated_at)}`}
                  </span>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap',
                  padding: '8px 12px', borderBottom: '1px solid var(--br)', position: 'relative',
                }}>
                  {toolBtn(() => exec('bold'), 'Bold', <Bold size={15} />)}
                  {toolBtn(() => exec('italic'), 'Italic', <Italic size={15} />)}
                  {toolBtn(() => exec('strikeThrough'), 'Strikethrough', <Strikethrough size={15} />)}
                  {toolBtn(() => exec('formatBlock', '<h3>'), 'Heading', <Type size={15} />)}
                  <span style={{ width: '1px', height: '18px', background: 'var(--br)', margin: '0 6px' }} />
                  {toolBtn(() => exec('insertUnorderedList'), 'Bullet list', <List size={15} />)}
                  {toolBtn(() => exec('insertOrderedList'), 'Numbered list', <ListOrdered size={15} />)}
                  {toolBtn(insertCheckbox, 'Checklist item', <SquareCheck size={15} />)}
                  <span style={{ width: '1px', height: '18px', background: 'var(--br)', margin: '0 6px' }} />
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    {toolBtn(() => setShowHl(v => !v), 'Highlight', <Highlighter size={15} />,
                      showHl ? { background: 'var(--hover)', color: 'var(--t1)' } : undefined)}
                    {showHl && (
                      <div style={{
                        position: 'absolute', top: '36px', left: 0, zIndex: 5,
                        display: 'flex', gap: '5px', padding: '7px',
                        background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '10px',
                        boxShadow: 'var(--pop-shadow)', animation: 'wdScaleIn 0.14s cubic-bezier(0.4,0,0.2,1)',
                      }}>
                        {HIGHLIGHTS.map(h => (
                          <button
                            key={h.value}
                            title={h.name}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { exec('hiliteColor', h.value); setShowHl(false); }}
                            style={{
                              width: '22px', height: '22px', borderRadius: '7px', cursor: 'pointer',
                              background: h.value, border: '1px solid rgba(0,0,0,0.12)',
                            }}
                          />
                        ))}
                        <button
                          title="Remove highlight"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => { exec('hiliteColor', 'transparent'); setShowHl(false); }}
                          style={{
                            width: '22px', height: '22px', borderRadius: '7px', cursor: 'pointer',
                            background: 'var(--hover)', border: '1px solid var(--br)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)',
                          }}
                        ><X size={12} /></button>
                      </div>
                    )}
                  </div>
                  {toolBtn(() => exec('removeFormat'), 'Clear formatting', <span style={{ fontSize: '11px', fontWeight: 800 }}>Tx</span>)}
                  <span style={{ flex: 1 }} />
                  {toolBtn(copyNote, 'Copy note as plain text',
                    copied ? <Check size={15} color="var(--ac)" strokeWidth={3} /> : <Copy size={15} />)}
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => queueSave({ content: editorRef.current.innerHTML })}
                  onClick={onEditorClick}
                  className="wd-note-editor"
                  style={{
                    flex: 1, overflowY: 'auto', padding: '18px 22px', outline: 'none',
                    fontSize: '14px', lineHeight: 1.7, color: 'var(--t1)',
                  }}
                />
              </>
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '10px', padding: '30px', textAlign: 'center',
              }}>
                <div style={{ ...TYPE.body, fontWeight: 700 }}>Nothing open</div>
                <div style={{ ...TYPE.caption, maxWidth: '300px', lineHeight: 1.6 }}>
                  Create a note to jot down campaign ideas, follow-up scripts, or anything you need on hand from any device.
                </div>
                <button onClick={createNote} style={{
                  marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 16px', borderRadius: '10px', border: 'none',
                  background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}><Plus size={14} strokeWidth={3} /> New note</button>
              </div>
            )}

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                borderTop: '1px solid var(--br)', background: 'rgba(239,68,68,0.08)',
              }}>
                <CircleAlert size={14} color="#EF4444" style={{ flexShrink: 0 }} />
                <span style={{ ...TYPE.caption, color: '#EF4444' }}>{error}</span>
                <button onClick={() => { setError(null); load(); }} style={{
                  marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444',
                  fontSize: '11px', fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
                }}><RefreshCw size={12} /> Retry</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ KONFIRMASI HAPUS ══ */}
      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            animation: 'wdFadeIn 0.15s ease',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: '340px', padding: '18px 20px',
            background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '16px',
            boxShadow: 'var(--pop-shadow)', animation: 'wdScaleIn 0.16s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <div style={{ ...TYPE.h4 }}>Delete this note?</div>
            <div style={{ ...TYPE.small, marginTop: '7px', lineHeight: 1.6 }}>
              “{confirmDelete.title || 'Untitled note'}” will be removed from every device. This can’t be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '16px' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                padding: '9px 15px', borderRadius: '9px', border: '1px solid var(--br)',
                background: 'var(--cd)', color: 'var(--t1)', fontSize: '12.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={() => removeNote(confirmDelete.id)} style={{
                padding: '9px 15px', borderRadius: '9px', border: 'none',
                background: '#EF4444', color: '#fff', fontSize: '12.5px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
