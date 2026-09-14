import { useEffect, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import 'mdui/components/avatar.js';
import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/divider.js';
import 'mdui/components/badge.js';

import { supabase } from '../../lib/supabase';
import AdminClientCreation from './AdminClientCreation';
import AdminClientEdit from './AdminClientEdit';
import AdminClientView from './AdminClientView';
interface ClientItem {
  id: number | string;
  name: string;
  rif: string;
  [key: string]: any;
}

export default function AdminClients() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string | number, number>>({});

  const reloadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('id,name,rif')
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load clients', error.message || error);
      setClients([]);
    } else {
      const clientsData = (data as any) ?? [];
      setClients(clientsData);

      // load product counts per client
      const counts: Record<string, number> = {};
      await Promise.all(
        clientsData.map(async (c: any) => {
          const { count, error: countErr } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: false })
            .eq('client_id', c.id);

          if (countErr) {
            console.error('Failed to load product count for client', c.id, countErr.message || countErr);
            counts[c.id] = 0;
          } else {
            counts[c.id] = count ?? 0;
          }
        })
      );

      setProductCounts(counts);
    }

    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await reloadClients();
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Fragment>
      <div class="list-header">
        <h3>Clients</h3>
        {!showCreate && (
          <mdui-button variant="filled" icon="add" onClick={() => setShowCreate(true)}>Add client</mdui-button>
        )}
      </div>

      {showCreate ? (
        <div class="dialog-panel">
          <AdminClientCreation
            onCreated={() => {
              setShowCreate(false);
              reloadClients();
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
              reloadClients();
            }}
            onClose={() => setEditingClientId(null)}
          />
        </div>
      ) : null}

      {loading && <p>Loading clients...</p>}

      <div class="user-list">
        {clients.map((c) => (
          <div class="user-box" key={c.id}>
            <mdui-avatar icon="person"></mdui-avatar>

            <div>
              <div>{c.name}</div>
              <div>{c.rif}</div>
              <div>
                <span class="status-highlight">Products: {productCounts[c.id] ?? 0}</span>
              </div>
            </div>

            <div>
              <mdui-button-icon icon="edit" variant="outlined" onClick={() => setEditingClientId(String(c.id))}></mdui-button-icon>
              <mdui-button-icon icon="visibility" variant="filled" onClick={() => setSelectedClient(c)}></mdui-button-icon>
            </div>
          </div>
        ))}

        {!loading && clients.length === 0 && (
          <div class="info-message">No clients found.</div>
        )}
      </div>

      {selectedClient && (
        <div class="dialog-panel">
          <AdminClientView clientId={String(selectedClient.id)} onClose={() => setSelectedClient(null)} />
        </div>
      )}
    </Fragment>
  );
}
