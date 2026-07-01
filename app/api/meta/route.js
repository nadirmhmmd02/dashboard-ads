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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get('date_preset') || 'this_month';
  const since      = searchParams.get('since') || '';
  const until      = searchParams.get('until') || '';
  const mode       = searchParams.get('mode') || 'campaigns';

  const { param: dateParam, field: dateField } = buildDateFilter(datePreset, since, until);

  try {
    if (mode === 'dashboard') {
      const [summaryRes, dailyRes, campaignsRes] = await Promise.all([
        fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,cpm,cpc,ctr,actions&${dateParam}&access_token=${ACCESS_TOKEN}`),
        fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,actions&${dateParam}&time_increment=1&access_token=${ACCESS_TOKEN}&limit=90`),
        fetch(`https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name,objective,status,insights.${dateField}{spend,impressions,reach,clicks,actions}&access_token=${ACCESS_TOKEN}&limit=50`),
      ]);
      const [summaryData, dailyData, campaignsData] = await Promise.all([summaryRes.json(), dailyRes.json(), campaignsRes.json()]);

      return NextResponse.json({
        summary:   summaryData.data?.[0] || {},
        daily:     dailyData.data || [],
        campaigns: campaignsData.data || [],
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
