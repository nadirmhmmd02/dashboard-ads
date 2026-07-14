/* ─────────────────────────────────────────────────────────────
   INSIGHT ENGINE — WILL OF D · Analytics & Insights
   Analisis otomatis dari data Meta Ads (mode=dashboard API).
   Murni fungsi (tanpa React) — mudah dites & nanti gampang
   diganti/ditambah narasi LLM (Claude API) tanpa ubah halaman.

   ATURAN METRIK mengikuti logika bisnis final CLAUDE.md:
   - Tipe campaign dari NAMA (TRAFFIC / PROSPEK|KONVERSI / lainnya)
   - Traffic hanya dari campaign TRAFFIC, Leads hanya CONVERSION
   - CPM semua campaign, CPC per TRAFFIC, CPL per CONVERSION
   Untuk PERBANDINGAN vs periode sebelumnya, dipakai angka
   "blended" level akun (spend/leads/clicks akun) karena API prev
   hanya tersedia level akun — di-label jelas di kartunya.
   ───────────────────────────────────────────────────────────── */

function getActionValue(actions, types) {
  if (!actions) return 0;
  for (const t of types) {
    const a = actions.find(x => x.action_type === t);
    if (a) return parseInt(a.value) || 0;
  }
  return 0;
}

export function getCampaignType(name) {
  const n = name?.toUpperCase() || '';
  if (n.includes('TRAFFIC'))                           return 'TRAFFIC';
  if (n.includes('PROSPEK') || n.includes('KONVERSI')) return 'CONVERSION';
  return 'AWARENESS';
}

function stripCampPrefix(name) {
  const i = (name || '').indexOf('-');
  return i >= 0 ? name.slice(i + 1).trim() : (name || '—');
}

function getCampaignResult(name, ins) {
  const type = getCampaignType(name);
  if (type === 'TRAFFIC')    return getActionValue(ins.actions, ['link_click']);
  if (type === 'CONVERSION') return getActionValue(ins.actions, ['lead', 'onsite_conversion.lead_grouped']);
  const n = (name || '').toUpperCase();
  if (n.includes('AWR REACH')) return parseFloat(ins.reach || 0);
  return parseFloat(ins.impressions || 0);
}

const pctChange = (cur, prev) => (!prev || prev <= 0) ? null : ((cur - prev) / prev) * 100;
const median = arr => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const fmtRp   = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export const fmtNum  = n => Math.round(n).toLocaleString('id-ID');
export const fmtPct  = p => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;

