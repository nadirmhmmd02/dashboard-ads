'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapPinned, RefreshCw, CloudDownload, Settings2, Search, X,
  CheckCircle2, AlertTriangle, Navigation, CircleOff, ExternalLink,
  Globe2, Database,
} from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { authFetch } from '../supabase';
import Dropdown from '../components/Dropdown';
import ThemeToggle from '../components/ThemeToggle';
import CountUp from '../components/CountUp';
import MapView from '../components/MapView';
import useIsMobile from '../components/useIsMobile';
import {
  MAPS_STATUS, STATUS_LABEL, REVIEW_COLOR, statusColor,
  PROVINSI, UNMAPPED_PROVINSI,
} from '../components/mapsConfig';

/* ─────────────────────────────────────────────────────────────
   MAPS HUB — halaman /maps (ADMIN-ONLY fase 1, lihat MAPS-HUB-PLAN.md).
   Monitoring status pendaftaran Google Maps 500+ outlet dari Google
   Sheets (read-only). Atas→bawah: header card → KPI (klik = filter
   status) → banner geocode (kalau ada kota kosong) → peta + panel
   Alerts/Data Quality → tabel outlet + toolbar filter.
   AppShell sudah me-redirect role non-admin.
   ───────────────────────────────────────────────────────────── */

const EASE = 'cubic-bezier(0.4,0,0.2,1)';
const FIELD_LABEL = { alamat: 'Address', ordinat_raw: 'Coordinates', nama_gmaps: 'Google Maps name' };

function relTime(iso) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/* Pill status (dipakai tabel + panel) */
function StatusPill({ status, coordBroken }) {
  const color = statusColor(status, coordBroken);
  const label = coordBroken ? 'Needs Review' : (STATUS_LABEL[status] || status || '—');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 9px', borderRadius: '999px',
      border: `1px solid ${color}40`, background: `${color}14`, color,
      fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

/* Kartu KPI — klik = filter status */
function KpiCard({ label, value, color, active, onClick, index }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer',
      background: 'var(--cd)', borderRadius: '16px',
      border: active ? `1.5px solid ${color}` : '1px solid var(--br)',
      boxShadow: active ? `0 0 0 3px ${color}22` : 'none',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: '4px',
      transition: `border-color 0.18s, box-shadow 0.18s, transform 0.18s ${EASE}`,
      animation: `wdFadeUp 0.4s ${EASE} both`, animationDelay: `${index * 0.05}s`,
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
      title={active ? 'Click to clear filter' : 'Click to filter'}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--t2)' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </span>
      <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
        <CountUp value={value} display={value.toLocaleString('id-ID')} duration={700} delay={100} />
      </span>
    </button>
  );
}

const ALERT_META = {
  relokasi:       { icon: Navigation,    color: '#3B82F6', title: 'Relocated' },
  perubahan_info: { icon: AlertTriangle, color: '#F59E0B', title: 'Info changed' },
  hilang:         { icon: CircleOff,     color: '#EF4444', title: 'Missing from sheet' },
};

function alertDesc(a) {
  if (a.type === 'relokasi') return `Moved from "${a.detail?.dari || '?'}" — update the Google Maps listing.`;
  if (a.type === 'perubahan_info') {
    const fields = (a.detail?.changed || []).map(c => FIELD_LABEL[c.field] || c.field).join(', ');
    return `${fields || 'Data'} changed in the sheet — check the listing.`;
  }
  return 'No longer in the spreadsheet — check manually (closed? renamed without "Nama Lama"?).';
}

