import './ProductPicker.css';

import 'mdui/components/icon.js';

import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';

import {FullScreenDialog} from '@/components/dialog';
import {SelectField} from '@/components/form';
import {PickerList} from '@/components/list';
import {SearchBar} from '@/components/search';
import type {CatalogProduct} from '@/lib/catalog';
import {useLocalSearch} from '@/lib/useLocalSearch';

/** Rows drawn at once: more than this is a search problem, not a scroll one. */
const MAX_ROWS = 200;

/** What the search box looks at, besides what the combo boxes filter. */
const getProductTexts = (product: CatalogProduct) => [
  product.name,
  product.sku,
  product.display_quantity,
  product.brand,
  product.category,
];

const getProductKey = (product: CatalogProduct) => product.id;

const distinct = (values: readonly (string | null)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (first, second) => first.localeCompare(second),
  );

/** Props of {@link ProductPickerDialog}. */
export interface ProductPickerDialogProps {
  open: boolean;
  /** `undefined` while loading. */
  catalog: readonly CatalogProduct[] | undefined;
  /** Products already in the report: they are not offered again. */
  excludeIds: readonly string[];
  onClose: () => void;
  onConfirm: (_productIds: string[]) => void;
}

/**
 * Full-screen list to add several products at once. Filter by brand and
 * category with the combo boxes, or search by name, SKU, quantity, brand or
 * category.
 */
export function ProductPickerDialog({
  open,
  ...rest
}: ProductPickerDialogProps): JSX.Element | null {
  // Mounted only while open, so selection and filters start fresh each time.
  return open ? <ProductPickerContent {...rest} /> : null;
}

function ProductPickerContent({
  catalog,
  excludeIds,
  onClose,
  onConfirm,
}: Omit<ProductPickerDialogProps, 'open'>): JSX.Element {
  const [selected, setSelected] = useState<string[]>([]);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');

  const available = useMemo(() => {
    const excluded = new Set(excludeIds);

    return catalog?.filter(product => !excluded.has(product.id));
  }, [catalog, excludeIds]);

  const brands = useMemo(
    () => distinct(available?.map(product => product.brand) ?? []),
    [available],
  );
  const categories = useMemo(
    () => distinct(available?.map(product => product.category) ?? []),
    [available],
  );

  const filtered = useMemo(
    () =>
      available?.filter(
        product =>
          (brand === '' || product.brand === brand) &&
          (category === '' || product.category === category),
      ),
    [available, brand, category],
  );

  const {query, setQuery, results} = useLocalSearch(filtered, getProductTexts);
  const visible = results?.slice(0, MAX_ROWS);
  const isFiltering = query !== '' || brand !== '' || category !== '';

  const toggle = (product: CatalogProduct) =>
    setSelected(previous =>
      previous.includes(product.id)
        ? previous.filter(id => id !== product.id)
        : [...previous, product.id],
    );

  return (
    <FullScreenDialog
      open
      title="Add products"
      closeLabel="Close"
      onClose={onClose}
      action={{
        label: `Add (${selected.length})`,
        onClick: () => onConfirm(selected),
        disabled: selected.length === 0,
      }}
    >
      <PickerList
        items={visible}
        getKey={getProductKey}
        getRow={product => ({
          icon: (
            <mdui-icon
              name={
                selected.includes(product.id)
                  ? 'check_box'
                  : 'check_box_outline_blank'
              }
            />
          ),
          headline: product.name,
          details: [
            product.display_quantity,
            [product.sku, product.brand].filter(Boolean).join(' · '),
          ],
        })}
        onPick={toggle}
        toolbar={
          <>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search products"
              autoFocus={false}
            />
            <div class="product-picker__filters">
              <SelectField
                label="Brand"
                value={brand}
                options={brands.map(value => ({value, label: value}))}
                onChange={setBrand}
                clearable
              />
              <SelectField
                label="Category"
                value={category}
                options={categories.map(value => ({value, label: value}))}
                onChange={setCategory}
                clearable
              />
            </div>
          </>
        }
        loadingLabel="Loading products..."
        emptyLabel={
          isFiltering
            ? 'No products match your filters.'
            : 'No products to add.'
        }
        listLabel="Products"
      />
      {results && results.length > MAX_ROWS ? (
        <p class="product-picker__hint">
          Showing the first {MAX_ROWS} of {results.length}. Use the search or
          the filters to narrow them down.
        </p>
      ) : null}
    </FullScreenDialog>
  );
}
