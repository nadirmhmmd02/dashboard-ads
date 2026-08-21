'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { TILE, MAP_CENTER, MAP_ZOOM, statusColor, STATUS_LABEL } from './mapsConfig';

/* ─────────────────────────────────────────────────────────────
   MAP VIEW (Maps Hub) — Leaflet MURNI (bukan react-leaflet):
   di-init sekali di useEffect (SSR aman karena 'use client' +
   dynamic import), marker di-rebuild tiap daftar outlet berubah.
   Clustering: leaflet.markercluster (wajib — 500+ marker).
   Tile CARTO light/dark ikut tema; styling popup/cluster ada di
   globals.css (.wd-map, .wd-cluster, .wd-dot).

   Props:
   - outlets  : outlet TERFILTER yang punya lat/lng valid
   - theme    : 'light' | 'dark' (dari useAuth)
   - focus    : outlet yang harus di-zoom + buka popup (klik baris tabel)
   ───────────────────────────────────────────────────────────── */

const esc = (s) => String(s || '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function popupHtml(o) {
  const color = statusColor(o.status, false);
  const label = STATUS_LABEL[o.status] || o.status || '—';
  const catatan = o.catatan && o.catatan.toLowerCase() !== 'clear'
    ? `<div class="wd-pop-note">${esc(o.catatan)}</div>` : '';
  const link = o.link_gmaps
    ? `<a class="wd-pop-link" href="${esc(o.link_gmaps)}" target="_blank" rel="noreferrer">Open in Google Maps ↗</a>` : '';
  return `
    <div class="wd-pop">
      <div class="wd-pop-name">${esc(o.nama)}</div>
      <div class="wd-pop-meta">${esc(o.depo || '—')}${o.kota && o.kota !== '-' ? ' · ' + esc(o.kota) : ''}</div>
      <div class="wd-pop-addr">${esc(o.alamat || '—')}</div>
      <div class="wd-pop-row">
        <span class="wd-pop-pill" style="color:${color};border-color:${color}40;background:${color}14">
          <span class="wd-pop-dot" style="background:${color}"></span>${esc(label)}
        </span>
        ${o.nama_gmaps ? `<span class="wd-pop-gm" title="Nama listing Google Maps">${esc(o.nama_gmaps)}</span>` : ''}
      </div>
      ${catatan}
      ${link}
    </div>`;
}

export default function MapView({ outlets, theme, focus }) {
  const boxRef     = useRef(null);
  const mapRef     = useRef(null);
  const tileRef    = useRef(null);
  const clusterRef = useRef(null);
  const markersRef = useRef(new Map()); // nama → marker
  const LRef       = useRef(null);
  // Anti race: data bisa datang SEBELUM import Leaflet selesai —
  // rebuild selalu membaca outlet TERBARU dari ref, bukan closure lama
  const outletsRef = useRef(outlets);
  outletsRef.current = outlets;

  // Init sekali (guard StrictMode double-mount via cleanup remove())
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet.markercluster');
      if (cancelled || !boxRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(boxRef.current, {
        center: MAP_CENTER, zoom: MAP_ZOOM,
        zoomControl: true, attributionControl: true,
        worldCopyJump: true,
      });
      mapRef.current = map;

      tileRef.current = L.tileLayer(TILE[theme === 'dark' ? 'dark' : 'light'], {
        attribution: TILE.attribution, maxZoom: 19, subdomains: 'abcd',
      }).addTo(map);

      clusterRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 52,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => {
          const n = cluster.getChildCount();
          const size = n >= 100 ? 46 : n >= 25 ? 40 : 32;
          return L.divIcon({
            html: `<div class="wd-cluster" style="width:${size}px;height:${size}px">${n}</div>`,
            className: 'wd-cluster-wrap', iconSize: [size, size],
          });
        },
      }).addTo(map);

      rebuildMarkers();
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markersRef.current.clear();
      clusterRef.current = null; tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ganti tema → ganti tile
  useEffect(() => {
    if (tileRef.current) tileRef.current.setUrl(TILE[theme === 'dark' ? 'dark' : 'light']);
  }, [theme]);

  function rebuildMarkers() {
    const L = LRef.current, cluster = clusterRef.current, map = mapRef.current;
    if (!L || !cluster || !map) return;
    cluster.clearLayers();
    markersRef.current.clear();

    const pts = [];
    for (const o of outletsRef.current) {
      if (o.lat == null || o.lng == null) continue;
      const color = statusColor(o.status, false);
      const marker = L.marker([o.lat, o.lng], {
        icon: L.divIcon({
          html: `<span class="wd-dot" style="background:${color}"></span>`,
          className: 'wd-dot-wrap', iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8],
        }),
        title: o.nama,
      });
      marker.bindPopup(popupHtml(o), { maxWidth: 300, closeButton: true });
      cluster.addLayer(marker);
      markersRef.current.set(o.nama, marker);
      pts.push([o.lat, o.lng]);
    }

    // Pas-kan viewport ke hasil filter (tanpa zoom berlebihan)
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 12, animate: true, duration: 0.6 });
    }
  }

  // Daftar outlet (hasil filter) berubah → rebuild marker
  useEffect(() => { rebuildMarkers(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outlets]);

  // Klik baris tabel → terbang ke outlet + buka popup
  useEffect(() => {
    const map = mapRef.current, cluster = clusterRef.current;
    if (!map || !focus || focus.lat == null) return;
    const marker = markersRef.current.get(focus.nama);
    map.flyTo([focus.lat, focus.lng], 16, { duration: 0.9 });
    if (marker && cluster) {
      // Tunggu terbang selesai supaya marker sudah keluar dari cluster
      setTimeout(() => { cluster.zoomToShowLayer(marker, () => marker.openPopup()); }, 950);
    }
  }, [focus]);

  return (
    <div ref={boxRef} className="wd-map" style={{ width: '100%', height: '100%', minHeight: '280px' }} />
  );
}
