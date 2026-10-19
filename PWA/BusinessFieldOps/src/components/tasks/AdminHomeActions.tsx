import './AdminHomeActions.css';

import 'mdui/components/button.js';

import type {JSX} from 'preact';

import {useAuth} from '@/lib/AuthContext';
import {NEW_ADMIN_TASK_KEY} from '@/lib/adminTasks';
import {openDashboardTab} from '@/lib/dashboardNavigation';
import {useDialogParam} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

/**
 * Shortcuts of the administrator's Home: create a task, and open the report
 * list (a hidden tab, there is no button for it in the bar).
 */
export function AdminHomeActions(): JSX.Element | null {
  const {profile} = useAuth();
  const adminTask = useDialogParam('adminTask');

  if (profile?.role !== 'administrator') {
    return null;
  }

  return (
    <section class="admin-home-actions">
      <mdui-button
        icon="add_task"
        onClick={() => adminTask.open(NEW_ADMIN_TASK_KEY)}
      >
        {m.task_assign()}
      </mdui-button>
      <mdui-button
        variant="tonal"
        icon="analytics"
        onClick={() => openDashboardTab('reports')}
      >
        {m.task_see_reports()}
      </mdui-button>
    </section>
  );
}
