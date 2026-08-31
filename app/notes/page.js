'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Plus, Search, Pin, Trash2, Copy, Check, ChevronLeft, ChevronDown,
  Bold, Italic, Strikethrough, List, ListOrdered,
  Highlighter, SquareCheck, Type, CircleAlert, RefreshCw, GripVertical,
} from 'lucide-react';
import { useAuth, homeFor } from '../components/AuthContext';
import { supabase } from '../supabase';
import useIsMobile from '../components/useIsMobile';
import ThemeToggle from '../components/ThemeToggle';
import { TYPE } from '../components/typography';
import useTodos from '../components/useTodos';
import TodoPanel from '../components/TodoPanel';
import TodoDetail from '../components/TodoDetail';

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
/* Tinggi panel To Do di bawah daftar catatan — juga bisa digeser (row-resize) */
const TODO_MIN = 150, TODO_MAX = 640, TODO_DEFAULT = 320;
const TODO_H_KEY = 'wd-notes-todo-h';
const TODO_MIN_KEY = 'wd-notes-todo-min';   // '1' = panel To Do di-minimize (tinggal header)
const TODO_HEADER_H = 40;                   // tinggi header panel saat minimized
const GROUPS_KEY = 'wd-notes-groups-min';   // grup daftar catatan yang dilipat { pinned, all }
const ACTIVE_KEY = 'wd-notes-active-id';    // catatan terakhir dibuka — dibuka lagi setelah refresh

/* ── Auto-link ──
   URL di dalam catatan otomatis dibungkus <a> warna aksen (styling di globals.css
   .wd-note-editor a). Klik biasa tetap mengedit teks; Ctrl+klik membuka link. */
const URL_RE  = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const URL_ONE = /^(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)$/i;
function cleanUrl(raw) { return (raw || '').replace(/[.,;:!?)\]}'"»…]+$/, ''); }
function makeLinkEl(url) {
  const a = document.createElement('a');
  a.href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  a.className = 'wd-link';
  a.title = 'Ctrl+click to open link';
  a.setAttribute('rel', 'noopener');
  return a;
}
/* Bungkus semua URL polos di dalam root jadi <a>; teks yang sudah di dalam link
   atau checkbox dilewati. Return true kalau ada yang berubah. */
