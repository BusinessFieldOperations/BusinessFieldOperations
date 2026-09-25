import {useState, useEffect} from 'preact/hooks';
import 'mdui/components/text-field.js';
import 'mdui/components/button.js';

type Product = {
  name: string;
  units_per_package?: number;
  sku?: string;
  brand?: string;
  category?: string;
};

export default function AdminProductCreation({
  onAdd,
  onClose,
  initial,
}: {
  onAdd: (p: Product) => void;
  onClose: () => void;
  initial?: Product & {id?: number};
}) {
  const [name, setName] = useState('');
  const [units, setUnits] = useState<number | ''>('');
  const [sku, setSku] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setUnits(initial.units_per_package ?? '');
      setSku((initial as any).sku ?? '');
      setBrand((initial as any).brand ?? '');
      setCategory((initial as any).category ?? '');
    }
  }, [initial]);

  const handleAdd = async (e?: Event) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const product = {
      ...initial,
      name: name.trim(),
      units_per_package: Number(units) || undefined,
      sku: sku.trim() || undefined,
      brand: brand.trim() || undefined,
      category: category.trim() || undefined,
    } as Product & {id?: number};
    onAdd(product as Product);
    setName('');
    setUnits('');
    setSku('');
    setBrand('');
    setCategory('');
    setLoading(false);
  };

  return (
    <div class="creation-root">
      <h3>{initial ? 'Edit Product' : 'Add Product'}</h3>

      <form onSubmit={handleAdd}>
        <mdui-text-field
          label="Product name"
          variant="outlined"
          value={name}
          onInput={(e: any) => setName(e.target.value)}
          required
        />
        <mdui-text-field
          label="SKU"
          variant="outlined"
          value={sku}
          onInput={(e: any) => setSku(e.target.value)}
        />
        <mdui-text-field
          label="Brand"
          variant="outlined"
          value={brand}
          onInput={(e: any) => setBrand(e.target.value)}
        />
        <mdui-text-field
          label="Category"
          variant="outlined"
          value={category}
          onInput={(e: any) => setCategory(e.target.value)}
        />
        <mdui-text-field
          label="Units per package"
          type="number"
          variant="outlined"
          value={String(units)}
          onInput={(e: any) =>
            setUnits(e.target.value ? Number(e.target.value) : '')
          }
        />

        <div>
          <mdui-button
            type="submit"
            variant="filled"
            loading={loading ? true : undefined}
          >
            {initial ? 'Save' : 'Add Product'}
          </mdui-button>
          <mdui-button variant="outlined" onClick={onClose}>
            Cancel
          </mdui-button>
        </div>
      </form>
    </div>
  );
}
