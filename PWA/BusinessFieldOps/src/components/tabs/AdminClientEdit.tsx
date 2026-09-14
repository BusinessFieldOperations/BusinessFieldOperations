import { useEffect, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/divider.js';
import 'mdui/components/badge.js';
import 'mdui/components/select.js';
import 'mdui/components/menu-item.js';

import AdminProductCreation from './AdminProductCreation';
import { supabase } from '../../lib/supabase';

type Feedback = { type: 'success' | 'error'; text: string };

export default function AdminClientEdit({ clientId, onUpdated, onClose }: { clientId: string; onUpdated?: (msg: Feedback) => void; onClose?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [rif, setRif] = useState('');
  const [statesList, setStatesList] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedStates, setSelectedStates] = useState<number[]>([]);
  const [products, setProducts] = useState<Array<any>>([]);
  const [showProductCreate, setShowProductCreate] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<Feedback | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: client } = await supabase.from('clients').select('id,name,rif').eq('id', clientId).single();
    if (client) {
      setName(client.name || '');
      setRif(client.rif || '');
    }

    const { data: states } = await supabase.from('states').select('id,name').order('name');
    if (states) setStatesList(states as any);

    const { data: clientStates } = await supabase.from('clients_states').select('state_id').eq('client_id', clientId);
    if (clientStates) setSelectedStates((clientStates as any).map((r: any) => r.state_id));

    const { data: prods } = await supabase.from('products').select('*').eq('client_id', clientId).order('name');
    if (prods) setProducts(prods as any);

    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const handleAddProduct = async (p: any) => {
    // if p has id -> update
    if (p && (p as any).id) {
      const { error } = await supabase.from('products').update({ name: p.name, units_per_package: p.units_per_package ?? null }).eq('id', (p as any).id);
      if (error) {
        setFeedbackMsg({ type: 'error', text: error.message || 'Failed to update product' });
        return;
      }
      setProducts((cur) => cur.map((x) => (x.id === p.id ? { ...x, name: p.name, units_per_package: p.units_per_package } : x)));
    } else {
      // insert
      const { data, error } = await supabase.from('products').insert([{ name: p.name, units_per_package: p.units_per_package ?? null, client_id: clientId }]).select().single();
      if (error) {
        setFeedbackMsg({ type: 'error', text: error.message || 'Failed to add product' });
        return;
      }
      setProducts((cur) => [...cur, data]);
    }

    setShowProductCreate(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = async (id: number) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      setFeedbackMsg({ type: 'error', text: error.message || 'Failed to delete product' });
      return;
    }
    setProducts((cur) => cur.filter((p) => p.id !== id));
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('clients').update({ name, rif }).eq('id', clientId);
      if (error) throw error;

      // update states: delete existing then insert new
      await supabase.from('clients_states').delete().eq('client_id', clientId);
      if (selectedStates.length > 0) {
        const rels = selectedStates.map((sId) => ({ client_id: clientId, state_id: Number(sId) }));
        const { error: relErr } = await supabase.from('clients_states').insert(rels);
        if (relErr) throw relErr;
      }

      const msg = { type: 'success' as const, text: `Client ${name} updated.` };
      if (onUpdated) onUpdated(msg);
      if (onClose) onClose();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update client' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fragment>
      <div class="creation-root">
        <h3>Edit Client</h3>

        <form onSubmit={handleSave}>
          <mdui-text-field label="Client name" variant="outlined" value={name} onInput={(e: any) => setName(e.target.value)} required />
          <mdui-text-field label="Client RIF" variant="outlined" value={rif} onInput={(e: any) => setRif(e.target.value)} required />

          <div class="items-box">
            <h4>States</h4>
            <mdui-select multiple label="States" variant="outlined" onChange={(e: any) => {
              const opts = Array.from(e.target.selectedOptions || []);
              const vals = opts.map((o: any) => Number(o.value));
              setSelectedStates(vals);
            }}>
              {statesList.map(s => <mdui-menu-item key={s.id} value={String(s.id)} selected={selectedStates.includes(s.id)}>{s.name}</mdui-menu-item>)}
            </mdui-select>
          </div>

          <div class="items-box">
            <h4>Products</h4>
            <mdui-button variant="outlined" icon="add" onClick={() => { setEditingProduct(null); setShowProductCreate(true); }}>Add product</mdui-button>

            <div class="user-list">
              {products.length === 0 ? (
                <div class="info-message">No products yet.</div>
              ) : (
                products.map((p) => (
                  <div class="user-box" key={p.id}>
                    <mdui-avatar icon="inventory_2"></mdui-avatar>

                    <div>
                      <div>{p.name}</div>
                      <mdui-badge>{p.units_per_package ?? '-'}</mdui-badge>
                    </div>

                    <div>
                      <mdui-button-icon icon="edit" variant="outlined" onClick={() => { setEditingProduct(p); setShowProductCreate(true); }}></mdui-button-icon>
                      <mdui-button-icon icon="delete" variant="outlined" onClick={() => handleDeleteProduct(p.id)}></mdui-button-icon>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {feedbackMsg && <div class={`feedback-message ${feedbackMsg.type === 'error' ? 'error' : 'success'}`}>{feedbackMsg.text}</div>}

          <div>
            <mdui-button type="submit" variant="filled" loading={loading ? true : undefined}>Save Changes</mdui-button>
            <mdui-button variant="outlined" onClick={() => { if (onClose) onClose(); }} style={{ marginLeft: '8px' }}>Cancel</mdui-button>
          </div>
        </form>

        {showProductCreate && (
          <div class="dialog-panel">
            <AdminProductCreation onAdd={handleAddProduct} onClose={() => setShowProductCreate(false)} initial={editingProduct ?? undefined} />
          </div>
        )}
      </div>
    </Fragment>
  );
}
