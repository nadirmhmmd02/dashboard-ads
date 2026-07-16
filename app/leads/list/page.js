'use client';

import { Users } from 'lucide-react';
import LeadsPlaceholder from '../../components/LeadsPlaceholder';

// LEADS HUB — Leads List (placeholder sampai v3.0 dibangun)
export default function LeadsListPage() {
  return (
    <LeadsPlaceholder
      pageTitle="Leads List"
      featureName="Leads List"
      Icon={Users}
    />
  );
}
