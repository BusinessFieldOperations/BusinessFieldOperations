import {getClientNames} from '@/lib/clients';
import {db} from '@/lib/offline/db';
import {describeDeliveryError} from '@/lib/offline/deliveryErrors';
import {useLiveQuery} from '@/lib/offline/useLiveQuery';
import type {UserRole} from '@/lib/profiles';
import type {ReportKind, ReportStatus} from '@/lib/reports';

// ------------------------------------------------------------------ keys

/**
 * `?view=<key>` identifies the report to show:
 * `merchant-12` / `promoter-7` (server id) or `outbox-<uuid>` (not sent yet).
 */
export type ReportViewSource =
  | {source: 'outbox'; id: string}
  | {source: 'sent'; kind: ReportKind; id: number};

export const sentReportViewKey = (kind: ReportKind, id: number) =>
  `${kind}-${id}`;

export const outboxReportViewKey = (id: string) => `outbox-${id}`;

export function parseReportViewKey(key: string): ReportViewSource | null {
  if (key.startsWith('outbox-') && key.length > 'outbox-'.length) {
    return {source: 'outbox', id: key.slice('outbox-'.length)};
  }

  const match = /^(merchant|promoter)-(\d+)$/.exec(key);

  return match
    ? {source: 'sent', kind: match[1] as ReportKind, id: Number(match[2])}
    : null;
}

// ----------------------------------------------------------------- model

export interface ReportViewProduct {
  productId: string;
  name: string;
  /** "500 ml · SKU 123 · Brand": what tells similar products apart. */
  meta: string;
}

export interface MerchantViewLine {
  /** `null` for counts that do not belong to a salesfloor. */
  salesfloor: string | null;
  good: number;
  damaged: number;
  expired: number;
  total: number;
}

export interface MerchantViewProduct extends ReportViewProduct {
  lines: MerchantViewLine[];
}

export interface PromoterViewProduct extends ReportViewProduct {
  initial: number;
  restocked: number;
  final: number;
  sales: number;
}

