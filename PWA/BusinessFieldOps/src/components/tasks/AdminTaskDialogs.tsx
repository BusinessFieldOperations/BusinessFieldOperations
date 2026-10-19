import type {JSX} from 'preact';

import {NEW_ADMIN_TASK_KEY} from '@/lib/adminTasks';
import {useAuth} from '@/lib/AuthContext';
import {useDialogParam} from '@/lib/useDialogParam';

import {AdminTaskCreateDialog} from './AdminTaskCreateDialog';
import {AdminTaskDetailDialog} from './AdminTaskDetailDialog';

/**
 * Mount ONCE in the dashboard. Administrators open these dialogs through the
 * URL, from any tab:
 *
 * - `?adminTask=new`: the form for a new task.
 * - `?adminTask=<id>`: that task, with its reports and the complete button.
 *
 * (`?task=` is the dialog of merchants and promoters; see `TaskDialogs`.)
 */
export function AdminTaskDialogs(): JSX.Element | null {
  const {profile} = useAuth();
  const adminTask = useDialogParam('adminTask');

  if (profile?.role !== 'administrator' || adminTask.value === null) {
    return null;
  }

  // `key` gives every task a fresh dialog (and fresh form state).
  if (adminTask.value === NEW_ADMIN_TASK_KEY) {
    return (
      <AdminTaskCreateDialog key={adminTask.value} onClose={adminTask.close} />
    );
  }

  return (
    <AdminTaskDetailDialog
      key={adminTask.value}
      taskId={adminTask.value}
      onClose={adminTask.close}
    />
  );
}
