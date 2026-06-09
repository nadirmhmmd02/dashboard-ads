'use client';
import { useState } from 'react';

const platforms = [
  { name:'Meta Ads', color:'#1877F2', campaigns:4, budget:'Rp 5,4 jt', cpm:'Rp 17rb', cpc:'Rp 780', cpl:'Rp 50rb', leads:'107' },
  { name:'Google Ads', color:'#EA4335', campaigns:2, budget:'Rp 2,1 jt', cpm:'Rp 21rb', cpc:'Rp 910', cpl:'Rp 78rb', leads:'27' },
];

const metaMetrics = [
  ['Total Budget','Rp 5,4 jt','+10%',true],['Reach','248.300','+8%',true],
  ['Impressi','319.200','+6%',true],['Traffic','12.840','+4%',true],
  ['Leads','107','+9%',true],['CPM (Reach)','Rp 22rb','Lebih efisien',true],
  ['CPM (Impressi)','Rp 17rb','+2%',false],['CPC','Rp 780','Lebih efisien',true],
  ['CPL','Rp 50rb','Lebih efisien',true],['CTR','3,8%','+0,5%',true],
  ['Total Leads','107','+9%',true],
];

const googleMetrics = [
  ['Total Budget','Rp 2,1 jt','+7%',true],['Reach','63.900','+5%',true],
  ['Impressi','84.600','+4%',true],['Traffic','3.340','+3%',true],
  ['Leads','27','+6%',true],['CPM (Reach)','Rp 33rb','+4%',false],
  ['CPM (Impressi)','Rp 21rb','+3%',false],['CPC','Rp 910','+2%',false],
  ['CPL','Rp 78rb','+5%',false],['CTR','2,6%','-0,3%',false],
  ['Total Leads','27','+6%',true],
];

const metaCampaigns = [
  { name:'Promo Bulanan Mei', obj:'Awareness', status:'Running', budget:'Rp 3,1 jt', impressi:'172.400', traffic:'5.870', ctr:'3,4%', cpm:'Rp 18rb', cpc:'Rp 530', leads:'—', cpl:'—' },
  { name:'Depo Karawang — Brand', obj:'Awareness', status:'Done', budget:'Rp 1,05 jt', impressi:'58.200', traffic:'1.340', ctr:'2,3%', cpm:'Rp 18rb', cpc:'Rp 784', leads:'—', cpl:'—' },
  { name:'Depo Karawang — Traffic', obj:'Traffic', status:'Running', budget:'Rp 1,4 jt', impressi:'43.100', traffic:'3.900', ctr:'4,2%', cpm:'Rp 15rb', cpc:'Rp 620', leads:'—', cpl:'—' },
  { name:'Franchise Autopilot KTBR', obj:'Konversi', status:'Running', budget:'Rp 2,5 jt', impressi:'89.300', traffic:'4.120', ctr:'4,6%', cpm:'Rp 28rb', cpc:'Rp 607', leads:'84', cpl:'Rp 50rb' },
];

const googleCampaigns = [
  { name:'Franchise Depo Palembang', obj:'Traffic', status:'Running', budget:'Rp 1,4 jt', impressi:'40.800', traffic:'3.710', ctr:'3,9%', cpm:'Rp 16rb', cpc:'Rp 650', leads:'—', cpl:'—' },
  { name:'KTBR Search — Franchise', obj:'Konversi', status:'Running', budget:'Rp 700rb', impressi:'21.400', traffic:'1.240', ctr:'2,8%', cpm:'Rp 33rb', cpc:'Rp 910', leads:'27', cpl:'Rp 78rb' },
];

const objColors = {
  Awareness: { bg:'rgba(91,127,212,0.14)', color:'#3A5FAD' },
  Traffic: { bg:'rgba(242,168,48,0.14)', color:'#9A6800' },
  Konversi: { bg:'rgba(61,170,106,0.14)', color:'#1E7A45' },
};

