'use client';

import { useState, useEffect } from 'react';
import { X, Send, Trash2, MessageSquare, CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'willofd_suggestions';

export default function SuggestionsModal({ isOpen, onClose, isAdmin, user }) {
  const [suggestions, setSuggestions] = useState([]);
  const [text, setText] = useState('');
  const [success, setSuccess] = useState(false);

  // Load from local storage when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setSuggestions(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse suggestions', e);
      }
      setSuccess(false);
      setText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;

    const newSuggestion = {
      id: Date.now().toString(),
      text: text.trim(),
      date: new Date().toISOString(),
      author: user?.username || 'user',
    };

    const updated = [newSuggestion, ...suggestions];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSuggestions(updated);
    setText('');
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1500);
  }

  function handleDelete(id) {
    const updated = suggestions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSuggestions(updated);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(3px)',
      animation: 'wdFadeUp 0.2s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div style={{
        background: 'var(--cd)',
        border: '1px solid var(--br)',
        borderRadius: '16px',
        width: '90%',
        maxWidth: isAdmin ? '500px' : '400px',
        maxHeight: '80vh',
        boxShadow: 'var(--shadow)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--br)',
          background: 'var(--sf)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={18} color="var(--t2)" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t1)' }}>
              {isAdmin ? 'User Suggestions' : 'Send a Suggestion'}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--t3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px', borderRadius: '6px', transition: 'background 0.15s, color 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--t1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--t3)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {isAdmin ? (
            // ADMIN VIEW
            suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '13px', padding: '20px 0' }}>
                No suggestions yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {suggestions.map(s => (
                  <div key={s.id} style={{
                    padding: '14px', borderRadius: '10px',
                    border: '1px solid var(--br)', background: 'var(--data-bg)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)', textTransform: 'capitalize' }}>
                        {s.author}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--t3)' }}>
                          {new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button onClick={() => handleDelete(s.id)} title="Delete" style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444',
                          display: 'flex', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--t1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {s.text}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // USER VIEW
            success ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 0', gap: '12px' }}>
                <CheckCircle2 size={40} color="#10B981" />
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--t1)' }}>Suggestion sent!</div>
                <div style={{ fontSize: '13px', color: 'var(--t2)' }}>Thank you for your feedback.</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.5 }}>
                  Have an idea for a new feature or found something that could be improved? Let us know!
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Describe your suggestion here..."
                  style={{
                    width: '100%', minHeight: '120px', padding: '12px',
                    borderRadius: '10px', border: '1px solid var(--br)',
                    background: 'var(--data-bg)', color: 'var(--t1)', fontSize: '13px',
                    fontFamily: 'inherit', resize: 'vertical', outline: 'none'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--cal-accent-line)'}
                  onBlur={e => e.target.style.borderColor = 'var(--br)'}
                />
                <button type="submit" disabled={!text.trim()} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '10px 16px', borderRadius: '9px', border: 'none',
                  background: text.trim() ? 'var(--cal-accent)' : 'var(--hover)',
                  color: text.trim() ? 'var(--cal-accent-fg)' : 'var(--t3)',
                  fontSize: '13px', fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default',
                  transition: 'background 0.15s, color 0.15s'
                }}>
                  <Send size={15} />
                  Submit
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
