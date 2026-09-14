import { useState, useEffect } from 'preact/hooks';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';

type Product = {
  name: string;
  units_per_package?: number;
};

export default function AdminProductCreation({ onAdd, onClose, initial }: { onAdd: (p: Product) => void; onClose: () => void; initial?: Product & { id?: number } }) {
  const [name, setName] = useState('');
  const [units, setUnits] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setUnits(initial.units_per_package ?? '');
    }
  }, [initial]);

  const handleAdd = async (e?: Event) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const product = { ...initial, name: name.trim(), units_per_package: Number(units) || undefined } as Product & { id?: number };
    onAdd(product as Product);
    setName('');
    setUnits('');
    setLoading(false);
  };

  return (
    <div class="creation-root">
      <h3>{initial ? 'Edit Product' : 'Add Product'}</h3>

      <form onSubmit={handleAdd}>
        <mdui-text-field label="Product name" variant="outlined" value={name} onInput={(e: any) => setName(e.target.value)} required />
        <mdui-text-field label="Units per package" type="number" variant="outlined" value={String(units)} onInput={(e: any) => setUnits(e.target.value ? Number(e.target.value) : '')} />

        <div>
          <mdui-button type="submit" variant="filled" loading={loading ? true : undefined}>{initial ? 'Save' : 'Add Product'}</mdui-button>
          <mdui-button variant="outlined" onClick={onClose}>Cancel</mdui-button>
        </div>
      </form>
    </div>
  );
}
