'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../components/AuthContext';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const OBJ_ORDER = ['Awareness','Traffic','Conversion'];
const OBJ_STYLE = {
  Awareness: { bg:'rgba(91,127,212,0.14)', color:'#5b8fd4', bar:'rgba(91,127,212,0.7)' },
  Traffic:   { bg:'rgba(245,158,11,0.14)',  color:'#f59e0b', bar:'rgba(245,158,11,0.75)' },
  Conversion:{ bg:'rgba(16,185,129,0.14)',  color:'#10b981', bar:'rgba(16,185,129,0.7)' },
};

function daysInMonth(y,m){ return new Date(y,m+1,0).getDate() }
function isActive(c,y,m,d){ if(!c.mulai||!c.selesai)return false; const s=new Date(c.mulai),e=new Date(c.selesai),cur=new Date(y,m,d); return cur>=s&&cur<=e }
function hasActivity(c,y,m){ if(!c.mulai||!c.selesai)return false; const s=new Date(c.mulai),e=new Date(c.selesai),ms=new Date(y,m,1),me=new Date(y,m+1,0); return s<=me&&e>=ms }
function budgetForMonth(c,y,m){ const days=daysInMonth(y,m); let t=0; for(let d=1;d<=days;d++){ if(isActive(c,y,m,d))t++ } return t*(c.bh||0) }
function fmtRp(v){ if(!v)return'—'; if(v>=1000000)return'Rp '+(v/1000000).toFixed(1).replace('.0','')+' jt'; return'Rp '+(v/1000).toFixed(0)+'rb' }

const emptyForm = { name:'', obj:'Awareness', konten:'', bh:'', mulai:'', selesai:'', status:'Draft' };