const dateOptions = ['Hari ini','Kemarin','3 hari terakhir','7 hari terakhir','14 hari terakhir','30 hari terakhir','Bulan ini','Bulan lalu'];

function MetricGrid({ metrics }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px' }}>
      {metrics.map(([label,val,trend,pos]) => (
        <div key={label} style={{ background:'var(--sf)', borderRadius:'14px', padding:'14px 15px' }}>
          <div style={{ fontSize:'10px', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>{label}</div>
          <div style={{ fontSize:'20px', fontWeight:'500', color:'var(--t1)', marginBottom:'5px' }}>{val}</div>
          <div style={{ fontSize:'11px', color: pos ? 'var(--pos)' : 'var(--neg)' }}>{pos ? '↑' : '↓'} {trend}</div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ color, text }) {
  return (
    <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'6px' }}>
      <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:color, display:'inline-block' }}></span>
      {text}
    </div>
  );
}

function CampaignTable({ campaigns }) {
  const groups = ['Awareness','Traffic','Konversi'];
  return (
    <div style={{ background:'var(--cd)', border:'0.5px solid var(--br)', borderRadius:'18px', overflow:'hidden', marginBottom:'4px' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
          <thead>
            <tr style={{ background:'var(--sf)' }}>
              {['Campaign','Status','Budget','Impressi','Traffic','CTR','CPM','CPC','Leads','CPL'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign: h==='Campaign'||h==='Status' ? 'left' : 'right', fontSize:'10px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(grp => {
              const rows = campaigns.filter(c => c.obj === grp);
              if (!rows.length) return null;
              return [
                <tr key={grp+'-hdr'} style={{ background:'var(--s2)' }}>
                  <td colSpan={10} style={{ padding:'6px 14px' }}>
                    <span style={{ fontSize:'10px', fontWeight:'600', color:'var(--t2)', display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ padding:'2px 9px', borderRadius:'20px', fontSize:'10px', fontWeight:'500', background: objColors[grp].bg, color: objColors[grp].color }}>{grp}</span>
                      {rows.length} campaign
                    </span>
                  </td>
                </tr>,
                ...rows.map((c,i) => (
                  <tr key={c.name} style={{ borderTop:'0.5px solid var(--br)' }}>
                    <td style={{ padding:'9px 12px', fontWeight:'500', color:'var(--t1)', whiteSpace:'nowrap' }}>{c.name}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', padding:'2px 8px', borderRadius:'20px', fontSize:'10px', fontWeight:'500', background: c.status==='Running' ? 'var(--pr-bg)' : 'var(--pd-bg)', color: c.status==='Running' ? 'var(--pr-tx)' : 'var(--pd-tx)' }}>
                        {c.status==='Running' ? '▶ ' : ''}{c.status}
                      </span>
                    </td>
                    {[c.budget,c.impressi,c.traffic,c.ctr,c.cpm,c.cpc,c.leads,c.cpl].map((v,j) => (
                      <td key={j} style={{ padding:'9px 12px', textAlign:'right', color:'var(--t2)', whiteSpace:'nowrap' }}>{v}</td>
                    ))}
                  </tr>
                )),
                <tr key={grp+'-total'} style={{ borderTop:'0.5px solid var(--br)', background:'var(--sf)' }}>
                  <td colSpan={2} style={{ padding:'8px 12px', fontWeight:'600', color:'var(--t1)', fontSize:'11px', fontStyle:'italic' }}>Subtotal {grp}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:'500', color:'var(--t1)', fontSize:'11px' }}>
                    {grp==='Awareness'?'Rp 4,15 jt':grp==='Traffic'?'Rp 1,4 jt':'Rp 2,5 jt'}
                  </td>
                  <td colSpan={7} style={{ padding:'8px 12px' }}></td>
                </tr>
              ];
            })}
            <tr style={{ borderTop:'0.5px solid var(--br)', background:'var(--s2)' }}>
              <td colSpan={2} style={{ padding:'9px 12px', fontWeight:'600', color:'var(--t1)' }}>Total</td>
              <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:'600', color:'var(--t1)' }}>
                {campaigns===metaCampaigns ? 'Rp 5,4 jt' : 'Rp 2,1 jt'}
              </td>
              <td colSpan={7}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState('7 hari terakhir');
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', marginBottom:'20px' }}>
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowDropdown(!showDropdown)}
            style={{ display:'flex', alignItems:'center', gap:'7px', padding:'8px 14px', fontSize:'13px', fontWeight:'500', border:'1.5px solid var(--bs)', borderRadius:'12px', background:'var(--cd)', color:'var(--t1)', cursor:'pointer' }}>
            📅 {selectedDate} ▾
          </button>
          {showDropdown && (
            <div style={{ position:'absolute', top:'42px', right:0, zIndex:50, background:'var(--cd)', border:'1px solid var(--bs)', borderRadius:'12px', overflow:'hidden', minWidth:'180px' }}>
              {dateOptions.map(opt => (
                <div key={opt} onClick={() => { setSelectedDate(opt); setShowDropdown(false); }}
                  style={{ padding:'10px 16px', fontSize:'13px', cursor:'pointer', color: opt===selectedDate?'var(--ac)':'var(--t2)', fontWeight: opt===selectedDate?'500':'400', background: opt===selectedDate?'var(--sf)':'transparent' }}>
                  {opt===selectedDate?'● ':'○ '}{opt}
                </div>
              ))}
            </div>
          )}
        </div>
        <button style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 14px', fontSize:'13px', fontWeight:'500', border:'1.5px solid var(--bs)', borderRadius:'12px', background:'var(--cd)', color:'var(--t1)', cursor:'pointer' }}>
          ⇄ Bandingkan ▾
        </button>
      </div>

      <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>📊 Breakdown per platform</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
        {platforms.map(p => (
          <div key={p.name} style={{ background:'var(--cd)', border:'0.5px solid var(--br)', borderRadius:'18px', padding:'18px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'13px', fontWeight:'500', color:'var(--t1)' }}>
                <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:p.color, display:'inline-block' }}></span>{p.name}
              </div>
              <span style={{ fontSize:'10px', padding:'3px 10px', borderRadius:'20px', background:'var(--pr-bg)', color:'var(--pr-tx)', fontWeight:'500' }}>{p.campaigns} campaign aktif</span>
            </div>
            <div style={{ fontSize:'30px', fontWeight:'500', color:'var(--t1)', lineHeight:1, marginBottom:'3px' }}>{p.budget}</div>
            <div style={{ fontSize:'11px', color:'var(--t3)', marginBottom:'14px' }}>Total budget terpakai · {selectedDate}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'0.5px solid var(--br)', paddingTop:'13px' }}>
              {[['CPM',p.cpm],['CPC',p.cpc],['CPL',p.cpl],['Leads',p.leads]].map(([label,val],i) => (
                <div key={label} style={{ textAlign:'center', borderRight: i<3?'0.5px solid var(--br)':'none' }}>
                  <div style={{ fontSize:'10px', color:'var(--t3)', marginBottom:'3px', textTransform:'uppercase' }}>{label}</div>
                  <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--t1)' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height:'0.5px', background:'var(--br)', margin:'8px 0 20px' }}></div>
      <SectionLabel color="#1877F2" text="Metrik keseluruhan Meta Ads" />
      <MetricGrid metrics={metaMetrics} />
      <SectionLabel color="#1877F2" text="Performa campaign Meta Ads" />
      <CampaignTable campaigns={metaCampaigns} />

      <div style={{ height:'0.5px', background:'var(--br)', margin:'20px 0' }}></div>
      <SectionLabel color="#EA4335" text="Metrik keseluruhan Google Ads" />
      <MetricGrid metrics={googleMetrics} />
      <SectionLabel color="#EA4335" text="Performa campaign Google Ads" />
      <CampaignTable campaigns={googleCampaigns} />
    </div>
  );
}