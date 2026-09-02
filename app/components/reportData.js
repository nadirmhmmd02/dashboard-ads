/* ─────────────────────────────────────────────────────────────
   reportData.js — util untuk fitur EXPORT laporan.

   1) buildReportData(json): ubah respon /api/meta?mode=dashboard jadi
      { summary, chartData, chartDates, donut, activeCount } — RUMUS FINAL
      disalin PERSIS dari app/page.js (jangan diubah tanpa ubah dashboard juga).
      Dipakai saat export "pisah per bulan": tiap bulan di-fetch sendiri lalu
      dihitung ulang di sini.
   2) monthChunks / isWholeMonths / rangeLabelOf / monthToken: bantu memecah
      rentang tanggal menjadi bulan-bulan kalender (untuk opsi pisah per bulan).
   ───────────────────────────────────────────────────────────── */

const GREEN  = '#2FB673';
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';
const ORANGE = '#F59E0B';
const CIRC   = 238.76;

/* ── helpers (salinan dari page.js) ── */
function getActionValue(actions, types) {
  if (!actions) return 0;
  for (const t of types) {
    const a = actions.find(x => x.action_type === t);
    if (a) return parseInt(a.value) || 0;
  }
  return 0;
}
function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC'))                            return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}
function pctChange(cur, prev) {
  if (!prev || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}
function fmtSpendFull(n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); }
function fmtNumFull(n)   { return Math.round(n || 0).toLocaleString('id-ID'); }

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetweenStr(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) + 1;
}

// Bangun array chart selebar rentang; slot tanpa data = null (salinan page.js)
function buildChartData(daily, range) {
  if (!range || !range.since || !range.until) {
    const r = { spend: [], awareness: [], traffic: [], leads: [] };
    const dates = [];
    daily.forEach((d, i) => {
      r.spend.push(Math.round(parseFloat(d.spend || 0)));
      r.awareness.push(Math.round(parseFloat(d.impressions || 0)));
      r.traffic.push(getActionValue(d.actions, ['link_click']));
      r.leads.push(getActionValue(d.actions, ['lead', 'onsite_conversion.lead_grouped']));
      dates.push(d.date_start ? parseInt(d.date_start.slice(8, 10), 10) : i + 1);
    });
    return { data: r, dates };
  }
  const { since, until } = range;
  const n = Math.max(1, daysBetweenStr(since, until));
  const data = { spend: Array(n).fill(null), awareness: Array(n).fill(null), traffic: Array(n).fill(null), leads: Array(n).fill(null) };
  const dates = [];
  for (let i = 0; i < n; i++) dates.push(parseInt(addDaysStr(since, i).slice(8, 10), 10));
  daily.forEach(d => {
    if (!d.date_start) return;
    const idx = daysBetweenStr(since, d.date_start) - 1;
    if (idx < 0 || idx >= n) return;
    data.spend[idx]     = Math.round(parseFloat(d.spend || 0));
    data.awareness[idx] = Math.round(parseFloat(d.impressions || 0));
    data.traffic[idx]   = getActionValue(d.actions, ['link_click']);
    data.leads[idx]     = getActionValue(d.actions, ['lead', 'onsite_conversion.lead_grouped']);
  });
  return { data, dates };
}

