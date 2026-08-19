'use client';

import { useState } from 'react';
import {
  Circle, CircleCheck, Star, Sun, CalendarDays, Inbox, Plus, X, Trash2, ChevronLeft,
} from 'lucide-react';
import Dropdown from './Dropdown';
import { TYPE } from './typography';
import { todayStr, addDays, dueLabel, isOverdue } from './useTodos';

/* ─────────────────────────────────────────────────────────────
   TODO DETAIL — panel kanan saat sebuah tugas dipilih (menggantikan
   editor catatan). Isi ala Microsoft To Do: judul + selesai + bintang,
   Steps (sub-tugas), Add to My Day, Due date, pindah List, catatan,
   footer created + hapus.
   ───────────────────────────────────────────────────────────── */

function dotIcon(color) {
  return function Dot() {
    return <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color || 'var(--t3)', flexShrink: 0, display: 'inline-block' }} />;
  };
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TodoDetail({ task: t, td, onRequestDelete, isMobile, onBack }) {
  const [stepDraft, setStepDraft] = useState('');
  const [pickDate, setPickDate] = useState(false);

  const steps = t.steps || [];
  const inMyDay = t.my_day_date === todayStr();
  const overdue = !t.done && isOverdue(t.due_date);
  const list = t.list_id ? td.lists.find(l => l.id === t.list_id) : null;

  function addStep() {
    const s = stepDraft.trim();
    if (!s) return;
    td.addStep(t, s);
    setStepDraft('');
  }

  const dueOptions = [
    { value: todayStr(),  label: 'Today',     hint: new Date().toLocaleDateString('en-GB', { weekday: 'short' }) },
    { value: addDays(1),  label: 'Tomorrow',  hint: new Date(Date.now() + 864e5).toLocaleDateString('en-GB', { weekday: 'short' }) },
    { value: addDays(7),  label: 'Next week', hint: dueLabel(addDays(7)) },
    { value: '__pick',    label: 'Pick a date…' },
    ...(t.due_date ? [{ value: '__none', label: 'Remove due date', color: '#EF4444' }] : []),
  ];
  const listOptions = [
    { value: '', label: 'Tasks', icon: Inbox },
    ...td.lists.map(l => ({ value: l.id, label: l.name, icon: dotIcon(l.color) })),
  ];

  /* Baris aksi ala To Do (ikon + label; aktif = warna aksen) */
  const actionRow = (Icon, label, { on = false, onClick, right = null, key } = {}) => (
    <div key={key} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px',
      borderRadius: '10px', cursor: onClick ? 'pointer' : 'default',
      color: on ? 'var(--ac)' : 'var(--t2)', fontSize: '13px', fontWeight: 600,
      transition: 'background 0.12s',
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {right}
    </div>
  );

  const xBtn = (onClick, title) => (
    <button onClick={e => { e.stopPropagation(); onClick(); }} title={title} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: 'var(--t3)', borderRadius: '6px' }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--t1)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)'; }}
    ><X size={13} /></button>
  );

  return (
    <>
      {/* Header: selesai + judul + bintang */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', borderBottom: '1px solid var(--br)' }}>
        {isMobile && onBack && (
          <button onClick={onBack} title="Back" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', padding: '2px' }}><ChevronLeft size={18} /></button>
        )}
        <button onClick={() => td.toggleDone(t)} title={t.done ? 'Mark as not done' : 'Mark as done'}
          style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.done ? 'var(--ac)' : 'var(--t3)', flexShrink: 0 }}>
          {t.done ? <CircleCheck size={21} /> : <Circle size={21} />}
        </button>
        <input
          value={t.title}
          onChange={e => td.updateTask(t.id, { title: e.target.value }, { debounce: true })}
          placeholder="Task title"
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            ...TYPE.h4, color: t.done ? 'var(--t3)' : 'var(--t1)', fontFamily: 'inherit',
            textDecoration: t.done ? 'line-through' : 'none',
          }}
        />
        <button onClick={() => td.toggleStar(t)} title={t.starred ? 'Remove importance' : 'Mark as important'}
          style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: t.starred ? 'var(--ac)' : 'var(--t3)', flexShrink: 0 }}>
          <Star size={17} fill={t.starred ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {steps.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 12px', borderRadius: '9px' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <button onClick={() => td.toggleStep(t, s.id)} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: s.done ? 'var(--ac)' : 'var(--t3)', flexShrink: 0 }}>
                {s.done ? <CircleCheck size={15} /> : <Circle size={15} />}
              </button>
              <input
                value={s.title}
                onChange={e => td.renameStep(t, s.id, e.target.value)}
                style={{
                  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit',
                  fontSize: '13px', color: s.done ? 'var(--t3)' : 'var(--t1)', textDecoration: s.done ? 'line-through' : 'none',
                }}
              />
              {xBtn(() => td.removeStep(t, s.id), 'Remove step')}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 12px' }}>
            <Plus size={15} color="var(--ac)" style={{ flexShrink: 0 }} />
            <input
              value={stepDraft}
              onChange={e => setStepDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addStep(); }}
              placeholder={steps.length ? 'Next step' : 'Add step'}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '13px', color: 'var(--t1)' }}
            />
          </div>
          {steps.length > 0 && (
            <div style={{ ...TYPE.caption, padding: '0 12px' }}>{steps.filter(s => s.done).length} of {steps.length} steps done</div>
          )}
        </div>

        {/* Aksi: My Day · Due date · List */}
        <div style={{ border: '1px solid var(--br)', borderRadius: '12px', padding: '4px', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          {actionRow(Sun, inMyDay ? 'Added to My Day' : 'Add to My Day', {
            key: 'myday', on: inMyDay, onClick: () => td.toggleMyDay(t),
            right: inMyDay ? xBtn(() => td.toggleMyDay(t), 'Remove from My Day') : null,
          })}
          <div style={{ height: '1px', background: 'var(--br)', margin: '0 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Dropdown
                label={t.due_date ? `Due ${dueLabel(t.due_date)}` : 'Add due date'}
                icon={CalendarDays}
                options={dueOptions}
                value={t.due_date || undefined}
                onSelect={(v) => {
                  if (v === '__pick') { setPickDate(true); return; }
                  if (v === '__none') { td.setDue(t, null); setPickDate(false); return; }
                  td.setDue(t, v); setPickDate(false);
                }}
                minWidth={200}
                showCheck
                block
                buttonStyle={{
                  border: 'none', background: 'transparent', width: '100%', padding: '11px 12px', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 600, color: overdue ? '#EF4444' : t.due_date ? 'var(--ac)' : 'var(--t2)', justifyContent: 'flex-start', gap: '10px',
                }}
              />
            </div>
            {t.due_date && xBtn(() => { td.setDue(t, null); setPickDate(false); }, 'Remove due date')}
          </div>
          {pickDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px 10px 37px' }}>
              <input
                type="date"
                autoFocus
                value={t.due_date || ''}
                onChange={e => { if (e.target.value) td.setDue(t, e.target.value); }}
                style={{ padding: '6px 9px', borderRadius: '8px', border: '1px solid var(--br)', background: 'var(--cd)', color: 'var(--t1)', fontFamily: 'inherit', fontSize: '12.5px', outline: 'none' }}
              />
              <button onClick={() => setPickDate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: '12px', fontFamily: 'inherit', fontWeight: 600 }}>Done</button>
            </div>
          )}
          <div style={{ height: '1px', background: 'var(--br)', margin: '0 10px' }} />
          <Dropdown
            label={list ? list.name : 'Tasks'}
            icon={list ? dotIcon(list.color) : Inbox}
            options={listOptions}
            value={t.list_id || ''}
            onSelect={(v) => td.moveToList(t, v || null)}
            minWidth={200}
            block
            title="Move to list"
            buttonStyle={{
              border: 'none', background: 'transparent', width: '100%', padding: '11px 12px', borderRadius: '10px',
              fontSize: '13px', fontWeight: 600, color: 'var(--t2)', justifyContent: 'flex-start', gap: '10px',
            }}
          />
        </div>

        {/* Catatan tugas */}
        <textarea
          value={t.notes || ''}
          onChange={e => td.updateTask(t.id, { notes: e.target.value }, { debounce: true })}
          placeholder="Add note"
          rows={5}
          style={{
            width: '100%', resize: 'vertical', minHeight: '96px', padding: '11px 12px', borderRadius: '12px',
            border: '1px solid var(--br)', background: 'var(--bg)', color: 'var(--t1)', fontFamily: 'inherit',
            fontSize: '13px', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--br-strong)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--br)'; }}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderTop: '1px solid var(--br)' }}>
        <span style={{ ...TYPE.caption, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t.done && t.done_at ? `Completed ${fmtDate(t.done_at)}` : `Created ${fmtDate(t.created_at)}`}
        </span>
        <button onClick={() => onRequestDelete(t)} title="Delete task" style={{
          display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--t3)', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', padding: '5px 8px', borderRadius: '8px',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)'; e.currentTarget.style.background = 'transparent'; }}
        ><Trash2 size={13} /> Delete</button>
      </div>
    </>
  );
}
