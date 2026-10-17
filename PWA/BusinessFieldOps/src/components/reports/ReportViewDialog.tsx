import './ReportView.css';

import 'mdui/components/button.js';

import type {JSX} from 'preact';

import {
  DetailBadge,
  DetailField,
  DetailGrid,
  DetailSection,
  DetailStat,
  DetailStats,
  type DetailTone,
} from '@/components/detail';
import {FullScreenDialog} from '@/components/dialog';
import {useAuth} from '@/lib/AuthContext';
import {openExternal} from '@/lib/openExternal';
import type {UserRole} from '@/lib/profiles';
import type {ReportStatus} from '@/lib/reports';
import {
  useReportView,
  type MerchantViewProduct,
  type PromoterViewProduct,
  type ReportView,
  type ReportViewAdminInfo,
  type ReportViewLocation,
  type ReportViewProduct,
} from '@/lib/reportView';
import {useDialogParam} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDateTime = (value: string) => dateFormatter.format(new Date(value));

const STATUS_LABELS: Record<ReportStatus, string> = {
  sent: 'Sent',
  queued: 'Waiting to be sent',
  failed: 'Could not be sent',
};

const STATUS_TONES: Record<ReportStatus, DetailTone> = {
  sent: 'ok',
  queued: 'neutral',
  failed: 'error',
};

const mapsUrl = ({latitude, longitude}: ReportViewLocation) =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;

const ROLE_LABELS: Record<UserRole, () => string> = {
  merchant: () => m.merchant(),
  promoter: () => m.promoter(),
  administrator: () => m.administrator(),
};

/**
 * Read-only view of a report: sent, waiting to be sent or failed. Mounted
 * once in the dashboard; any list opens it with `?view=<key>`
 * (see `reportView.ts` for the keys).
 *
 * Administrators also see the position and who sent the report.
 */
export function ReportViewDialog(): JSX.Element | null {
  const {profile} = useAuth();
  const view = useDialogParam('view');

  if (!profile || view.value === null) {
    return null;
  }

  // Mounted only while `?view=` is in the URL: `key` gives each report a
  // fresh dialog.
  return (
    <ReportViewContent
      key={view.value}
      viewKey={view.value}
      viewerId={profile.id}
      role={profile.role}
      onClose={view.close}
    />
  );
}

function ReportViewContent({
  viewKey,
  viewerId,
  role,
  onClose,
}: {
  viewKey: string;
  viewerId: string;
  role: UserRole;
  onClose: () => void;
}): JSX.Element {
  const report = useReportView(viewKey, viewerId, role);

  return (
    <FullScreenDialog
      open
      title={report ? `Report · ${report.establishmentName}` : 'Report'}
      closeLabel="Close"
      onClose={onClose}
    >
      {report === undefined ? (
        <p class="report-view__message">Loading report...</p>
      ) : null}
      {report === null ? (
        <p class="report-view__message" role="alert">
          This report is not available. If it was just sent, open it again from
          the list.
        </p>
      ) : null}
      {report ? <ReportViewBody report={report} /> : null}
    </FullScreenDialog>
  );
}

function ProductHeader({product}: {product: ReportViewProduct}): JSX.Element {
  return (
    <div class="report-view__product-header">
      <span class="report-view__product-name">{product.name}</span>
      {product.meta ? (
        <span class="report-view__product-meta">{product.meta}</span>
      ) : null}
    </div>
  );
}

function MerchantInventory({report}: {report: ReportView}): JSX.Element {
  let content: JSX.Element | JSX.Element[];

  if (report.noInventory) {
    content = <p class="report-view__muted">No inventory.</p>;
  } else if (report.merchantProducts.length === 0) {
    content = <p class="report-view__muted">No products were counted.</p>;
  } else {
    content = report.merchantProducts.map((product: MerchantViewProduct) => (
      <div key={product.productId} class="report-view__product">
        <ProductHeader product={product} />
        {product.lines.map(line => (
          <div key={line.salesfloor ?? ''} class="report-view__floor-block">
            {line.salesfloor === null ? null : (
              <p class="report-view__floor">{line.salesfloor}</p>
            )}
            <DetailStats>
              <DetailStat label="Good" value={line.good} />
              <DetailStat label="Damaged" value={line.damaged} />
              <DetailStat label="Expired" value={line.expired} />
              <DetailStat label="Total" value={line.total} />
            </DetailStats>
          </div>
        ))}
      </div>
    ));
  }

  return <DetailSection title="Inventory">{content}</DetailSection>;
}

