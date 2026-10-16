import type {JSX} from 'preact';

import {useAuth} from '@/lib/AuthContext';
import {reportKindForRole} from '@/lib/reportKinds';
import {useAvailableTasks, type TaskListItem} from '@/lib/tasks';
import {setDialogParams, useDialogParam} from '@/lib/useDialogParam';
import {ReportDialog} from '@/components/reports';

import {TaskDialog} from './TaskDialog';
import {TaskPickerDialog} from './TaskPickerDialog';

/**
 * Mount ONCE in the dashboard. Any tab opens these dialogs through the URL:
 *
 * - `?pickTask=1`: list of open tasks (Reports tab, Home "view all").
 * - `?task=<id>`: the task dialog.
 * - `?report=<draftId>`: opened from the task dialog; the report dialog
 *   (next phase) reads it.
 */
export function TaskDialogs(): JSX.Element | null {
  const {profile} = useAuth();
  const tasks = useAvailableTasks(profile?.id, profile?.role);
  const pickTask = useDialogParam('pickTask');
  const task = useDialogParam('task');
  const report = useDialogParam('report');

  if (!profile || !reportKindForRole(profile.role)) {
    return null;
  }

  const selectedTask =
    task.value === null || tasks === undefined
      ? undefined
      : (tasks.find(item => item.id === task.value) ?? null);

  // Replace, so Back from the task returns to the tab and not to the picker.
  const handlePick = (picked: TaskListItem) =>
    setDialogParams({pickTask: null, task: picked.id}, {replace: true});

  // Every new report starts as a new draft: a task can have several.
  const handleAddReport = () => setDialogParams({report: crypto.randomUUID()});

  const handleOpenDraft = (draftId: string) =>
    setDialogParams({report: draftId});

  return (
    <>
      <TaskPickerDialog
        open={pickTask.isOpen}
        tasks={tasks}
        onClose={pickTask.close}
        onPick={handlePick}
      />
      <TaskDialog
        open={task.isOpen}
        task={selectedTask}
        onClose={task.close}
        onAddReport={handleAddReport}
        onOpenDraft={handleOpenDraft}
      />
      <ReportDialog
        draftId={report.value}
        taskId={task.value}
        task={task.value === null ? null : selectedTask}
        onClose={report.close}
      />
    </>
  );
}
