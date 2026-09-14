import { useState } from 'preact/hooks';
import DashboardLayout from './DashboardLayout';

import MerchantHome from './tabs/MerchantHome';
import MerchantReports from './tabs/MerchantReports';
import MerchantEstablishments from './tabs/MerchantEstablishments';

interface Props {
  userName: string;
}

export default function MerchantDashboard({ userName }: Props) {
  // State to track which tab is currently selected
  const [activeTab, setActiveTab] = useState('home');

  // Define the navigation items for this specific role
  const navItems = [
    { value: 'home', icon: 'home', label: 'Home' },
    { value: 'reports', icon: 'inventory_2', label: 'Reports' },
    { value: 'establishments', icon: 'place', label: 'Establishments' }
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      navItems={navItems}
    >
      {/* Conditional Rendering: Only show the component that matches activeTab */}
      {activeTab === 'home' && <MerchantHome userName={userName} role="merchant" onTabChange={setActiveTab} />}
      {activeTab === 'reports' && <MerchantReports />}
      {activeTab === 'establishments' && <MerchantEstablishments />}
    </DashboardLayout>
  );
}