import './AdminTaskIcon.css';

import 'mdui/components/icon.js';

import type {JSX} from 'preact';

import {joinClasses} from '@/components/list/classNames';
import type {AdminTaskState} from '@/lib/adminTasks';
import {m} from '@/paraglide/messages.js';

const STATE_ICONS: Record<AdminTaskState, string> = {
  new: 'fiber_new',
  reported: 'assignment_turned_in',
  completed: 'task_alt',
  open: 'assignment',
};

/** Props of {@link AdminTaskIcon}. */
export interface AdminTaskIconProps {
  state: AdminTaskState;
  /** Reports of the task; with at least one it is shown over the icon. */
  count: number;
}

/**
 * Icon of a task in the administrator's list. Icon and color follow the
 * state; the state is also written in a badge, so color is never the only cue.
 */
export function AdminTaskIcon({state, count}: AdminTaskIconProps): JSX.Element {
  return (
    <span class={joinClasses('admin-task-icon', `admin-task-icon--${state}`)}>
      <mdui-icon name={STATE_ICONS[state]} />
      {count > 0 ? (
        <span class="admin-task-icon__count" title={m.reports_count({count})}>
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </span>
  );
}
