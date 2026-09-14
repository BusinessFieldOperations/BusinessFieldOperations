import 'mdui/components/button.js';
import HomeUserBox from '../HomeUserBox';

interface Props {
  userName: string;
  role: string;
  onTabChange?: (value: string) => void;
}

export default function AdminHome({ userName, role, onTabChange }: Props) {
  return (
    <div class="home-box">
      <HomeUserBox userName={userName} role={role} />
      <mdui-button variant="filled" icon="dashboard">
        Assign Tasks
      </mdui-button>
      <mdui-button variant="outlined" icon="analytics" onClick={() => onTabChange?.('reports')}>
        View Reports
      </mdui-button>
      <mdui-button variant="outlined" icon="manage_accounts" onClick={() => onTabChange?.('users')}>
        Manage Users
      </mdui-button>
    </div>
  );
}
