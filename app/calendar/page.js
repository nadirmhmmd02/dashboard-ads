'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const OBJ_ORDER=['Awareness','Traffic','Konversi'];
const OBJ_STYLE={
  Awareness:{bg:'rgba(91,127,212,0.14)',color:'#3A5FAD',bar:'rgba(91,127,212,0.72)'},
  Traffic:{bg:'rgba(242,168,48,0.14)',color:'#9A6800',bar:'rgba(242,168,48,0.78)'},
  Konversi:{bg:'rgba(61,170,106,0.14)',color:'#1E7A45',bar:'rgba(61,170,106,0.72)'},
};

function daysInMonth(y,m){return new Date(y,m+1,0).getDate()}
function isActive(c,y,m,d){if(!c.mulai||!c.selesai)return false;const s=new Date(c.mulai),e=new Date(c.selesai),cur=new Date(y,m,d);return cur>=s&&cur<=e}
function hasActivity(c,y,m){if(!c.mulai||!c.selesai)return false;const s=new Date(c.mulai),e=new Date(c.selesai),ms=new Date(y,m,1),me=new Date(y,m+1,0);return s<=me&&e>=ms}
function budgetForMonth(c,y,m){const days=daysInMonth(y,m);let t=0;for(let d=1;d<=days;d++){if(isActive(c,y,m,d))t++}return t*(c.bh||0)}
function fmtRp(v){if(!v)return'—';if(v>=1000000)return'Rp '+(v/1000000).toFixed(1).replace('.0','')+' jt';return'Rp '+(v/1000).toFixed(0)+'rb'}

const emptyForm={name:'',obj:'Awareness',konten:'',bh:'',mulai:'',selesai:'',status:'Draft'};

