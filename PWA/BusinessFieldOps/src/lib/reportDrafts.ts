/**
 * What a report form keeps while it is a draft. Plain JSON (it goes to
 * IndexedDB) and independent from the server payload: `reportPayloads.ts`
 * turns it into what the `submit_*` functions expect.
 */

export interface ReportHeaderDraft {
  salesmanName: string;
  zone: string;
  /** `null` until the user picks one (a single available client is implied). */
  clientId: string | null;
}

/** Salesfloor of the counts that do not belong to any floor. */
export const NO_SALESFLOOR = '';

export interface InventoryCell {
  good: number | null;
  damaged: number | null;
  expired: number | null;
}

export const EMPTY_CELL: InventoryCell = {
  good: null,
  damaged: null,
  expired: null,
};

export interface MerchantReportDraft extends ReportHeaderDraft {
  noInventory: boolean;
  observations: string;
  salesfloors: string[];
  /** Products added to the report, in the order they were added. */
  productIds: string[];
  /** Counts by `cellKey(productId, salesfloor)`. */
  cells: Record<string, InventoryCell>;
}

export const EMPTY_MERCHANT_DRAFT: MerchantReportDraft = {
  salesmanName: '',
  zone: '',
  clientId: null,
  noInventory: false,
  observations: '',
  salesfloors: [],
  productIds: [],
  cells: {},
};

export interface PromoterLine {
  productId: string;
  initial: number | null;
  restocked: number | null;
  final: number | null;
}

export interface PromoterReportDraft extends ReportHeaderDraft {
  lines: PromoterLine[];
}

export const EMPTY_PROMOTER_DRAFT: PromoterReportDraft = {
  salesmanName: '',
  zone: '',
  clientId: null,
  lines: [],
};

// ---------------------------------------------------------------- merchant

export function cellKey(productId: string, salesfloor: string): string {
  return `${productId}|${salesfloor}`;
}

/** Product ids never contain `|`, floor names may: split at the first one. */
function splitCellKey(key: string): {productId: string; salesfloor: string} {
  const separator = key.indexOf('|');

  return {
    productId: key.slice(0, separator),
    salesfloor: key.slice(separator + 1),
  };
}

/** Floors the counts are entered for: the real ones, or "no floor". */
export function floorsOf(draft: MerchantReportDraft): readonly string[] {
  return draft.salesfloors.length > 0 ? draft.salesfloors : [NO_SALESFLOOR];
}

export function getCell(
  draft: MerchantReportDraft,
  productId: string,
  salesfloor: string,
): InventoryCell {
  return draft.cells[cellKey(productId, salesfloor)] ?? EMPTY_CELL;
}

export function setCell(
  draft: MerchantReportDraft,
  productId: string,
  salesfloor: string,
  patch: Partial<InventoryCell>,
): MerchantReportDraft {
  const key = cellKey(productId, salesfloor);

  return {
    ...draft,
    cells: {
      ...draft.cells,
      [key]: {...(draft.cells[key] ?? EMPTY_CELL), ...patch},
    },
  };
}

export function addMerchantProducts(
  draft: MerchantReportDraft,
  productIds: readonly string[],
): MerchantReportDraft {
  const known = new Set(draft.productIds);
  const added: string[] = [];

  for (const productId of productIds) {
    if (!known.has(productId)) {
      known.add(productId);
      added.push(productId);
    }
  }

  return added.length > 0
    ? {...draft, productIds: [...draft.productIds, ...added]}
    : draft;
}

export function removeMerchantProduct(
  draft: MerchantReportDraft,
  productId: string,
): MerchantReportDraft {
  return {
    ...draft,
    productIds: draft.productIds.filter(id => id !== productId),
    cells: Object.fromEntries(
      Object.entries(draft.cells).filter(
        ([key]) => splitCellKey(key).productId !== productId,
      ),
    ),
  };
}

/** Re-labels the counts of one floor, so floor changes do not lose them. */
function moveCells(
  cells: Record<string, InventoryCell>,
  from: string,
  to: string,
): Record<string, InventoryCell> {
  return Object.fromEntries(
    Object.entries(cells).map(([key, cell]) => {
      const {productId, salesfloor} = splitCellKey(key);

      return [salesfloor === from ? cellKey(productId, to) : key, cell];
    }),
  );
}

/**
 * Adds a floor (trimmed, no duplicates). Counts entered before the first
 * floor existed move to it.
 */
export function addSalesfloor(
  draft: MerchantReportDraft,
  rawName: string,
): MerchantReportDraft {
  const name = rawName.trim();

  if (name === '' || draft.salesfloors.includes(name)) {
    return draft;
  }

  return {
    ...draft,
    salesfloors: [...draft.salesfloors, name],
    cells:
      draft.salesfloors.length === 0
        ? moveCells(draft.cells, NO_SALESFLOOR, name)
        : draft.cells,
  };
}

/**
 * Removes a floor and its counts. Removing the last one keeps its counts as
 * "no floor".
 */
export function removeSalesfloor(
  draft: MerchantReportDraft,
  name: string,
): MerchantReportDraft {
  const salesfloors = draft.salesfloors.filter(floor => floor !== name);

  if (salesfloors.length === draft.salesfloors.length) {
    return draft;
  }

  return {
    ...draft,
    salesfloors,
    cells:
      salesfloors.length === 0
        ? moveCells(draft.cells, name, NO_SALESFLOOR)
        : Object.fromEntries(
            Object.entries(draft.cells).filter(
              ([key]) => splitCellKey(key).salesfloor !== name,
            ),
          ),
  };
}

// ---------------------------------------------------------------- promoter

export function addPromoterProducts(
  draft: PromoterReportDraft,
  productIds: readonly string[],
): PromoterReportDraft {
  const known = new Set(draft.lines.map(line => line.productId));
  const added: PromoterLine[] = [];

  for (const productId of productIds) {
    if (!known.has(productId)) {
      known.add(productId);
      added.push({productId, initial: null, restocked: null, final: null});
    }
  }

  return added.length > 0
    ? {...draft, lines: [...draft.lines, ...added]}
    : draft;
}

export function updatePromoterLine(
  draft: PromoterReportDraft,
  productId: string,
  patch: Partial<Omit<PromoterLine, 'productId'>>,
): PromoterReportDraft {
  return {
    ...draft,
    lines: draft.lines.map(line =>
      line.productId === productId ? {...line, ...patch} : line,
    ),
  };
}

export function removePromoterLine(
  draft: PromoterReportDraft,
  productId: string,
): PromoterReportDraft {
  return {
    ...draft,
    lines: draft.lines.filter(line => line.productId !== productId),
  };
}