export interface ReportViewReporter {
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface ReportViewLocation {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

/** What only an administrator may see. */
export interface ReportViewAdminInfo {
  /** `null` if the profile is not in the local copy. */
  reporter: ReportViewReporter | null;
  /** `null` if the report was sent without a position. */
  location: ReportViewLocation | null;
}

/** A report ready to display, wherever it currently lives. */
export interface ReportView {
  kind: ReportKind;
  status: ReportStatus;
  /** Why a `failed` report was refused, in words. */
  errorMessage: string | null;
  establishmentName: string;
  place: string;
  taskDescription: string | null;
  clientName: string;
  salesmanName: string;
  zone: string;
  /** ISO-8601 time the report was captured on the device. */
  capturedAt: string;
  /** When the server got it; `null` while it is still on this device. */
  submittedAt: string | null;
  observations: string | null;
  noInventory: boolean;
  salesfloors: string[];
  merchantProducts: MerchantViewProduct[];
  promoterProducts: PromoterViewProduct[];
  /**
   * Position and sender. `null` for everybody but administrators: the
   * coordinates are never put in the model of a merchant or a promoter.
   */
  admin: ReportViewAdminInfo | null;
}

// --------------------------------------------------------------- helpers

interface Viewer {
  id: string;
  role: UserRole;
}

const isAdmin = (viewer: Viewer) => viewer.role === 'administrator';

/** Administrators see every report; the others only their own. */
const canSee = (viewer: Viewer, ownerId: string) =>
  isAdmin(viewer) || ownerId === viewer.id;

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null,
      )
    : [];

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

async function describePlace(
  establishmentId: string,
): Promise<{establishmentName: string; place: string}> {
  const establishment = await db
    .reference('establishment')
    .get(establishmentId);

  if (!establishment) {
    return {establishmentName: '—', place: ''};
  }

  const [identity, state] = await Promise.all([
    db.reference('legal_identity').get(establishment.legal_identity_id),
    db.reference('states').get(establishment.state_id),
  ]);

  return {
    establishmentName:
      [identity?.name, establishment.branch_name].filter(Boolean).join(' - ') ||
      '—',
    place: [establishment.location, state?.name].filter(Boolean).join(' · '),
  };
}

async function loadContext(
  taskId: string,
  establishmentId: string,
  clientId: string | null,
) {
  const [place, task, clientNames] = await Promise.all([
    describePlace(establishmentId),
    db.reference('tasks').get(taskId),
    getClientNames(),
  ]);

  return {
    ...place,
    taskDescription: task?.description ?? null,
    clientName: clientId ? (clientNames.get(clientId) ?? '') : '',
  };
}

async function describeProducts(
  productIds: readonly string[],
): Promise<Map<string, ReportViewProduct>> {
  const products = await db
    .reference('products')
    .bulkGet([...new Set(productIds)]);
  const result = new Map<string, ReportViewProduct>();

  for (const product of products) {
    if (product) {
      result.set(product.id, {
        productId: product.id,
        name: product.name,
        meta: [
          product.display_quantity,
          product.sku ? `SKU ${product.sku}` : null,
          product.brand,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  return result;
}

const unknownProduct = (productId: string): ReportViewProduct => ({
  productId,
  name: 'Unknown product',
  meta: '',
});

async function getReporter(
  profileId: string,
): Promise<ReportViewReporter | null> {
  const profile = await db.reference('profiles').get(profileId);

  return profile
    ? {
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        role: profile.role,
        isActive: profile.is_active,
      }
    : null;
}

const toLocation = (row: {
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
}): ReportViewLocation | null =>
  row.latitude !== null && row.longitude !== null
    ? {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyM: row.location_accuracy_m,
      }
    : null;

interface MerchantRow {
  productId: string;
  salesfloor: string | null;
  good: number;
  damaged: number;
  expired: number;
}

function groupMerchantLines(
  rows: readonly MerchantRow[],
  products: Map<string, ReportViewProduct>,
): MerchantViewProduct[] {
  const byProduct = new Map<string, MerchantViewProduct>();

  for (const row of rows) {
    let entry = byProduct.get(row.productId);

    if (!entry) {
      entry = {
        ...(products.get(row.productId) ?? unknownProduct(row.productId)),
        lines: [],
      };
      byProduct.set(row.productId, entry);
    }

    entry.lines.push({
      salesfloor: row.salesfloor,
      good: row.good,
      damaged: row.damaged,
      expired: row.expired,
      total: row.good + row.damaged + row.expired,
    });
  }

  return [...byProduct.values()].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

interface PromoterRow {
  productId: string;
  initial: number;
  restocked: number;
  final: number;
}

function toPromoterProducts(
  rows: readonly PromoterRow[],
  products: Map<string, ReportViewProduct>,
): PromoterViewProduct[] {
  return rows
    .map(row => ({
      ...(products.get(row.productId) ?? unknownProduct(row.productId)),
      initial: row.initial,
      restocked: row.restocked,
      final: row.final,
      sales: row.initial + row.restocked - row.final,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
}

// ---------------------------------------------------------------- loaders

async function loadSentMerchant(
  id: number,
  viewer: Viewer,
): Promise<ReportView | null> {
  const report = await db.reference('merchant_reports').get(id);

  if (!report || !canSee(viewer, report.merchant_id)) {
    return null;
  }

  const [floorRows, inventoryRows, context] = await Promise.all([
    db
      .reference('merchant_report_salesfloors')
      .where('report_id')
      .equals(id)
      .toArray(),
    db
      .reference('merchant_report_inventory')
      .where('report_id')
      .equals(id)
      .toArray(),
    loadContext(report.task_id, report.establishment_id, report.client_id),
  ]);
  const floorNames = new Map(floorRows.map(floor => [floor.id, floor.name]));
  const products = await describeProducts(
    inventoryRows.map(row => row.product_id),
  );

  return {
    kind: 'merchant',
    status: 'sent',
    errorMessage: null,
    ...context,
    salesmanName: report.salesman_name,
    zone: report.zone,
    capturedAt: report.captured_at,
    submittedAt: report.submitted_at,
    observations: report.observations,
    noInventory: report.no_inventory,
    salesfloors: floorRows.map(floor => floor.name),
    merchantProducts: groupMerchantLines(
      inventoryRows.map(row => ({
        productId: row.product_id,
        salesfloor:
          row.salesfloor_id === null
            ? null
            : (floorNames.get(row.salesfloor_id) ?? null),
        good: row.good_units,
        damaged: row.damaged_units,
        expired: row.expired_units,
      })),
      products,
    ),
    promoterProducts: [],
    admin: isAdmin(viewer)
      ? {
          reporter: await getReporter(report.merchant_id),
          location: toLocation(report),
        }
      : null,
  };
}

async function loadSentPromoter(
  id: number,
  viewer: Viewer,
): Promise<ReportView | null> {
  const report = await db.reference('promoter_reports').get(id);

  if (!report || !canSee(viewer, report.promoter_id)) {
    return null;
  }

  const [detailRows, context] = await Promise.all([
    db
      .reference('promoter_report_details')
      .where('report_id')
      .equals(id)
      .toArray(),
    loadContext(report.task_id, report.establishment_id, report.client_id),
  ]);
  const products = await describeProducts(
    detailRows.map(row => row.product_id),
  );

  return {
    kind: 'promoter',
    status: 'sent',
    errorMessage: null,
    ...context,
    salesmanName: report.salesman_name,
    zone: report.zone,
    capturedAt: report.captured_at,
    submittedAt: report.submitted_at,
    observations: null,
    noInventory: false,
    salesfloors: [],
    merchantProducts: [],
    promoterProducts: toPromoterProducts(
      detailRows.map(row => ({
        productId: row.product_id,
        initial: row.initial_inventory,
        restocked: row.restocked_units,
        final: row.final_inventory,
      })),
      products,
    ),
    admin: isAdmin(viewer)
      ? {
          reporter: await getReporter(report.promoter_id),
          location: toLocation(report),
        }
      : null,
  };
}

/** A report still on this device: shown from what will be sent. */
async function loadFromOutbox(
  id: string,
  viewer: Viewer,
): Promise<ReportView | null> {
  const item = await db.outbox.get(id);

  if (!item || item.ownerId !== viewer.id) {
    return null;
  }

  const payload = item.payload;
  const isMerchant = item.kind === 'merchant_report';

  if (!isMerchant && item.kind !== 'promoter_report') {
    return null;
  }

  const clientId = textOrNull(payload.client_id);
  const context = await loadContext(
    text(payload.task_id),
    text(payload.establishment_id),
    clientId,
  );
  const failed = item.status === 'failed';
  const base = {
    status: failed ? ('failed' as const) : ('queued' as const),
    errorMessage: failed ? describeDeliveryError(item.lastError) : null,
    ...context,
    salesmanName: text(payload.salesman_name),
    zone: text(payload.zone),
    capturedAt: item.capturedAt,
    submittedAt: null,
    // The position goes with the report, but only administrators see it, and
    // they never have an outbox.
    admin: null,
  };

  if (isMerchant) {
    const rows = records(payload.inventory);
    const products = await describeProducts(
      rows.map(row => text(row.product_id)),
    );

    return {
      kind: 'merchant',
      ...base,
      observations: textOrNull(payload.observations),
      noInventory: payload.no_inventory === true,
      salesfloors: strings(payload.salesfloors),
      merchantProducts: groupMerchantLines(
        rows.map(row => ({
          productId: text(row.product_id),
          salesfloor: textOrNull(row.salesfloor),
          good: num(row.good_units),
          damaged: num(row.damaged_units),
          expired: num(row.expired_units),
        })),
        products,
      ),
      promoterProducts: [],
    };
  }

  const rows = records(payload.details);
  const products = await describeProducts(
    rows.map(row => text(row.product_id)),
  );

  return {
    kind: 'promoter',
    ...base,
    observations: null,
    noInventory: false,
    salesfloors: [],
    merchantProducts: [],
    promoterProducts: toPromoterProducts(
      rows.map(row => ({
        productId: text(row.product_id),
        initial: num(row.initial_inventory),
        restocked: num(row.restocked_units),
        final: num(row.final_inventory),
      })),
      products,
    ),
  };
}

/**
 * Builds what the view dialog shows, from the local copy of the data so it
 * works offline. `null` if the report is not there (or is not the viewer's).
 */
export async function loadReportView(
  key: string,
  viewer: Viewer,
): Promise<ReportView | null> {
  const source = parseReportViewKey(key);

  if (!source) {
    return null;
  }

  if (source.source === 'outbox') {
    return loadFromOutbox(source.id, viewer);
  }

  return source.kind === 'merchant'
    ? loadSentMerchant(source.id, viewer)
    : loadSentPromoter(source.id, viewer);
}

/**
 * The report behind `?view=<key>`. `undefined` while loading, `null` if it is
 * not available. Follows the local data (a queued report turning into a sent
 * one, a profile being deactivated...).
 */
export function useReportView(
  key: string,
  viewerId: string,
  role: UserRole,
): ReportView | null | undefined {
  return useLiveQuery(
    () => loadReportView(key, {id: viewerId, role}),
    [key, viewerId, role],
  );
}
