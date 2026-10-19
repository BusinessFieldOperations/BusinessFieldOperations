import './TaskStateBadge.css';

import type {JSX} from 'preact';

import {DetailBadge, type DetailTone} from '@/components/detail';
import type {AdminTaskState} from '@/lib/adminTasks';
import {m} from '@/paraglide/messages.js';

const STATE_LABELS: Record<AdminTaskState, () => string> = {
  new: () => m.task_state_new(),
  reported: () => m.task_state_reported(),
  completed: () => m.task_state_completed(),
  open: () => m.task_state_open(),
};

const STATE_TONES: Record<AdminTaskState, DetailTone> = {
  new: 'info',
  reported: 'ok',
  completed: 'neutral',
  open: 'neutral',
};

/** Props of {@link TaskStateBadge}. */
export interface TaskStateBadgeProps {
  state: AdminTaskState;
}

/** "New", "Reported", "Completed" or "Open", as a badge. */
export function TaskStateBadge({state}: TaskStateBadgeProps): JSX.Element {
  return (
    <span class="task-state">
      <DetailBadge tone={STATE_TONES[state]}>
        {STATE_LABELS[state]()}
      </DetailBadge>
    </span>
  );
}
