import {
  cellKey,
  floorsOf,
  NO_SALESFLOOR,
  type InventoryCell,
  type MerchantReportDraft,
  type PromoterReportDraft,
  type ReportHeaderDraft,
} from '@/lib/reportDrafts';
import type {TaskListItem} from '@/lib/tasks';
import type {GeoFix} from '@/lib/geolocation';

/** What a report needs to know about the task it belongs to. */
export type ReportTask = Pick<
  TaskListItem,
  'id' | 'establishmentId' | 'stateId'
>;

/** The task plus the position read when the report is sent. */
export interface ReportContext {
  task: ReportTask;
  /** Read at Send and never changed afterwards. `null` if unavailable. */
  location: GeoFix | null;
}

/** Why a draft cannot be sent yet (the form shows a message for each). */
export type ReportProblem =
  | 'missing_salesman'
  | 'missing_zone'
  | 'missing_client'
  | 'missing_state'
  | 'missing_products'
  | 'missing_counts'
  | 'invalid_counts';

const isCount = (value: number) => Number.isInteger(value) && value >= 0;

function validateHeader(
  draft: ReportHeaderDraft,
  task: ReportTask,
): ReportProblem | null {
  if (draft.salesmanName.trim() === '') return 'missing_salesman';
  if (draft.zone.trim() === '') return 'missing_zone';
  if (draft.clientId === null) return 'missing_client';
  if (task.stateId === null) return 'missing_state';

  return null;
}

function hasValues(cell: InventoryCell | undefined): cell is InventoryCell {
  return (
    cell !== undefined &&
    (cell.good !== null || cell.damaged !== null || cell.expired !== null)
  );
}

export function validateMerchantReport(
  draft: MerchantReportDraft,
  task: ReportTask,
): ReportProblem | null {
  const problem = validateHeader(draft, task);

  if (problem || draft.noInventory) {
    return problem;
  }

  if (draft.productIds.length === 0) {
    return 'missing_products';
  }

  const floors = floorsOf(draft);

  for (const productId of draft.productIds) {
    const cells = floors.map(floor => draft.cells[cellKey(productId, floor)]);

    if (!cells.some(hasValues)) {
      return 'missing_counts';
    }

    for (const cell of cells.filter(hasValues)) {
      const values = [cell.good, cell.damaged, cell.expired];

      if (values.some(value => value !== null && !isCount(value))) {
        return 'invalid_counts';
      }
    }
  }

  return null;
}

export function validatePromoterReport(
  draft: PromoterReportDraft,
  task: ReportTask,
): ReportProblem | null {
  const problem = validateHeader(draft, task);

  if (problem) {
    return problem;
  }

  if (draft.lines.length === 0) {
    return 'missing_products';
  }

  for (const {initial, final, restocked} of draft.lines) {
    if (initial === null || final === null) {
      return 'missing_counts';
    }

    const added = restocked ?? 0;

    if (![initial, final, added].every(isCount) || final > initial + added) {
      return 'invalid_counts';
    }
  }

  return null;
}

/** Header fields both report kinds share. */
function buildHeader(
  draft: ReportHeaderDraft,
  {task, location}: ReportContext,
) {
  return {
    task_id: task.id,
    state_id: task.stateId,
    client_id: draft.clientId,
    salesman_name: draft.salesmanName.trim(),
    zone: draft.zone.trim(),
    establishment_id: task.establishmentId,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    location_accuracy_m: location?.accuracyM ?? null,
  };
}

/**
 * Payload of `submit_merchant_report` (see the SQL header for the shape).
 * `captured_at` is added by `enqueue`, at the first Send.
 */
export function buildMerchantPayload(
  draft: MerchantReportDraft,
  context: ReportContext,
): Record<string, unknown> {
  const inventory: Record<string, unknown>[] = [];

  if (!draft.noInventory) {
    for (const productId of draft.productIds) {
      for (const floor of floorsOf(draft)) {
        const cell = draft.cells[cellKey(productId, floor)];

        // Blank means "not counted": only rows the user filled are sent.
        if (hasValues(cell)) {
          inventory.push({
            product_id: productId,
            salesfloor: floor === NO_SALESFLOOR ? null : floor,
            good_units: cell.good ?? 0,
            damaged_units: cell.damaged ?? 0,
            expired_units: cell.expired ?? 0,
          });
        }
      }
    }
  }

  return {
    ...buildHeader(draft, context),
    observations: draft.observations.trim() || null,
    no_inventory: draft.noInventory,
    salesfloors: draft.salesfloors,
    inventory,
  };
}

/** Payload of `submit_promoter_report`. */
export function buildPromoterPayload(
  draft: PromoterReportDraft,
  context: ReportContext,
): Record<string, unknown> {
  return {
    ...buildHeader(draft, context),
    details: draft.lines.map(line => ({
      product_id: line.productId,
      initial_inventory: line.initial,
      final_inventory: line.final,
      restocked_units: line.restocked ?? 0,
    })),
  };
}
