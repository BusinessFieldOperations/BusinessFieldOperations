import {useState} from 'preact/hooks';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';
import 'mdui/components/select.js';
import 'mdui/components/menu-item.js';
import {supabase} from '../../lib/supabase';

type Feedback = {type: 'success' | 'error'; text: string};

export default function AdminUserCreation({
  onCreated,
}: {
  onCreated?: (msg: Feedback) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ci, setCi] = useState('');
  const [role, setRole] = useState<'merchant' | 'promoter' | 'administrator'>(
    'promoter',
  );

  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleCreateUser = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedCi = ci.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setFeedbackMsg({
        type: 'error',
        text: 'First name and last name are required.',
      });
      setLoading(false);
      return;
    }

    const {data, error} = await supabase.rpc('create_user_by_admin', {
      email_input: email,
      password_input: password,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      user_role: role,
    });

    if (error) {
      setFeedbackMsg({type: 'error', text: error.message});
    } else if (data && data.status === 'success') {
      if (trimmedCi) {
        const {error: profileError} = await supabase
          .from('profiles')
          .update({ci: trimmedCi})
          .eq('id', data.user_id);

        if (profileError) {
          setFeedbackMsg({
            type: 'error',
            text: `User created, but CI could not be saved: ${profileError.message}`,
          });
          setLoading(false);
          return;
        }
      }

      const msg = {
        type: 'success' as const,
        text: `User ${trimmedFirstName} ${trimmedLastName} created successfully.`,
      };
      if (onCreated) onCreated(msg);
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setCi('');
      setRole('promoter');
    }

    setLoading(false);
  };

  return (
    <div class="creation-root">
      <h3>Add New User</h3>

      <form onSubmit={handleCreateUser}>
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

        <mdui-text-field
          label="CI / ID"
          variant="outlined"
          value={ci}
          onInput={(e: any) => setCi(e.target.value)}
        />

        <mdui-text-field
          label="Email"
          type="email"
          variant="outlined"
          icon="email"
          value={email}
          onInput={(e: any) => setEmail(e.target.value)}
          required
        />

        <mdui-text-field
          label="Password"
          type="password"
          variant="outlined"
          icon="key"
          value={password}
          onInput={(e: any) => setPassword(e.target.value)}
          required
          toggle-password
        />

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

        {feedbackMsg && (
          <div
            class={`feedback-message ${feedbackMsg.type === 'error' ? 'error' : 'success'}`}
          >
            {feedbackMsg.text}
          </div>
        )}

        <mdui-button
          type="submit"
          variant="filled"
          loading={loading ? true : undefined}
        >
          Create User
        </mdui-button>
      </form>
    </div>
  );
}
