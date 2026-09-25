import {useEffect, useState} from 'preact/hooks';
import {Fragment} from 'preact';
import 'mdui/components/avatar.js';
import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/divider.js';
import 'mdui/components/badge.js';

import {supabase} from '../../lib/supabase';
import AdminClientCreation from './AdminClientCreation';
import AdminClientEdit from './AdminClientEdit';
import AdminClientView from './AdminClientView';
interface ClientItem {
  id: number | string;
  name: string;
  rif: string;
  [key: string]: any;
}

const PAGE_SIZE = 10;

export default function AdminClients() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [productCounts, setProductCounts] = useState<
    Record<string | number, number>
  >({});
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const reloadClients = async (
    targetPage = page,
    targetSearch = searchTerm,
  ) => {
    setLoading(true);

    try {
      const trimmed = targetSearch.trim();
      const offset = (targetPage - 1) * PAGE_SIZE;

      let clientsData: ClientItem[] = [];
      let totalCount = 0;

      if (trimmed) {
        const {data: nameMatches, error: nameError} = await supabase
          .from('clients')
          .select('id', {count: 'exact'})
          .or(`name.ilike.%${trimmed}%,rif.ilike.%${trimmed}%`);

        if (nameError) {
          throw nameError;
        }

        const {data: productMatches, error: productError} = await supabase
          .from('products')
          .select('client_id')
          .ilike('name', `%${trimmed}%`);

        if (productError) {
          throw productError;
        }

        const matchingIds = [
          ...(nameMatches ?? []).map(item => item.id),
          ...(productMatches ?? []).map(item => item.client_id),
        ].filter((value, index, array) => array.indexOf(value) === index);

        if (matchingIds.length === 0) {
          setClients([]);
          setPageCount(1);
          setProductCounts({});
          return;
        }

        const {data, count, error} = await supabase
          .from('clients')
          .select('id,name,rif', {count: 'exact'})
          .in('id', matchingIds)
          .order('name', {ascending: true})
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          throw error;
        }

        clientsData = (data as ClientItem[]) ?? [];
        totalCount = count ?? clientsData.length;
      } else {
        const {data, count, error} = await supabase
          .from('clients')
          .select('id,name,rif', {count: 'exact'})
          .order('name', {ascending: true})
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          throw error;
        }

        clientsData = (data as ClientItem[]) ?? [];
        totalCount = count ?? clientsData.length;
      }

      setClients(clientsData);
      setPageCount(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
      if (targetPage > Math.max(1, Math.ceil(totalCount / PAGE_SIZE))) {
        setPage(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));
      }

      const counts: Record<string | number, number> = {};
      if (clientsData.length > 0) {
        const {data: productRows, error: productCountError} = await supabase
          .from('products')
          .select('client_id');

        if (productCountError) {
          console.error(
            'Failed to load product counts',
            productCountError.message || productCountError,
          );
        } else {
          for (const row of productRows ?? []) {
            const key = String(row.client_id);
            counts[key] = (counts[key] ?? 0) + 1;
          }
        }
      }

      setProductCounts(counts);
    } catch (error: any) {
      console.error('Failed to load clients', error.message || error);
      setClients([]);
      setPageCount(1);
      setProductCounts({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    void reloadClients(page, searchTerm);
  }, [page, searchTerm]);

  return (
    <Fragment>
      <div class="list-header">
        <h3>Clients</h3>

        <div class="list-header-actions">
          {showSearch && (
            <input
              class="list-search-input"
              type="text"
              value={searchTerm}
              placeholder="Search clients"
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
            <mdui-button
              variant="filled"
              icon="add"
              onClick={() => setShowCreate(true)}
            >
              Add client
            </mdui-button>
          )}
        </div>
      </div>

      {showCreate ? (
        <div class="dialog-panel">
          <AdminClientCreation
            onCreated={() => {
              setShowCreate(false);
              void reloadClients(1, searchTerm);
            }}
            onClose={() => setShowCreate(false)}
          />
        </div>
      ) : null}

      {editingClientId ? (
        <div class="dialog-panel">
          <AdminClientEdit
            clientId={editingClientId}
            onUpdated={() => {
              setEditingClientId(null);
              void reloadClients(1, searchTerm);
            }}
            onClose={() => setEditingClientId(null)}
          />
        </div>
      ) : null}

      {loading && <p>Loading clients...</p>}

      <div class="user-list">
        {clients.map(c => (
          <div class="user-box" key={c.id}>
            <mdui-avatar icon="person"></mdui-avatar>

            <div>
              <div>{c.name}</div>
              <div>{c.rif}</div>
              <div>
                <span class="status-highlight">
                  Products: {productCounts[String(c.id)] ?? 0}
                </span>
              </div>
            </div>

            <div>
              <mdui-button-icon
                icon="edit"
                variant="outlined"
                onClick={() => setEditingClientId(String(c.id))}
              ></mdui-button-icon>
              <mdui-button-icon
                icon="visibility"
                variant="filled"
                onClick={() => setSelectedClient(c)}
              ></mdui-button-icon>
            </div>
          </div>
        ))}

        {!loading && clients.length === 0 && (
          <div class="info-message">No clients found.</div>
        )}
      </div>

      {!loading && clients.length > 0 && (
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

      {selectedClient && (
        <div class="dialog-panel">
          <AdminClientView
            clientId={String(selectedClient.id)}
            onClose={() => setSelectedClient(null)}
          />
        </div>
      )}
    </Fragment>
  );
}
