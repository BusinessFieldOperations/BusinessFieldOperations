import {useEffect, useState} from 'preact/hooks';
import {Fragment} from 'preact';
import 'mdui/components/avatar.js';
import 'mdui/components/badge.js';
import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/divider.js';

import AdminUserCreation from './AdminUserCreation';
import AdminUserEdit from './AdminUserEdit';
import {supabase} from '../../lib/supabase';

interface UserItem {
  id: string;
  first_name: string;
  last_name: string;
  ci?: string | null;
  role: string;
  is_active: boolean;
}

const PAGE_SIZE = 10;

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [createFeedbackMsg, setCreateFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const reloadUsers = async (targetPage = page, targetSearch = searchTerm) => {
    setLoading(true);

    try {
      const trimmed = targetSearch.trim();
      const offset = (targetPage - 1) * PAGE_SIZE;
      let query = supabase
        .from('profiles')
        .select('id,first_name,last_name,ci,role,is_active', {count: 'exact'});

      if (trimmed) {
        query = query.or(
          `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,ci.ilike.%${trimmed}%`,
        );
      }

      const {data, count, error} = await query
        .order('first_name', {ascending: true})
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
      setUsers((data as UserItem[]) ?? []);
      setPageCount(totalPages);
      if (targetPage > totalPages) {
        setPage(totalPages);
      }
    } catch (error: any) {
      console.error('Failed to load users', error.message || error);
      setUsers([]);
      setPageCount(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    void reloadUsers(page, searchTerm);
  }, [page, searchTerm]);

  return (
    <Fragment>
      <div class="list-header">
        <h3>Users</h3>

        <div class="list-header-actions">
          {showSearch && (
            <input
              class="list-search-input"
              type="text"
              value={searchTerm}
              placeholder="Search users"
              onInput={event => {
                setSearchTerm((event.target as HTMLInputElement).value);
              }}
            />
          )}

          <mdui-button-icon
            icon="search"
            variant="filled"
            onClick={() => setShowSearch(value => !value)}
          ></mdui-button-icon>

          {!showCreate && (
            <mdui-button variant="filled" onClick={() => setShowCreate(true)}>
              Create user
            </mdui-button>
          )}
        </div>
      </div>

      {showCreate ? (
        <div class="dialog-panel">
          <mdui-button variant="outlined" onClick={() => setShowCreate(false)}>
            Back to list
          </mdui-button>
          <AdminUserCreation
            onCreated={msg => {
              setCreateFeedbackMsg(msg);
              setShowCreate(false);
              void reloadUsers(1, searchTerm);
            }}
          />
        </div>
      ) : null}

      {editingUser ? (
        <div class="dialog-panel">
          <mdui-button variant="outlined" onClick={() => setEditingUser(null)}>
            Back to list
          </mdui-button>
          <AdminUserEdit
            user={editingUser}
            onUpdated={msg => {
              setCreateFeedbackMsg(msg);
              setEditingUser(null);
              void reloadUsers(1, searchTerm);
            }}
            onClose={() => setEditingUser(null)}
          />
        </div>
      ) : null}

      {createFeedbackMsg && (
        <div
          class={`feedback-message ${createFeedbackMsg.type === 'error' ? 'error' : 'success'}`}
        >
          {createFeedbackMsg.text}
        </div>
      )}

      {loading && <p>Loading users...</p>}

      <div class="user-list">
        {users.map(u => (
          <div
            class={`user-box ${u.is_active ? '' : 'user-innactive'}`}
            key={u.id}
          >
            <mdui-avatar src="/favicon.svg"></mdui-avatar>
            <div>
              <div>
                {u.first_name} {u.last_name}
              </div>
              {u.ci && <div class="user-ci">CI: {u.ci}</div>}
              <mdui-badge>
                {u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'User'}
              </mdui-badge>
              <div class="status-highlight">
                {u.is_active ? 'Active' : 'No Active'}
              </div>
            </div>

            <div>
              <mdui-button-icon
                icon="edit"
                variant="outlined"
                onClick={() => setEditingUser(u)}
              ></mdui-button-icon>
            </div>
          </div>
        ))}

        {!loading && users.length === 0 && <div>No users found.</div>}
      </div>

      {!loading && users.length > 0 && (
        <div class="pagination-row">
          <mdui-button-icon
            icon="chevron_left"
            variant="outlined"
            disabled={page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}
          ></mdui-button-icon>
          <mdui-button-icon
            icon="chevron_right"
            variant="outlined"
            disabled={page >= pageCount}
            onClick={() => setPage(value => Math.min(pageCount, value + 1))}
          ></mdui-button-icon>
        </div>
      )}
    </Fragment>
  );
}
