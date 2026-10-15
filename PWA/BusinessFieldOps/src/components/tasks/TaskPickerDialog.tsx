import type {JSX} from 'preact';

import {FullScreenDialog} from '@/components/dialog';
import {SearchBar} from '@/components/search';
import {useLocalSearch} from '@/lib/useLocalSearch';
import type {TaskListItem} from '@/lib/tasks';

import {TaskList} from './TaskList';

const getTaskTexts = (task: TaskListItem) => [
  task.establishmentName,
  task.location,
  task.stateName,
  task.description,
];

/** Props of {@link TaskPickerDialog}. */
export interface TaskPickerDialogProps {
  open: boolean;
  /** `undefined` while loading. */
  tasks: readonly TaskListItem[] | undefined;
  onClose: () => void;
  onPick: (_task: TaskListItem) => void;
}

/** Full-screen list to choose one of the user's open tasks. */
export function TaskPickerDialog({
  open,
  tasks,
  onClose,
  onPick,
}: TaskPickerDialogProps): JSX.Element {
  return (
    <FullScreenDialog
      open={open}
      title="Select a task"
      closeLabel="Close"
      onClose={onClose}
    >
      <TaskPickerContent tasks={tasks} onPick={onPick} />
    </FullScreenDialog>
  );
}

// Separate component so the search text lives only while the dialog is open.
function TaskPickerContent({
  tasks,
  onPick,
}: Pick<TaskPickerDialogProps, 'tasks' | 'onPick'>): JSX.Element {
  const {query, setQuery, results} = useLocalSearch(tasks, getTaskTexts);

  return (
    <TaskList
      tasks={results}
      onSelect={onPick}
      emptyLabel={query ? 'No tasks match your search.' : 'No tasks available.'}
      toolbar={
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search tasks"
          autoFocus={false}
        />
      }
    />
  );
}
