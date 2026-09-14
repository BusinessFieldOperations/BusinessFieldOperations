import { useState, useEffect } from 'preact/hooks';
import { route } from "preact-router";
import "../App.css";
import "mdui/components/circular-progress.js";
import { supabase } from '../lib/supabase';

// Import the role-specific dashboards
import AdminDashboard from '../components/AdminDashboard';
import MerchantDashboard from '../components/MerchantDashboard';
import PromoterDashboard from '../components/PromoterDashboard';

type UserRole = 'merchant' | 'promoter' | 'administrator' | null;

export default function Dashboard() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [Name, setName] = useState('');

  useEffect(() => {
    async function fetchUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, first_name, last_name')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          setRole(data.role as UserRole);
          setName(`${data.first_name} ${data.last_name}`);
        }
      }
      setLoading(false);
    }

    fetchUserProfile();
  }, []);

  if (loading) {
    return (
      <main class="center-container">
        <mdui-circular-progress></mdui-circular-progress>
      </main>
    );
  }

  // Render the correct dashboard based on role
  if (role === 'administrator') return <AdminDashboard userName={Name} />;
  if (role === 'merchant') return <MerchantDashboard userName={Name} />;
  if (role === 'promoter') return <PromoterDashboard userName={Name} />;

  // Fallback if role is unknown or missing
  return <div style={{ padding: '24px' }}>
    <p>Error: Role not assigned. Contact administrator.</p>
    <mdui-button icon="chevron_right" variant="outlined" onClick={() => route("/login")}>
      Go to Login
    </mdui-button>
  </div>;
}