function linkifyDom(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  let tn;
  while ((tn = walker.nextNode())) {
    const p = tn.parentNode;
    if (p?.closest?.('a, .wd-check')) continue;
    URL_RE.lastIndex = 0;
    if (URL_RE.test(tn.textContent)) targets.push(tn);
  }
  for (const node of targets) {
    const text = node.textContent;
    const frag = document.createDocumentFragment();
    let last = 0;
    URL_RE.lastIndex = 0;   // regex global menyimpan posisi — wajib reset, kalau tidak matchAll mulai dari posisi basi
    for (const m of text.matchAll(URL_RE)) {
      const url = cleanUrl(m[0]);
      if (!url) continue;
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const a = makeLinkEl(url);
      a.textContent = url;
      frag.appendChild(a);
      last = m.index + url.length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
  return targets.length > 0;
}
function linkifyHtml(html) {
  if (typeof document === 'undefined') return html || '';
  const root = document.createElement('div');
  root.innerHTML = html || '';
  linkifyDom(root);
  return root.innerHTML;
}

function plainText(html) {
  if (typeof document === 'undefined') return '';
  const el = document.createElement('div');
  el.innerHTML = html || '';
  el.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
  el.querySelectorAll('div,p,li').forEach(b => b.append('\n'));
  return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

/* Urutan tampil: pinned dulu; di dalam grup pakai sort_order hasil geser manual.
   Catatan tanpa sort_order (baru dibuat / belum pernah digeser) tampil paling atas,
   diurutkan updated_at terbaru — sama seperti perilaku lama. */
function sortNotes(list) {
  return [...list].sort((a, b) => {
    const pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pin !== 0) return pin;
    const ao = a.sort_order, bo = b.sort_order;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return 1;
    if (ao == null && bo != null) return -1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });
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

  // Grup daftar catatan (PINNED / ALL NOTES) bisa dilipat — isi "tersedot" ke atas
  // masuk ke header grup (kebalikan arah To Do), diingat di localStorage.
  const [groupMin, setGroupMin] = useState({ pinned: false, all: false });

  // Geser urutan catatan (drag handle di daftar). canReorder = false kalau kolom
  // sort_order belum ada di DB (supabase-notes-update-1.sql belum dijalankan).
  const [canReorder, setCanReorder] = useState(true);
  const [dragId, setDragId] = useState(null);
  const dragIdRef = useRef(null);

  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const saveTimer = useRef(null);
  const loadedIdRef = useRef(null);

  // Lebar kolom daftar (drag) — diingat di localStorage supaya tidak reset tiap buka
  const [listWidth, setListWidth] = useState(LIST_DEFAULT);
  const [dragHover, setDragHover] = useState(false);
  const contentRef = useRef(null);
  const draggingRef = useRef(false);

  /* ── To Do (ala Microsoft To Do) — data via useTodos, panel di bawah daftar catatan,
        detail tugas menggantikan editor di kanan saat sebuah tugas dipilih ── */
  const td = useTodos(role === 'admin');
  const [todoView, setTodoView] = useState('myday');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [todoH, setTodoH] = useState(TODO_DEFAULT);
  const [todoMin, setTodoMin] = useState(false);
  const [todoDragging, setTodoDragging] = useState(false);   // matikan transisi tinggi saat digeser
  const [todoDragHover, setTodoDragHover] = useState(false);
  const leftCardRef = useRef(null);
  const draggingTodoRef = useRef(false);
  const selectedTask = useMemo(() => (td.todos || []).find(t => t.id === selectedTaskId) || null, [td.todos, selectedTaskId]);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(LIST_W_KEY) || '', 10);
    if (saved >= LIST_MIN && saved <= LIST_MAX) setListWidth(saved);
    const savedH = parseInt(localStorage.getItem(TODO_H_KEY) || '', 10);
    if (savedH >= TODO_MIN && savedH <= TODO_MAX) setTodoH(savedH);
    if (localStorage.getItem(TODO_MIN_KEY) === '1') setTodoMin(true);
    try {
      const g = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}');
      setGroupMin({ pinned: !!g.pinned, all: !!g.all });
    } catch { /* nilai rusak → pakai default terbuka */ }
  }, []);

  function toggleTodoMin() {
    setTodoMin(v => { localStorage.setItem(TODO_MIN_KEY, v ? '0' : '1'); return !v; });
  }

  function toggleGroup(id) {
    setGroupMin(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }
  // Buka paksa satu grup (dipakai saat catatan baru dibuat / di-pin) supaya
  // hasil aksinya tidak "hilang" di dalam grup yang sedang dilipat.
  function expandGroup(id) {
    setGroupMin(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev, [id]: false };
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }
  // Saat sedang mencari, lipatan diabaikan supaya hasil pencarian selalu terlihat
  const isGroupMin = (id) => !q.trim() && groupMin[id];

  useEffect(() => {
    function onMove(e) {
      if (draggingTodoRef.current && leftCardRef.current) {
        // Geser pembatas daftar catatan ↔ panel To Do (tinggi panel = jarak kursor ke dasar kartu)
        const bottom = leftCardRef.current.getBoundingClientRect().bottom;
        let h = bottom - e.clientY;
        if (h < TODO_MIN) h = TODO_MIN;
        if (h > TODO_MAX) h = TODO_MAX;
        setTodoH(h);
        return;
      }
      if (!draggingRef.current || !contentRef.current) return;
      const left = contentRef.current.getBoundingClientRect().left + 16; // padding kiri container
      let w = e.clientX - left;
      if (w < LIST_MIN) w = LIST_MIN;
      if (w > LIST_MAX) w = LIST_MAX;
      setListWidth(w);
    }
    function onUp() {
      if (draggingTodoRef.current) {
        draggingTodoRef.current = false;
        setTodoDragging(false);
        document.body.style.userSelect = '';
        setTodoH(h => { localStorage.setItem(TODO_H_KEY, String(Math.round(h))); return h; });
      }
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
  function startTodoDrag(e) {
    if (todoMin) return;   // saat minimized pembatas tidak bisa digeser
    draggingTodoRef.current = true;
    setTodoDragging(true);
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  /* Pilih tugas → panel kanan jadi detail tugas; pilih catatan → kembali editor.
     loadedIdRef di-reset supaya editor (yang sempat unmount) mengisi ulang innerHTML. */
  function selectTask(id) {
    setSelectedTaskId(id);
    loadedIdRef.current = null;
    if (isMobile) setMobileView('editor');
  }
  function selectNote(id) {
    setSelectedTaskId(null);
    setActiveId(id);
    if (isMobile) setMobileView('editor');
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
    // Coba ambil dengan kolom sort_order; kalau kolomnya belum ada (SQL update
    // belum dijalankan), fallback ke query lama supaya Notes tetap jalan.
    let { data, error: err } = await supabase
      .from('notes')
      .select('id,title,content,pinned,updated_at,sort_order')
      .order('updated_at', { ascending: false });
    let hasOrderCol = true;
    if (err && (err.code === '42703' || /sort_order/i.test(err.message || ''))) {
      hasOrderCol = false;
      ({ data, error: err } = await supabase
        .from('notes')
        .select('id,title,content,pinned,updated_at')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false }));
    }
    if (err) {
      const missingTable = err.code === 'PGRST205' || err.code === '42P01'
        || /could not find the table|does not exist/i.test(err.message || '');
      setError(missingTable
        ? 'Notes is not set up yet — run the notes SQL once in the Supabase SQL Editor, then refresh this page.'
        : err.message);
      setNotes([]);
      return;
    }
    setCanReorder(hasOrderCol);
    const sorted = sortNotes(data || []);
    setNotes(sorted);
    // Buka lagi catatan yang terakhir dibuka (localStorage); kalau sudah
    // dihapus / belum pernah ada → catatan paling atas seperti biasa.
    const savedId = localStorage.getItem(ACTIVE_KEY);
    const restored = savedId && sorted.some(n => n.id === savedId) ? savedId : null;
    setActiveId(prev => prev || restored || sorted[0]?.id || null);
  }, []);

  // Simpan catatan aktif tiap berganti — satu tempat, mencakup semua jalur
  // (klik daftar, catatan baru, hapus catatan aktif, dst.)
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  useEffect(() => { if (role === 'admin') load(); }, [role, load]);

  /* Isi editor HANYA saat catatan aktif berganti */
  useEffect(() => {
    if (!editorRef.current) return;
    if (loadedIdRef.current === activeId) return;
    // URL polos di catatan lama ikut dijadikan link saat catatan dibuka
    editorRef.current.innerHTML = linkifyHtml(active?.content || '');
    loadedIdRef.current = activeId;
    setStatus('');
    // Catatan dipakai seperti log/history — begitu dibuka langsung scroll ke
    // PALING BAWAH supaya tulisan terbaru langsung kelihatan (rAF: tunggu layout).
    const ed = editorRef.current;
    requestAnimationFrame(() => { ed.scrollTop = ed.scrollHeight; });
  }, [activeId, active, mobileView, selectedTaskId]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  /* Ctrl/Cmd ditekan → editor diberi class `wd-ctrl`: kursor di atas link berubah
     jadi pointer (icon klik) sebagai isyarat "klik = buka tab baru". Lepas tombol
     atau jendela kehilangan fokus (mis. Alt+Tab saat Ctrl masih ditekan) → normal.
     Toggle langsung via classList (bukan state) supaya tidak re-render halaman. */
  useEffect(() => {
    const set = (on) => editorRef.current?.classList.toggle('wd-ctrl', on);
    const down = (e) => { if (e.key === 'Control' || e.key === 'Meta') set(true); };
    const up   = (e) => { if (e.key === 'Control' || e.key === 'Meta') set(false); };
    const off  = () => set(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', off);
    };
  }, []);

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
      .select(canReorder ? 'id,title,content,pinned,updated_at,sort_order' : 'id,title,content,pinned,updated_at')
      .single();
    if (err) { setError(err.message); return; }
    setNotes(prev => [data, ...(prev || [])]);
    expandGroup('all');   // catatan baru masuk All notes — pastikan grupnya terbuka
    setSelectedTaskId(null);
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

  /* Eksekusi konfirmasi hapus — confirmDelete = { kind: 'note'|'task'|'list', item } */
  async function confirmDeleteNow() {
    const c = confirmDelete;
    if (!c) return;
    if (c.kind === 'note') { await removeNote(c.item.id); return; }
    if (c.kind === 'task') {
      await td.removeTask(c.item.id);
      if (selectedTaskId === c.item.id) { setSelectedTaskId(null); loadedIdRef.current = null; if (isMobile) setMobileView('list'); }
    } else if (c.kind === 'list') {
      await td.removeList(c.item.id);
      if (todoView === `list:${c.item.id}`) setTodoView('tasks');
      if (selectedTask && selectedTask.list_id === c.item.id) { setSelectedTaskId(null); loadedIdRef.current = null; }
    }
    setConfirmDelete(null);
  }

  async function togglePin(n) {
    const next = !n.pinned;
    expandGroup(next ? 'pinned' : 'all');   // grup tujuan dibuka biar catatannya kelihatan pindah
    setNotes(prev => (prev || []).map(x => (x.id === n.id ? { ...x, pinned: next } : x)));
    const { error: err } = await supabase.from('notes').update({ pinned: next }).eq('id', n.id);
    if (err) setError(err.message);
  }

  /* ── Geser urutan catatan (drag handle) ──
     Saat handle digeser melewati catatan lain di grup yang sama (pinned/biasa),
     posisinya langsung ditukar di layar; saat dilepas, urutan final disimpan
     sebagai sort_order (index) untuk semua catatan. */
  function moveNote(srcId, targetId) {
    setNotes(prev => {
      const list = [...(prev || [])];
      const si = list.findIndex(x => x.id === srcId);
      const ti = list.findIndex(x => x.id === targetId);
      if (si < 0 || ti < 0 || si === ti) return prev;
      if (!!list[si].pinned !== !!list[ti].pinned) return prev; // hanya dalam grup yang sama
      const [moved] = list.splice(si, 1);
      list.splice(ti, 0, moved);
      return list;
    });
  }

  function endReorder() {
    dragIdRef.current = null;
    setDragId(null);
    setNotes(prev => {
      const list = (prev || []).map((n, i) => ({ ...n, sort_order: i }));
      // Simpan idempotent — aman walau updater sempat jalan dua kali (StrictMode)
      Promise.all(list.map(n => supabase.from('notes').update({ sort_order: n.sort_order }).eq('id', n.id)))
        .then(results => {
          const bad = results.find(r => r.error);
          if (bad) setError(bad.error.message);
        });
      return list;
    });
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

  /* ── Checklist ──
     Span checkbox dibuat manual via Range API, BUKAN execCommand('insertHTML'):
     dengan insertHTML Chrome sering menaruh kursor sebelum/di dalam span
     contenteditable=false sehingga tidak bisa mengetik di samping checkbox.
     Kursor selalu ditaruh eksplisit setelah spasi pengiring. */
  function makeCheck() {
    const span = document.createElement('span');
    span.className = 'wd-check';
    span.setAttribute('data-done', '0');
    span.setAttribute('contenteditable', 'false');
    span.textContent = '☐';
    return span;
  }

  function placeCaretAfter(textNode) {
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(textNode, textNode.length);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /* Checkbox untuk BLOK teks (beberapa baris di-block lalu klik checkbox):
     berperilaku seperti bullet/numbered list — tiap baris dalam seleksi dapat
     checkbox di awal barisnya (teks tidak dihapus). Kalau SEMUA baris terpilih
     sudah ber-checkbox → checkbox dicabut (toggle, sama seperti list). */
  function toggleCheckboxOnSelection(ed, sel) {
    // Bungkus tiap baris jadi <div> dulu (teks polos di level atas editor jadi punya blok)
    const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    if (!anchorEl?.closest?.('li')) document.execCommand('formatBlock', false, '<div>');
    const range = sel.getRangeAt(0);
    // Kumpulkan blok baris yang tersentuh seleksi (li di dalam list dihitung per item)
    const blocks = [];
    for (const node of Array.from(ed.childNodes)) {
      if (!range.intersectsNode(node)) continue;
      if (node.nodeType !== 1) continue;
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        node.querySelectorAll('li').forEach(li => { if (range.intersectsNode(li)) blocks.push(li); });
      } else if (node.tagName !== 'BR') {
        blocks.push(node);
      }
    }
    if (!blocks.length) return false;
    const firstCheck = (b) => {
      // checkbox dianggap "di awal baris" kalau anak elemen pertama yang bukan whitespace = .wd-check
      for (const c of Array.from(b.childNodes)) {
        if (c.nodeType === 3 && !c.textContent.trim()) continue;
        return c.nodeType === 1 && c.classList?.contains('wd-check') ? c : null;
      }
      return null;
    };
    const allChecked = blocks.every(b => firstCheck(b));
    for (const b of blocks) {
      const existing = firstCheck(b);
      if (allChecked) {
        // cabut checkbox + spasi pengiringnya
        const next = existing.nextSibling;
        if (next && next.nodeType === 3 && /^[  ]/.test(next.textContent)) next.textContent = next.textContent.replace(/^[  ]/, '');
        existing.remove();
        if (!b.textContent.replace(/\s/g, '') && !b.querySelector('br,img')) b.innerHTML = '<br>';
      } else if (!existing) {
        // baris kosong (cuma <br>) → buang <br> supaya checkbox tidak turun baris
        if (b.childNodes.length === 1 && b.firstChild.nodeName === 'BR') b.innerHTML = '';
        b.insertBefore(document.createTextNode(' '), b.firstChild);
        b.insertBefore(makeCheck(), b.firstChild);
      }
    }
    // Seleksi tetap menyorot baris-baris yang sama (biar bisa lanjut format/aksi lain)
    const r = document.createRange();
    r.setStartBefore(blocks[0]);
    r.setEndAfter(blocks[blocks.length - 1]);
    sel.removeAllRanges();
    sel.addRange(r);
    return true;
  }

  function insertCheckbox() {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    // Ada teks yang di-block → mode massal per baris (seperti bullet/numbered list)
    if (!sel.isCollapsed) {
      if (toggleCheckboxOnSelection(ed, sel)) { queueSave({ content: ed.innerHTML }); return; }
    }
    // Pastikan baris jadi block <div> supaya perilaku Enter (lanjut checkbox)
    // bisa mengenali batas baris. Di dalam bullet/numbered list jangan —
    // formatBlock bakal merusak strukturnya.
    const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    if (!anchorEl?.closest?.('li')) document.execCommand('formatBlock', false, '<div>');
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const span = makeCheck();
    // Spasi pengiring = nbsp, bukan spasi biasa — spasi biasa di ujung baris
    // di-collapse browser sehingga kursor "hilang" di samping checkbox.
    const space = document.createTextNode(' ');
    range.insertNode(space);
    range.insertNode(span);   // urutan akhir: span lalu spasi
    placeCaretAfter(space);
    queueSave({ content: ed.innerHTML });
  }

  /* Kata tepat sebelum kursor = URL → bungkus jadi <a>, kursor ditaruh setelahnya
     supaya spasi/Enter yang sedang diketik jatuh DI LUAR link. */
  function linkifyAtCaret() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3) return false;
    if (node.parentNode?.closest?.('a')) return false;
    const offset = sel.anchorOffset;
    const m = node.textContent.slice(0, offset).match(/(\S+)$/);
    if (!m) return false;
    const word = cleanUrl(m[1]);
    if (!URL_ONE.test(word)) return false;
    const start = offset - m[1].length;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, start + word.length);
    const a = makeLinkEl(word);
    try { r.surroundContents(a); } catch { return false; }
    const after = document.createRange();
    after.setStartAfter(a);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    return true;
  }

  /* Enter di baris checklist berperilaku seperti bullet list:
     baris berisi teks → baris baru dengan checkbox baru;
     baris checkbox kosong (Enter kedua) → checkbox dihapus, jadi baris polos. */
  function onEditorKeyDown(e) {
    /* Tab = respon di DALAM tulisan ala Notepad Windows (31 Agu 2026) — bukan
       loncat fokus ke elemen lain. Di dalam bullet/numbered list: Tab/Shift+Tab
       menggeser level list; di teks biasa: sisipkan karakter tab (dirender via
       white-space pre-wrap + tab-size di globals.css). */
    if (e.key === 'Tab') {
      e.preventDefault();
      const ed = editorRef.current;
      const s = window.getSelection();
      const el = s?.anchorNode?.nodeType === 3 ? s.anchorNode.parentNode : s?.anchorNode;
      if (el?.closest?.('li')) {
        document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      } else if (!e.shiftKey) {
        document.execCommand('insertText', false, '\t');
      }
      if (ed) queueSave({ content: ed.innerHTML });
      return;
    }
    // URL yang baru selesai diketik langsung jadi link begitu spasi/Enter ditekan
    if ((e.key === ' ' || e.key === 'Enter') && !e.shiftKey) {
      if (linkifyAtCaret()) queueSave({ content: editorRef.current.innerHTML });
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    const ed = editorRef.current;
    const sel = window.getSelection();
    if (!ed || !sel || !sel.rangeCount) return;
    const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    if (!anchorEl || anchorEl.closest?.('li')) return;   // list asli: biarkan browser
    // Blok baris = ancestor kursor yang anak langsung editor
    let block = sel.getRangeAt(0).startContainer;
    while (block && block.parentNode !== ed) block = block.parentNode;
    if (!block || block.nodeType !== 1 || !block.querySelector('.wd-check')) return;
    e.preventDefault();
    const isEmpty = block.textContent.replace(/[☐☑ \s]/g, '') === '';
    if (isEmpty) {
      // Enter kedua: buang checkbox, baris ini jadi baris kosong biasa
      block.innerHTML = '<br>';
      const r = document.createRange();
      r.setStart(block, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      // Enter pertama: pecah baris di posisi kursor, baris baru diawali checkbox
      const range = sel.getRangeAt(0);
      const tailRange = range.cloneRange();
      tailRange.setEnd(block, block.childNodes.length);
      const tail = tailRange.extractContents();   // sisa teks setelah kursor ikut pindah
      const nd = document.createElement('div');
      const space = document.createTextNode(' ');
      nd.appendChild(makeCheck());
      nd.appendChild(space);
      nd.appendChild(tail);
      block.after(nd);
      placeCaretAfter(space);
    }
    queueSave({ content: ed.innerHTML });
  }

  /* ── Klik di tepi KIRI sebuah baris = block satu baris itu (ala Notepad/Word,
        31 Agu 2026). "Gutter" = area padding kiri editor (22px): kursor di sana
        berubah jadi panah (class wd-gutter), klik memilih seluruh blok baris
        pada ketinggian klik. Baris = div/p/h3 anak langsung editor, atau li. ── */
  const GUTTER_W = 22;   // = padding kiri editor

  function lineBlockFromPoint(x, y) {
    const ed = editorRef.current;
    let node = null;
    if (document.caretRangeFromPoint) node = document.caretRangeFromPoint(x, y)?.startContainer;
    else if (document.caretPositionFromPoint) node = document.caretPositionFromPoint(x, y)?.offsetNode;
    if (!node || node === ed || !ed.contains(node)) return null;
    let block = node;
    while (block.parentNode !== ed && !(block.nodeType === 1 && block.tagName === 'LI')) {
      block = block.parentNode;
      if (!block || block === ed) return null;
    }
    return block;
  }

  function onEditorMouseDown(e) {
    const ed = editorRef.current;
    if (!ed || e.button !== 0) return;
    if (e.clientX - ed.getBoundingClientRect().left > GUTTER_W) return;
    const block = lineBlockFromPoint(ed.getBoundingClientRect().left + GUTTER_W + 6, e.clientY);
    if (!block) return;
    e.preventDefault();   // jangan pindahkan kursor ke awal baris — kita mau block
    ed.focus({ preventScroll: true });   // toolbar (bold dsb.) tetap bisa langsung dipakai
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(block);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function onEditorMouseMove(e) {
    const ed = editorRef.current;
    if (!ed) return;
    // Toggle class langsung (bukan state) — pola sama dengan wd-ctrl, anti re-render
    ed.classList.toggle('wd-gutter', e.clientX - ed.getBoundingClientRect().left <= GUTTER_W);
  }

  function onEditorClick(e) {
    // Ctrl/Cmd+klik pada link → buka di tab baru; klik biasa tetap mengedit teks
    const link = e.target.closest?.('a');
    if (link && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      window.open(link.href, '_blank', 'noopener');
      return;
    }
    const box = e.target.closest?.('.wd-check');
    if (!box) return;
    const done = box.getAttribute('data-done') === '1';
    box.setAttribute('data-done', done ? '0' : '1');
    box.textContent = done ? '☐' : '☑';
    queueSave({ content: editorRef.current.innerHTML });
  }

  /* Paste: SELALU teks polos — format bawaan sumber (tabel/warna/font dari
     spreadsheet atau web) TIDAK ikut terbawa, tampilan mengikuti gaya Notes.
     URL tunggal → langsung link di posisi kursor. Teks panjang → ditempel via
     insertText (plain), lalu seluruh isi di-linkify; posisi kursor dijaga
     pakai penanda sementara (span) yang dihapus lagi setelahnya. */
  function onEditorPaste(e) {
    const ed = editorRef.current;
    if (!ed) return;
    const plain = e.clipboardData?.getData('text/plain') || '';
    if (!plain) return;   // clipboard tanpa teks (mis. gambar) → biarkan default
    const raw = plain.trim();
    const single = cleanUrl(raw);
    if (single && !/\s/.test(raw) && URL_ONE.test(single)) {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const a = makeLinkEl(single);
      a.textContent = single;
      const space = document.createTextNode(' ');   // nbsp — spasi biasa di ujung baris di-collapse browser
      r.insertNode(space);
      r.insertNode(a);
      placeCaretAfter(space);
      queueSave({ content: ed.innerHTML });
      return;
    }
    // Teks umum: tempel versi PLAIN-nya saja (execCommand insertText menjaga
    // undo stack + memicu onInput → auto-save), format sumber dibuang.
    e.preventDefault();
    document.execCommand('insertText', false, plain);
    setTimeout(() => {
      const sel = window.getSelection();
      let marker = null;
      if (sel && sel.rangeCount) {
        marker = document.createElement('span');
        sel.getRangeAt(0).insertNode(marker);
      }
      const changed = linkifyDom(ed);
      if (marker) {
        const parent = marker.parentNode;
        const idx = Array.prototype.indexOf.call(parent.childNodes, marker);
        marker.remove();
        const r = document.createRange();
        r.setStart(parent, idx);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      if (changed) queueSave({ content: ed.innerHTML });
    }, 0);
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
    const isActive = n.id === activeId && !selectedTaskId && (!isMobile || mobileView === 'editor');
    const isDragging = dragId === n.id;
    const preview = plainText(n.content).slice(0, 60);
    const showHandle = !isMobile && canReorder;
    return (
      <div
        onClick={() => selectNote(n.id)}
        onDragOver={e => {
          if (!dragIdRef.current || dragIdRef.current === n.id) return;
          e.preventDefault();
          moveNote(dragIdRef.current, n.id);
        }}
        onDrop={e => e.preventDefault()}
        style={{
          padding: '10px 11px', borderRadius: '11px', cursor: 'pointer',
          background: isActive ? 'var(--hover)' : 'transparent',
          border: `1px solid ${isActive ? 'var(--br)' : 'transparent'}`,
          display: 'flex', flexDirection: 'column', gap: '3px',
          transition: 'background 0.12s, opacity 0.12s',
          opacity: isDragging ? 0.45 : 1,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--hover)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {showHandle && (
            <span
              draggable
              onClick={e => e.stopPropagation()}
              onDragStart={e => {
                dragIdRef.current = n.id;
                setDragId(n.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={endReorder}
              title="Geser ke atas / bawah untuk atur urutan"
              style={{ display: 'flex', flexShrink: 0, cursor: 'grab', color: 'var(--t3)', margin: '0 -2px' }}
            ><GripVertical size={12} /></span>
          )}
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
            onClick={e => { e.stopPropagation(); setConfirmDelete({ kind: 'note', item: n }); }}
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

  /* ── Grup daftar yang bisa dilipat ──
     Dipanggil sebagai FUNGSI biasa (bukan komponen JSX) supaya elemennya tidak
     di-remount tiap render — kalau remount, transisi lipatnya tidak jalan
     (pelajaran yang sama dengan TaskRow di TodoPanel). Animasi tinggi pakai
     grid-template-rows 1fr→0fr: isi grup "tersedot" ke atas masuk ke header
     (kebalikan arah minimize To Do), keluar lagi ke bawah saat dibuka. */
  const groupHeader = (id, label, count) => {
    const min = isGroupMin(id);
    return (
      <button
        onClick={() => toggleGroup(id)}
        title={min ? 'Show notes' : 'Hide notes'}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          textAlign: 'left', ...TYPE.caption, fontWeight: 800, letterSpacing: '0.6px',
          textTransform: 'uppercase', padding: '8px 6px 4px', color: 'var(--t3)',
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--t2)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
      >
        <ChevronDown size={12} strokeWidth={2.5} style={{
          flexShrink: 0,
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          transform: min ? 'rotate(-90deg)' : 'none',
        }} />
        <span>{label}</span>
        <span style={{ fontWeight: 700, opacity: 0.85 }}>· {count}</span>
      </button>
    );
  };
  const groupBody = (id, children) => {
    const min = isGroupMin(id);
    return (
      <div style={{
        display: 'grid', gridTemplateRows: min ? '0fr' : '1fr',
        transition: 'grid-template-rows 0.34s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{
          overflow: 'hidden', minHeight: 0,
          display: 'flex', flexDirection: 'column', gap: '2px',
          opacity: min ? 0 : 1,
          transform: min ? 'translateY(-8px)' : 'none',
          transition: 'opacity 0.26s ease, transform 0.34s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {children}
        </div>
      </div>
    );
  };

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
              {notes === null ? 'Loading…' : `${notes.length} note${notes.length === 1 ? '' : 's'}${td.todos && !td.error ? ` · ${td.todos.filter(t => !t.done).length} open task${td.todos.filter(t => !t.done).length === 1 ? '' : 's'}` : ''} · synced across your devices`}
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
          <div ref={leftCardRef} style={{
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
              {pinned.length > 0 && groupHeader('pinned', 'Pinned', pinned.length)}
              {pinned.length > 0 && groupBody('pinned', pinned.map(n => <NoteRow key={n.id} n={n} />))}
              {rest.length > 0 && groupHeader('all', 'All notes', rest.length)}
              {rest.length > 0 && groupBody('all', rest.map(n => <NoteRow key={n.id} n={n} />))}
              {notes !== null && notes.length > 1 && !canReorder && !isMobile && (
                <div style={{ ...TYPE.caption, padding: '10px 6px 2px', lineHeight: 1.5 }}>
                  Mau geser urutan catatan? Jalankan <strong>supabase-notes-update-1.sql</strong> sekali di Supabase SQL Editor, lalu refresh halaman ini.
                </div>
              )}
            </div>

            {/* ── Pembatas daftar ↔ To Do (desktop: bisa digeser atas-bawah) ── */}
            <div
              onMouseDown={isMobile ? undefined : startTodoDrag}
              onMouseEnter={() => setTodoDragHover(true)}
              onMouseLeave={() => setTodoDragHover(false)}
              title={isMobile ? undefined : 'Drag to resize'}
              style={{
                height: '1px', flexShrink: 0, position: 'relative',
                background: 'var(--br)',
                cursor: isMobile || todoMin ? 'default' : 'row-resize',
              }}
            >
              {!isMobile && !todoMin && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '-3px', height: '7px', zIndex: 5,
                  background: todoDragHover || todoDragging ? 'var(--br-strong)' : 'transparent',
                  transition: 'background 0.15s', borderRadius: '999px',
                }} />
              )}
            </div>

            {/* ── Panel To Do (ala Microsoft To Do) ──
                Minimize ala Windows: tinggi menyusut ke header saja (panel menempel di dasar
                kartu, jadi tampak "turun & mengecil ke bawah"); transisi dimatikan saat digeser. */}
            <div style={{
              height: todoMin ? `${TODO_HEADER_H}px` : isMobile ? '44%' : `${todoH}px`,
              flexShrink: 0, minHeight: 0, background: 'var(--cd)', overflow: 'hidden',
              transition: todoDragging ? 'none' : 'height 0.34s cubic-bezier(0.4,0,0.2,1)',
            }}>
              <TodoPanel
                td={td}
                view={todoView}
                setView={setTodoView}
                selectedId={selectedTaskId}
                onSelect={selectTask}
                onRequestDeleteList={(l) => setConfirmDelete({ kind: 'list', item: l })}
                isMobile={isMobile}
                minimized={todoMin}
                onToggleMinimize={toggleTodoMin}
              />
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
            {selectedTask ? (
              <TodoDetail
                key={selectedTask.id}
                task={selectedTask}
                td={td}
                onRequestDelete={(t) => setConfirmDelete({ kind: 'task', item: t })}
                isMobile={isMobile}
              />
            ) : active ? (
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
                  onKeyDown={onEditorKeyDown}
                  onPaste={onEditorPaste}
                  onMouseDown={onEditorMouseDown}
                  onMouseMove={onEditorMouseMove}
                  onDragStart={e => e.preventDefault()}
                  onDrop={e => e.preventDefault()}
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
            <div style={{ ...TYPE.h4 }}>
              {confirmDelete.kind === 'task' ? 'Delete this task?' : confirmDelete.kind === 'list' ? 'Delete this list?' : 'Delete this note?'}
            </div>
            <div style={{ ...TYPE.small, marginTop: '7px', lineHeight: 1.6 }}>
              {confirmDelete.kind === 'task' && <>“{confirmDelete.item.title || 'Untitled task'}” will be removed from every device. This can’t be undone.</>}
              {confirmDelete.kind === 'list' && <>“{confirmDelete.item.name}” and <strong>all tasks inside it</strong> will be removed from every device. This can’t be undone.</>}
              {confirmDelete.kind === 'note' && <>“{confirmDelete.item.title || 'Untitled note'}” will be removed from every device. This can’t be undone.</>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '16px' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                padding: '9px 15px', borderRadius: '9px', border: '1px solid var(--br)',
                background: 'var(--cd)', color: 'var(--t1)', fontSize: '12.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={confirmDeleteNow} style={{
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
