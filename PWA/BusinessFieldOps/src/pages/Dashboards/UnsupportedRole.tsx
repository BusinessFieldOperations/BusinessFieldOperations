import LogoutButton from '@/components/LogoutButton';
import {m} from '@/paraglide/messages.js';

export default function UnsupportedRole() {
  // DRAFT message and logout button
  return (
    <div>
      {m.unsupported_role()} <LogoutButton></LogoutButton>
    </div>
  );
}
