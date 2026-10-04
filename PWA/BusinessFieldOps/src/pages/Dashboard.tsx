import type {VNode} from 'preact';

import {useAuth} from '@/lib/AuthContext';
import AdministratorDashboard from '@/pages/Dashboards/Admin';
import MerchantDashboard from '@/pages/Dashboards/Merchant';
import PromoterDashboard from '@/pages/Dashboards/Promoter';
import UnsupportedRole from '@/pages/Dashboards/UnsupportedRole';

import type {UserRole} from '@/lib/profiles';

const ROLE_DASHBOARDS: Record<UserRole, () => VNode> = {
  administrator: () => <AdministratorDashboard />,
  merchant: () => <MerchantDashboard />,
  promoter: () => <PromoterDashboard />,
};

export default function Dashboard() {
  const {profile} = useAuth();
  if (!profile || !profile.is_active) return null;

  const render = ROLE_DASHBOARDS[profile.role];
  return render ? render() : <UnsupportedRole />;
}
