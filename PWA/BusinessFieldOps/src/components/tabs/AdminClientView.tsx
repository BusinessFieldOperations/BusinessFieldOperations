import { useEffect, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import 'mdui/components/avatar.js';
import 'mdui/components/badge.js';
import 'mdui/components/button.js';

import { supabase } from '../../lib/supabase';

interface ProductItem {
  id: number;
  name: string;
  units_per_package: number | null;
}

export default function AdminClientView({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [rif, setRif] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: client } = await supabase.from('clients').select('id,name,rif').eq('id', clientId).single();
      if (client) {
        setClientName(client.name || '');
        setRif(client.rif || '');
      }

      const { data: prods } = await supabase.from('products').select('id,name,units_per_package').eq('client_id', clientId).order('name');
      setProducts((prods as any) ?? []);
    } catch (err) {
      console.error('Failed to load client view', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  return (
    <Fragment>
      <div class="dialog-panel">
        <mdui-button variant="outlined" onClick={onClose}>Back to list</mdui-button>

        <div>
          <h3>{clientName}</h3>
          <p>RIF: {rif}</p>
          <div>
            <span>Total products: <strong>{products.length}</strong></span>
          </div>

          {loading && <p>Loading products...</p>}

          <div class="user-list">
            {products.length === 0 ? (
              <div class="info-message">No products for this client.</div>
            ) : (
              products.map((p) => (
                <div class="user-box" key={p.id}>
                  <mdui-avatar icon="inventory_2"></mdui-avatar>
                  <div>
                    <div>{p.name}</div>
                    <div>Units per package: {p.units_per_package ?? '-'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Fragment>
  );
}
