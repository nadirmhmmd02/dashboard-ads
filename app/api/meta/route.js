import { NextResponse } from 'next/server';

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

// Bangun string filter insights — pakai date_preset atau time_range
function buildDateFilter(datePreset, since, until) {
  if (since && until) {
    return { param: `time_range={'since':'${since}','until':'${until}'}`, field: `time_range({'since':'${since}','until':'${until}'})` };
  }
  return { param: `date_preset=${datePreset}`, field: `date_preset(${datePreset})` };
}

/* ─── Date helpers untuk periode pembanding (growth badge) ─── */
function ymd(d) { return d.toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) + 1;
}

// Terjemahkan date_preset → {since, until} eksplisit (untuk hitung periode sebelumnya)
function presetToRange(preset) {
  const now = new Date();
  const today = ymd(now);
  switch (preset) {
    case 'today':     return { since: today, until: today };
    case 'yesterday': return { since: addDays(today, -1), until: addDays(today, -1) };
    case 'last_7d':   return { since: addDays(today, -7),  until: addDays(today, -1) };
    case 'last_14d':  return { since: addDays(today, -14), until: addDays(today, -1) };
    case 'last_30d':  return { since: addDays(today, -30), until: addDays(today, -1) };
    case 'this_month': {
      const first = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
      return { since: first, until: today };
    }
    case 'last_month': {
      const firstThis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastPrev  = new Date(firstThis); lastPrev.setUTCDate(0);
      const firstPrev = new Date(Date.UTC(lastPrev.getUTCFullYear(), lastPrev.getUTCMonth(), 1));
      return { since: ymd(firstPrev), until: ymd(lastPrev) };
    }
    default: return { since: addDays(today, -30), until: addDays(today, -1) };
  }
}

// Periode sebelumnya dengan panjang sama, tepat sebelum periode sekarang
function previousRange(since, until) {
  const len       = daysBetween(since, until);
  const prevUntil = addDays(since, -1);
  const prevSince = addDays(prevUntil, -(len - 1));
  return { since: prevSince, until: prevUntil };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get('date_preset') || 'this_month';
  const since      = searchParams.get('since') || '';
  const until      = searchParams.get('until') || '';
  const mode       = searchParams.get('mode') || 'campaigns';

  const { param: dateParam, field: dateField } = buildDateFilter(datePreset, since, until);

  try {
    if (mode === 'dashboard') {
      // Hitung periode pembanding (growth badge = perbandingan periode nyata)
      const curRange  = since && until ? { since, until } : presetToRange(datePreset);
      const prevRange = previousRange(curRange.since, curRange.until);
      const prevParam = `time_range={'since':'${prevRange.since}','until':'${prevRange.until}'}`;

      // Rentang sumbu chart: preset "this month" direntang ke akhir bulan
      // (sumbu-X tampil sebulan penuh, garis hanya di hari yang ada datanya)
      let chartRange = curRange;
      if (!(since && until) && datePreset === 'this_month') {
        const now   = new Date();
        const first = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
        const last  = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
        chartRange = { since: first, until: last };
      }

      const [summaryRes, dailyRes, campaignsRes, prevRes] = await Promise.all([
        fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,cpm,cpc,ctr,actions&${dateParam}&access_token=${ACCESS_TOKEN}`),
        fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,actions&${dateParam}&time_increment=1&access_token=${ACCESS_TOKEN}&limit=90`),
        fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name,objective,status,insights.${dateField}{spend,impressions,reach,clicks,ctr,actions}&access_token=${ACCESS_TOKEN}&limit=50`),
        fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,actions&${prevParam}&access_token=${ACCESS_TOKEN}`),
      ]);
      const [summaryData, dailyData, campaignsData, prevData] = await Promise.all([
        summaryRes.json(), dailyRes.json(), campaignsRes.json(), prevRes.json(),
      ]);

      return NextResponse.json({
        summary:     summaryData.data?.[0] || {},
        prevSummary: prevData.data?.[0] || {},
        daily:       dailyData.data || [],
        campaigns:   campaignsData.data || [],
        chartRange,
      });
    }

    // mode=campaign_detail — ads + creative (konten iklan) + breakdown platform untuk popup detail
    if (mode === 'campaign_detail') {
      const campaignId = searchParams.get('campaign_id');
      if (!campaignId) {
        return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 });
      }

      const [adsRes, platformRes] = await Promise.all([
        // Ads di campaign ini + creative-nya (thumbnail besar, link post Instagram)
        fetch(`https://graph.facebook.com/v19.0/${campaignId}/ads?fields=id,name,status,creative.thumbnail_width(1080).thumbnail_height(1080){id,thumbnail_url,image_url,instagram_permalink_url},insights.${dateField}{spend,impressions,reach,clicks,actions}&access_token=${ACCESS_TOKEN}&limit=50`),
        // Delivery nyata per platform (facebook/instagram/audience_network/messenger)
        fetch(`https://graph.facebook.com/v19.0/${campaignId}/insights?fields=spend,impressions,reach&breakdowns=publisher_platform&${dateParam}&access_token=${ACCESS_TOKEN}`),
      ]);
      const [adsData, platformData] = await Promise.all([adsRes.json(), platformRes.json()]);

      if (adsData.error) {
        return NextResponse.json({ error: adsData.error.message }, { status: 500 });
      }

      return NextResponse.json({
        ads:       adsData.data || [],
        platforms: platformData.data || [],
      });
    }

    // mode=campaigns (default)
    const [campaignsRes, insightsRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,insights.${dateField}{spend,impressions,reach,clicks,cpm,cpc,ctr,actions}&access_token=${ACCESS_TOKEN}&limit=50`),
      fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,cpm,cpc,ctr,actions&${dateParam}&access_token=${ACCESS_TOKEN}`),
    ]);
    const [campaignsData, insightsData] = await Promise.all([campaignsRes.json(), insightsRes.json()]);

    return NextResponse.json({
      campaigns: campaignsData.data || [],
      insights:  insightsData.data || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
