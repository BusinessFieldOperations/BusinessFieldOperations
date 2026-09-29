import DashboardLayout from '@/layouts/DashboardLayout';
import type {TabId} from '@/components/Tabs';

const TABS: readonly TabId[] = ['home', 'reports', 'contacts', 'users'];

export default function AdministratorDashboard() {
  return <DashboardLayout tabs={TABS} />;
}