function PromoterProducts({
  products,
}: {
  products: readonly PromoterViewProduct[];
}): JSX.Element {
  return (
    <DetailSection title="Products">
      {products.length === 0 ? (
        <p class="report-view__muted">No products.</p>
      ) : (
        products.map(product => (
          <div key={product.productId} class="report-view__product">
            <ProductHeader product={product} />
            <DetailStats>
              <DetailStat label="Initial" value={product.initial} />
              <DetailStat label="Restocked" value={product.restocked} />
              <DetailStat label="Final" value={product.final} />
              <DetailStat label="Sales" value={product.sales} />
            </DetailStats>
          </div>
        ))
      )}
    </DetailSection>
  );
}

/** Only rendered for administrators: sender and GPS position. */
function AdminInfo({info}: {info: ReportViewAdminInfo}): JSX.Element {
  const {reporter, location} = info;

  return (
    <>
      <DetailSection title="Sent by">
        <DetailGrid>
          <DetailField label="Employee">
            {reporter ? reporter.name : 'Unknown employee'}
          </DetailField>
          {reporter ? (
            <DetailField label="Role">
              {ROLE_LABELS[reporter.role]()}
            </DetailField>
          ) : null}
          {reporter ? (
            <DetailField label="Account">
              <DetailBadge tone={reporter.isActive ? 'ok' : 'error'}>
                {reporter.isActive ? m.active() : m.inactive()}
              </DetailBadge>
            </DetailField>
          ) : null}
        </DetailGrid>
      </DetailSection>

      <DetailSection title="GPS location">
        {location ? (
          <>
            <DetailGrid>
              <DetailField label="Latitude">
                {location.latitude.toFixed(6)}
              </DetailField>
              <DetailField label="Longitude">
                {location.longitude.toFixed(6)}
              </DetailField>
              {location.accuracyM === null ? null : (
                <DetailField label="Accuracy">
                  ±{Math.round(location.accuracyM)} m
                </DetailField>
              )}
            </DetailGrid>
            <mdui-button
              variant="tonal"
              icon="map"
              onClick={() => void openExternal(mapsUrl(location))}
            >
              Open in maps
            </mdui-button>
          </>
        ) : (
          <p class="report-view__muted">No location was recorded.</p>
        )}
      </DetailSection>
    </>
  );
}

function ReportViewBody({report}: {report: ReportView}): JSX.Element {
  return (
    <div class="report-view">
      <section class="report-view__status">
        <DetailBadge tone={STATUS_TONES[report.status]}>
          {STATUS_LABELS[report.status]}
        </DetailBadge>
        {report.errorMessage ? (
          <p class="report-view__error" role="alert">
            {report.errorMessage}
          </p>
        ) : null}
      </section>

      <DetailSection title="Visit">
        <DetailGrid>
          <DetailField label="Establishment">
            {report.establishmentName}
          </DetailField>
          {report.place ? (
            <DetailField label="Place">{report.place}</DetailField>
          ) : null}
          {report.clientName ? (
            <DetailField label="Client">{report.clientName}</DetailField>
          ) : null}
          <DetailField label="Salesman">{report.salesmanName}</DetailField>
          <DetailField label="Zone">{report.zone}</DetailField>
          <DetailField label="Captured">
            {formatDateTime(report.capturedAt)}
          </DetailField>
          {report.submittedAt ? (
            <DetailField label="Received">
              {formatDateTime(report.submittedAt)}
            </DetailField>
          ) : null}
        </DetailGrid>
        {report.taskDescription ? (
          <DetailField label="Task">{report.taskDescription}</DetailField>
        ) : null}
      </DetailSection>

      {report.admin ? <AdminInfo info={report.admin} /> : null}

      {report.kind === 'merchant' && report.salesfloors.length > 0 ? (
        <DetailSection title="Salesfloors">
          <div class="report-view__floors">
            {report.salesfloors.map(floor => (
              <DetailBadge key={floor}>{floor}</DetailBadge>
            ))}
          </div>
        </DetailSection>
      ) : null}

      {report.kind === 'merchant' ? (
        <MerchantInventory report={report} />
      ) : (
        <PromoterProducts products={report.promoterProducts} />
      )}

      {report.observations ? (
        <DetailSection title="Observations">
          <p class="report-view__text">{report.observations}</p>
        </DetailSection>
      ) : null}
    </div>
  );
}
