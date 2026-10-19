import DashboardLayout from '@/layouts/DashboardLayout';
import type {TabId} from '@/components/Tabs';

const TABS: readonly TabId[] = ['home', 'tasks', 'contacts', 'users'];

// Reached from the "See report list" button in Home, not from the bar.
const HIDDEN_TABS: readonly TabId[] = ['reports'];

export default function AdministratorDashboard() {
  return <DashboardLayout tabs={TABS} hiddenTabs={HIDDEN_TABS} />;
}
