'use client';
import { useState } from 'react';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const OBJ_ORDER = ['Awareness','Traffic','Konversi'];
const OBJ_STYLE = {
  Awareness: { bg:'rgba(91,127,212,0.14)', color:'#3A5FAD', bar:'rgba(91,127,212,0.72)' },
  Traffic:   { bg:'rgba(242,168,48,0.14)',  color:'#9A6800', bar:'rgba(242,168,48,0.78)' },
  Konversi:  { bg:'rgba(61,170,106,0.14)',  color:'#1E7A45', bar:'rgba(61,170,106,0.72)' },
};

const initCampaigns = [
  { id:1, name:'Promo Bulanan Mei', obj:'Awareness', konten:'Post Instagram', bh:100000, mulai:'2026-05-01', selesai:'2026-05-31', status:'Running' },
  { id:2, name:'Depo Karawang', obj:'Awareness', konten:'Post Instagram', bh:75000, mulai:'2026-05-04', selesai:'2026-05-17', status:'Done' },
  { id:3, name:'Depo Karawang — Traffic', obj:'Traffic', konten:'Post Instagram', bh:100000, mulai:'2026-05-18', selesai:'2026-05-31', status:'Running' },
  { id:4, name:'Franchise Autopilot KTBR', obj:'Konversi', konten:'Poster & Motion', bh:100000, mulai:'2026-05-07', selesai:'2026-05-31', status:'Running' },
  { id:5, name:'Franchise Depo Surabaya', obj:'Konversi', konten:'Poster & Motion', bh:100000, mulai:'2026-05-25', selesai:'2026-06-30', status:'Draft' },
];

function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function isActive(c, y, m, d) {
  if (!c.mulai) return false;
  const s = new Date(c.mulai), e = new Date(c.selesai), cur = new Date(y, m, d);
  return cur >= s && cur <= e;
}
function budgetForMonth(c, y, m) {
  const days = daysInMonth(y, m);
  let total = 0;
  for (let d = 1; d <= days; d++) { if (isActive(c, y, m, d)) total++; }
  return total * c.bh;
}
function fmtRp(v) {
  if (!v) return '—';
  if (v >= 1000000) return 'Rp ' + (v/1000000).toFixed(1).replace('.0','') + ' jt';
  return 'Rp ' + (v/1000).toFixed(0) + 'rb';
}

