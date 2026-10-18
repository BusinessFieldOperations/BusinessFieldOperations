import 'mdui/components/button-icon.js';
import 'mdui/components/card.js';

import type {ComponentChildren, JSX} from 'preact';

import type {CatalogProduct} from '@/lib/catalog';
import {m} from '@/paraglide/messages.js';

/** "500 ml · SKU 123 · Brand": what tells similar products apart. */
export function productMeta(product: CatalogProduct): string {
  return [
    product.display_quantity,
    product.sku ? `SKU ${product.sku}` : null,
    product.brand,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Props of {@link ReportLineCard}. */
export interface ReportLineCardProps {
  /** `undefined` if it is not in the local catalog (e.g. deactivated). */
  product: CatalogProduct | undefined;
  onRemove: () => void;
  /** The count fields of the product. */
  children: ComponentChildren;
}

/** One product of a report: its name, a remove button and its fields. */
export function ReportLineCard({
  product,
  onRemove,
  children,
}: ReportLineCardProps): JSX.Element {
  const meta = product ? productMeta(product) : '';

  return (
    <mdui-card variant="outlined" class="report-line">
      <div class="report-line__header">
        <div class="report-line__title">
          <span class="report-line__name">
            {product?.name ?? m.unknown_product()}
          </span>
          {meta ? <span class="report-line__meta">{meta}</span> : null}
        </div>
        <mdui-button-icon
          icon="delete"
          aria-label={m.remove_product()}
          onClick={() => onRemove()}
        />
      </div>
      {children}
    </mdui-card>
  );
}
