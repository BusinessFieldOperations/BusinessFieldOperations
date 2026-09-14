import 'mdui/components/button.js';
import HomeUserBox from '../HomeUserBox';

interface Props {
  userName: string;
  role: string;
  onTabChange?: (value: string) => void;
}

export default function PromoterHome({ userName, role, onTabChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <HomeUserBox userName={userName} role={role} />
      <mdui-button variant="filled" icon="point_of_sale" onClick={() => onTabChange?.('sales')}>
        New Report
      </mdui-button>
      <p style={{ fontSize: '14px', color: 'gray' }}>Register sales reports</p>
    </div>
  );
}