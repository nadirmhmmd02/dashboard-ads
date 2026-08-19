'use client';

import { useState, useMemo } from 'react';
import {
  ListTodo, Sun, Star, CalendarDays, Inbox, Circle, CircleCheck, Plus,
  ChevronRight, Check, X, Pencil, Trash2, CircleAlert,
} from 'lucide-react';
import Dropdown from './Dropdown';
import { TYPE } from './typography';
import { TODO_LIST_COLORS, todayStr, dueLabel, isOverdue } from './useTodos';

/* ─────────────────────────────────────────────────────────────
   TODO PANEL — daftar tugas ala Microsoft To Do, menempel di bagian
   bawah kolom daftar catatan (halaman Notes). Tampilan (view):
   My Day · Important · Planned · Tasks (bawaan) · daftar kustom.
   Klik tugas → detailnya tampil di panel kanan (TodoDetail).
   ───────────────────────────────────────────────────────────── */

export const BUILTIN_VIEWS = [
  { id: 'myday',     label: 'My Day',    Icon: Sun },
  { id: 'important', label: 'Important', Icon: Star },
  { id: 'planned',   label: 'Planned',   Icon: CalendarDays },
  { id: 'tasks',     label: 'Tasks',     Icon: Inbox },
];
export const listViewId = (id) => `list:${id}`;
export const listIdOfView = (view) => (view?.startsWith('list:') ? view.slice(5) : null);

export function viewMeta(view, lists) {
  const b = BUILTIN_VIEWS.find(v => v.id === view);
  if (b) return { ...b, list: null };
  const l = lists.find(x => listViewId(x.id) === view);
  if (l) return { id: view, label: l.name, Icon: null, color: l.color, list: l };
  return { ...BUILTIN_VIEWS[3], list: null };
}

/* Tugas mana yang masuk view ini (belum termasuk pemisahan selesai/belum) */
export function tasksForView(todos, view) {
  const today = todayStr();
  const lid = listIdOfView(view);
  return (todos || []).filter(t => {
    if (view === 'myday')     return t.my_day_date === today;
    if (view === 'important') return !!t.starred;
    if (view === 'planned')   return !!t.due_date;
    if (view === 'tasks')     return !t.list_id;
    if (lid)                  return t.list_id === lid;
    return true;
  });
}

/* Titik warna sebagai "ikon" opsi dropdown (Dropdown mewarnai teks kalau pakai opt.color) */
function dotIcon(color) {
  return function Dot() {
    return <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color || 'var(--t3)', flexShrink: 0, display: 'inline-block' }} />;
  };
}

