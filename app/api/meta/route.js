import { NextResponse } from 'next/server';

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get('date_preset') || 'this_month';
  const mode = searchParams.get('mode') || 'campaigns';

  try {
    if (mode === 'dashboard') {
      // 1. Summary insights (semua campaign)
      const summaryRes = await fetch(
        `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,cpm,cpc,ctr,actions&date_preset=${datePreset}&access_token=${ACCESS_TOKEN}`
      );
      const summaryData = await summaryRes.json();

      // 2. Daily insights (time_increment=1 untuk bar chart)
      const dailyRes = await fetch(
        `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,actions&date_preset=${datePreset}&time_increment=1&access_token=${ACCESS_TOKEN}&limit=90`
      );
      const dailyData = await dailyRes.json();

      // 3. Campaign-level insights (untuk breakdown per objective di donut)
      const campaignsRes = await fetch(
        `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name,objective,status,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,actions}&access_token=${ACCESS_TOKEN}&limit=50`
      );
      const campaignsData = await campaignsRes.json();

      return NextResponse.json({
        summary: summaryData.data?.[0] || {},
        daily: dailyData.data || [],
        campaigns: campaignsData.data || [],
      });
    }

    // mode=campaigns (default) — dipakai halaman /campaigns
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpm,cpc,ctr,actions}&access_token=${ACCESS_TOKEN}&limit=50`
    );
    const campaignsData = await campaignsRes.json();

    const insightsRes = await fetch(
      `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?fields=spend,impressions,reach,clicks,cpm,cpc,ctr,actions&date_preset=${datePreset}&access_token=${ACCESS_TOKEN}`
    );
    const insightsData = await insightsRes.json();

    return NextResponse.json({
      campaigns: campaignsData.data || [],
      insights: insightsData.data || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