/* ── buildReportData: respon API → data siap render laporan ── */
export function buildReportData(json) {
  const sum        = json.summary     || {};
  const prev       = json.prevSummary || {};
  const daily      = json.daily       || [];
  const campaigns  = json.campaigns   || [];
  const chartRange = json.chartRange  || null;
  const prevCampaigns = json.prevCampaigns || [];

  const totalSpend       = parseFloat(sum.spend || 0);
  const totalReach       = parseFloat(sum.reach || 0);
  const totalImpressions = parseFloat(sum.impressions || 0);
  const curLeadsAcc      = getActionValue(sum.actions, ['lead', 'onsite_conversion.lead_grouped']);

  const prevSpend       = parseFloat(prev.spend || 0);
  const prevReach       = parseFloat(prev.reach || 0);
  const prevImpressions = parseFloat(prev.impressions || 0);

  const campsWithData = campaigns.filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0);
  // "Active campaigns" = campaign yang PUNYA delivery (spend > 0) di periode, ikut filter
  const activeCount = campsWithData.length;
  const trafficCamps  = campsWithData.filter(c => getCampaignType(c.name) === 'TRAFFIC');
  const convCamps     = campsWithData.filter(c => getCampaignType(c.name) === 'CONVERSION');
  const awareCamps    = campsWithData.filter(c => getCampaignType(c.name) === 'AWARENESS');

  const trafficSpend    = trafficCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
  const trafficClicks   = trafficCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
  const convSpend       = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
  const convLeads       = convCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['lead', 'onsite_conversion.lead_grouped']), 0);
  const convImpressions = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
  const convClicks      = convCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.clicks || 0), 0);
  const awareSpend      = awareCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);

  const calcCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null;
  const calcCPC = trafficClicks > 0    ? trafficSpend / trafficClicks            : null;
  const calcCPL = convLeads > 0        ? convSpend / convLeads                   : null;
  const calcCTR = convImpressions > 0  ? (convClicks / convImpressions) * 100    : null;

  const prevCampsWithData = prevCampaigns.filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0);
  const prevTrafficCamps  = prevCampsWithData.filter(c => getCampaignType(c.name) === 'TRAFFIC');
  const prevConvCamps     = prevCampsWithData.filter(c => getCampaignType(c.name) === 'CONVERSION');
  const prevTrafficSpend  = prevTrafficCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
  const prevTrafficClicks = prevTrafficCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['link_click']), 0);
  const prevConvSpend     = prevConvCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.spend || 0), 0);
  const prevConvLeads     = prevConvCamps.reduce((s, c) => s + getActionValue(c.insights?.data?.[0]?.actions, ['lead', 'onsite_conversion.lead_grouped']), 0);
  const prevConvImpr      = prevConvCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.impressions || 0), 0);
  const prevConvClicks    = prevConvCamps.reduce((s, c) => s + parseFloat(c.insights?.data?.[0]?.clicks || 0), 0);
  const prevCPM = prevImpressions > 0   ? (prevSpend / prevImpressions) * 1000  : null;
  const prevCPC = prevTrafficClicks > 0 ? prevTrafficSpend / prevTrafficClicks  : null;
  const prevCPL = prevConvLeads > 0     ? prevConvSpend / prevConvLeads         : null;
  const prevCTR = prevConvImpr > 0      ? (prevConvClicks / prevConvImpr) * 100 : null;

  const summary = {
    totalSpend, totalReach, totalImpressions,
    totalTraffic: trafficClicks,
    totalLeads:   convLeads || curLeadsAcc,
    calcCPM, calcCPC, calcCPL, calcCTR,
    pctSpend:       pctChange(totalSpend, prevSpend),
    pctReach:       pctChange(totalReach, prevReach),
    pctImpressions: pctChange(totalImpressions, prevImpressions),
    pctTraffic:     pctChange(trafficClicks, prevTrafficClicks), // apple-to-apple: link click campaign TRAFFIC saja di dua periode
    pctLeads:       pctChange(convLeads, prevConvLeads),         // apple-to-apple: lead campaign CONVERSION saja di dua periode
    pctCPM: calcCPM != null ? pctChange(calcCPM, prevCPM) : null,
    pctCPC: calcCPC != null ? pctChange(calcCPC, prevCPC) : null,
    pctCPL: calcCPL != null ? pctChange(calcCPL, prevCPL) : null,
    pctCTR: calcCTR != null ? pctChange(calcCTR, prevCTR) : null,
  };

  const built = buildChartData(daily, chartRange);

  // Donut spend breakdown (dash/offset dihitung sama seperti dashboard)
  const total = totalSpend || 1;
  const segs = [];
  if (awareSpend > 0)   segs.push({ color: PURPLE, label: 'Awareness',  pct: Math.round(awareSpend / total * 100),   value: fmtSpendFull(awareSpend) });
  if (trafficSpend > 0) segs.push({ color: ORANGE, label: 'Traffic',    pct: Math.round(trafficSpend / total * 100), value: fmtSpendFull(trafficSpend) });
  if (convSpend > 0)    segs.push({ color: GREEN,  label: 'Conversion', pct: Math.round(convSpend / total * 100),    value: fmtSpendFull(convSpend) });
  const other = Math.max(0, totalSpend - awareSpend - trafficSpend - convSpend);
  if (other > 0)        segs.push({ color: BLUE,   label: 'Other',      pct: Math.round(other / total * 100),        value: fmtSpendFull(other) });
  let offset = 0;
  const donutSegs = segs.map(seg => {
    const dash = (seg.pct / 100) * CIRC;
    const s = { ...seg, dash: parseFloat(dash.toFixed(1)), offset: parseFloat((-offset).toFixed(1)) };
    offset += dash;
    return s;
  });

  return {
    summary,
    chartData:  built.data,
    chartDates: built.dates,
    donut:      { segs: donutSegs, total: { value: fmtSpendFull(totalSpend), label: 'Total Spend' } },
    activeCount,
  };
}

/* ── util bulan kalender (untuk opsi "pisah per bulan") ── */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parseYMD(s) { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; }
function ymd(y, m, d) { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
function lastDay(y, m) { return new Date(y, m + 1, 0).getDate(); } // m 0-based

// true kalau rentang = bulan-bulan penuh (mulai tgl 1, berakhir tgl terakhir bulan)
export function isWholeMonths(since, until) {
  if (!since || !until) return false;
  const a = parseYMD(since), b = parseYMD(until);
  return a.d === 1 && b.d === lastDay(b.y, b.m);
}

// pecah rentang jadi array bulan kalender { since, until, y, m }
export function monthChunks(since, until) {
  if (!since || !until) return [];
  const a = parseYMD(since), b = parseYMD(until);
  const out = [];
  let y = a.y, m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    const start = (y === a.y && m === a.m) ? a.d : 1;
    const end   = (y === b.y && m === b.m) ? b.d : lastDay(y, m);
    out.push({ since: ymd(y, m, start), until: ymd(y, m, end), y, m });
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}

function fmtDay(s) { return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }); }
export function rangeLabelOf(since, until) { return `${fmtDay(since)} – ${fmtDay(until)}`; }
export function monthToken(chunk) { return `${MON[chunk.m]}${String(chunk.y).slice(2)}`; } // "Jun26"
