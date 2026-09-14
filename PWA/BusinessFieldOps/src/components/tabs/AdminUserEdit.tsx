import { useEffect, useState } from 'preact/hooks';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';
import 'mdui/components/select.js';
import 'mdui/components/menu-item.js';
import { supabase } from '../../lib/supabase';

type UserRole = 'merchant' | 'promoter' | 'administrator';

type Feedback = { type: 'success' | 'error'; text: string };

interface UserItem {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole | string;
  is_active: boolean;
}

export default function AdminUserEdit({
  user,
  onUpdated,
  onClose,
}: {
  user: UserItem;
  onUpdated?: (msg: Feedback) => void;
  onClose?: () => void;
}) {
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [role, setRole] = useState<UserRole>('promoter');
  const [isActive, setIsActive] = useState(Boolean(user.is_active));
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<Feedback | null>(null);

  useEffect(() => {
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setIsActive(Boolean(user.is_active));

    if (user.role === 'merchant' || user.role === 'promoter' || user.role === 'administrator') {
      setRole(user.role);
    } else {
      setRole('promoter');
    }
  }, [user]);

  const handleSaveUser = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setFeedbackMsg({ type: 'error', text: 'First name and last name are required.' });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        role,
        is_active: isActive,
      })
      .eq('id', user.id)
      .select('id, first_name, last_name, role, is_active')
      .single();

    if (error) {
      setFeedbackMsg({ type: 'error', text: error.message });
    } else if (data) {
      const msg = {
        type: 'success' as const,
        text: `User ${data.first_name} ${data.last_name} updated successfully.`,
      };

      if (onUpdated) {
        onUpdated(msg);
      } else {
        setFeedbackMsg(msg);
      }

      if (onClose) {
        onClose();
      }
    }

    setLoading(false);
  };

  return (
    <div class="creation-root">
      <h3>Edit User</h3>

      <form onSubmit={handleSaveUser}>
        <div>
          <mdui-text-field
            label="First Name"
            variant="outlined"
            value={firstName}
            onInput={(e: any) => setFirstName(e.target.value)}
            required
          />
          <mdui-text-field
            label="Last Name"
            variant="outlined"
            value={lastName}
            onInput={(e: any) => setLastName(e.target.value)}
            required
          />
        </div>

        <mdui-select
          label="System Role"
          value={role}
          variant="outlined"
          onChange={(e: any) => setRole(e.target.value)}
        >
          <mdui-menu-item value="promoter">Promoter</mdui-menu-item>
          <mdui-menu-item value="merchant">Merchant</mdui-menu-item>
          <mdui-menu-item value="administrator">Administrator</mdui-menu-item>
        </mdui-select>

        <mdui-select
          label="Status"
          value={isActive ? 'active' : 'inactive'}
          variant="outlined"
          onChange={(e: any) => setIsActive(e.target.value === 'active')}
        >
          <mdui-menu-item value="active">Active</mdui-menu-item>
          <mdui-menu-item value="inactive">Inactive</mdui-menu-item>
        </mdui-select>

        {feedbackMsg && (
          <div class={`feedback-message ${feedbackMsg.type === 'error' ? 'error' : 'success'}`}>
            {feedbackMsg.text}
          </div>
        )}

        <mdui-button type="submit" variant="filled" loading={loading ? true : undefined}>
          Save Changes
        </mdui-button>
      </form>
    </div>
  );
}
