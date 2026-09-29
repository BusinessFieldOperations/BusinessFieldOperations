import DashboardLayout from '@/layouts/DashboardLayout';
import type {TabId} from '@/components/Tabs';

const TABS: readonly TabId[] = ['home', 'reports', 'contacts'];

export default function PromoterDashboard() {
  return <DashboardLayout tabs={TABS} />;
}
