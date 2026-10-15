import './TaskDialog.css';

import 'mdui/components/button.js';
import 'mdui/components/icon.js';

import type {JSX} from 'preact';

import {FullScreenDialog} from '@/components/dialog';
import {ListContainer, ListItem} from '@/components/list';
import type {TaskListItem, TaskReportStatus} from '@/lib/tasks';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDateTime = (value: string | number) =>
  dateFormatter.format(new Date(value));

/** Sent reports need no marker; the others tell the user something. */
const STATUS_MARKERS: Record<
  TaskReportStatus,
  {icon: string; label: string} | null
> = {
  sent: null,
  queued: {icon: 'schedule', label: 'Waiting to be sent'},
  failed: {icon: 'error', label: 'Could not be sent'},
};

/** Props of {@link TaskDialog}. */
export interface TaskDialogProps {
  open: boolean;
  /** `undefined` while tasks load; `null` if it is not among the open tasks. */
  task: TaskListItem | null | undefined;
  onClose: () => void;
  onAddReport: () => void;
  onOpenDraft: (_draftId: string) => void;
}

/** One task: what to do, its drafts and reports, and "Add report". */
export function TaskDialog({
  open,
  task,
  onClose,
  onAddReport,
  onOpenDraft,
}: TaskDialogProps): JSX.Element {
  return (
    <FullScreenDialog
      open={open}
      title={task ? task.establishmentName : 'Task'}
      closeLabel="Close"
      onClose={onClose}
    >
      {task === undefined ? (
        <p class="task-dialog__message">Loading task...</p>
      ) : null}
      {task === null ? (
        <p class="task-dialog__message" role="alert">
          This task is not available anymore.
        </p>
      ) : null}
      {task ? (
        <TaskDetails
          task={task}
          onAddReport={onAddReport}
          onOpenDraft={onOpenDraft}
        />
      ) : null}
    </FullScreenDialog>
  );
}

function TaskDetails({
  task,
  onAddReport,
  onOpenDraft,
}: Pick<TaskDialogProps, 'onAddReport' | 'onOpenDraft'> & {
  task: TaskListItem;
}): JSX.Element {
  const place = [task.location, task.stateName].filter(Boolean).join(' · ');

  return (
    <div class="task-dialog">
      <section class="task-dialog__info">
        {task.description ? (
          <p class="task-dialog__description">{task.description}</p>
        ) : null}
        {place ? <p class="task-dialog__place">{place}</p> : null}
        <mdui-button icon="add" full-width onClick={onAddReport}>
          Add report
        </mdui-button>
      </section>

      {task.drafts.length > 0 ? (
        <section>
          <h3 class="task-dialog__heading">Drafts</h3>
          <ListContainer listLabel="Drafts">
            {task.drafts.map(draft => (
              <ListItem
                key={draft.id}
                icon={<mdui-icon name="edit_note" />}
                headline="Draft"
                details={[`Edited ${formatDateTime(draft.updatedAt)}`]}
                itemAction={() => onOpenDraft(draft.id)}
              />
            ))}
          </ListContainer>
        </section>
      ) : null}

      <section>
        <h3 class="task-dialog__heading">Reports</h3>
        {task.reports.length === 0 ? (
          <p class="task-dialog__message">No reports yet.</p>
        ) : (
          <ListContainer listLabel="Reports">
            {task.reports.map(report => {
              const marker = STATUS_MARKERS[report.status];

              return (
                <ListItem
                  key={report.key}
                  icon={<mdui-icon name="assignment" />}
                  headline={report.clientName || 'Report'}
                  details={[
                    [report.salesmanName, report.zone]
                      .filter(Boolean)
                      .join(' · '),
                    formatDateTime(report.capturedAt),
                  ]}
                  actions={
                    marker ? (
                      <mdui-icon
                        class={`task-dialog__status task-dialog__status--${report.status}`}
                        name={marker.icon}
                        title={marker.label}
                      />
                    ) : null
                  }
                />
              );
            })}
          </ListContainer>
        )}
      </section>
    </div>
  );
}
