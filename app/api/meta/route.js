import { NextResponse } from 'next/server';

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get('date_preset') || 'last_7d';

  try {
    // Fetch campaigns dengan insights per campaign
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,cpm,cpc,ctr,actions}&access_token=${ACCESS_TOKEN}&limit=50`
    );
    const campaignsData = await campaignsRes.json();

    // Fetch insights keseluruhan akun
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