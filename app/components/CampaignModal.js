'use client';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { X, Globe, MessageCircle, ImageOff, RefreshCw, Users, Eye, MousePointerClick, UserPlus, Gauge, Coins, Wallet, Banknote, Target, RectangleVertical, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import CountUp from './CountUp';
import { authFetch } from '../supabase';

/* ─── Helpers metrik (sama persis dengan logika tabel campaigns — jangan diubah) ─── */
function getActionValue(actions, types) {
  if (!actions) return null;
  for (const type of types) {
    const a = actions.find(x => x.action_type === type);
    if (a) return parseInt(a.value);
  }
  return null;
}
function getLeads(actions)      { return getActionValue(actions, ['lead', 'onsite_conversion.lead_grouped']); }
function getLinkClicks(actions) { return getActionValue(actions, ['link_click']); }

function fmtNum(v) {
  if (!v && v !== 0) return '—';
  const n = parseFloat(v);
  if (!n) return '—';
  return n.toLocaleString('id-ID');
}
function fmtRpFull(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return 'Rp ' + Math.round(parseFloat(v)).toLocaleString('id-ID');
}

function getResult(campaign, insights) {
  const name = campaign.name?.toUpperCase() || '';
  const actions = insights?.actions || [];
  if (name.includes('AWR REACH')) return { label: 'Reach', value: fmtNum(insights?.reach) };
  if (name.includes('AWR'))       return { label: 'Impressions', value: fmtNum(insights?.impressions) };
  if (name.includes('TRAFFIC'))   return { label: 'Link Clicks', value: fmtNum(getLinkClicks(actions)) };
  if (name.includes('PROSPEK') || name.includes('KONVERSI')) return { label: 'Leads', value: fmtNum(getLeads(actions)) };
  return { label: 'Result', value: '—' };
}

const OBJ_GROUP = {
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_LEADS: 'Conversion',
  OUTCOME_SALES: 'Conversion',
  OUTCOME_ENGAGEMENT: 'Traffic',
  LINK_CLICKS: 'Traffic',
};
const OBJ_STYLE = {
  Awareness:  { bg: 'rgba(91,127,212,0.14)', color: '#5b8fd4' },
  Traffic:    { bg: 'rgba(245,158,11,0.14)', color: '#f59e0b' },
  Conversion: { bg: 'rgba(16,185,129,0.14)', color: '#10b981' },
};

/* ─── Ikon brand kecil (lucide versi ini tidak punya Instagram/Facebook) ─── */
function IgIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
function FbIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const PLATFORM_META = {
  facebook:         { label: 'Facebook',         Icon: FbIcon,        chipBg: 'rgba(59,130,246,0.16)', chipFg: '#3B82F6' },
  instagram:        { label: 'Instagram',        Icon: IgIcon,        chipBg: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)', chipFg: '#FFFFFF' },
  audience_network: { label: 'Audience Network', Icon: Globe,         chipBg: 'rgba(139,92,246,0.16)', chipFg: '#8B5CF6' },
  messenger:        { label: 'Messenger',        Icon: MessageCircle, chipBg: 'rgba(59,130,246,0.16)', chipFg: '#60A5FA' },
};

/* Link post IG → URL embed (feed & reels dua-duanya support /embed/) */
function embedUrl(permalink) {
  if (!permalink) return null;
  const base = permalink.split('?')[0];
  return (base.endsWith('/') ? base : base + '/') + 'embed/';
}

/* ─── Preview media asli (per 15 Agu 2026) ───
   Konten iklan ditampilkan FULL tanpa frame embed Instagram (header profil,
   footer "Lihat lainnya", ikon like) — file gambar/video diambil langsung dari
   CDN IG lewat /api/meta campaign_detail (ad.media). Ukuran kotak dihitung
   dari rasio asli media supaya pas di area preview (portrait/feed otomatis,
   tidak perlu toggle). Label kecil di pojok = platform sumber konten
   (klik → buka post aslinya). Carousel → panah kiri/kanan + titik. */
const PLATFORM_CHIP = {
  instagram: { label: 'Instagram', Icon: IgIcon },
  facebook:  { label: 'Facebook',  Icon: FbIcon },
};

function MediaPreview({ media, adName }) {
  const areaRef = useRef(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [nat, setNat]   = useState({});      // url → { w, h } rasio asli
  const [idx, setIdx]   = useState(0);       // slide carousel aktif (reset otomatis: komponen di-key per ad)

  // Ukur area preview (content-box) — ikut berubah kalau modal di-resize
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    // dikurangi padding (18/6+12) + baris caption nama ad (~24px)
    const measure = () => setArea({ w: el.clientWidth - 36, h: el.clientHeight - 18 - 24 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items = media.items || [];
  const item  = items[Math.min(idx, items.length - 1)] || null;
  const chip  = PLATFORM_CHIP[media.platform] || PLATFORM_CHIP.instagram;

  // Kotak = rasio asli media (default 9:16 sebelum metadata termuat) yang muat di area
  const n = item && nat[item.url];
  const ratio = n && n.w && n.h ? n.w / n.h : 9 / 16;
  let boxW = 0, boxH = 0;
  if (area.w > 0 && area.h > 0) {
    boxW = Math.min(area.w, area.h * ratio);
    boxH = boxW / ratio;
  }
  const remember = (url, w, h) => { if (w && h) setNat(prev => (prev[url] ? prev : { ...prev, [url]: { w, h } })); };

  const navBtn = (side) => ({
    position: 'absolute', top: '50%', [side]: '8px', transform: 'translateY(-50%)',
    width: '26px', height: '26px', borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(0,0,0,0.45)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)', transition: 'background 0.12s', zIndex: 2,
  });

  return (
    <div ref={areaRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 18px 12px', overflow: 'hidden' }}>
      {item && boxW > 0 && (<>
        <div key={item.url} style={{
          position: 'relative', width: `${boxW}px`, height: `${boxH}px`,
          borderRadius: '14px', overflow: 'hidden', background: 'var(--data-bg)',
          animation: 'wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {item.type === 'VIDEO' ? (
            <video
              src={item.url} poster={item.thumb || undefined}
              autoPlay loop playsInline controls preload="metadata"
              /* Default BERSUARA (keputusan Nadir 19 Agu 2026; tombol mute tetap ada di controls).
                 Popup dibuka lewat klik, jadi browser umumnya mengizinkan autoplay bersuara;
                 kalau ditolak (Safari ketat / kebijakan site), jatuh ke mute supaya tetap jalan. */
              ref={el => {
                if (!el || el.dataset.wdAuto) return;
                el.dataset.wdAuto = '1';
                el.muted = false;
                const p = el.play();
                if (p && p.catch) p.catch(() => { el.muted = true; el.play().catch(() => {}); });
              }}
              onLoadedMetadata={e => remember(item.url, e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
            />
          ) : (
            <img
              src={item.url} alt={adName || ''}
              onLoad={e => remember(item.url, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}

          {/* Label kecil platform sumber konten (klik = buka post asli) */}
          {(() => {
            const Tag = media.permalink ? 'a' : 'span';
            return (
              <Tag
                {...(media.permalink ? { href: media.permalink, target: '_blank', rel: 'noopener noreferrer', title: `Open on ${chip.label}` } : {})}
                style={{
                  position: 'absolute', top: '10px', left: '10px', zIndex: 2,
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 9px 4px 7px', borderRadius: '20px',
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                  color: '#fff', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.3px',
                  textDecoration: 'none', cursor: media.permalink ? 'pointer' : 'default',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}>
                <chip.Icon size={11} color="#fff" /> {chip.label}
              </Tag>
            );
          })()}

          {/* Carousel: panah + titik */}
          {items.length > 1 && (
            <>
              <button onClick={() => setIdx(i => (i - 1 + items.length) % items.length)} style={navBtn('left')} title="Previous">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => setIdx(i => (i + 1) % items.length)} style={navBtn('right')} title="Next">
                <ChevronRight size={15} />
              </button>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: item.type === 'VIDEO' ? '52px' : '10px', display: 'flex', justifyContent: 'center', gap: '5px', zIndex: 2 }}>
                {items.map((_, i) => (
                  <span key={i} onClick={() => setIdx(i)} style={{
                    width: i === idx ? '14px' : '6px', height: '6px', borderRadius: '3px', cursor: 'pointer',
                    background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)', transition: 'width 0.2s, background 0.2s',
                  }} />
                ))}
              </div>
            </>
          )}
        </div>
        {/* Caption nama ad (info yang sebelumnya ada di bawah embed) */}
        <div style={{ fontSize: '10.5px', color: 'var(--t3)', marginTop: '8px', maxWidth: `${Math.max(boxW, 200)}px`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
          {adName}
        </div>
      </>)}
    </div>
  );
}

/* Format tampilan konten untuk FALLBACK embed Instagram (dipakai hanya kalau
   media asli tidak berhasil diambil): DEFAULT portrait (mayoritas iklan Baba
   Rafi 9:16 — keputusan Nadir 7 Agu 2026). Rasio asli tidak terdeteksi dari
   permalink, jadi ada toggle manual portrait/feed di header panel konten. */

export default function CampaignModal({ campaign, query, periodLabel, onClose }) {
  const [detail, setDetail]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeAd, setActiveAd] = useState(0);      // index konten terpilih
  const [closing, setClosing]   = useState(false);
  // Format preview konten — default portrait, reset tiap ganti konten
  const [viewFormat, setViewFormat] = useState('portrait');
  useEffect(() => { setViewFormat('portrait'); }, [activeAd]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res  = await authFetch(`/api/meta?mode=campaign_detail&campaign_id=${campaign.id}&${query}`);
        const json = await res.json();
        if (!alive) return;
        if (json.error) throw new Error(json.error);
        setDetail(json);
      } catch (err) {
        if (alive) setError(err.message);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [campaign.id, query]);

  // Tutup dengan animasi reverse
  function close() {
    setClosing(true);
    setTimeout(onClose, 170);
  }
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* ── Data metrik (dari row yang di-klik — konsisten dengan tabel) ── */
  const ci          = campaign.insights?.data?.[0] || {};
  const cLeads      = getLeads(ci.actions);
  const cLinkClicks = getLinkClicks(ci.actions);
  const spend       = parseFloat(ci.spend || 0);
  const cCPM = parseFloat(ci.impressions || 0) > 0 ? (spend / parseFloat(ci.impressions)) * 1000 : null;
  const cCPC = cLinkClicks > 0 ? spend / cLinkClicks : null;
  const cCPL = cLeads > 0 ? spend / cLeads : null;
  const result   = getResult(campaign, ci);
  // Nilai mentah result untuk animasi count-up (mengikuti branch yang sama dengan getResult)
  const cName     = campaign.name?.toUpperCase() || '';
  const resultRaw = cName.includes('AWR REACH') ? parseFloat(ci.reach || 0)
    : cName.includes('AWR') ? parseFloat(ci.impressions || 0)
    : cName.includes('TRAFFIC') ? (cLinkClicks || 0)
    : (cName.includes('PROSPEK') || cName.includes('KONVERSI')) ? (cLeads || 0)
    : 0;
  const grp      = OBJ_GROUP[campaign.objective] || 'Awareness';
  const grpStyle = OBJ_STYLE[grp];
  const isActive = campaign.status === 'ACTIVE';

  /* ── Konten: dedupe creative lalu bagi feed / portrait ── */
  const seen = new Set();
  const uniqueAds = (detail?.ads || []).filter(ad => {
    const key = ad.creative?.instagram_permalink_url || ad.creative?.id || ad.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return !!(ad.creative?.instagram_permalink_url || ad.creative?.thumbnail_url || ad.creative?.image_url);
  });
  const currentAd  = uniqueAds[Math.min(activeAd, Math.max(uniqueAds.length - 1, 0))] || null;
  const currentUrl = currentAd ? embedUrl(currentAd.creative?.instagram_permalink_url) : null;
  const currentImg = currentAd ? (currentAd.creative?.image_url || currentAd.creative?.thumbnail_url) : null;
  const isPortrait = viewFormat === 'portrait';
  // Media asli dari API (IG) → preview full. Tanpa itu: ada permalink → embed IG
  // (fallback, masih ber-frame); tanpa permalink → gambar creative (konten Facebook).
  const currentMedia = currentAd?.media
    || (currentAd && !currentUrl && currentImg
      ? { platform: 'facebook', permalink: null, items: [{ type: 'IMAGE', url: currentImg, thumb: currentImg }] }
      : null);
  const useEmbed = !!(currentAd && !currentMedia && currentUrl);

  /* ── Platform breakdown ── */
  const platforms  = (detail?.platforms || []).filter(p => parseFloat(p.spend || 0) > 0 || parseFloat(p.impressions || 0) > 0);
  const totalPlatformSpend = platforms.reduce((s, p) => s + parseFloat(p.spend || 0), 0);

  /* ── Styles kecil ── */
  const sectionLabel = {
    fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase',
    color: 'var(--t3)', marginBottom: '10px',
  };
  const tile = (delay = 0) => ({
    background: 'var(--data-bg)', border: '1px solid var(--data-br)', borderRadius: '10px',
    padding: '10px 13px', animation: `wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1) ${delay}s backwards`,
  });
  const tileLabel = { fontSize: '10px', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' };
  const tileValue = { fontSize: '14px', fontWeight: 600, color: 'var(--t1)' };

  // Metrik delivery (count-up angka) & metrik biaya (count-up Rupiah)
  const deliveryTiles = [
    { label: 'Reach',       Icon: Users,             raw: parseFloat(ci.reach || 0),       display: fmtNum(ci.reach) },
    { label: 'Impressions', Icon: Eye,               raw: parseFloat(ci.impressions || 0), display: fmtNum(ci.impressions) },
    { label: 'Traffic',     Icon: MousePointerClick, raw: cLinkClicks || 0,                display: fmtNum(cLinkClicks) },
    { label: 'Leads',       Icon: UserPlus,          raw: cLeads || 0,                     display: cLeads ? fmtNum(cLeads) : '—' },
  ];
  const costTiles = [
    { label: 'CPM',          Icon: Gauge,    raw: cCPM,  display: fmtRpFull(cCPM) },
    { label: 'CPC',          Icon: Coins,    raw: cCPC,  display: fmtRpFull(cCPC) },
    { label: 'CPL',          Icon: Wallet,   raw: cCPL,  display: fmtRpFull(cCPL) },
    { label: 'Daily Budget', Icon: Banknote, raw: campaign.daily_budget ? parseInt(campaign.daily_budget) : null, display: campaign.daily_budget ? fmtRpFull(parseInt(campaign.daily_budget)) : '—' },
  ];

  // Hover lift kecil untuk tile (inline style, konsisten dengan pola project)
  const liftOn  = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--cal-accent-line)'; e.currentTarget.style.boxShadow = '0 4px 14px var(--cal-glow)'; };
  const liftOff = (e) => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.borderColor = 'var(--data-br)';         e.currentTarget.style.boxShadow = 'none'; };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5,7,10,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px',
        animation: closing ? 'wdFadeIn 0.17s ease reverse forwards' : 'wdFadeIn 0.2s ease',
      }}
    >
      <div style={{
        position: 'relative',
        width: 'min(1020px, 94vw)', height: 'min(660px, 90vh)',
        background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '18px',
        boxShadow: 'var(--pop-shadow)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: closing
          ? 'wdSlideUp 0.17s cubic-bezier(0.4,0,0.2,1) reverse forwards'
          : 'wdSlideUp 0.24s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* hairline aksen atas */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px', zIndex: 1,
          background: 'linear-gradient(90deg, transparent, var(--cal-accent), transparent)',
          transformOrigin: 'left', animation: 'wdGrowX 0.7s cubic-bezier(0.4,0,0.2,1) 0.15s backwards',
        }} />

        {/* ── Header ── */}
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid var(--br)', background: 'var(--sf)',
          display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {campaign.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 500, background: grpStyle.bg, color: grpStyle.color }}>{grp}</span>
              {isActive ? (
                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(16,185,129,0.14)', color: '#10b981', fontWeight: 600 }}>▶ Active</span>
              ) : (
                <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(115,115,115,0.12)', color: 'var(--t3)', fontWeight: 600 }}>■ {campaign.status === 'PAUSED' ? 'Stop' : 'Ended'}</span>
              )}
              <span style={{ fontSize: '11px', color: 'var(--t3)' }}>{periodLabel}</span>
            </div>
          </div>
          <button
            onClick={close}
            style={{
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--br)', borderRadius: '9px', background: 'transparent', cursor: 'pointer',
              transition: 'background 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={15} color="var(--t2)" />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

          {/* ═══ KIRI: konten iklan ═══ */}
          <div style={{ width: '430px', flexShrink: 0, borderRight: '1px solid var(--br)', background: 'var(--sf)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Header panel konten */}
            <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IgIcon size={12} color="var(--t3)" /> Ad Creative
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {uniqueAds.length > 1 && (
                  <span style={{ fontSize: '10.5px', color: 'var(--t3)' }}>
                    {Math.min(activeAd, uniqueAds.length - 1) + 1} / {uniqueAds.length}
                  </span>
                )}
                {/* Toggle format preview — HANYA untuk fallback embed IG (media asli rasionya otomatis) */}
                {useEmbed && (
                  <span style={{ display: 'flex', gap: '3px', padding: '2px', borderRadius: '8px', border: '1px solid var(--br)', background: 'var(--cd)' }}>
                    {[
                      { v: 'portrait', Icon: RectangleVertical, title: 'Portrait (9:16)' },
                      { v: 'feed',     Icon: Square,            title: 'Feed (1:1)' },
                    ].map(o => {
                      const on = viewFormat === o.v;
                      return (
                        <button key={o.v} onClick={() => setViewFormat(o.v)} title={o.title} style={{
                          width: '22px', height: '22px', padding: 0, borderRadius: '6px', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          background: on ? 'var(--cal-accent-soft)' : 'transparent',
                          color: on ? 'var(--cal-accent-line)' : 'var(--t3)',
                          transition: 'background 0.12s, color 0.12s',
                        }}>
                          <o.Icon size={12} />
                        </button>
                      );
                    })}
                  </span>
                )}
              </span>
            </div>

            {/* Preview — media asli full-bleed; embed IG hanya fallback */}
            {!loading && !error && currentMedia ? (
              <MediaPreview key={currentAd.id} media={currentMedia} adName={currentAd.name} />
            ) : (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 18px 12px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
                  <RefreshCw size={18} color="var(--t3)" style={{ animation: 'wdSpin 0.8s linear infinite', marginBottom: '10px' }} />
                  <div>Loading ad creatives...</div>
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '12px', padding: '0 20px' }}>
                  <ImageOff size={20} color="var(--t3)" style={{ marginBottom: '10px' }} />
                  <div>Failed to load creatives: {error}</div>
                </div>
              ) : !currentAd ? (
                <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
                  <ImageOff size={20} color="var(--t3)" style={{ marginBottom: '10px' }} />
                  <div>No ad creative content in this campaign</div>
                </div>
              ) : (
                /* Fallback: embed Instagram (masih ber-frame) — hanya kalau media asli gagal diambil */
                <div key={currentAd.id || ''} style={{ animation: 'wdFadeUp 0.3s cubic-bezier(0.4,0,0.2,1)', textAlign: 'center', maxWidth: '100%' }}>
                  <iframe
                    src={currentUrl}
                    loading="lazy"
                    scrolling="no"
                    frameBorder="0"
                    allow="encrypted-media"
                    style={{
                      width: isPortrait ? '292px' : '340px',
                      height: isPortrait ? '505px' : '425px',
                      border: '1px solid var(--br)', borderRadius: '14px',
                      background: '#fff', display: 'block', margin: '0 auto',
                      boxShadow: 'var(--card-shadow)',
                    }}
                  />
                  <div style={{ fontSize: '10.5px', color: 'var(--t3)', marginTop: '8px', maxWidth: '330px', margin: '8px auto 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentAd.name}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Strip thumbnail kalau ada > 1 konten */}
            {uniqueAds.length > 1 && (
              <div style={{ padding: '10px 18px 14px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0, justifyContent: 'center' }}>
                {uniqueAds.map((ad, i) => {
                  const on = i === Math.min(activeAd, uniqueAds.length - 1);
                  const thumb = ad.creative?.thumbnail_url || ad.creative?.image_url;
                  return (
                    <button key={ad.id} onClick={() => setActiveAd(i)}
                      title={ad.name}
                      style={{
                        width: '42px', height: '42px', padding: 0, borderRadius: '9px', overflow: 'hidden', flexShrink: 0,
                        border: on ? '2px solid var(--cal-accent)' : '1px solid var(--br)',
                        background: 'var(--data-bg)', cursor: 'pointer',
                        boxShadow: on ? '0 2px 8px var(--cal-glow)' : 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}>
                      {thumb
                        ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <ImageOff size={14} color="var(--t3)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ KANAN: performa + platform ═══ */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 24px' }}>

            {/* ── HERO: Result + Total Spend ── */}
            <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '14px', height: '2px', borderRadius: '1px', background: 'var(--cal-accent)', display: 'inline-block' }} />
              Performance
            </div>
            <div style={{
              position: 'relative', overflow: 'hidden',
              borderRadius: '14px', border: '1px solid var(--cal-accent-soft)',
              background: 'linear-gradient(135deg, var(--cal-accent-soft) 0%, transparent 62%)',
              padding: '16px 18px', marginBottom: '14px',
              animation: 'wdFadeUp 0.35s cubic-bezier(0.4,0,0.2,1) 0.02s backwards',
            }}>
              {/* glow dekoratif pojok */}
              <div style={{
                position: 'absolute', top: '-46px', right: '-46px', width: '150px', height: '150px',
                borderRadius: '50%', background: 'var(--cal-glow)', filter: 'blur(46px)', opacity: 0.55, pointerEvents: 'none',
              }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '13px' }}>
                  <span style={{
                    width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
                    boxShadow: '0 4px 14px var(--cal-glow)',
                  }}>
                    <Target size={19} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...tileLabel, color: 'var(--cal-accent-line)', marginBottom: '2px' }}>Result · {result.label}</div>
                    <div style={{ fontSize: '23px', fontWeight: 700, color: 'var(--t1)', lineHeight: 1.15 }}>
                      {resultRaw > 0 ? <CountUp value={resultRaw} display={result.value} duration={800} delay={150} /> : result.value}
                    </div>
                  </div>
                </div>
                <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--br)', flexShrink: 0 }} />
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ ...tileLabel, marginBottom: '2px' }}>Total Spend</div>
                  <div style={{ fontSize: '19px', fontWeight: 700, color: 'var(--cal-accent-line)', lineHeight: 1.2 }}>
                    {spend > 0 ? <CountUp value={spend} display={fmtRpFull(spend)} duration={800} delay={150} /> : fmtRpFull(spend)}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Delivery: 2x2 dengan icon + count-up ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '9px' }}>
              {deliveryTiles.map((m, i) => (
                <div key={m.label}
                  onMouseEnter={liftOn} onMouseLeave={liftOff}
                  style={{ ...tile(0.08 + i * 0.04), display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 13px', transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s' }}>
                  <span style={{
                    width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--cal-accent-soft)', color: 'var(--cal-accent-line)',
                  }}>
                    <m.Icon size={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={tileLabel}>{m.label}</div>
                    <div style={{ ...tileValue, fontSize: '15px' }}>
                      {m.raw > 0 ? <CountUp value={m.raw} display={m.display} duration={800} delay={200 + i * 60} /> : m.display}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Cost efficiency ── */}
            <div style={{ ...sectionLabel, marginTop: '18px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '14px', height: '2px', borderRadius: '1px', background: 'var(--cal-accent)', display: 'inline-block' }} />
              Cost Efficiency
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '9px' }}>
              {costTiles.map((m, i) => (
                <div key={m.label}
                  onMouseEnter={liftOn} onMouseLeave={liftOff}
                  style={{ ...tile(0.22 + i * 0.04), display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 13px', transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s' }}>
                  <span style={{
                    width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--hover)', color: 'var(--t2)',
                  }}>
                    <m.Icon size={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={tileLabel}>{m.label}</div>
                    <div style={{ ...tileValue, fontSize: '15px' }}>
                      {m.raw ? <CountUp value={m.raw} display={m.display} duration={800} delay={280 + i * 60} /> : m.display}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Platforms */}
            <div style={{ ...sectionLabel, marginTop: '18px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '14px', height: '2px', borderRadius: '1px', background: 'var(--cal-accent)', display: 'inline-block' }} />
              Running On
            </div>
            {loading ? (
              <div style={{ fontSize: '11.5px', color: 'var(--t3)' }}>Loading platforms...</div>
            ) : platforms.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: 'var(--t3)' }}>No platform delivery data for this period</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {platforms.map((p, i) => {
                  const meta  = PLATFORM_META[p.publisher_platform] || { label: p.publisher_platform, Icon: Globe, chipBg: 'var(--hover)', chipFg: 'var(--t2)' };
                  const share = totalPlatformSpend > 0 ? (parseFloat(p.spend || 0) / totalPlatformSpend) * 100 : 0;
                  const Icon  = meta.Icon;
                  return (
                    <div key={p.publisher_platform}
                      onMouseEnter={liftOn} onMouseLeave={liftOff}
                      style={{ ...tile(0.36 + i * 0.06), padding: '11px 14px', transition: 'transform 0.18s, border-color 0.18s, box-shadow 0.18s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
                        <span style={{
                          width: '28px', height: '28px', borderRadius: '9px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: meta.chipBg, color: meta.chipFg,
                        }}>
                          <Icon size={14} />
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--t1)', flex: 1 }}>{meta.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>{fmtRpFull(parseFloat(p.spend || 0))}</span>
                        <span style={{ fontSize: '10.5px', color: 'var(--t3)', width: '38px', textAlign: 'right' }}>{share.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: '4px', borderRadius: '2px', background: 'var(--track)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${share}%`, height: '100%', borderRadius: '2px',
                          background: 'var(--cal-accent)', transformOrigin: 'left',
                          animation: `wdGrowX 0.6s cubic-bezier(0.4,0,0.2,1) ${0.2 + i * 0.08}s backwards`,
                        }} />
                      </div>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '7px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--t3)' }}>Impressions <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{fmtNum(p.impressions)}</span></span>
                        <span style={{ fontSize: '10.5px', color: 'var(--t3)' }}>Reach <span style={{ color: 'var(--t2)', fontWeight: 500 }}>{fmtNum(p.reach)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