export default function CalendarPage(){
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth());
  const [showModal,setShowModal]=useState(false);
  const [campaigns,setCampaigns]=useState([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState(emptyForm);
  const [editId,setEditId]=useState(null);

  const today={y:now.getFullYear(),m:now.getMonth(),d:now.getDate()};
  const days=daysInMonth(year,month);
  const sorted=[...campaigns].filter(c=>hasActivity(c,year,month)).sort((a,b)=>OBJ_ORDER.indexOf(a.obj)-OBJ_ORDER.indexOf(b.obj));

  useEffect(()=>{loadCampaigns()},[]);

  async function loadCampaigns(){
    setLoading(true);
    const{data,error}=await supabase.from('campaigns').select('*').order('created_at',{ascending:true});
    if(!error)setCampaigns(data||[]);
    setLoading(false);
  }

  function openAdd(){setForm(emptyForm);setEditId(null);setShowModal(true)}
  function openEdit(c){
    setForm({name:c.name,obj:c.obj,konten:c.konten||'',bh:c.bh||'',mulai:c.mulai||'',selesai:c.selesai||'',status:c.status});
    setEditId(c.id);setShowModal(true);
  }

  async function handleSave(){
    if(!form.name)return;
    const payload={name:form.name,obj:form.obj,konten:form.konten,bh:parseInt(form.bh)||0,mulai:form.mulai||null,selesai:form.selesai||null,status:form.status};
    if(editId){await supabase.from('campaigns').update(payload).eq('id',editId);}
    else{await supabase.from('campaigns').insert([payload]);}
    setShowModal(false);setForm(emptyForm);setEditId(null);
    loadCampaigns();
  }

  async function handleDelete(id){
    if(!confirm('Hapus campaign ini?'))return;
    await supabase.from('campaigns').delete().eq('id',id);
    loadCampaigns();
  }

  const reminders=campaigns.filter(c=>{
    if(!c.mulai)return false;
    const s=new Date(c.mulai),now2=new Date(today.y,today.m,today.d);
    const diff=(s-now2)/86400000;
    return diff>=0&&diff<=3;
  });

  const totalBudget=sorted.reduce((sum,c)=>sum+budgetForMonth(c,year,month),0);
  const budgetByObj=OBJ_ORDER.reduce((acc,o)=>{
    acc[o]=sorted.filter(c=>c.obj===o).reduce((s,c)=>s+budgetForMonth(c,year,month),0);
    return acc;
  },{});

  function prevMonth(){if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1)}
  function nextMonth(){if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1)}

  const inp={width:'100%',padding:'8px 12px',fontSize:'13px',border:'1px solid var(--bs)',borderRadius:'10px',background:'var(--sf)',color:'var(--t1)',fontFamily:'inherit',outline:'none'};

  const thBase={padding:'8px 6px',fontSize:'10px',fontWeight:'600',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',background:'var(--sf)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'};

  return(
    <div style={{position:'relative'}}>
      {reminders.length>0&&(
        <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 14px',background:'var(--s2)',border:'0.5px solid var(--bs)',borderRadius:'12px',marginBottom:'16px',fontSize:'12px',color:'var(--t2)'}}>
          🔔 <span><strong>{reminders.length} campaign</strong> mulai dalam 3 hari — <strong>{reminders[0].name}</strong></span>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <button onClick={prevMonth} style={{width:'32px',height:'32px',borderRadius:'9px',border:'1.5px solid var(--bs)',background:'var(--cd)',cursor:'pointer',color:'var(--t1)',fontSize:'14px'}}>‹</button>
          <span style={{fontSize:'16px',fontWeight:'500',color:'var(--t1)',minWidth:'130px',textAlign:'center'}}>{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} style={{width:'32px',height:'32px',borderRadius:'9px',border:'1.5px solid var(--bs)',background:'var(--cd)',cursor:'pointer',color:'var(--t1)',fontSize:'14px'}}>›</button>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px',fontSize:'13px',border:'1.5px solid var(--bs)',borderRadius:'12px',background:'var(--cd)',color:'var(--t1)',cursor:'pointer',fontWeight:'500'}}>↓ Export</button>
          <button onClick={openAdd} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px',fontSize:'13px',border:'none',borderRadius:'12px',background:'var(--ac)',color:'#fff',cursor:'pointer',fontWeight:'500'}}>+ Tambah Campaign</button>
        </div>
      </div>

      <div style={{display:'flex',gap:'14px',marginBottom:'12px',flexWrap:'wrap'}}>
        {OBJ_ORDER.map(o=>(
          <span key={o} style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'11px',color:'var(--t2)'}}>
            <span style={{width:'10px',height:'10px',borderRadius:'3px',background:OBJ_STYLE[o].bar,display:'inline-block'}}></span>{o}
          </span>
        ))}
      </div>

      {loading?(
        <div style={{textAlign:'center',padding:'40px',color:'var(--t3)',fontSize:'13px'}}>Memuat data...</div>
      ):(
        <div style={{border:'0.5px solid var(--br)',borderRadius:'16px',overflow:'hidden',marginBottom:'16px'}}>
          <table style={{borderCollapse:'collapse',width:'100%',tableLayout:'fixed'}}>
            <colgroup>
              <col style={{width:'18%'}}/>
              <col style={{width:'9%'}}/>
              <col style={{width:'7%'}}/>
              <col style={{width:'6%'}}/>
              <col style={{width:'6%'}}/>
              <col style={{width:'7%'}}/>
              <col style={{width:'7%'}}/>
              <col style={{width:'6%'}}/>
              {Array.from({length:days}).map((_,i)=>(
                <col key={i} style={{width:`${(34/(days))}%`}}/>
              ))}
            </colgroup>
            <thead>
              <tr style={{background:'var(--sf)'}}>
                <th style={{...thBase,textAlign:'left',position:'sticky',left:0,background:'var(--sf)',zIndex:2}}>Campaign</th>
                <th style={{...thBase,textAlign:'left',position:'sticky',left:'18%',background:'var(--sf)',zIndex:2}}>Objektif</th>
                <th style={{...thBase,textAlign:'right'}}>Bgt/Hari</th>
                <th style={{...thBase,textAlign:'right'}}>Mulai</th>
                <th style={{...thBase,textAlign:'right'}}>Selesai</th>
                <th style={{...thBase,textAlign:'right'}}>Bgt Total</th>
                <th style={{...thBase,textAlign:'left'}}>Status</th>
                <th style={{...thBase,textAlign:'left'}}>Aksi</th>
                {Array.from({length:days},(_,i)=>i+1).map(d=>{
                  const isToday=year===today.y&&month===today.m&&d===today.d;
                  return <th key={d} style={{...thBase,textAlign:'center',padding:'8px 0',fontWeight:isToday?'700':'500',color:isToday?'var(--ac)':'var(--t3)'}}>{d}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.length===0?(
                <tr><td colSpan={8+days} style={{textAlign:'center',padding:'32px',color:'var(--t3)',fontSize:'13px'}}>Belum ada campaign di bulan ini.</td></tr>
              ):sorted.map(c=>{
                const bt=budgetForMonth(c,year,month);
                const st=c.status;
                return(
                  <tr key={c.id} style={{borderTop:'0.5px solid var(--br)'}}>
                    <td style={{padding:'6px 8px',fontSize:'12px',fontWeight:'500',color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',position:'sticky',left:0,background:'var(--cd)',zIndex:1}}>{c.name}</td>
                    <td style={{padding:'6px 6px',position:'sticky',left:'18%',background:'var(--cd)',zIndex:1}}>
                      <span style={{padding:'2px 6px',borderRadius:'20px',fontSize:'9px',fontWeight:'500',background:OBJ_STYLE[c.obj]?.bg,color:OBJ_STYLE[c.obj]?.color,whiteSpace:'nowrap'}}>{c.obj}</span>
                    </td>
                    <td style={{padding:'6px 6px',fontSize:'11px',color:'var(--t2)',textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.bh?fmtRp(c.bh):'—'}</td>
                    <td style={{padding:'6px 6px',fontSize:'11px',color:'var(--t2)',textAlign:'right',whiteSpace:'nowrap'}}>{c.mulai?new Date(c.mulai).toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'—'}</td>
                    <td style={{padding:'6px 6px',fontSize:'11px',color:'var(--t2)',textAlign:'right',whiteSpace:'nowrap'}}>{c.selesai?new Date(c.selesai).toLocaleDateString('id-ID',{day:'numeric',month:'short'}):'—'}</td>
                    <td style={{padding:'6px 6px',fontSize:'11px',fontWeight:'500',color:'var(--t2)',textAlign:'right',whiteSpace:'nowrap'}}>{fmtRp(bt)}</td>
                    <td style={{padding:'6px 6px'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:'2px',padding:'2px 6px',borderRadius:'20px',fontSize:'9px',fontWeight:'500',background:st==='Running'?'var(--pr-bg)':st==='Done'?'var(--pd-bg)':'var(--s2)',color:st==='Running'?'var(--pr-tx)':st==='Done'?'var(--pd-tx)':'var(--t3)',whiteSpace:'nowrap'}}>
                        {st==='Running'?'▶ ':st==='Done'?'':'✏ '}{st}
                      </span>
                    </td>
                    <td style={{padding:'6px 4px',whiteSpace:'nowrap'}}>
                      <button onClick={()=>openEdit(c)} style={{fontSize:'10px',padding:'2px 6px',borderRadius:'6px',border:'0.5px solid var(--br)',background:'transparent',color:'var(--t2)',cursor:'pointer',marginRight:'3px'}}>✏</button>
                      <button onClick={()=>handleDelete(c.id)} style={{fontSize:'10px',padding:'2px 6px',borderRadius:'6px',border:'0.5px solid rgba(220,50,50,0.3)',background:'transparent',color:'#C62828',cursor:'pointer'}}>🗑</button>
                    </td>
                    {Array.from({length:days},(_,i)=>i+1).map(d=>{
                      const isToday=year===today.y&&month===today.m&&d===today.d;
                      const active=isActive(c,year,month,d);
                      const prev=isActive(c,year,month,d-1);
                      const next=isActive(c,year,month,d+1);
                      return(
                        <td key={d} style={{padding:'3px 1px',textAlign:'center',verticalAlign:'middle',background:isToday?'rgba(122,62,16,.07)':'transparent'}}>
                          {active&&<div style={{height:'14px',background:OBJ_STYLE[c.obj]?.bar,borderRadius:(!prev&&!next)?'3px':(!prev)?'3px 0 0 3px':(!next)?'0 3px 3px 0':'0'}}></div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--cd)',border:'0.5px solid var(--br)',borderRadius:'16px',padding:'16px 20px'}}>
        <div>
          <div style={{fontSize:'13px',color:'var(--t3)',fontWeight:'500',marginBottom:'4px'}}>💰 Total Budget Iklan <span style={{color:'var(--ac)'}}>{MONTHS[month]} {year}</span></div>
          <div style={{fontSize:'20px',fontWeight:'500',color:'var(--t1)'}}>{fmtRp(totalBudget)}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          {OBJ_ORDER.map((o,i)=>(
            <div key={o} style={{textAlign:'center',paddingLeft:i>0?'16px':0,borderLeft:i>0?'0.5px solid var(--br)':''}}>
              <div style={{fontSize:'10px',color:'var(--t3)',textTransform:'uppercase',marginBottom:'2px'}}>{o}</div>
              <div style={{fontSize:'13px',fontWeight:'500',color:'var(--t1)'}}>{budgetByObj[o]>0?fmtRp(budgetByObj[o]):'—'}</div>
            </div>
          ))}
        </div>
      </div>

      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'var(--cd)',borderRadius:'18px',padding:'24px',width:'400px',border:'0.5px solid var(--bs)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
              <span style={{fontSize:'15px',fontWeight:'500',color:'var(--t1)'}}>{editId?'Edit Campaign':'Tambah Campaign'}</span>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',fontSize:'18px',cursor:'pointer',color:'var(--t3)'}}>✕</button>
            </div>
            {[['Nama Campaign','text','name','Masukkan nama campaign...'],['Konten Iklan','text','konten','Post Instagram, Video, dll...']].map(([lbl,type,key,ph])=>(
              <div key={key} style={{marginBottom:'12px'}}>
                <div style={{fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'5px',fontWeight:'500'}}>{lbl}</div>
                <input style={inp} type={type} placeholder={ph} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
              </div>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
              <div>
                <div style={{fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'5px',fontWeight:'500'}}>Objektif</div>
                <select style={inp} value={form.obj} onChange={e=>setForm(f=>({...f,obj:e.target.value}))}>
                  {OBJ_ORDER.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'5px',fontWeight:'500'}}>Status</div>
                <select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {['Draft','Running','Done'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
              <div>
                <div style={{fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'5px',fontWeight:'500'}}>Tanggal Mulai</div>
                <input style={inp} type="date" value={form.mulai} onChange={e=>setForm(f=>({...f,mulai:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'5px',fontWeight:'500'}}>Tanggal Selesai</div>
                <input style={inp} type="date" value={form.selesai} onChange={e=>setForm(f=>({...f,selesai:e.target.value}))}/>
              </div>
            </div>
            <div style={{marginBottom:'12px'}}>
              <div style={{fontSize:'11px',color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'5px',fontWeight:'500'}}>Budget Harian (Rp)</div>
              <input style={inp} type="number" placeholder="100000" value={form.bh} onChange={e=>setForm(f=>({...f,bh:e.target.value}))}/>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'18px',paddingTop:'14px',borderTop:'0.5px solid var(--br)'}}>
              <button onClick={()=>setShowModal(false)} style={{padding:'8px 16px',fontSize:'13px',border:'1px solid var(--br)',borderRadius:'10px',background:'transparent',color:'var(--t2)',cursor:'pointer'}}>Batal</button>
              <button onClick={handleSave} style={{padding:'8px 18px',fontSize:'13px',border:'none',borderRadius:'10px',background:'var(--ac)',color:'#fff',cursor:'pointer',fontWeight:'500'}}>{editId?'Update':'Simpan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}