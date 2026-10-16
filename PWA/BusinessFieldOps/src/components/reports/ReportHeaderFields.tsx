import type {JSX} from 'preact';

import {SelectField, TextField} from '@/components/form';
import type {ClientOption} from '@/lib/catalog';
import type {ReportHeaderDraft} from '@/lib/reportDrafts';
import type {TaskListItem} from '@/lib/tasks';

/** Props of {@link ReportHeaderFields}. */
export interface ReportHeaderFieldsProps {
  task: TaskListItem;
  salesmanName: string;
  zone: string;
  /** The picked client, or the only one available. */
  clientId: string | null;
  /** `undefined` while loading. */
  clients: readonly ClientOption[] | undefined;
  /** The client cannot change while products of it are in the report. */
  clientLocked: boolean;
  onChange: (_patch: Partial<ReportHeaderDraft>) => void;
}

/**
 * Fields every report starts with: where (task, read-only), who (salesman,
 * zone) and for which client. The position is not here on purpose: it is
 * read when the report is sent.
 */
export function ReportHeaderFields({
  task,
  salesmanName,
  zone,
  clientId,
  clients,
  clientLocked,
  onChange,
}: ReportHeaderFieldsProps): JSX.Element {
  const place = [task.location, task.stateName].filter(Boolean).join(' · ');
  let clientHelper: string | undefined;

  if (clientLocked) {
    clientHelper = 'Remove the products to change the client.';
  } else if (clients?.length === 0) {
    clientHelper = 'No clients operate in this state.';
  }

  return (
    <section class="report-form__section">
      <div class="report-form__task">
        <p class="report-form__task-name">{task.establishmentName}</p>
        {place ? <p class="report-form__muted">{place}</p> : null}
        {task.description ? (
          <p class="report-form__muted">{task.description}</p>
        ) : null}
      </div>

      <TextField
        label="Salesman"
        value={salesmanName}
        required
        autocomplete="off"
        onChange={value => onChange({salesmanName: value})}
      />
      <TextField
        label="Zone"
        value={zone}
        required
        autocomplete="off"
        onChange={value => onChange({zone: value})}
      />
      <SelectField
        label="Client"
        value={clientId ?? ''}
        options={(clients ?? []).map(client => ({
          value: client.id,
          label: client.name,
        }))}
        required
        disabled={clientLocked || clients === undefined}
        helper={clientHelper}
        onChange={value => onChange({clientId: value || null})}
      />
    </section>
  );
}