export default function MapsPage() {
  const { role, ready, theme } = useAuth();
  const isMobile = useIsMobile();

  const [data, setData]         = useState(null);   // { outlets, alerts, depoProvinsi, lastSync }
  const [loading, setLoading]   = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [toast, setToast]       = useState(null);   // { kind:'ok'|'err', lines:[] }
  const [toastClosing, setToastClosing] = useState(false);

  const [fStatus, setFStatus] = useState('all');    // all | <status> | review
  const [fDepo, setFDepo]     = useState('all');
  const [fProv, setFProv]     = useState('all');
  const [fKota, setFKota]     = useState('all');
  const [search, setSearch]   = useState('');
  const [focus, setFocus]     = useState(null);
  const [panelTab, setPanelTab] = useState('alerts');

  const [showWilayah, setShowWilayah] = useState(false);
  const [wilayahClosing, setWilayahClosing] = useState(false);
  const [expandedDepo, setExpandedDepo] = useState(null);

  const [geo, setGeo] = useState({ running: false, done: 0, total: 0 });
  const geoStop = useRef(false);
  const toastTimer = useRef(null);

  /* ── Data ── */
  async function load() {
    try {
      const res = await authFetch('/api/maps');
      const json = await res.json();
      if (json.needsSetup) { setNeedsSetup(true); setLoading(false); return; }
      if (json.error) throw new Error(json.error);
      setNeedsSetup(false);
      setData(json);
    } catch (e) {
      showToast('err', ['Failed to load: ' + e.message]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (ready && role === 'admin') load();
    return () => { geoStop.current = true; if (toastTimer.current) clearTimeout(toastTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, role]);

  function showToast(kind, lines) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastClosing(false);
    setToast({ kind, lines });
    toastTimer.current = setTimeout(closeToast, 9000);
  }
  function closeToast() {
    setToastClosing(true);
    setTimeout(() => { setToast(null); setToastClosing(false); }, 200);
  }

  async function doSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await authFetch('/api/maps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const json = await res.json();
      if (json.needsSetup) { setNeedsSetup(true); return; }
      if (json.error) throw new Error(json.error);
      const s = json.summary || {};
      const lines = [
        `${s.total ?? 0} outlets synced`,
        s.baru ? `${s.baru} new` : null,
        s.relokasi ? `${s.relokasi} relocated` : null,
        s.berubah ? `${s.berubah} info changed` : null,
        s.hilang ? `${s.hilang} missing from sheet` : null,
        (s.duplikat || []).length ? `${s.duplikat.length} duplicate names skipped` : null,
        s.dilewati ? `${s.dilewati} rows without name skipped` : null,
        s.needs_review ? `${s.needs_review} coordinates need review` : null,
      ].filter(Boolean);
      showToast('ok', lines);
      await load();
    } catch (e) {
      showToast('err', [e.message]);
    }
    setSyncing(false);
  }

  async function markDone(alert) {
    setData(d => ({ ...d, alerts: d.alerts.filter(a => a.id !== alert.id) })); // optimistik
    await authFetch('/api/maps', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_done', alert_id: alert.id }),
    });
  }

  async function setProvinsi(depo, provinsi) {
    setExpandedDepo(null);
    setData(d => {
      const rest = (d.depoProvinsi || []).filter(m => m.depo !== depo);
      return { ...d, depoProvinsi: [...rest, { depo, provinsi }] };
    });
    await authFetch('/api/maps', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_provinsi', depo, provinsi }),
    });
  }

  async function startGeocode() {
    if (geo.running) return;
    geoStop.current = false;
    const total = pendingGeocode;
    setGeo({ running: true, done: 0, total });
    let done = 0;
    try {
      for (let i = 0; i < 40 && !geoStop.current; i++) {
        const res = await authFetch('/api/maps', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'geocode', limit: 35 }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        done += json.processed || 0;
        setGeo({ running: true, done, total });
        if (!json.remaining || !json.processed) break;
      }
      showToast('ok', [`Geocoding done — ${done} outlets got a city name.`]);
    } catch (e) {
      showToast('err', ['Geocoding stopped: ' + e.message, `${done} processed — click again to continue.`]);
    }
    setGeo({ running: false, done: 0, total: 0 });
    await load();
  }

  function closeWilayah() {
    setWilayahClosing(true);
    setTimeout(() => { setShowWilayah(false); setWilayahClosing(false); setExpandedDepo(null); }, 200);
  }

  /* ── Derivasi ── */
  const outlets = data?.outlets || [];
  const alerts  = data?.alerts || [];
  const lastSync = data?.lastSync || null;

  const provMap = useMemo(() =>
    new Map((data?.depoProvinsi || []).map(m => [m.depo, m.provinsi])), [data]);

  const enriched = useMemo(() => outlets.map(o => ({
    ...o,
    provinsi: (o.depo && provMap.get(o.depo)) || UNMAPPED_PROVINSI,
  })), [outlets, provMap]);

  const counts = useMemo(() => {
    const c = { total: enriched.length, review: 0 };
    for (const s of MAPS_STATUS) c[s.value] = 0;
    for (const o of enriched) {
      if (o.coord_error) c.review++;
      if (c[o.status] !== undefined) c[o.status]++;
    }
    return c;
  }, [enriched]);

  const depoOptions = useMemo(() => {
    const set = [...new Set(enriched.map(o => o.depo).filter(Boolean))].sort();
    return [{ value: 'all', label: 'All Depo' }, ...set.map(d => ({ value: d, label: d }))];
  }, [enriched]);

  const provOptions = useMemo(() => {
    const set = [...new Set(enriched.map(o => o.provinsi))].sort();
    return [{ value: 'all', label: 'All Province' }, ...set.map(p => ({ value: p, label: p }))];
  }, [enriched]);

  const kotaOptions = useMemo(() => {
    const set = [...new Set(enriched.map(o => o.kota).filter(k => k && k !== '-'))].sort();
    return [{ value: 'all', label: 'All City' }, ...set.map(k => ({ value: k, label: k }))];
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(o => {
      if (fStatus === 'review') { if (!o.coord_error) return false; }
      else if (fStatus !== 'all' && o.status !== fStatus) return false;
      if (fDepo !== 'all' && o.depo !== fDepo) return false;
      if (fProv !== 'all' && o.provinsi !== fProv) return false;
      if (fKota !== 'all' && o.kota !== fKota) return false;
      if (q) {
        const hay = `${o.nama} ${o.alamat || ''} ${o.nama_gmaps || ''} ${o.depo || ''} ${o.kota || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, fStatus, fDepo, fProv, fKota, search]);

  const mapOutlets = useMemo(() =>
    filtered.filter(o => o.lat != null && o.lng != null && !o.missing_since), [filtered]);

  const pendingGeocode = useMemo(() =>
    outlets.filter(o => o.lat != null && o.kota == null).length, [outlets]);

  const unmappedDepos = useMemo(() => {
    const all = [...new Set(outlets.map(o => o.depo).filter(Boolean))];
    return all.filter(d => !provMap.get(d)).sort();
  }, [outlets, provMap]);

  const allDepos = useMemo(() => {
    const countByDepo = {};
    outlets.forEach(o => { if (o.depo) countByDepo[o.depo] = (countByDepo[o.depo] || 0) + 1; });
    const names = Object.keys(countByDepo).sort();
    // Yang belum dipetakan tampil paling atas
    return [
      ...names.filter(d => !provMap.get(d)),
      ...names.filter(d => provMap.get(d)),
    ].map(d => ({ depo: d, n: countByDepo[d], provinsi: provMap.get(d) || null }));
  }, [outlets, provMap]);

  const quality = useMemo(() => {
    const s = lastSync?.summary || {};
    return {
      duplicates: s.duplikat || [],
      skipped: s.dilewati || 0,
      coordErr: enriched.filter(o => o.coord_error),
      emptyDepo: enriched.filter(o => !o.depo),
    };
  }, [lastSync, enriched]);

  const qualityCount = quality.duplicates.length + quality.coordErr.length + quality.emptyDepo.length + (quality.skipped ? 1 : 0);
  const filterActive = fStatus !== 'all' || fDepo !== 'all' || fProv !== 'all' || fKota !== 'all' || search.trim();

  function resetFilters() {
    setFStatus('all'); setFDepo('all'); setFProv('all'); setFKota('all'); setSearch('');
  }

  if (!ready || role !== 'admin') return null;

  /* ── Style bersama ── */
  const card = { background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '18px' };
  const iconBtn = {
    width: '40px', height: '40px', borderRadius: '10px',
    border: '1px solid var(--br)', background: 'var(--cd)', color: 'var(--t1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', flexShrink: 0,
  };
  const th = {
    textAlign: 'left', padding: '10px 12px', fontSize: '10px', fontWeight: 700,
    letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--t3)',
    borderBottom: '1px solid var(--br)', background: 'var(--cd)',
    position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap',
  };
  const td = {
    padding: '9px 12px', fontSize: '12px', color: 'var(--t1)',
    borderBottom: '1px solid var(--br)', verticalAlign: 'middle',
    overflow: 'hidden', textOverflow: 'ellipsis',
  };

  /* ── Setup hint (tabel Supabase belum dibuat) ── */
  if (needsSetup) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...card, maxWidth: '460px', padding: '28px', textAlign: 'center', animation: `wdFadeUp 0.4s ${EASE}` }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px', margin: '0 auto 14px',
            background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Database size={22} /></div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--t1)', marginBottom: '8px' }}>Maps Hub is not set up yet</div>
          <div style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.6, marginBottom: '18px' }}>
            Jalankan file <b style={{ color: 'var(--t1)' }}>supabase-maps-setup.sql</b> (ada di folder project) di
            Supabase → <b style={{ color: 'var(--t1)' }}>SQL Editor</b> → New query → paste → Run.
            Cukup sekali saja, lalu klik tombol di bawah.
          </div>
          <button onClick={() => { setLoading(true); load(); }} style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none',
            background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          }}>I&apos;ve run it — check again</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'auto',
      padding: isMobile ? '12px' : '12px 16px',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>

      {/* ── HEADER CARD ── */}
      <div style={{
        ...card, padding: isMobile ? '12px 14px' : '12px 18px',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap',
        animation: `wdFadeUp 0.35s ${EASE}`,
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
          background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><MapPinned size={19} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.3px' }}>Outlet Maps</div>
          <div style={{ fontSize: '11px', color: 'var(--t2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Google Maps monitoring · {outlets.length ? `${outlets.length} outlets` : 'no data yet'}
            {lastSync ? ` · Last sync ${relTime(lastSync.run_at)}` : ' · Never synced'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          {/* Wilayah (mapping Depo → Provinsi) */}
          <button title="Depo → Province mapping" onClick={() => setShowWilayah(true)} style={{ ...iconBtn, position: 'relative' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--br-strong)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}>
            <Settings2 size={16} />
            {unmappedDepos.length > 0 && (
              <span style={{
                position: 'absolute', top: '-5px', right: '-5px', minWidth: '17px', height: '17px',
                borderRadius: '999px', background: '#F59E0B', color: '#fff',
                fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', border: '2px solid var(--cd)',
              }}>{unmappedDepos.length}</span>
            )}
          </button>

          {/* Refresh */}
          <button title="Refresh data" onClick={() => { setLoading(true); load(); }} style={iconBtn}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--br-strong)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--br)'}>
            <RefreshCw size={16} style={loading ? { animation: 'wdSpin 1s linear infinite' } : undefined} />
          </button>

          {/* Sync */}
          <button onClick={doSync} disabled={syncing} title="Pull latest data from Google Sheets" style={{
            height: '40px', padding: '0 16px', borderRadius: '10px', border: 'none',
            background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
            fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px',
            cursor: syncing ? 'default' : 'pointer', opacity: syncing ? 0.75 : 1,
            transition: 'opacity 0.15s',
          }}>
            <CloudDownload size={16} style={syncing ? { animation: 'wdSpin 1s linear infinite' } : undefined} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>

          {!isMobile && <ThemeToggle />}
        </div>
      </div>

      {/* ── KPI (klik = filter status) ── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <KpiCard index={0} label="Total Outlets" value={counts.total} color="var(--cal-accent)"
          active={fStatus === 'all'} onClick={() => setFStatus('all')} />
        {MAPS_STATUS.map((s, i) => (
          <KpiCard key={s.value} index={i + 1} label={s.label} value={counts[s.value] || 0} color={s.color}
            active={fStatus === s.value} onClick={() => setFStatus(fStatus === s.value ? 'all' : s.value)} />
        ))}
        <KpiCard index={4} label="Needs Review" value={counts.review} color={REVIEW_COLOR}
          active={fStatus === 'review'} onClick={() => setFStatus(fStatus === 'review' ? 'all' : 'review')} />
      </div>

      {/* ── Banner geocode kota ── */}
      {pendingGeocode > 0 && (
        <div style={{
          ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
          borderColor: 'var(--cal-accent-line, var(--br))',
          animation: `wdFadeUp 0.4s ${EASE}`,
        }}>
          <Globe2 size={17} color="var(--ac)" style={{ flexShrink: 0 }} />
          {geo.running ? (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', marginBottom: '5px' }}>
                  Geocoding cities… {geo.done} of {geo.total}
                  <span style={{ fontWeight: 500, color: 'var(--t3)' }}> — takes ±1 second per outlet (OpenStreetMap rate limit), leave this tab open</span>
                </div>
                <div style={{ height: '5px', borderRadius: '999px', background: 'var(--hover)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: '100%', borderRadius: '999px', background: 'var(--cal-accent)',
                    transform: `scaleX(${geo.total ? geo.done / geo.total : 0})`,
                    transformOrigin: 'left', transition: 'transform 0.6s ease',
                  }} />
                </div>
              </div>
              <button onClick={() => { geoStop.current = true; }} style={{
                padding: '7px 12px', borderRadius: '9px', border: '1px solid var(--br)',
                background: 'var(--cd)', color: 'var(--t2)', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              }}>Stop</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, fontSize: '12px', color: 'var(--t1)', fontWeight: 600 }}>
                {`${pendingGeocode} ${pendingGeocode > 1 ? 'outlets' : 'outlet'} don't have a city name yet`}
                <span style={{ color: 'var(--t3)', fontWeight: 500 }}> — needed for the City filter (one-time, cached)</span>
              </div>
              <button onClick={startGeocode} style={{
                padding: '8px 14px', borderRadius: '9px', border: 'none',
                background: 'var(--cal-accent)', color: 'var(--cal-accent-fg)',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Geocode now</button>
            </>
          )}
        </div>
      )}

      {/* ── PETA + PANEL ── */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px',
        height: isMobile ? 'auto' : 'min(560px, 58vh)', minHeight: isMobile ? 0 : '400px',
      }}>
        {/* Peta — zIndex: 0 WAJIB: bikin stacking context sendiri supaya
            z-index internal Leaflet (pane 400, kontrol 1000) TERKURUNG di
            kartu ini dan tidak menimpa modal/toast halaman */}
        <div style={{
          ...card, flex: isMobile ? 'none' : 2.6, minWidth: 0, overflow: 'hidden', position: 'relative',
          zIndex: 0,
          height: isMobile ? '320px' : 'auto',
          animation: `wdFadeUp 0.45s ${EASE}`,
        }}>
          {outlets.length === 0 && !loading ? (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '16px',
                background: 'var(--hover)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><MapPinned size={24} color="var(--t3)" /></div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>No outlets yet</div>
              <div style={{ fontSize: '12px', color: 'var(--t2)', maxWidth: '300px', lineHeight: 1.6 }}>
                Click <b>Sync</b> to pull all outlets from the Google Sheets — the map, filters, and alerts fill in automatically.
              </div>
            </div>
          ) : (
            <>
              <MapView outlets={mapOutlets} theme={theme} focus={focus} />
              {/* Legend */}
              <div style={{
                position: 'absolute', left: '10px', bottom: '10px', zIndex: 500,
                display: 'flex', gap: '6px', flexWrap: 'wrap', pointerEvents: 'none',
              }}>
                {MAPS_STATUS.map(s => (
                  <span key={s.value} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '3px 8px', borderRadius: '999px',
                    background: 'var(--cd)', border: '1px solid var(--br)',
                    fontSize: '10px', fontWeight: 700, color: 'var(--t2)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
              {/* Jumlah tampil */}
              <div style={{
                position: 'absolute', right: '10px', top: '10px', zIndex: 500,
                padding: '4px 10px', borderRadius: '999px', pointerEvents: 'none',
                background: 'var(--cd)', border: '1px solid var(--br)',
                fontSize: '11px', fontWeight: 700, color: 'var(--t1)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)', fontVariantNumeric: 'tabular-nums',
              }}>
                {mapOutlets.length} on map
              </div>
            </>
          )}
        </div>

        {/* Panel Alerts / Data Quality */}
        <div style={{
          ...card, flex: 1, minWidth: isMobile ? 0 : '300px', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', maxHeight: isMobile ? '420px' : 'none',
          animation: `wdFadeUp 0.5s ${EASE}`,
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--br)', padding: '0 6px', flexShrink: 0 }}>
            {[
              { key: 'alerts', label: `Alerts`, n: alerts.length },
              { key: 'quality', label: `Data Quality`, n: qualityCount },
            ].map(t => (
              <button key={t.key} onClick={() => setPanelTab(t.key)} style={{
                flex: 1, padding: '12px 8px', border: 'none', background: 'transparent',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                color: panelTab === t.key ? 'var(--t1)' : 'var(--t3)',
                borderBottom: panelTab === t.key ? '2px solid var(--cal-accent)' : '2px solid transparent',
                marginBottom: '-1px', transition: 'color 0.15s, border-color 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                {t.label}
                {t.n > 0 && (
                  <span style={{
                    minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px',
                    background: panelTab === t.key ? 'var(--cal-accent)' : 'var(--hover)',
                    color: panelTab === t.key ? 'var(--cal-accent-fg)' : 'var(--t2)',
                    fontSize: '10px', fontWeight: 800, display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums',
                  }}>{t.n}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {panelTab === 'alerts' ? (
              <>
                {/* Ringkas kerjaan dari status (hilang sendiri saat sheet diubah) */}
                {(counts['Belum di Daftarkan'] > 0 || counts['Perlu Klaim Bisnis'] > 0) && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {counts['Belum di Daftarkan'] > 0 && (
                      <button onClick={() => setFStatus('Belum di Daftarkan')} style={{
                        padding: '5px 10px', borderRadius: '999px', cursor: 'pointer',
                        border: '1px solid #F59E0B40', background: '#F59E0B14', color: '#F59E0B',
                        fontSize: '11px', fontWeight: 700,
                      }}>{counts['Belum di Daftarkan']} to register</button>
                    )}
                    {counts['Perlu Klaim Bisnis'] > 0 && (
                      <button onClick={() => setFStatus('Perlu Klaim Bisnis')} style={{
                        padding: '5px 10px', borderRadius: '999px', cursor: 'pointer',
                        border: '1px solid #3B82F640', background: '#3B82F614', color: '#3B82F6',
                        fontSize: '11px', fontWeight: 700,
                      }}>{counts['Perlu Klaim Bisnis']} to claim</button>
                    )}
                  </div>
                )}

                {alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--t3)', fontSize: '12px', lineHeight: 1.6 }}>
                    <CheckCircle2 size={26} color="#2FB673" style={{ marginBottom: '8px' }} />
                    <div style={{ fontWeight: 700, color: 'var(--t2)' }}>All clear</div>
                    Changes detected on the next sync will show up here.
                  </div>
                ) : alerts.map((a, i) => {
                  const meta = ALERT_META[a.type] || ALERT_META.perubahan_info;
                  const AIcon = meta.icon;
                  return (
                    <div key={a.id} style={{
                      display: 'flex', gap: '10px', padding: '10px',
                      borderRadius: '12px', border: '1px solid var(--br)', marginBottom: '8px',
                      background: 'var(--data-bg, transparent)',
                      animation: `wdFadeUp 0.35s ${EASE} both`, animationDelay: `${Math.min(i, 8) * 0.04}s`,
                    }}>
                      <span style={{
                        width: '28px', height: '28px', borderRadius: '9px', flexShrink: 0,
                        background: `${meta.color}18`, color: meta.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}><AIcon size={14} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3 }}>{a.outlet_nama}</div>
                        <div style={{ fontSize: '11px', color: 'var(--t2)', margin: '3px 0', lineHeight: 1.45 }}>{alertDesc(a)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--t3)', fontWeight: 600 }}>{meta.title} · {relTime(a.created_at)}</div>
                      </div>
                      <button title="Mark as done" onClick={() => markDone(a)} style={{
                        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0, alignSelf: 'center',
                        border: '1px solid var(--br)', background: 'var(--cd)', color: 'var(--t3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        transition: 'color 0.15s, border-color 0.15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#2FB673'; e.currentTarget.style.borderColor = '#2FB67360'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)'; e.currentTarget.style.borderColor = 'var(--br)'; }}
                      ><CheckCircle2 size={14} /></button>
                    </div>
                  );
                })}
              </>
            ) : (
              /* ── Data Quality ── */
              qualityCount === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--t3)', fontSize: '12px', lineHeight: 1.6 }}>
                  <CheckCircle2 size={26} color="#2FB673" style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 700, color: 'var(--t2)' }}>Spreadsheet is clean</div>
                  Duplicate names, broken coordinates, and skipped rows will show up here after a sync.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {quality.duplicates.length > 0 && (
                    <QualitySection title={`Duplicate outlet names (${quality.duplicates.length})`}
                      hint="These rows are NOT processed until fixed in the sheet — rename or remove the doubles.">
                      {quality.duplicates.map(n => (
                        <div key={n} style={{ fontSize: '11px', color: 'var(--t1)', padding: '3px 0', fontWeight: 600 }}>• {n}</div>
                      ))}
                    </QualitySection>
                  )}
                  {quality.coordErr.length > 0 && (
                    <QualitySection title={`Coordinate issues (${quality.coordErr.length})`}
                      hint="Fix the Titik Ordinat cell in the sheet — these outlets can't be shown on the map.">
                      {quality.coordErr.map(o => (
                        <div key={o.id} style={{ padding: '3px 0' }}>
                          <span style={{ fontSize: '11px', color: 'var(--t1)', fontWeight: 600 }}>• {o.nama}</span>
                          <span style={{ fontSize: '10px', color: 'var(--t3)' }}> — {o.coord_error}</span>
                        </div>
                      ))}
                    </QualitySection>
                  )}
                  {quality.emptyDepo.length > 0 && (
                    <QualitySection title={`Missing Depo (${quality.emptyDepo.length})`}
                      hint="Depo cell is empty in the sheet.">
                      {quality.emptyDepo.map(o => (
                        <div key={o.id} style={{ fontSize: '11px', color: 'var(--t1)', padding: '3px 0', fontWeight: 600 }}>• {o.nama}</div>
                      ))}
                    </QualitySection>
                  )}
                  {quality.skipped > 0 && (
                    <QualitySection title={`${quality.skipped} rows skipped`}
                      hint='Rows without "Nama Outlet" (parked data) — they are ignored by sync.' />
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── TABEL OUTLET ── */}
      <div style={{ ...card, overflow: 'hidden', animation: `wdFadeUp 0.55s ${EASE}` }}>
        {/* Toolbar filter */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px',
          borderBottom: '1px solid var(--br)', flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', height: '36px',
            padding: '0 12px', borderRadius: '10px', border: '1px solid var(--br)',
            background: 'var(--cd)', flex: isMobile ? '1 1 100%' : '0 1 240px', minWidth: '160px',
          }}>
            <Search size={14} color="var(--t3)" style={{ flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search outlet, address, city…"
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: '12px', color: 'var(--t1)', width: '100%', fontFamily: 'inherit',
              }} />
            {search && (
              <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>

          <Dropdown label={fDepo === 'all' ? 'All Depo' : fDepo} options={depoOptions} value={fDepo} onSelect={setFDepo} minWidth={180} />
          <Dropdown label={fProv === 'all' ? 'All Province' : fProv} options={provOptions} value={fProv} onSelect={setFProv} minWidth={190} />
          <Dropdown label={fKota === 'all' ? 'All City' : fKota} options={kotaOptions} value={fKota} onSelect={setFKota} minWidth={180} />

          {filterActive && (
            <button onClick={resetFilters} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px',
              borderRadius: '10px', border: '1px solid var(--br)', background: 'var(--cd)',
              color: 'var(--t2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>
              <X size={12} /> Reset
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--t3)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {filtered.length} of {enriched.length}
          </span>
        </div>

        {/* Tabel */}
        <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
          {/* tableLayout FIXED wajib: dgn ~490 baris, layout auto bikin browser
              mengukur ulang semua cell tiap reflow (animasi sidebar jadi patah-patah) */}
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px', tableLayout: 'fixed' }}>
            <colgroup>
              <col />{/* Outlet = sisa lebar */}
              <col style={{ width: '120px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '150px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th}>Outlet</th>
                <th style={th}>Depo</th>
                <th style={th}>Province</th>
                <th style={th}>City</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'center' }}>Maps</th>
                <th style={th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...td, textAlign: 'center', padding: '32px', color: 'var(--t3)', borderBottom: 'none' }}>
                    {enriched.length === 0 ? 'No data — click Sync to pull outlets from Google Sheets.' : 'No outlets match your filters.'}
                    {filterActive && (
                      <button onClick={resetFilters} style={{
                        marginLeft: '10px', padding: '5px 12px', borderRadius: '8px',
                        border: '1px solid var(--br)', background: 'var(--cd)', color: 'var(--t1)',
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      }}>Reset filters</button>
                    )}
                  </td>
                </tr>
              ) : filtered.map((o, i) => (
                <tr key={o.id}
                  onClick={() => { if (o.lat != null && !o.missing_since) setFocus({ ...o, _t: Date.now() }); }}
                  style={{
                    cursor: o.lat != null && !o.missing_since ? 'pointer' : 'default',
                    opacity: o.missing_since ? 0.5 : 1,
                    transition: 'background 0.13s',
                    animation: i < 25 ? `wdFadeUp 0.3s ${EASE} both` : undefined,
                    animationDelay: i < 25 ? `${i * 0.018}s` : undefined,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...td, maxWidth: '260px' }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.nama}>
                      {o.nama}
                      {o.missing_since && (
                        <span style={{
                          marginLeft: '7px', fontSize: '9px', fontWeight: 800, color: '#EF4444',
                          border: '1px solid #EF444440', background: '#EF444414',
                          padding: '1.5px 6px', borderRadius: '999px', verticalAlign: 'middle',
                        }}>MISSING</span>
                      )}
                    </div>
                    {o.nama_gmaps && (
                      <div style={{ fontSize: '10px', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.nama_gmaps}>
                        {o.nama_gmaps}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{o.depo || '-'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: o.provinsi === UNMAPPED_PROVINSI ? 'var(--t3)' : 'var(--t1)' }}>
                    {o.provinsi === UNMAPPED_PROVINSI ? '—' : o.provinsi}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{o.kota && o.kota !== '-' ? o.kota : '-'}</td>
                  <td style={td}><StatusPill status={o.status} coordBroken={!!o.coord_error} /></td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {o.link_gmaps ? (
                      <a href={o.link_gmaps} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        title="Open Google Maps listing"
                        style={{ color: 'var(--ac)', display: 'inline-flex' }}>
                        <ExternalLink size={14} />
                      </a>
                    ) : <span style={{ color: 'var(--t3)' }}>-</span>}
                  </td>
                  <td style={{ ...td, maxWidth: '180px' }}>
                    <span style={{
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: o.catatan && o.catatan.toLowerCase() !== 'clear' ? '#F59E0B' : 'var(--t3)',
                      fontSize: '11px',
                    }} title={o.catatan || ''}>
                      {o.catatan || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL Depo → Provinsi ── */}
      {showWilayah && (
        <div
          onMouseDown={e => { if (e.target === e.currentTarget) closeWilayah(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, // di atas seluruh lapisan Leaflet (maks 1000)
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            animation: wilayahClosing ? `wdFadeOut 0.2s ${EASE} forwards` : `wdFadeIn 0.2s ${EASE}`,
          }}>
          <div style={{
            ...card, width: 'min(560px, 100%)', maxHeight: '76vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: wilayahClosing ? `wdFadeOut 0.2s ${EASE} forwards` : `wdScaleIn 0.2s ${EASE}`,
          }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--br)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings2 size={16} color="var(--t2)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--t1)' }}>Depo → Province</div>
                <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
                  New depos from the sheet appear here automatically after each sync.
                </div>
              </div>
              <button onClick={closeWilayah} style={{ ...iconBtn, width: '32px', height: '32px' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              {allDepos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--t3)', fontSize: '12px' }}>
                  No depos yet — run a Sync first.
                </div>
              ) : allDepos.map(d => (
                <div key={d.depo} style={{ borderBottom: '1px solid var(--br)' }}>
                  <button onClick={() => setExpandedDepo(expandedDepo === d.depo ? null : d.depo)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '11px 4px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      background: d.provinsi ? '#2FB673' : '#F59E0B',
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.depo}
                      <span style={{ fontWeight: 500, color: 'var(--t3)', fontSize: '11px' }}> · {d.n} outlet{d.n > 1 ? 's' : ''}</span>
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: d.provinsi ? 'var(--t2)' : '#F59E0B', whiteSpace: 'nowrap' }}>
                      {d.provinsi || 'Pick a province'}
                    </span>
                  </button>
                  {expandedDepo === d.depo && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '2px 4px 12px 22px',
                      animation: `wdFadeUp 0.22s ${EASE}`,
                    }}>
                      {PROVINSI.map(p => (
                        <button key={p} onClick={() => setProvinsi(d.depo, p)} style={{
                          padding: '5px 10px', borderRadius: '999px', cursor: 'pointer',
                          border: p === d.provinsi ? '1px solid var(--cal-accent)' : '1px solid var(--br)',
                          background: p === d.provinsi ? 'var(--cal-accent)' : 'var(--cd)',
                          color: p === d.provinsi ? 'var(--cal-accent-fg)' : 'var(--t2)',
                          fontSize: '11px', fontWeight: 600,
                          transition: 'border-color 0.13s, background 0.13s',
                        }}
                          onMouseEnter={e => { if (p !== d.provinsi) e.currentTarget.style.borderColor = 'var(--br-strong)'; }}
                          onMouseLeave={e => { if (p !== d.provinsi) e.currentTarget.style.borderColor = 'var(--br)'; }}
                        >{p}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST hasil sync / geocode ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 1300, // di atas modal & Leaflet
          width: 'min(340px, calc(100vw - 40px))',
          background: 'var(--cd)', border: '1px solid var(--br)', borderRadius: '14px',
          boxShadow: 'var(--pop-shadow)', padding: '14px 16px',
          animation: toastClosing ? `wdFadeOut 0.2s ${EASE} forwards` : `wdSlideUp 0.25s ${EASE}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: toast.lines.length > 1 ? '8px' : 0 }}>
            {toast.kind === 'ok'
              ? <CheckCircle2 size={16} color="#2FB673" style={{ flexShrink: 0 }} />
              : <AlertTriangle size={16} color="#EF4444" style={{ flexShrink: 0 }} />}
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--t1)', flex: 1 }}>
              {toast.kind === 'ok' ? toast.lines[0] : 'Something went wrong'}
            </span>
            <button onClick={closeToast} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          </div>
          {(toast.kind === 'ok' ? toast.lines.slice(1) : toast.lines).map((l, i) => (
            <div key={i} style={{ fontSize: '11px', color: 'var(--t2)', lineHeight: 1.6, paddingLeft: '24px' }}>• {l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Bagian di panel Data Quality */
function QualitySection({ title, hint, children }) {
  return (
    <div style={{ border: '1px solid var(--br)', borderRadius: '12px', padding: '10px 12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--t1)', marginBottom: '3px' }}>{title}</div>
      {hint && <div style={{ fontSize: '10.5px', color: 'var(--t3)', lineHeight: 1.5, marginBottom: children ? '7px' : 0 }}>{hint}</div>}
      {children && <div style={{ maxHeight: '150px', overflowY: 'auto' }}>{children}</div>}
    </div>
  );
}
