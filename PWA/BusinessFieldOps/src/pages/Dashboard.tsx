import {useAuth} from '@/lib/AuthContext';
import AdministratorDashboard from '@/pages/Dashboards/Admin';
import MerchantDashboard from '@/pages/Dashboards/Merchant';
import PromoterDashboard from '@/pages/Dashboards/Promoter';

export default function Dashboard() {
  const {profile} = useAuth();

  if (!profile || !profile.is_active) return null;

  switch (profile.role) {
    case 'administrator':
      return <AdministratorDashboard />;
    case 'merchant':
      return <MerchantDashboard />;
    case 'promoter':
      return <PromoterDashboard />;
    default:
      return (
        <main class="center-container">
          <h1 class="main-title">Access unavailable</h1>
          <p>This account has an unsupported role.</p>
        </main>
      );
  }
}