export default function TodoPanel({
  td, view, setView, selectedId, onSelect, onRequestDeleteList, isMobile,
}) {
  const { lists, todos, error } = td;
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [listEdit, setListEdit] = useState(null);   // null | { mode:'new'|'rename', id, name, color }

  const meta = viewMeta(view, lists);
  const inView = useMemo(() => tasksForView(todos, view), [todos, view]);
  const open = useMemo(() => {
    const o = inView.filter(t => !t.done);
    if (view === 'planned') return [...o].sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0));
    return o; // urutan load = created_at desc (baru di atas)
  }, [inView, view]);
  const done = useMemo(() => [...inView.filter(t => t.done)].sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')), [inView]);

  async function quickAdd() {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    const lid = listIdOfView(view);
    await td.createTask({
      title,
      listId: lid,
      starred: view === 'important',
      myDay: view === 'myday',
      dueDate: view === 'planned' ? todayStr() : null,
    });
  }

  async function commitListEdit() {
    if (!listEdit) return;
    const name = listEdit.name.trim();
    if (!name) { setListEdit(null); return; }
    if (listEdit.mode === 'new') {
      const l = await td.createList(name, listEdit.color);
      if (l) setView(listViewId(l.id));
    } else {
      await td.updateList(listEdit.id, { name, color: listEdit.color });
    }
    setListEdit(null);
  }

  const viewOptions = [
    ...BUILTIN_VIEWS.map(v => ({ value: v.id, label: v.label, icon: v.Icon })),
    ...lists.map(l => ({ value: listViewId(l.id), label: l.name, icon: dotIcon(l.color) })),
  ];

  const smallBtn = (onClick, title, child, extra = {}) => (
    <button onClick={onClick} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none',
      cursor: 'pointer', color: 'var(--t2)', fontSize: '11.5px', fontWeight: 600, fontFamily: 'inherit',
      padding: '4px 6px', borderRadius: '7px', ...extra,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >{child}</button>
  );

  const ViewIcon = meta.Icon;
  const openCount = open.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Header: judul + pilihan view */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px 6px', flexShrink: 0 }}>
        {listEdit ? (
          /* Editor inline nama + warna daftar (buat baru / ganti nama) */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                autoFocus
                value={listEdit.name}
                onChange={e => setListEdit(le => ({ ...le, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') commitListEdit(); if (e.key === 'Escape') setListEdit(null); }}
                placeholder={listEdit.mode === 'new' ? 'New list name' : 'List name'}
                style={{
                  flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: '8px', border: '1px solid var(--br-strong)',
                  background: 'var(--bg)', color: 'var(--t1)', fontSize: '12px', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button onClick={commitListEdit} title="Save" style={{ display: 'flex', background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><Check size={13} strokeWidth={3} /></button>
              <button onClick={() => setListEdit(null)} title="Cancel" style={{ display: 'flex', background: 'none', color: 'var(--t3)', border: '1px solid var(--br)', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={13} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '2px' }}>
              <span style={{ ...TYPE.caption, marginRight: '2px' }}>Color</span>
              {TODO_LIST_COLORS.map(c => {
                const on = listEdit.color === c;
                return (
                  <button key={c} onClick={() => setListEdit(le => ({ ...le, color: on ? null : c }))} title={c} style={{
                    width: '16px', height: '16px', borderRadius: '50%', background: c, cursor: 'pointer',
                    border: on ? '2px solid var(--t1)' : '2px solid transparent', boxShadow: on ? '0 0 0 2px var(--cd) inset' : 'none', padding: 0,
                  }} />
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <ListTodo size={13} color="var(--t3)" />
            <span style={{ ...TYPE.caption, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--t3)' }}>To Do</span>
            {todos !== null && !error && (
              <span style={{ ...TYPE.caption, color: 'var(--t3)' }}>· {openCount} open</span>
            )}
            <span style={{ flex: 1 }} />
            <Dropdown
              label={meta.label}
              icon={ViewIcon || dotIcon(meta.color)}
              options={viewOptions}
              value={view}
              onSelect={setView}
              align="right"
              minWidth={190}
              buttonStyle={{ padding: '5px 9px', fontSize: '11.5px', borderRadius: '8px', gap: '6px', maxWidth: '170px' }}
              footer={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '0 -4px' }}>
                  {smallBtn(() => setListEdit({ mode: 'new', id: null, name: '', color: TODO_LIST_COLORS[1] }), 'Create a new list', <><Plus size={12} /> New list</>)}
                  {meta.list && smallBtn(() => setListEdit({ mode: 'rename', id: meta.list.id, name: meta.list.name, color: meta.list.color }), 'Rename this list', <><Pencil size={12} /> Rename list</>)}
                  {meta.list && smallBtn(() => onRequestDeleteList(meta.list), 'Delete this list and its tasks', <><Trash2 size={12} /> Delete list</>, { color: '#EF4444' })}
                </div>
              }
            />
          </>
        )}
      </div>

      {/* Quick add */}
      {!error && (
        <div style={{ padding: '0 10px 6px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px',
            background: 'var(--bg)', border: '1px solid var(--br)', borderRadius: '10px',
          }}>
            <Plus size={13} color="var(--t3)" />
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') quickAdd(); }}
              placeholder={`Add a task${meta.list ? ` to ${meta.label}` : view === 'myday' ? ' to My Day' : ''}…`}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '12.5px', color: 'var(--t1)', fontFamily: 'inherit' }}
            />
            {draft.trim() && (
              <button onClick={quickAdd} style={{ display: 'flex', background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)', border: 'none', borderRadius: '6px', padding: '3px', cursor: 'pointer' }}><Check size={11} strokeWidth={3} /></button>
            )}
          </div>
        </div>
      )}

      {/* Daftar tugas */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {error?.missing && (
          <div style={{ ...TYPE.caption, padding: '8px 6px', lineHeight: 1.6, display: 'flex', gap: '7px' }}>
            <CircleAlert size={13} color="var(--t3)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>To Do is not set up yet — run <strong>supabase-todo-setup.sql</strong> once in the Supabase SQL Editor, then refresh this page.</span>
          </div>
        )}
        {error && !error.missing && (
          <div style={{ ...TYPE.caption, padding: '8px 6px', color: '#EF4444', lineHeight: 1.5 }}>{error.message}</div>
        )}
        {!error && todos === null && <div style={{ ...TYPE.caption, padding: '8px 6px' }}>Loading…</div>}
        {!error && todos !== null && open.length === 0 && done.length === 0 && (
          <div style={{ ...TYPE.caption, padding: '10px 6px', lineHeight: 1.6 }}>
            {view === 'myday' ? 'My Day is empty — add what you want to focus on today.' : 'No tasks here yet.'}
          </div>
        )}
        {open.map(t => <TaskRow key={t.id} t={t} td={td} view={view} isSel={t.id === selectedId} onSelect={onSelect} />)}
        {done.length > 0 && (
          <>
            <button onClick={() => setShowDone(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 6px 4px', color: 'var(--t3)', fontFamily: 'inherit', ...TYPE.caption, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
            }}>
              <ChevronRight size={11} style={{ transform: showDone ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }} />
              Completed <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none' }}>({done.length})</span>
            </button>
            {showDone && done.map(t => <TaskRow key={t.id} t={t} td={td} view={view} isSel={t.id === selectedId} onSelect={onSelect} />)}
          </>
        )}
      </div>
    </div>
  );
}

/* Baris tugas — di level modul supaya tidak di-remount tiap render panel */
function TaskRow({ t, td, view, isSel, onSelect }) {
    const steps = t.steps || [];
    const stepsDone = steps.filter(s => s.done).length;
    const inMyDay = t.my_day_date === todayStr();
    const overdue = !t.done && isOverdue(t.due_date);
    const dueIsToday = t.due_date === todayStr();
    const hasMeta = (inMyDay && view !== 'myday') || t.due_date || steps.length > 0;
    return (
      <div
        onClick={() => onSelect(t.id)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '8px',
          padding: '8px 9px', borderRadius: '11px', cursor: 'pointer',
          background: isSel ? 'var(--hover)' : 'transparent',
          border: `1px solid ${isSel ? 'var(--br)' : 'transparent'}`,
          transition: 'background 0.12s',
          animation: 'wdFadeUp 0.25s cubic-bezier(0.4,0,0.2,1) backwards',
        }}
        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--hover)'; }}
        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
      >
        <button
          onClick={e => { e.stopPropagation(); td.toggleDone(t); }}
          title={t.done ? 'Mark as not done' : 'Mark as done'}
          style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: '1px', marginTop: '1px', color: t.done ? 'var(--ac)' : 'var(--t3)', flexShrink: 0, transition: 'color 0.15s, transform 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {t.done ? <CircleCheck size={16} /> : <Circle size={16} />}
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{
            ...TYPE.small, fontWeight: 600, color: t.done ? 'var(--t3)' : 'var(--t1)',
            textDecoration: t.done ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{t.title || 'Untitled task'}</span>
          {hasMeta && (
            <span style={{ ...TYPE.caption, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {inMyDay && view !== 'myday' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Sun size={10} /> My Day</span>
              )}
              {t.due_date && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  color: overdue ? '#EF4444' : dueIsToday ? 'var(--ac)' : 'inherit', fontWeight: overdue || dueIsToday ? 700 : 500,
                }}><CalendarDays size={10} /> {dueLabel(t.due_date)}</span>
              )}
              {steps.length > 0 && <span>{stepsDone}/{steps.length} steps</span>}
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); td.toggleStar(t); }}
          title={t.starred ? 'Remove importance' : 'Mark as important'}
          style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginTop: '1px', color: t.starred ? 'var(--ac)' : 'var(--t3)', flexShrink: 0 }}
        ><Star size={13} fill={t.starred ? 'currentColor' : 'none'} /></button>
      </div>
    );
  }
