import './HomeTasks.css';

import 'mdui/components/button.js';

import type {JSX} from 'preact';

import {useAuth} from '@/lib/AuthContext';
import {reportKindForRole} from '@/lib/reportKinds';
import {useAvailableTasks} from '@/lib/tasks';
import {useDialogParam} from '@/lib/useDialogParam';
import {m} from '@/paraglide/messages.js';

import {TaskList} from './TaskList';

/** Tasks shown in Home; the rest are one tap away in the picker. */
const HOME_TASK_LIMIT = 5;

/** Short list of the user's open tasks for the Home tab. */
export function HomeTasks(): JSX.Element | null {
  const {profile} = useAuth();
  const tasks = useAvailableTasks(profile?.id, profile?.role);
  const task = useDialogParam('task');
  const pickTask = useDialogParam('pickTask');

  if (!profile || !reportKindForRole(profile.role)) {
    return null;
  }

  return (
    <section class="home-tasks">
      <div class="home-tasks__header">
        <h2 class="home-tasks__title">{m.my_tasks()}</h2>
        {tasks && tasks.length > HOME_TASK_LIMIT ? (
          <mdui-button variant="text" onClick={() => pickTask.open('1')}>
            {m.view_all_count({count: tasks.length})}
          </mdui-button>
        ) : null}
      </div>

      <TaskList
        tasks={tasks?.slice(0, HOME_TASK_LIMIT)}
        onSelect={selected => task.open(selected.id)}
        emptyLabel={m.tasks_none_assigned()}
      />
    </section>
  );
}
