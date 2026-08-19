'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';

/* ─────────────────────────────────────────────────────────────
   useTodos — lapisan data To-Do (halaman Notes, admin).
   Tabel Supabase: todo_lists + todos (lihat supabase-todo-setup.sql).
   Semua update OPTIMISTIK (layar berubah dulu, DB menyusul); field teks
   (title/notes) di-debounce 600ms per tugas supaya tidak spam request.
   Kalau tabel belum dibuat → error.missing = true (UI tampilkan hint SQL).
   ───────────────────────────────────────────────────────────── */

export const TODO_LIST_COLORS = ['#2FB673', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];
const TEXT_DEBOUNCE_MS = 600;

/* Tanggal lokal yyyy-mm-dd (BUKAN toISOString — itu UTC, bisa geser sehari) */
export function toDateStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function todayStr() { return toDateStr(new Date()); }
export function addDays(n, from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + n); return toDateStr(d); }
export function parseDateStr(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

/* Label tanggal ala To Do: Today / Tomorrow / Yesterday / "12 Aug" (+ tahun kalau beda) */
export function dueLabel(s) {
  if (!s) return '';
  const today = todayStr();
  if (s === today) return 'Today';
  if (s === addDays(1)) return 'Tomorrow';
  if (s === addDays(-1)) return 'Yesterday';
  const d = parseDateStr(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}
export function isOverdue(s) { return !!s && s < todayStr(); }

function missingTable(err) {
  return err && (err.code === 'PGRST205' || err.code === '42P01'
    || /could not find the table|does not exist/i.test(err.message || ''));
}

export default function useTodos(enabled) {
  const [lists, setLists] = useState([]);
  const [todos, setTodos] = useState(null);      // null = loading
  const [error, setError] = useState(null);      // { missing, message }
  const timers = useRef({});                      // id → timeout (debounce teks)

  const load = useCallback(async () => {
    const [{ data: l, error: le }, { data: t, error: te }] = await Promise.all([
      supabase.from('todo_lists').select('id,name,color,sort_order,created_at').order('sort_order', { ascending: true, nullsFirst: false }).order('created_at'),
      supabase.from('todos').select('id,list_id,title,notes,done,done_at,starred,due_date,my_day_date,steps,sort_order,created_at,updated_at').order('created_at', { ascending: false }),
    ]);
    const err = le || te;
    if (err) {
      setError({ missing: missingTable(err), message: err.message });
      setLists([]); setTodos([]);
      return;
    }
    setError(null);
    setLists(l || []);
    setTodos(t || []);
  }, []);

  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const fail = (err) => { if (err) setError({ missing: missingTable(err), message: err.message }); };

  /* ── Tugas ── */
  async function createTask({ title, listId = null, starred = false, myDay = false, dueDate = null }) {
    const row = {
      title: title.trim(), list_id: listId, starred,
      my_day_date: myDay ? todayStr() : null, due_date: dueDate,
    };
    const { data, error: err } = await supabase.from('todos').insert(row)
      .select('id,list_id,title,notes,done,done_at,starred,due_date,my_day_date,steps,sort_order,created_at,updated_at').single();
    if (err) { fail(err); return null; }
    setTodos(prev => [data, ...(prev || [])]);
    return data;
  }

  /* patch langsung ke layar; ke DB: segera (default) atau debounce (teks) */
  function updateTask(id, patch, { debounce = false } = {}) {
    setTodos(prev => (prev || []).map(t => (t.id === id ? { ...t, ...patch } : t)));
    const send = async () => {
      const { error: err } = await supabase.from('todos').update(patch).eq('id', id);
      fail(err);
    };
    if (!debounce) { send(); return; }
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(send, TEXT_DEBOUNCE_MS);
  }

  const toggleDone  = (t) => updateTask(t.id, { done: !t.done, done_at: !t.done ? new Date().toISOString() : null });
  const toggleStar  = (t) => updateTask(t.id, { starred: !t.starred });
  const toggleMyDay = (t) => updateTask(t.id, { my_day_date: t.my_day_date === todayStr() ? null : todayStr() });
  const setDue      = (t, date) => updateTask(t.id, { due_date: date || null });
  const moveToList  = (t, listId) => updateTask(t.id, { list_id: listId || null });

  async function removeTask(id) {
    setTodos(prev => (prev || []).filter(t => t.id !== id));
    const { error: err } = await supabase.from('todos').delete().eq('id', id);
    fail(err);
  }

  /* ── Steps (sub-tugas) — disimpan sebagai JSON di kolom steps ── */
  const setSteps = (t, steps) => updateTask(t.id, { steps });
  const addStep    = (t, title) => setSteps(t, [...(t.steps || []), { id: crypto.randomUUID(), title: title.trim(), done: false }]);
  const toggleStep = (t, sid)   => setSteps(t, (t.steps || []).map(s => (s.id === sid ? { ...s, done: !s.done } : s)));
  const renameStep = (t, sid, title) => updateTask(t.id, { steps: (t.steps || []).map(s => (s.id === sid ? { ...s, title } : s)) }, { debounce: true });
  const removeStep = (t, sid)   => setSteps(t, (t.steps || []).filter(s => s.id !== sid));

  /* ── Daftar kustom ── */
  async function createList(name, color = null) {
    const { data, error: err } = await supabase.from('todo_lists')
      .insert({ name: name.trim() || 'Untitled list', color, sort_order: lists.length })
      .select('id,name,color,sort_order,created_at').single();
    if (err) { fail(err); return null; }
    setLists(prev => [...prev, data]);
    return data;
  }
  async function updateList(id, patch) {
    setLists(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
    const { error: err } = await supabase.from('todo_lists').update(patch).eq('id', id);
    fail(err);
  }
  async function removeList(id) {
    // tugas di dalamnya ikut terhapus (on delete cascade) — cerminkan di layar
    setLists(prev => prev.filter(l => l.id !== id));
    setTodos(prev => (prev || []).filter(t => t.list_id !== id));
    const { error: err } = await supabase.from('todo_lists').delete().eq('id', id);
    fail(err);
  }

  return {
    lists, todos, error, reload: load,
    createTask, updateTask, toggleDone, toggleStar, toggleMyDay, setDue, moveToList, removeTask,
    addStep, toggleStep, renameStep, removeStep,
    createList, updateList, removeList,
  };
}
