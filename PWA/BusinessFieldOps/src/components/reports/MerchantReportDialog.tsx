import 'mdui/components/button.js';

import type {JSX} from 'preact';
import {useEffect, useMemo, useState} from 'preact/hooks';

import {
  DeletableChip,
  IntegerField,
  SwitchField,
  TextField,
} from '@/components/form';
import {useAuth} from '@/lib/AuthContext';
import {
  resolveClientId,
  useCatalog,
  useClientOptions,
  type CatalogProduct,
} from '@/lib/catalog';
import {warmUpGeolocation} from '@/lib/geolocation';
import {useDraft} from '@/lib/offline';
import {
  addMerchantProducts,
  addSalesfloor,
  EMPTY_MERCHANT_DRAFT,
  floorsOf,
  getCell,
  NO_SALESFLOOR,
  removeMerchantProduct,
  removeSalesfloor,
  setCell,
  type InventoryCell,
  type MerchantReportDraft,
} from '@/lib/reportDrafts';
import {
  buildMerchantPayload,
  validateMerchantReport,
} from '@/lib/reportPayloads';
import {useDialogParam} from '@/lib/useDialogParam';

import {ProductPickerDialog} from './ProductPickerDialog';
import {ReportFrame, type ReportDialogProps} from './ReportFrame';
import {ReportHeaderFields} from './ReportHeaderFields';
import {ReportLineCard} from './ReportLineCard';
import {useReportSubmit} from './useReportSubmit';

/** Good, damaged and expired units of one product on one floor. */
function CountRow({
  cell,
  onChange,
}: {
  cell: InventoryCell;
  onChange: (_patch: Partial<InventoryCell>) => void;
}): JSX.Element {
  return (
    <div class="report-form__row">
      <IntegerField
        label="Good"
        value={cell.good}
        onChange={good => onChange({good})}
      />
      <IntegerField
        label="Damaged"
        value={cell.damaged}
        onChange={damaged => onChange({damaged})}
      />
      <IntegerField
        label="Expired"
        value={cell.expired}
        onChange={expired => onChange({expired})}
      />
    </div>
  );
}

/** Merchant report: salesfloors, inventory counts per product and floor. */
export function MerchantReportDialog({
  draftId,
  taskId,
  task,
  onClose,
}: ReportDialogProps): JSX.Element {
  const {profile} = useAuth();
  const draft = useDraft<MerchantReportDraft>({
    kind: 'merchant_report',
    ownerId: profile?.id,
    refId: taskId ?? '',
    draftId,
    initialValue: EMPTY_MERCHANT_DRAFT,
  });
  const {value, setValue} = draft;
  const [floorInput, setFloorInput] = useState('');

  const clients = useClientOptions(task?.stateId ?? null);
  const clientId = resolveClientId(value.clientId, clients);
  const catalog = useCatalog(task?.establishmentId, clientId);
  const hasTask = Boolean(task);
  const pickProduct = useDialogParam('pickProduct');
  const resolved = {...value, clientId};

  // Ask for the location permission and wake the GPS early, so Send does not
  // wait for them. The position itself is read at Send.
  useEffect(() => {
    if (draft.ready && hasTask) {
      warmUpGeolocation();
    }
  }, [draft.ready, hasTask]);

  const productsById = useMemo(
    () =>
      new Map<string, CatalogProduct>(
        catalog?.map(product => [product.id, product]),
      ),
    [catalog],
  );

  const submit = useReportSubmit({
    kind: 'merchant_report',
    ownerId: profile?.id,
    draftId: draft.draftId,
    reset: draft.reset,
    onQueued: onClose,
    check: () =>
      task ? validateMerchantReport(resolved, task) : 'missing_state',
    build: location => {
      if (!task) {
        throw new Error('A report needs its task');
      }

      return buildMerchantPayload(resolved, {task, location});
    },
  });

  const handleDiscard = async () => {
    await draft.reset();
    onClose();
  };

  const handleAddFloor = () => {
    setValue(previous => addSalesfloor(previous, floorInput));
    setFloorInput('');
  };

  return (
    <>
      <ReportFrame
        task={task}
        ready={draft.ready}
        sending={submit.sending}
        error={submit.error}
        formRef={submit.formRef}
        onSend={submit.send}
        onClose={onClose}
        onDiscard={handleDiscard}
      >
        {task ? (
          <>
            <ReportHeaderFields
              task={task}
              salesmanName={value.salesmanName}
              zone={value.zone}
              clientId={clientId}
              clients={clients}
              clientLocked={value.productIds.length > 0}
              onChange={patch =>
                setValue(previous => ({...previous, ...patch}))
              }
            />

            <section class="report-form__section">
              <h3 class="report-form__heading">Salesfloors (optional)</h3>
              {value.salesfloors.length > 0 ? (
                <div class="report-form__chips">
                  {value.salesfloors.map(floor => (
                    <DeletableChip
                      key={floor}
                      label={floor}
                      onDelete={() =>
                        setValue(previous => removeSalesfloor(previous, floor))
                      }
                    />
                  ))}
                </div>
              ) : null}
              <div class="report-form__add">
                <TextField
                  label="Add salesfloor"
                  value={floorInput}
                  onChange={setFloorInput}
                  onEnter={handleAddFloor}
                />
                <mdui-button variant="tonal" onClick={handleAddFloor}>
                  Add
                </mdui-button>
              </div>
            </section>

            <SwitchField
              label="No inventory"
              checked={value.noInventory}
              onChange={noInventory =>
                setValue(previous => ({...previous, noInventory}))
              }
            />

            {value.noInventory ? null : (
              <section class="report-form__section">
                <h3 class="report-form__heading">Inventory</h3>
                {value.productIds.map(productId => (
                  <ReportLineCard
                    key={productId}
                    product={productsById.get(productId)}
                    onRemove={() =>
                      setValue(previous =>
                        removeMerchantProduct(previous, productId),
                      )
                    }
                  >
                    {floorsOf(value).map(floor => (
                      <div key={floor} class="report-line__floor-block">
                        {floor === NO_SALESFLOOR ? null : (
                          <p class="report-line__floor">{floor}</p>
                        )}
                        <CountRow
                          cell={getCell(value, productId, floor)}
                          onChange={patch =>
                            setValue(previous =>
                              setCell(previous, productId, floor, patch),
                            )
                          }
                        />
                      </div>
                    ))}
                  </ReportLineCard>
                ))}
                <mdui-button
                  variant="outlined"
                  icon="add"
                  disabled={clientId === null}
                  onClick={() => pickProduct.open('1')}
                >
                  Add products
                </mdui-button>
              </section>
            )}

            <TextField
              label="Observations"
              value={value.observations}
              rows={3}
              onChange={observations =>
                setValue(previous => ({...previous, observations}))
              }
            />
          </>
        ) : null}
      </ReportFrame>

      <ProductPickerDialog
        open={pickProduct.isOpen}
        catalog={catalog}
        excludeIds={value.productIds}
        onClose={pickProduct.close}
        onConfirm={ids => {
          // Keep the implied client: the product list now depends on it.
          setValue(previous => ({
            ...addMerchantProducts(previous, ids),
            clientId: previous.clientId ?? clientId,
          }));
          pickProduct.close();
        }}
      />
    </>
  );
}