export default function CalendarPage() {
  const { isAdmin } = useAuth();
  const now = new Date();
  const [year, setYear]         = useState(now.getFullYear());
  const [month, setMonth]       = useState(now.getMonth());
  const [showModal, setShowModal]       = useState(false);
  const [campaigns, setCampaigns]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [form, setForm]                 = useState(emptyForm);
  const [editId, setEditId]             = useState(null);
  const [tableKey, setTableKey]         = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const days  = daysInMonth(year, month);
  const sorted = [...campaigns]
    .filter(c => hasActivity(c, year, month))
    .sort((a,b) => OBJ_ORDER.indexOf(a.obj) - OBJ_ORDER.indexOf(b.obj));

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from('campaigns').select('*').order('created_at', { ascending: true });
    if (err) setError(err.message);
    else setCampaigns(data || []);
    setLoading(false);
  }

  function prevMonth() {
    setTableKey(k => k+1);
    if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1);
  }
  function nextMonth() {
    setTableKey(k => k+1);
    if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1);
  }

  function openAdd()  { setForm(emptyForm); setEditId(null); setShowModal(true); }
  function openEdit(c) {
    setForm({ name:c.name, obj:c.obj, konten:c.konten||'', bh:c.bh||'', mulai:c.mulai||'', selesai:c.selesai||'', status:c.status });
    setEditId(c.id); setShowModal(true);
  }

  async function handleSave() {
    if (!form.name) return;
    const payload = { name:form.name, obj:form.obj, konten:form.konten, bh:parseInt(form.bh)||0, mulai:form.mulai||null, selesai:form.selesai||null, status:form.status };
    if (editId) { await supabase.from('campaigns').update(payload).eq('id', editId); }
    else         { await supabase.from('campaigns').insert([payload]); }
    setShowModal(false); setForm(emptyForm); setEditId(null);
    loadCampaigns();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this campaign?')) return;
    await supabase.from('campaigns').delete().eq('id', id);
    loadCampaigns();
  }

  const reminders = campaigns.filter(c => {
    if (!c.mulai) return false;
    const s = new Date(c.mulai), now2 = new Date(today.y, today.m, today.d);
    const diff = (s - now2) / 86400000;
    return diff >= 0 && diff <= 3;
  });

  const totalBudget  = sorted.reduce((sum,c) => sum + budgetForMonth(c,year,month), 0);
  const budgetByObj  = OBJ_ORDER.reduce((acc,o) => {
    acc[o] = sorted.filter(c => c.obj===o).reduce((s,c) => s + budgetForMonth(c,year,month), 0);
    return acc;
  }, {});

  const inp = {
    width:'100%', padding:'8px 12px', fontSize:'13px',
    border:'1px solid var(--br)', borderRadius:'8px',
    background:'var(--sf)', color:'var(--t1)',
    fontFamily:'inherit', outline:'none',
    transition:'border-color 0.2s',
  };

  const thBase = {
    padding:'9px 6px', fontSize:'10px', fontWeight:'600',
    color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px',
    background:'var(--sf)', whiteSpace:'nowrap',
  };

  return (
    <div style={{ padding:'18px 20px', flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', gap:'14px' }}>

      {/* Error banner */}
      {error && (
        <div style={{ padding:'12px 16px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'10px', color:'#ef4444', fontSize:'13px' }}>
          ⚠️ Gagal load data: {error}
        </div>
      )}

      {/* Reminder banner */}
      {reminders.length > 0 && (
        <div style={{
          display:'flex', alignItems:'center', gap:'8px',
          padding:'10px 16px',
          background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)',
          borderRadius:'10px', fontSize:'12px', color:'var(--t2)',
          animation:'wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}>
          🔔 <span><strong style={{color:'var(--ac)'}}>{reminders.length} campaign{reminders.length>1?'s':''}</strong> starting within 3 days — <strong>{reminders[0].name}</strong></span>
        </div>
      )}

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button onClick={prevMonth} style={{
            width:'32px', height:'32px', borderRadius:'8px',
            border:'1px solid var(--br)', background:'var(--cd)',
            cursor:'pointer', color:'var(--t1)', fontSize:'16px',
            transition:'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor='var(--ac)'}
          onMouseLeave={e => e.currentTarget.style.borderColor='var(--br)'}
          >‹</button>

          <span style={{ fontSize:'16px', fontWeight:'500', color:'var(--t1)', minWidth:'160px', textAlign:'center' }}>
            {MONTHS[month]} {year}
          </span>

          <button onClick={nextMonth} style={{
            width:'32px', height:'32px', borderRadius:'8px',
            border:'1px solid var(--br)', background:'var(--cd)',
            cursor:'pointer', color:'var(--t1)', fontSize:'16px',
            transition:'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor='var(--ac)'}
          onMouseLeave={e => e.currentTarget.style.borderColor='var(--br)'}
          >›</button>

          {/* Legend */}
          <div style={{ display:'flex', gap:'12px', marginLeft:'12px' }}>
            {OBJ_ORDER.map(o => (
              <span key={o} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'var(--t3)' }}>
                <span style={{ width:'8px', height:'8px', borderRadius:'2px', background:OBJ_STYLE[o].bar, display:'inline-block' }}/>
                {o}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:'8px' }}>
          <button style={{
            display:'flex', alignItems:'center', gap:'6px',
            padding:'7px 14px', fontSize:'13px',
            border:'1px solid var(--br)', borderRadius:'8px',
            background:'var(--cd)', color:'var(--t2)', cursor:'pointer',
            transition:'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='var(--t1)'; e.currentTarget.style.borderColor='var(--t2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='var(--t2)'; e.currentTarget.style.borderColor='var(--br)'; }}
          >↓ Export</button>

          {isAdmin && (
            <button onClick={openAdd} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'7px 16px', fontSize:'13px',
              border:'none', borderRadius:'8px',
              background:'var(--ac)', color:'#fff', cursor:'pointer', fontWeight:'500',
              transition:'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity='1'}
            >+ Add Campaign</button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'48px', color:'var(--t3)', fontSize:'13px' }}>Loading...</div>
      ) : (
        <div
          key={tableKey}
          style={{
            border:'1px solid var(--br)', borderRadius:'10px', overflow:'hidden',
            animation:'wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', width:'100%', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:'16%' }}/>
                <col style={{ width:'8%' }}/>
                <col style={{ width:'8%' }}/>
                <col style={{ width:'6%' }}/>
                <col style={{ width:'5%' }}/>
                <col style={{ width:'5%' }}/>
                <col style={{ width:'6%' }}/>
                <col style={{ width:'6%' }}/>
                <col style={{ width:'6%' }}/>
                {Array.from({ length:days }).map((_,i) => (
                  <col key={i} style={{ width:`${(34/days)}%` }}/>
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thBase, textAlign:'left', position:'sticky', left:0, background:'var(--sf)', zIndex:2 }}>Campaign</th>
                  <th style={{ ...thBase, textAlign:'left' }}>Objective</th>
                  <th style={{ ...thBase, textAlign:'left' }}>Ad Content</th>
                  <th style={{ ...thBase, textAlign:'right' }}>Bgt/Day</th>
                  <th style={{ ...thBase, textAlign:'right' }}>Start</th>
                  <th style={{ ...thBase, textAlign:'right' }}>End</th>
                  <th style={{ ...thBase, textAlign:'right' }}>Total Bgt</th>
                  <th style={{ ...thBase, textAlign:'left' }}>Status</th>
                  {isAdmin && <th style={{ ...thBase, textAlign:'left' }}>Action</th>}
                  {Array.from({ length:days }, (_,i) => i+1).map(d => {
                    const isToday = year===today.y && month===today.m && d===today.d;
                    return (
                      <th key={d} style={{
                        ...thBase, textAlign:'center', padding:'9px 0',
                        fontWeight: isToday ? '700' : '500',
                        color: isToday ? 'var(--ac)' : 'var(--t3)',
                      }}>{d}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={9+days} style={{ textAlign:'center', padding:'40px', color:'var(--t3)', fontSize:'13px' }}>
                    No campaigns this month.
                  </td></tr>
                ) : sorted.map((c, rowIdx) => {
                  const bt = budgetForMonth(c, year, month);
                  const st = c.status;
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderTop:'1px solid var(--br)',
                        transition:'background 0.15s',
                        animation:`wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1) backwards`,
                        animationDelay: `${rowIdx * 0.04}s`,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >
                      <td style={{ padding:'8px', fontSize:'12px', fontWeight:'500', color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', position:'sticky', left:0, background:'var(--cd)', zIndex:1 }}>{c.name}</td>
                      <td style={{ padding:'6px' }}>
                        <span style={{ padding:'2px 7px', borderRadius:'20px', fontSize:'9px', fontWeight:'600', background:OBJ_STYLE[c.obj]?.bg, color:OBJ_STYLE[c.obj]?.color, whiteSpace:'nowrap' }}>{c.obj}</span>
                      </td>
                      <td style={{ padding:'6px', fontSize:'11px', color:'var(--t2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'0' }}>{c.konten || '—'}</td>
                      <td style={{ padding:'6px', fontSize:'11px', color:'var(--t2)', textAlign:'right', whiteSpace:'nowrap' }}>{c.bh ? fmtRp(c.bh) : '—'}</td>
                      <td style={{ padding:'6px', fontSize:'11px', color:'var(--t2)', textAlign:'right', whiteSpace:'nowrap' }}>{c.mulai ? new Date(c.mulai).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'}</td>
                      <td style={{ padding:'6px', fontSize:'11px', color:'var(--t2)', textAlign:'right', whiteSpace:'nowrap' }}>{c.selesai ? new Date(c.selesai).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '—'}</td>
                      <td style={{ padding:'6px', fontSize:'11px', fontWeight:'500', color:'var(--t1)', textAlign:'right', whiteSpace:'nowrap' }}>{fmtRp(bt)}</td>
                      <td style={{ padding:'6px' }}>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:'3px',
                          padding:'2px 7px', borderRadius:'20px', fontSize:'9px', fontWeight:'600',
                          background: st==='Running' ? 'rgba(16,185,129,0.14)' : st==='Done' ? 'rgba(115,115,115,0.12)' : 'rgba(245,158,11,0.12)',
                          color: st==='Running' ? '#10b981' : st==='Done' ? 'var(--t3)' : '#f59e0b',
                          whiteSpace:'nowrap',
                        }}>
                          {st==='Running' ? '▶' : st==='Done' ? '✓' : '✏'} {st}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding:'6px 4px', whiteSpace:'nowrap' }}>
                          <button
                            onClick={() => openEdit(c)}
                            style={{ fontSize:'10px', padding:'3px 7px', borderRadius:'6px', border:'1px solid var(--br)', background:'transparent', color:'var(--t2)', cursor:'pointer', marginRight:'3px', transition:'border-color 0.15s, color 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--t2)'; e.currentTarget.style.color='var(--t1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--br)'; e.currentTarget.style.color='var(--t2)'; }}
                          >✏</button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            style={{ fontSize:'10px', padding:'3px 7px', borderRadius:'6px', border:'1px solid rgba(239,68,68,0.25)', background:'transparent', color:'#ef4444', cursor:'pointer', transition:'border-color 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor='rgba(239,68,68,0.6)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor='rgba(239,68,68,0.25)'}
                          >🗑</button>
                        </td>
                      )}
                      {Array.from({ length:days }, (_,i) => i+1).map((d, di) => {
                        const isToday = year===today.y && month===today.m && d===today.d;
                        const active  = isActive(c, year, month, d);
                        const prev    = isActive(c, year, month, d-1);
                        const next    = isActive(c, year, month, d+1);
                        const radius  = !prev && !next ? '3px' : !prev ? '3px 0 0 3px' : !next ? '0 3px 3px 0' : '0';
                        return (
                          <td key={d} style={{
                            padding:'4px 1px', textAlign:'center', verticalAlign:'middle',
                            background: isToday ? 'rgba(245,158,11,0.06)' : 'transparent',
                          }}>
                            {active && (
                              <div style={{
                                height:'13px',
                                background: OBJ_STYLE[c.obj]?.bar,
                                borderRadius: radius,
                                transformOrigin: 'left center',
                                animation: !prev ? `wdGrowX 0.4s cubic-bezier(0.4,0,0.2,1) ${rowIdx*0.04 + di*0.005}s backwards` : 'none',
                              }}/>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget summary footer */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'var(--cd)', border:'1px solid var(--br)',
        borderRadius:'10px', padding:'16px 20px',
        animation:'wdFadeUp 0.4s cubic-bezier(0.4,0,0.2,1) 0.1s backwards',
      }}>
        <div>
          <div style={{ fontSize:'12px', color:'var(--t3)', marginBottom:'4px' }}>
            Total Ad Budget · <span style={{ color:'var(--ac)' }}>{MONTHS[month]} {year}</span>
          </div>
          <div style={{ fontSize:'22px', fontWeight:'500', color:'var(--t1)' }}>{fmtRp(totalBudget)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          {OBJ_ORDER.map((o,i) => (
            <div key={o} style={{
              textAlign:'center',
              paddingLeft: i>0 ? '20px' : 0,
              borderLeft: i>0 ? '1px solid var(--br)' : '',
            }}>
              <div style={{ fontSize:'10px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'3px' }}>{o}</div>
              <div style={{ fontSize:'14px', fontWeight:'500', color: OBJ_STYLE[o].color }}>{budgetByObj[o]>0 ? fmtRp(budgetByObj[o]) : '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign tanpa tanggal */}
      {campaigns.filter(c => !c.mulai || !c.selesai).length > 0 && (
        <div style={{ background:'var(--cd)', border:'1px solid var(--br)', borderRadius:'10px', padding:'14px 16px' }}>
          <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'10px' }}>
            Draft / Belum ada tanggal ({campaigns.filter(c => !c.mulai || !c.selesai).length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            {campaigns.filter(c => !c.mulai || !c.selesai).map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', background:'var(--sf)', borderRadius:'8px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ padding:'2px 7px', borderRadius:'20px', fontSize:'9px', fontWeight:'600', background: OBJ_STYLE[c.obj]?.bg, color: OBJ_STYLE[c.obj]?.color }}>{c.obj}</span>
                  <span style={{ fontSize:'12px', color:'var(--t1)', fontWeight:'500' }}>{c.name}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ fontSize:'11px', color:'var(--t3)' }}>Belum ada tanggal</span>
                  {isAdmin && <button onClick={() => openEdit(c)} style={{ fontSize:'10px', padding:'3px 8px', borderRadius:'6px', border:'1px solid var(--br)', background:'transparent', color:'var(--ac)', cursor:'pointer' }}>Set tanggal</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position:'fixed', inset:0,
          background:'rgba(0,0,0,0.5)', zIndex:50,
          display:'flex', alignItems:'center', justifyContent:'center',
          animation:'wdFadeIn 0.2s ease',
        }}
        onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{
            background:'var(--cd)', borderRadius:'12px', padding:'24px',
            width:'400px', border:'1px solid var(--br)',
            boxShadow:'0 20px 60px rgba(0,0,0,0.4)',
            animation:'wdScaleIn 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <span style={{ fontSize:'15px', fontWeight:'500', color:'var(--t1)' }}>{editId ? 'Edit Campaign' : 'Add Campaign'}</span>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'var(--t3)', lineHeight:1 }}>✕</button>
            </div>

            {/* Campaign Name */}
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'600' }}>Campaign Name</div>
              <input style={inp} type="text" placeholder="Enter campaign name..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
            </div>

            {/* Ad Content — dengan autocomplete */}
            <div style={{ marginBottom:'12px', position:'relative' }}>
              <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'600' }}>Ad Content</div>
              <input
                style={inp}
                type="text"
                placeholder="Instagram post, video, etc..."
                value={form.konten}
                autoComplete="off"
                onChange={e => { setForm(f => ({ ...f, konten: e.target.value })); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              {(() => {
                // Unique values saja, exclude yg sudah persis sama dengan input
                const allKonten = [...new Set(campaigns.map(c => c.konten).filter(Boolean))];
                const filtered = allKonten
                  .filter(k => k.toLowerCase().includes((form.konten || '').toLowerCase()) && k.toLowerCase() !== (form.konten || '').toLowerCase())
                  .slice(0, 5);
                if (!showSuggestions || filtered.length === 0) return null;
                return (
                  <div style={{
                    position:'absolute', top:'100%', left:0, right:0, zIndex:100,
                    background:'var(--cd)', border:'1px solid var(--br)',
                    borderRadius:'8px', marginTop:'4px',
                    boxShadow:'0 8px 24px rgba(0,0,0,0.3)',
                    overflow:'hidden',
                    animation:'wdScaleIn 0.15s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    {filtered.map((k, i) => (
                      <div
                        key={i}
                        onMouseDown={() => { setForm(f => ({ ...f, konten: k })); setShowSuggestions(false); }}
                        style={{
                          padding:'9px 12px', fontSize:'13px', cursor:'pointer',
                          color:'var(--t1)', borderTop: i > 0 ? '1px solid var(--br)' : 'none',
                          transition:'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--sf)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {k}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'600' }}>Objective</div>
                <select style={inp} value={form.obj} onChange={e => setForm(f => ({ ...f, obj:e.target.value }))}>
                  {OBJ_ORDER.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'600' }}>Status</div>
                <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status:e.target.value }))}>
                  {['Draft','Running','Done'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'600' }}>Start Date</div>
                <input style={inp} type="date" value={form.mulai} onChange={e => setForm(f => ({ ...f, mulai:e.target.value }))}/>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'600' }}>End Date</div>
                <input style={inp} type="date" value={form.selesai} onChange={e => setForm(f => ({ ...f, selesai:e.target.value }))}/>
              </div>
            </div>

            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'600' }}>Daily Budget (Rp)</div>
              <input style={inp} type="number" placeholder="100000" value={form.bh} onChange={e => setForm(f => ({ ...f, bh:e.target.value }))}/>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'14px', borderTop:'1px solid var(--br)' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding:'8px 16px', fontSize:'13px', border:'1px solid var(--br)', borderRadius:'8px', background:'transparent', color:'var(--t2)', cursor:'pointer', transition:'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color='var(--t1)'}
                onMouseLeave={e => e.currentTarget.style.color='var(--t2)'}
              >Cancel</button>
              <button
                onClick={handleSave}
                style={{ padding:'8px 20px', fontSize:'13px', border:'none', borderRadius:'8px', background:'var(--ac)', color:'#fff', cursor:'pointer', fontWeight:'500', transition:'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}
              >{editId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
