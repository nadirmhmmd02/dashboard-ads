'use client';

import { createContext, useContext, useState } from 'react';

const DATE_PRESETS_DASHBOARD = [
  { label: 'Today',        value: 'today' },
  { label: 'Yesterday',    value: 'yesterday' },
  { label: 'Last 7 days',  value: 'last_7d' },
  { label: 'Last 14 days', value: 'last_14d' },
  { label: 'Last 30 days', value: 'last_30d' },
  { label: 'This month',   value: 'this_month' },
  { label: 'Last month',   value: 'last_month' },
];

const DATE_PRESETS_CAMPAIGNS = [
  { label: 'Today',        value: 'today' },
  { label: 'Yesterday',    value: 'yesterday' },
  { label: 'Last 3 days',  value: 'last_3d' },
  { label: 'Last 7 days',  value: 'last_7d' },
  { label: 'Last 14 days', value: 'last_14d' },
  { label: 'Last 30 days', value: 'last_30d' },
  { label: 'This month',   value: 'this_month' },
  { label: 'Last month',   value: 'last_month' },
];

const DEFAULT_PRESET = { label: 'This month', value: 'this_month' };

const DateFilterContext = createContext(null);

function useFilterState() {
  const [dateOpt, setDateOpt]           = useState(DEFAULT_PRESET);
  const [customSince, setCustomSince]   = useState('');
  const [customUntil, setCustomUntil]   = useState('');
  const [isCustom, setIsCustom]         = useState(false);

  function selectPreset(opt) {
    setDateOpt(opt);
    setIsCustom(false);
    setCustomSince('');
    setCustomUntil('');
  }

  function applyCustom(since, until) {
    setCustomSince(since);
    setCustomUntil(until);
    setIsCustom(true);
  }

  return { dateOpt, setDateOpt, customSince, setCustomSince, customUntil, setCustomUntil, isCustom, setIsCustom, selectPreset, applyCustom };
}

export function DateFilterProvider({ children }) {
  const dashboard = useFilterState();
  const campaigns = useFilterState();
  const reports   = useFilterState();
  const leads     = useFilterState(); // Leads Hub — state independen per Hub (MASTER PLAN 3.3)

  return (
    <DateFilterContext.Provider value={{ dashboard, campaigns, reports, leads }}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDashboardFilter() {
  return useContext(DateFilterContext).dashboard;
}

export function useCampaignsFilter() {
  return useContext(DateFilterContext).campaigns;
}

export function useReportsFilter() {
  return useContext(DateFilterContext).reports;
}

export function useLeadsFilter() {
  return useContext(DateFilterContext).leads;
}

export { DATE_PRESETS_DASHBOARD, DATE_PRESETS_CAMPAIGNS };
