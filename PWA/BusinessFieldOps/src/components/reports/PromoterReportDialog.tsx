import 'mdui/components/button.js';

import type {JSX} from 'preact';
import {useEffect, useMemo} from 'preact/hooks';

import {IntegerField} from '@/components/form';
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
  addPromoterProducts,
  EMPTY_PROMOTER_DRAFT,
  removePromoterLine,
  updatePromoterLine,
  type PromoterLine,
  type PromoterReportDraft,
} from '@/lib/reportDrafts';
import {
  buildPromoterPayload,
  validatePromoterReport,
} from '@/lib/reportPayloads';
import {useDialogParam} from '@/lib/useDialogParam';

import {ProductPickerDialog} from './ProductPickerDialog';
import {ReportFrame, type ReportDialogProps} from './ReportFrame';
import {ReportHeaderFields} from './ReportHeaderFields';
import {ReportLineCard} from './ReportLineCard';
import {useReportSubmit} from './useReportSubmit';

type LinePatch = Partial<Omit<PromoterLine, 'productId'>>;

/** Initial, restocked and final units of a product, and the sales implied. */
function PromoterLineFields({
  line,
  onChange,
}: {
  line: PromoterLine;
  onChange: (_patch: LinePatch) => void;
}): JSX.Element {
  // Same rule as the table: final <= initial + restocked.
  const available =
    line.initial === null ? undefined : line.initial + (line.restocked ?? 0);
  const sales =
    available !== undefined && line.final !== null
      ? available - line.final
      : null;

  return (
    <>
      <div class="report-form__row">
        <IntegerField
          label="Initial"
          value={line.initial}
          required
          onChange={initial => onChange({initial})}
        />
        <IntegerField
          label="Restocked"
          value={line.restocked}
          onChange={restocked => onChange({restocked})}
        />
        <IntegerField
          label="Final"
          value={line.final}
          required
          max={available}
          onChange={final => onChange({final})}
        />
      </div>
      {sales !== null ? <p class="report-line__total">Sales: {sales}</p> : null}
    </>
  );
}

/** Promoter report: per product, what was there, restocked and left. */
export function PromoterReportDialog({
  draftId,
  taskId,
  task,
  onClose,
}: ReportDialogProps): JSX.Element {
  const {profile} = useAuth();
  const draft = useDraft<PromoterReportDraft>({
    kind: 'promoter_report',
    ownerId: profile?.id,
    refId: taskId ?? '',
    draftId,
    initialValue: EMPTY_PROMOTER_DRAFT,
  });
  const {value, setValue} = draft;

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
  const productIds = useMemo(
    () => value.lines.map(line => line.productId),
    [value.lines],
  );

  const submit = useReportSubmit({
    kind: 'promoter_report',
    ownerId: profile?.id,
    draftId: draft.draftId,
    reset: draft.reset,
    onQueued: onClose,
    check: () =>
      task ? validatePromoterReport(resolved, task) : 'missing_state',
    build: location => {
      if (!task) {
        throw new Error('A report needs its task');
      }

      return buildPromoterPayload(resolved, {task, location});
    },
  });

  const handleDiscard = async () => {
    await draft.reset();
    onClose();
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
              clientLocked={value.lines.length > 0}
              onChange={patch =>
                setValue(previous => ({...previous, ...patch}))
              }
            />

            <section class="report-form__section">
              <h3 class="report-form__heading">Products</h3>
              {value.lines.map(line => (
                <ReportLineCard
                  key={line.productId}
                  product={productsById.get(line.productId)}
                  onRemove={() =>
                    setValue(previous =>
                      removePromoterLine(previous, line.productId),
                    )
                  }
                >
                  <PromoterLineFields
                    line={line}
                    onChange={patch =>
                      setValue(previous =>
                        updatePromoterLine(previous, line.productId, patch),
                      )
                    }
                  />
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
          </>
        ) : null}
      </ReportFrame>

      <ProductPickerDialog
        open={pickProduct.isOpen}
        catalog={catalog}
        excludeIds={productIds}
        onClose={pickProduct.close}
        onConfirm={ids => {
          // Keep the implied client: the line list now depends on it.
          setValue(previous => ({
            ...addPromoterProducts(previous, ids),
            clientId: previous.clientId ?? clientId,
          }));
          pickProduct.close();
        }}
      />
    </>
  );
}
