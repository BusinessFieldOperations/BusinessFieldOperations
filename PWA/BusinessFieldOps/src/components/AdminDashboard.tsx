import { useState } from 'preact/hooks';
import DashboardLayout from './DashboardLayout';

import AdminHome from './tabs/AdminHome';
import AdminReports from './tabs/AdminReports';
import AdminUsers from './tabs/AdminUsers';
import AdminClients from './tabs/AdminClients';

interface Props {
  userName: string;
}

export default function AdminDashboard({ userName }: Props) {
  const [activeTab, setActiveTab] = useState('home');

  const navItems = [
    { value: 'home', icon: 'home', label: 'Home' },
    { value: 'reports', icon: 'analytics', label: 'Reports' },
    { value: 'clients', icon: 'people', label: 'Clients' },
    { value: 'users', icon: 'manage_accounts', label: 'Users' }
  ];

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      navItems={navItems}
    >
      {activeTab === 'home' && <AdminHome userName={userName} role="administrator" onTabChange={setActiveTab} />}
      {activeTab === 'reports' && <AdminReports />}
      {activeTab === 'clients' && <AdminClients />}
      {activeTab === 'users' && <AdminUsers />}
    </DashboardLayout>
  );
}