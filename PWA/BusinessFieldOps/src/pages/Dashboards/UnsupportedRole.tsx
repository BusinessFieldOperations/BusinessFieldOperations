import LogoutButton from '@/components/LogoutButton';
export default function UnsupportedRole() {
  // DRAFT message and logout button
  return (
    <div>
      Unknown Role, Refresh or update the app <LogoutButton></LogoutButton>
    </div>
  );
}