/* ═══ MAIN ═══ */
export function buildAnalysis(json) {
  const sum       = json.summary     || {};
  const prev      = json.prevSummary || {};
  const daily     = json.daily       || [];
  const campaigns = json.campaigns   || [];

  /* ── Metrik periode ini (aturan final) ── */
  const spend       = parseFloat(sum.spend || 0);
  const reach       = parseFloat(sum.reach || 0);
  const impressions = parseFloat(sum.impressions || 0);
  const accClicks   = getActionValue(sum.actions, ['link_click']);
  const accLeads    = getActionValue(sum.actions, ['lead', 'onsite_conversion.lead_grouped']);

  const prevSpend       = parseFloat(prev.spend || 0);
  const prevReach       = parseFloat(prev.reach || 0);
  const prevImpressions = parseFloat(prev.impressions || 0);
  const prevClicks      = getActionValue(prev.actions, ['link_click']);
  const prevLeads       = getActionValue(prev.actions, ['lead', 'onsite_conversion.lead_grouped']);

  const camps = campaigns
    .filter(c => parseFloat(c.insights?.data?.[0]?.spend || 0) > 0)
    .map(c => {
      const ins    = c.insights?.data?.[0] || {};
      const type   = getCampaignType(c.name);
      const sp     = parseFloat(ins.spend || 0);
      const result = getCampaignResult(c.name, ins);
      return {
        name: stripCampPrefix(c.name), type, spend: sp, result,
        status: c.status,
        cpr: result > 0 ? (type === 'AWARENESS' ? (sp / result) * 1000 : sp / result) : null,
      };
    });

  const trafficCamps = camps.filter(c => c.type === 'TRAFFIC');
  const convCamps    = camps.filter(c => c.type === 'CONVERSION');

  const trafficSpend  = trafficCamps.reduce((s, c) => s + c.spend, 0);
  const trafficClicks = trafficCamps.reduce((s, c) => s + c.result, 0);
  const convSpend     = convCamps.reduce((s, c) => s + c.spend, 0);
  const convLeads     = convCamps.reduce((s, c) => s + c.result, 0);

  const leads = convLeads || accLeads;
  const cpm   = impressions > 0   ? (spend / impressions) * 1000 : null;
  const cpc   = trafficClicks > 0 ? trafficSpend / trafficClicks : null;
  const cpl   = convLeads > 0     ? convSpend / convLeads        : null;

  /* Blended (level akun) — untuk komparasi vs periode sebelumnya */
  const blCPL     = accLeads  > 0 ? spend / accLeads      : null;
  const prevBlCPL = prevLeads > 0 ? prevSpend / prevLeads : null;
  const blCPC     = accClicks  > 0 ? spend / accClicks       : null;
  const prevBlCPC = prevClicks > 0 ? prevSpend / prevClicks  : null;
  const prevCPM   = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : null;

  const dLeads   = pctChange(accLeads, prevLeads);
  const dSpend   = pctChange(spend, prevSpend);
  const dReach   = pctChange(reach, prevReach);
  const dCPL     = (blCPL != null && prevBlCPL != null) ? pctChange(blCPL, prevBlCPL) : null;
  const dCPC     = (blCPC != null && prevBlCPC != null) ? pctChange(blCPC, prevBlCPC) : null;
  const dCPM     = (cpm   != null && prevCPM   != null) ? pctChange(cpm, prevCPM)     : null;

  /* Deret harian (untuk sparkline & momentum) */
  const dailySpend = daily.map(d => Math.round(parseFloat(d.spend || 0)));
  const dailyLeads = daily.map(d => getActionValue(d.actions, ['lead', 'onsite_conversion.lead_grouped']));

  /* ── INSIGHTS ── */
  const insights = [];
  const add = (o) => insights.push(o);

  // 1. Momentum leads vs periode sebelumnya
  if (dLeads != null && accLeads + prevLeads > 0) {
    if (dLeads >= 15) add({
      id: 'leads-up', severity: 'positive', icon: 'TrendingUp',
      title: 'Lead generation is accelerating',
      body: `You generated ${fmtNum(accLeads)} leads this period — up ${fmtPct(dLeads)} versus the previous period (${fmtNum(prevLeads)} leads). Whatever changed recently is working; consider protecting the budget of your conversion campaigns.`,
      chips: [{ label: 'Leads', value: fmtNum(accLeads) }, { label: 'vs prev', value: fmtPct(dLeads), tone: 'pos' }],
      spark: dailyLeads,
    });
    else if (dLeads <= -15) add({
      id: 'leads-down', severity: dLeads <= -35 ? 'critical' : 'warning', icon: 'TrendingDown',
      title: 'Lead volume is slowing down',
      body: `Leads dropped ${fmtPct(dLeads)} versus the previous period (${fmtNum(accLeads)} vs ${fmtNum(prevLeads)}). Check whether conversion campaigns lost delivery, budget was reduced, or creative fatigue is setting in.`,
      chips: [{ label: 'Leads', value: fmtNum(accLeads) }, { label: 'vs prev', value: fmtPct(dLeads), tone: 'neg' }],
      spark: dailyLeads,
    });
  }

  // 2. Efisiensi biaya per lead (blended)
  if (dCPL != null) {
    if (dCPL <= -10) add({
      id: 'cpl-better', severity: 'positive', icon: 'BadgeCheck',
      title: 'Cost per lead is improving',
      body: `Blended cost per lead came down to ${fmtRp(blCPL)} — ${fmtPct(dCPL)} versus the previous period. You're paying less for every lead; this is the right direction.`,
      chips: [{ label: 'Blended CPL', value: fmtRp(blCPL) }, { label: 'vs prev', value: fmtPct(dCPL), tone: 'pos' }],
    });
    else if (dCPL >= 20) add({
      id: 'cpl-worse', severity: dCPL >= 50 ? 'critical' : 'warning', icon: 'Wallet',
      title: 'Leads are getting more expensive',
      body: `Blended cost per lead rose to ${fmtRp(blCPL)} (${fmtPct(dCPL)} vs previous period). Review targeting and creatives on conversion campaigns before scaling budget further.`,
      chips: [{ label: 'Blended CPL', value: fmtRp(blCPL) }, { label: 'vs prev', value: fmtPct(dCPL), tone: 'neg' }],
    });
  }

  // 3. CPM (biaya tayang) — semua campaign
  if (dCPM != null && Math.abs(dCPM) >= 15) {
    const up = dCPM > 0;
    add({
      id: 'cpm', severity: up ? 'warning' : 'positive', icon: up ? 'TrendingUp' : 'TrendingDown',
      title: up ? 'Impressions are costing more (CPM up)' : 'Cheaper reach — CPM is down',
      body: up
        ? `CPM climbed to ${fmtRp(cpm)} per 1,000 impressions (${fmtPct(dCPM)}). Rising CPM usually means tighter auction competition or audience saturation — refreshing creatives often helps.`
        : `CPM dropped to ${fmtRp(cpm)} per 1,000 impressions (${fmtPct(dCPM)}). Your ads are reaching people more cheaply than before.`,
      chips: [{ label: 'CPM', value: fmtRp(cpm) }, { label: 'vs prev', value: fmtPct(dCPM), tone: up ? 'neg' : 'pos' }],
    });
  }

  // 4. Biaya per klik (blended)
  if (dCPC != null && Math.abs(dCPC) >= 15 && accClicks > 50) {
    const up = dCPC > 0;
    add({
      id: 'cpc', severity: up ? 'warning' : 'positive', icon: 'Crosshair',
      title: up ? 'Clicks are getting pricier' : 'Click costs are falling',
      body: `Blended cost per click is now ${fmtRp(blCPC)} (${fmtPct(dCPC)} vs previous period) across ${fmtNum(accClicks)} link clicks.`,
      chips: [{ label: 'Blended CPC', value: fmtRp(blCPC) }, { label: 'vs prev', value: fmtPct(dCPC), tone: up ? 'neg' : 'pos' }],
    });
  }

  // 5. Kampanye terbaik (cost per result terendah di tipenya, spend berarti)
  const rankPool = [...convCamps, ...trafficCamps].filter(c => c.cpr != null && c.spend >= spend * 0.05);
  if (rankPool.length >= 2) {
    const best = rankPool.reduce((a, b) => {
      const typeMedA = median(camps.filter(x => x.type === a.type && x.cpr != null).map(x => x.cpr)) || a.cpr;
      const typeMedB = median(camps.filter(x => x.type === b.type && x.cpr != null).map(x => x.cpr)) || b.cpr;
      return (a.cpr / typeMedA) <= (b.cpr / typeMedB) ? a : b;
    });
    const unit = best.type === 'CONVERSION' ? 'lead' : 'click';
    add({
      id: 'top-performer', severity: 'positive', icon: 'Award',
      title: `Top performer: ${best.name}`,
      body: `This ${best.type.toLowerCase()} campaign delivers results at ${fmtRp(best.cpr)} per ${unit} — the most efficient in its group this period, with ${fmtNum(best.result)} ${unit}s from ${fmtRp(best.spend)} spend.`,
      chips: [{ label: `Cost/${unit}`, value: fmtRp(best.cpr), tone: 'pos' }, { label: 'Results', value: fmtNum(best.result) }],
    });
  }

  // 6. Kampanye yang perlu perhatian (cost per result >1.6x median tipenya)
  for (const type of ['CONVERSION', 'TRAFFIC']) {
    const pool = camps.filter(c => c.type === type && c.cpr != null);
    if (pool.length < 2) continue;
    const med = median(pool.map(c => c.cpr));
    const worst = pool.filter(c => c.cpr > med * 1.6 && c.spend >= spend * 0.08)
                      .sort((a, b) => b.cpr - a.cpr)[0];
    if (worst) {
      const unit = type === 'CONVERSION' ? 'lead' : 'click';
      add({
        id: `attention-${type}`, severity: 'warning', icon: 'TriangleAlert',
        title: `Needs attention: ${worst.name}`,
        body: `Its cost per ${unit} (${fmtRp(worst.cpr)}) is well above the ${type.toLowerCase()} group median (${fmtRp(med)}) while consuming ${fmtRp(worst.spend)} of budget. Worth reviewing the audience or creative — or shifting budget to better performers.`,
        chips: [{ label: `Cost/${unit}`, value: fmtRp(worst.cpr), tone: 'neg' }, { label: 'Group median', value: fmtRp(med) }],
      });
    }
  }

  // 7. Konsentrasi budget
  if (camps.length >= 3 && spend > 0) {
    const top = [...camps].sort((a, b) => b.spend - a.spend)[0];
    const share = (top.spend / spend) * 100;
    if (share >= 45) add({
      id: 'concentration', severity: 'info', icon: 'Target',
      title: 'Budget is concentrated in one campaign',
      body: `"${top.name}" absorbs ${share.toFixed(0)}% of total spend this period. That's fine if it's your best performer — but it also means overall results depend heavily on this single campaign.`,
      chips: [{ label: 'Share of spend', value: `${share.toFixed(0)}%` }, { label: 'Spend', value: fmtRp(top.spend) }],
    });
  }

  // 8. Momentum dalam periode (paruh kedua vs paruh pertama, min 8 hari data)
  const leadDays = dailyLeads.filter(v => v != null);
  if (leadDays.length >= 8 && accLeads > 0) {
    const half = Math.floor(leadDays.length / 2);
    const first = leadDays.slice(0, half).reduce((a, b) => a + b, 0);
    const second = leadDays.slice(-half).reduce((a, b) => a + b, 0);
    const d = pctChange(second, first);
    if (d != null && Math.abs(d) >= 25) {
      const up = d > 0;
      add({
        id: 'momentum', severity: up ? 'positive' : 'warning', icon: 'Activity',
        title: up ? 'Momentum is building within this period' : 'Momentum is fading within this period',
        body: `The second half of this period produced ${fmtNum(second)} leads versus ${fmtNum(first)} in the first half (${fmtPct(d)}). ${up ? 'Recent days are outperforming — keep the current setup running.' : 'Recent days are underperforming — check delivery and creative fatigue on conversion campaigns.'}`,
        chips: [{ label: '2nd half', value: fmtNum(second), tone: up ? 'pos' : 'neg' }, { label: '1st half', value: fmtNum(first) }],
        spark: dailyLeads,
      });
    }
  }

  // 9. Hari sepi (spend jalan tapi 0 lead) — hanya relevan kalau ada conversion camp
  if (convCamps.length > 0 && leadDays.length >= 5) {
    const quiet = daily.filter(d => parseFloat(d.spend || 0) > 0 &&
      getActionValue(d.actions, ['lead', 'onsite_conversion.lead_grouped']) === 0).length;
    if (quiet >= 3) add({
      id: 'quiet-days', severity: 'warning', icon: 'CircleAlert',
      title: `${quiet} spending days produced zero leads`,
      body: `On ${quiet} days this period the account spent budget without generating a single lead. A few quiet days are normal, but if they cluster together it can signal delivery or tracking issues.`,
      chips: [{ label: 'Zero-lead days', value: String(quiet), tone: 'neg' }],
      spark: dailyLeads,
    });
  }

  // 10. Reach naik signifikan
  if (dReach != null && dReach >= 20) add({
    id: 'reach-up', severity: 'info', icon: 'Zap',
    title: 'Your ads are reaching a wider audience',
    body: `Reach grew to ${fmtNum(reach)} people (${fmtPct(dReach)} vs previous period). Broader reach feeds the top of your funnel — expect traffic and leads to follow with some delay.`,
    chips: [{ label: 'Reach', value: fmtNum(reach) }, { label: 'vs prev', value: fmtPct(dReach), tone: 'pos' }],
  });

  // 11. Spend shift besar (informasi konteks)
  if (dSpend != null && Math.abs(dSpend) >= 25) {
    const up = dSpend > 0;
    add({
      id: 'spend-shift', severity: 'info', icon: 'Wallet',
      title: up ? 'Spending is ramping up' : 'Spending has been scaled back',
      body: `Total spend is ${fmtRp(spend)} — ${fmtPct(dSpend)} versus the previous period. Keep this in mind when reading the other numbers: big budget shifts move every metric.`,
      chips: [{ label: 'Spend', value: fmtRp(spend) }, { label: 'vs prev', value: fmtPct(dSpend) }],
      spark: dailySpend,
    });
  }

  /* Urutkan: critical → warning → positive → info */
  const ORDER = { critical: 0, warning: 1, positive: 2, info: 3 };
  insights.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  /* ── PERFORMANCE SCORE ── */
  let score = 70;
  if (dLeads != null) { if (dLeads >= 15) score += 9; else if (dLeads <= -35) score -= 14; else if (dLeads <= -15) score -= 9; }
  if (dCPL != null)   { if (dCPL <= -10) score += 9; else if (dCPL >= 50) score -= 13; else if (dCPL >= 20) score -= 8; }
  if (dCPM != null)   { if (dCPM <= -15) score += 4; else if (dCPM >= 15) score -= 4; }
  if (dCPC != null)   { if (dCPC <= -15) score += 3; else if (dCPC >= 15) score -= 3; }
  if (insights.some(i => i.id === 'quiet-days')) score -= 5;
  if (insights.some(i => i.id === 'momentum' && i.severity === 'positive')) score += 4;
  if (insights.some(i => i.id === 'momentum' && i.severity === 'warning'))  score -= 4;
  score = Math.max(8, Math.min(97, Math.round(score)));

  const label   = score >= 85 ? 'Excellent' : score >= 68 ? 'Good' : score >= 50 ? 'Fair' : 'Needs attention';
  const verdict =
    score >= 85 ? 'Your account is firing on all cylinders this period. Costs are healthy and results are trending the right way.' :
    score >= 68 ? 'Overall performance is solid. A few areas below are worth a look, but nothing alarming.' :
    score >= 50 ? 'Performance is mixed this period. Review the warnings below — a couple of adjustments could move the needle.' :
                  'Several metrics are moving the wrong way. Prioritize the critical and warning items below.';

  return {
    metrics: { spend, reach, impressions, leads, cpm, cpc, cpl, blCPL, dSpend, dLeads, dCPL, dReach },
    insights,
    score: { value: score, label, verdict },
    campaignCount: camps.length,
  };
}