export default function CalendarPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [showModal, setShowModal] = useState(false);
  const [campaigns, setCampaigns] = useState(initCampaigns);
  const [form, setForm] = useState({ name:'', obj:'Awareness', konten:'', bh:'', mulai:'', selesai:'', status:'Draft' });

  const today = { y:2026, m:4, d:22 };
  const days = daysInMonth(year, month);
  const sorted = [...campaigns].sort((a,b) => OBJ_ORDER.indexOf(a.obj) - OBJ_ORDER.indexOf(b.obj));

  const reminders = campaigns.filter(c => {
    if (!c.mulai) return false;
    const s = new Date(c.mulai);
    const now = new Date(today.y, today.m, today.d);
    const diff = (s - now) / 86400000;
    return diff >= 0 && diff <= 3;
  });

  const totalBudget = campaigns.reduce((sum,c) => sum + budgetForMonth(c, year, month), 0);
  const budgetByObj = OBJ_ORDER.reduce((acc,o) => {
    acc[o] = campaigns.filter(c=>c.obj===o).reduce((s,c)=>s+budgetForMonth(c,year,month),0);
    return acc;
  }, {});

  function prevMonth() { if (month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1); }
  function nextMonth() { if (month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1); }

  function handleSave() {
    if (!form.name) return;
    setCampaigns(prev => [...prev, { ...form, id: Date.now(), bh: parseInt(form.bh)||0 }]);
    setForm({ name:'', obj:'Awareness', konten:'', bh:'', mulai:'', selesai:'', status:'Draft' });
    setShowModal(false);
  }

  const inputStyle = { width:'100%', padding:'8px 12px', fontSize:'13px', border:'1px solid var(--bs)', borderRadius:'10px', background:'var(--sf)', color:'var(--t1)', fontFamily:'inherit', outline:'none' };

  return (
    <div style={{ position:'relative' }}>

      {/* Reminder Banner */}
      {reminders.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background:'var(--s2)', border:'0.5px solid var(--bs)', borderRadius:'12px', marginBottom:'16px', fontSize:'12px', color:'var(--t2)' }}>
          🔔 <span><strong>{reminders.length} campaign</strong> mulai dalam 3 hari — <strong>{reminders[0].name}</strong> dijadwalkan mulai <strong>{new Date(reminders[0].mulai).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</strong></span>
        </div>
      )}

      {/* Top Bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button onClick={prevMonth} style={{ width:'32px', height:'32px', borderRadius:'9px', border:'1.5px solid var(--bs)', background:'var(--cd)', cursor:'pointer', color:'var(--t1)', fontSize:'14px' }}>‹</button>
          <span style={{ fontSize:'16px', fontWeight:'500', color:'var(--t1)', minWidth:'130px', textAlign:'center' }}>{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} style={{ width:'32px', height:'32px', borderRadius:'9px', border:'1.5px solid var(--bs)', background:'var(--cd)', cursor:'pointer', color:'var(--t1)', fontSize:'14px' }}>›</button>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', fontSize:'13px', border:'1.5px solid var(--bs)', borderRadius:'12px', background:'var(--cd)', color:'var(--t1)', cursor:'pointer', fontWeight:'500' }}>
            ↓ Export
          </button>
          <button onClick={() => setShowModal(true)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', fontSize:'13px', border:'none', borderRadius:'12px', background:'var(--ac)', color:'#fff', cursor:'pointer', fontWeight:'500' }}>
            + Tambah Campaign
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:'14px', marginBottom:'12px', flexWrap:'wrap' }}>
        {OBJ_ORDER.map(o => (
          <span key={o} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'var(--t2)' }}>
            <span style={{ width:'10px', height:'10px', borderRadius:'3px', background:OBJ_STYLE[o].bar, display:'inline-block' }}></span>{o}
          </span>
        ))}
      </div>

      {/* Table */}
      <div style={{ border:'0.5px solid var(--br)', borderRadius:'16px', overflow:'hidden', marginBottom:'16px' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ borderCollapse:'collapse', minWidth:'max-content', width:'100%' }}>
            <thead>
              <tr style={{ background:'var(--sf)' }}>
                <th style={{ padding:'9px 10px', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap', position:'sticky', left:0, background:'var(--sf)', zIndex:2, minWidth:'150px' }}>Campaign</th>
                <th style={{ padding:'9px 10px', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap', position:'sticky', left:'150px', background:'var(--sf)', zIndex:2, minWidth:'88px' }}>Objektif</th>
                <th style={{ padding:'9px 10px', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap', minWidth:'74px' }}>Bgt/Hari</th>
                <th style={{ padding:'9px 10px', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap', minWidth:'64px' }}>Mulai</th>
                <th style={{ padding:'9px 10px', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap', minWidth:'64px' }}>Selesai</th>
                <th style={{ padding:'9px 10px', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap', minWidth:'76px' }}>Bgt Total</th>
                <th style={{ padding:'9px 10px', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', whiteSpace:'nowrap', minWidth:'74px' }}>Status</th>
                {Array.from({length:days},(_,i)=>i+1).map(d => {
                  const isToday = year===today.y && month===today.m && d===today.d;
                  return <th key={d} style={{ padding:'9px 2px', fontSize:'10px', fontWeight: isToday?'700':'500', color: isToday?'var(--ac)':'var(--t3)', width:'24px', minWidth:'24px', textAlign:'center', background:'var(--sf)' }}>{d}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const bt = budgetForMonth(c, year, month);
                const st = c.status;
                return (
                  <tr key={c.id} style={{ borderTop:'0.5px solid var(--br)' }}>
                    <td style={{ padding:'6px 10px', fontSize:'12px', fontWeight:'500', color:'var(--t1)', whiteSpace:'nowrap', position:'sticky', left:0, background:'var(--cd)', zIndex:1 }}>{c.name}</td>
                    <td style={{ padding:'6px 10px', position:'sticky', left:'150px', background:'var(--cd)', zIndex:1 }}>
                      <span style={{ padding:'2px 7px', borderRadius:'20px', fontSize:'10px', fontWeight:'500', background:OBJ_STYLE[c.obj].bg, color:OBJ_STYLE[c.obj].color }}>{c.obj}</span>
                    </td>
                    <td style={{ padding:'6px 10px', fontSize:'11px', color:'var(--t2)', whiteSpace:'nowrap' }}>{c.bh ? fmtRp(c.bh) : '—'}</td>
                    <td style={{ padding:'6px 10px', fontSize:'11px', color:'var(--t2)', whiteSpace:'nowrap' }}>{c.mulai ? new Date(c.mulai).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '—'}</td>
                    <td style={{ padding:'6px 10px', fontSize:'11px', color:'var(--t2)', whiteSpace:'nowrap' }}>{c.selesai ? new Date(c.selesai).toLocaleDateString('id-ID',{day:'numeric',month:'short'}) : '—'}</td>
                    <td style={{ padding:'6px 10px', fontSize:'11px', fontWeight:'500', color:'var(--t2)', whiteSpace:'nowrap' }}>{fmtRp(bt)}</td>
                    <td style={{ padding:'6px 10px' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', padding:'2px 8px', borderRadius:'20px', fontSize:'10px', fontWeight:'500', background: st==='Running'?'var(--pr-bg)':st==='Done'?'var(--pd-bg)':'var(--s2)', color: st==='Running'?'var(--pr-tx)':st==='Done'?'var(--pd-tx)':'var(--t3)' }}>
                        {st==='Running'?'▶ ':st==='Done'?'':'✏ '}{st}
                      </span>
                    </td>
                    {Array.from({length:days},(_,i)=>i+1).map(d => {
                      const isToday = year===today.y && month===today.m && d===today.d;
                      const active = isActive(c, year, month, d);
                      const prev = isActive(c, year, month, d-1);
                      const next = isActive(c, year, month, d+1);
                      return (
                        <td key={d} style={{ width:'24px', minWidth:'24px', padding:'3px 1px', textAlign:'center', verticalAlign:'middle', background: isToday?'var(--hl, rgba(122,62,16,.07))':'transparent' }}>
                          {active && (
                            <div style={{ height:'16px', background:OBJ_STYLE[c.obj].bar, borderRadius: (!prev&&!next)?'4px':(!prev)?'4px 0 0 4px':(!next)?'0 4px 4px 0':'0' }}></div>
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

      {/* Total Budget Card */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--cd)', border:'0.5px solid var(--br)', borderRadius:'16px', padding:'16px 20px' }}>
        <div>
          <div style={{ fontSize:'13px', color:'var(--t3)', fontWeight:'500', marginBottom:'4px' }}>💰 Total Budget Iklan <span style={{ color:'var(--ac)' }}>{MONTHS[month]} {year}</span></div>
          <div style={{ fontSize:'20px', fontWeight:'500', color:'var(--t1)' }}>{fmtRp(totalBudget)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          {OBJ_ORDER.map((o,i) => (
            <div key={o} style={{ textAlign:'center', paddingLeft: i>0?'16px':0, borderLeft: i>0?'0.5px solid var(--br)':'' }}>
              <div style={{ fontSize:'10px', color:'var(--t3)', textTransform:'uppercase', marginBottom:'2px' }}>{o}</div>
              <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--t1)' }}>{budgetByObj[o]>0 ? fmtRp(budgetByObj[o]) : '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--cd)', borderRadius:'18px', padding:'24px', width:'400px', border:'0.5px solid var(--bs)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
              <span style={{ fontSize:'15px', fontWeight:'500', color:'var(--t1)' }}>Tambah Campaign</span>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'var(--t3)' }}>✕</button>
            </div>
            {[['Nama Campaign','text','name','Masukkan nama campaign...'],['Konten Iklan','text','konten','Post Instagram, Video, dll...']].map(([lbl,type,key,ph]) => (
              <div key={key} style={{ marginBottom:'12px' }}>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'500' }}>{lbl}</div>
                <input style={inputStyle} type={type} placeholder={ph} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'500' }}>Objektif</div>
                <select style={inputStyle} value={form.obj} onChange={e=>setForm(f=>({...f,obj:e.target.value}))}>
                  {OBJ_ORDER.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'500' }}>Status</div>
                <select style={inputStyle} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {['Draft','Running','Done'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'500' }}>Tanggal Mulai</div>
                <input style={inputStyle} type="date" value={form.mulai} onChange={e=>setForm(f=>({...f,mulai:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'500' }}>Tanggal Selesai</div>
                <input style={inputStyle} type="date" value={form.selesai} onChange={e=>setForm(f=>({...f,selesai:e.target.value}))} />
              </div>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'11px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:'5px', fontWeight:'500' }}>Budget Harian (Rp)</div>
              <input style={inputStyle} type="number" placeholder="100000" value={form.bh} onChange={e=>setForm(f=>({...f,bh:e.target.value}))} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'18px', paddingTop:'14px', borderTop:'0.5px solid var(--br)' }}>
              <button onClick={()=>setShowModal(false)} style={{ padding:'8px 16px', fontSize:'13px', border:'1px solid var(--br)', borderRadius:'10px', background:'transparent', color:'var(--t2)', cursor:'pointer' }}>Batal</button>
              <button onClick={handleSave} style={{ padding:'8px 18px', fontSize:'13px', border:'none', borderRadius:'10px', background:'var(--ac)', color:'#fff', cursor:'pointer', fontWeight:'500' }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}