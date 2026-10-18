import './TaskDialog.css';

import 'mdui/components/button.js';
import 'mdui/components/icon.js';

import type {JSX} from 'preact';

import {FullScreenDialog} from '@/components/dialog';
import {ListContainer, ListItem} from '@/components/list';
import type {TaskListItem} from '@/lib/tasks';
import {OutboxItemActions} from '@/components/reports';
import {setDialogParams} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDateTime = (value: string | number) =>
  dateFormatter.format(new Date(value));

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
      title={task ? task.establishmentName : m.task()}
      closeLabel={m.close()}
      onClose={onClose}
    >
      {task === undefined ? (
        <p class="task-dialog__message">{m.task_loading()}</p>
      ) : null}
      {task === null ? (
        <p class="task-dialog__message" role="alert">
          {m.task_unavailable()}
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
          {m.report_add()}
        </mdui-button>
      </section>

      {task.drafts.length > 0 ? (
        <section>
          <h3 class="task-dialog__heading">{m.drafts()}</h3>
          <ListContainer listLabel={m.drafts()}>
            {task.drafts.map(draft => (
              <ListItem
                key={draft.id}
                icon={<mdui-icon name="edit_note" />}
                headline={m.draft()}
                details={[
                  m.draft_edited({date: formatDateTime(draft.updatedAt)}),
                ]}
                itemAction={() => onOpenDraft(draft.id)}
              />
            ))}
          </ListContainer>
        </section>
      ) : null}

      <section>
        <h3 class="task-dialog__heading">{m.reports()}</h3>
        {task.reports.length === 0 ? (
          <p class="task-dialog__message">{m.reports_none()}</p>
        ) : (
          <ListContainer listLabel={m.reports()}>
            {task.reports.map(report => {
              return (
                <ListItem
                  key={report.key}
                  itemAction={() => setDialogParams({view: report.viewKey})}
                  icon={<mdui-icon name="assignment" />}
                  headline={report.clientName || m.report_title()}
                  details={[
                    [report.salesmanName, report.zone]
                      .filter(Boolean)
                      .join(' · '),
                    report.errorMessage ?? formatDateTime(report.capturedAt),
                  ]}
                  actions={
                    report.outboxId && report.status !== 'sent' ? (
                      <OutboxItemActions
                        outboxId={report.outboxId}
                        status={report.status}
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
