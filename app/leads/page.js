'use client';

import { LayoutDashboard } from 'lucide-react';
import LeadsPlaceholder from '../components/LeadsPlaceholder';

// LEADS HUB — Dashboard (placeholder sampai v3.0 dibangun)
export default function LeadsDashboardPage() {
  return (
    <LeadsPlaceholder
      pageTitle="Dashboard"
      featureName="Leads Dashboard"
      Icon={LayoutDashboard}
    />
  );
}
