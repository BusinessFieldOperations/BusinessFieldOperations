import './AdminTaskDialog.css';

import 'mdui/components/button.js';
import 'mdui/components/icon.js';

import type {JSX} from 'preact';
import {useState} from 'preact/hooks';

import {DetailField, DetailGrid, DetailSection} from '@/components/detail';
import {FullScreenDialog} from '@/components/dialog';
import {ListContainer, ListItem} from '@/components/list';
import {useAdminTaskDetail, type AdminTaskDetail} from '@/lib/adminTasks';
import type {UserRole} from '@/lib/profiles';
import {
  setTaskCompleted,
  TaskNeedsConnectionError,
  TaskNotFoundError,
} from '@/lib/taskActions';
import {setDialogParams} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

import {TaskStateBadge} from './TaskStateBadge';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDateTime = (value: string | number) =>
  dateFormatter.format(new Date(value));

const ROLE_LABELS: Record<UserRole, () => string> = {
  merchant: () => m.merchant(),
  promoter: () => m.promoter(),
  administrator: () => m.administrator(),
};

function describeFailure(cause: unknown): string {
  if (cause instanceof TaskNeedsConnectionError) {
    return m.task_error_connection();
  }

  if (cause instanceof TaskNotFoundError) {
    return m.task_error_not_found();
  }

  return m.task_error_save();
}

/** Props of {@link TaskCompletion}. */
interface TaskCompletionProps {
  /** Whether the task is completed now (the button then reopens it). */
  completed: boolean;
  busy: boolean;
  onConfirm: () => void;
}

/** Complete / reopen button. Asks twice, inline, without another layer. */
function TaskCompletion({
  completed,
  busy,
  onConfirm,
}: TaskCompletionProps): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div class="admin-task-detail__action">
        <mdui-button
          variant="tonal"
          icon={completed ? 'undo' : 'task_alt'}
          onClick={() => setConfirming(true)}
        >
          {completed ? m.task_reopen() : m.task_mark_completed()}
        </mdui-button>
      </div>
    );
  }

  return (
    <div class="admin-task-detail__action">
      <span>
        {completed ? m.task_reopen_question() : m.task_complete_question()}
      </span>
      <mdui-button
        variant="text"
        disabled={busy}
        onClick={() => setConfirming(false)}
      >
        {m.cancel()}
      </mdui-button>
      <mdui-button
        variant="text"
        loading={busy}
        disabled={busy}
        onClick={onConfirm}
      >
        {m.confirm()}
      </mdui-button>
      {completed ? null : (
        <p class="admin-task-detail__warning">{m.task_complete_warning()}</p>
      )}
    </div>
  );
}

/** Props of {@link AdminTaskDetailDialog}. */
export interface AdminTaskDetailDialogProps {
  taskId: string;
  onClose: () => void;
}

/**
 * One task for the administrator (`?adminTask=<id>`): who has it, where, its
 * state and reports, and the button to complete or reopen it. Reports open in
 * the report view (`?view=`). Completing needs a connection.
 */
export function AdminTaskDetailDialog({
  taskId,
  onClose,
}: AdminTaskDetailDialogProps): JSX.Element {
  const task = useAdminTaskDetail(taskId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (current: AdminTaskDetail) => {
    if (busy) {
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await setTaskCompleted(current.id, current.completedAt === null);
    } catch (cause) {
      console.error('Failed to change the task', cause);
      setError(describeFailure(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FullScreenDialog
      open
      title={task ? task.establishmentName : m.task()}
      closeLabel={m.close()}
      onClose={onClose}
    >
      {task === undefined ? (
        <p class="admin-task-detail__message">{m.task_loading()}</p>
      ) : null}
      {task === null ? (
        <p class="admin-task-detail__message" role="alert">
          {m.task_unavailable()}
        </p>
      ) : null}
      {task ? (
        <div class="admin-task-detail">
          <TaskInfo task={task} />

          {error ? (
            <p class="admin-task-detail__error" role="alert">
              {error}
            </p>
          ) : null}
          {/* The key resets the confirmation once the state has changed. */}
          <TaskCompletion
            key={task.completedAt === null ? 'open' : 'completed'}
            completed={task.completedAt !== null}
            busy={busy}
            onConfirm={() => void handleToggle(task)}
          />

          <TaskReports task={task} />
        </div>
      ) : null}
    </FullScreenDialog>
  );
}

function TaskInfo({task}: {task: AdminTaskDetail}): JSX.Element {
  const place = [task.location, task.stateName].filter(Boolean).join(' · ');
  const assignee = [
    task.assigneeName || m.unknown_employee(),
    task.assigneeRole ? ROLE_LABELS[task.assigneeRole]() : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DetailSection className="admin-task-detail__info" title={m.task()}>
      <TaskStateBadge state={task.state} />
      <DetailGrid>
        <DetailField label={m.establishment()}>
          {task.establishmentName}
        </DetailField>
        {place ? <DetailField label={m.place()}>{place}</DetailField> : null}
        <DetailField label={m.task_assigned_to()}>{assignee}</DetailField>
        <DetailField label={m.task_assigned_at()}>
          {formatDateTime(task.assignedAt)}
        </DetailField>
        {task.completedAt ? (
          <DetailField label={m.task_completed_at()}>
            {formatDateTime(task.completedAt)}
          </DetailField>
        ) : null}
      </DetailGrid>
      {task.description ? (
        <DetailField label={m.task_description()}>
          {task.description}
        </DetailField>
      ) : null}
    </DetailSection>
  );
}

function TaskReports({task}: {task: AdminTaskDetail}): JSX.Element {
  return (
    <section>
      <h3 class="admin-task-detail__heading">{m.reports()}</h3>
      {task.reports.length === 0 ? (
        <p class="admin-task-detail__message">{m.reports_none()}</p>
      ) : (
        <ListContainer listLabel={m.reports()}>
          {task.reports.map(report => (
            <ListItem
              key={report.viewKey}
              icon={<mdui-icon name="assignment" />}
              headline={report.clientName || m.report_title()}
              details={[
                [report.salesmanName, report.zone].filter(Boolean).join(' · '),
                formatDateTime(report.capturedAt),
              ]}
              itemAction={() => setDialogParams({view: report.viewKey})}
            />
          ))}
        </ListContainer>
      )}
    </section>
  );
}
