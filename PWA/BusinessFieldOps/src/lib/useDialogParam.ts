import {useCallback, useMemo} from 'preact/hooks';
import {useSearch} from 'wouter-preact';

/** `history.state` key that remembers which dialog created a history entry. */
const OPENED_BY = 'openedByDialog';

/** True between a `history.back()` call and its `popstate`. */
let backPending = false;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    backPending = false;
  });
}

export interface SetDialogParamsOptions {
  /** Replace the current history entry instead of adding one. */
  replace?: boolean;
}

/**
 * Sets (string) or removes (null) query parameters in ONE history change.
 *
 * Opening a dialog pushes an entry, so the back button or gesture closes it.
 * To swap one dialog for another (picker -> task) use `replace` and change
 * both parameters in the same call.
 *
 * wouter patches `history.pushState` / `replaceState`, so components using
 * `useSearch` re-render after this.
 */
export function setDialogParams(
  changes: Record<string, string | null>,
  {replace = false}: SetDialogParamsOptions = {},
): void {
  const url = new URL(window.location.href);
  let opener: string | null = null;

  for (const [key, value] of Object.entries(changes)) {
    if (value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
      opener ??= key;
    }
  }

  const state = {...window.history.state, [OPENED_BY]: opener};
  const target = `${url.pathname}${url.search}${url.hash}`;

  if (replace) {
    window.history.replaceState(state, '', target);
  } else {
    window.history.pushState(state, '', target);
  }
}

/**
 * Closes the dialog of `key`. If its history entry was created by opening it,
 * the entry is popped (the entry survives reloads, so this also works after
 * one); otherwise (deep link) the parameter is just removed.
 */
export function closeDialogParam(key: string): void {
  if (new URL(window.location.href).searchParams.get(key) === null) {
    return;
  }

  if (window.history.state?.[OPENED_BY] === key) {
    // A double tap must not go back twice and leave the app.
    if (!backPending) {
      backPending = true;
      window.history.back();
    }
    return;
  }

  setDialogParams({[key]: null}, {replace: true});
}

/** Value returned by {@link useDialogParam}. */
export interface DialogParam {
  /** Value of the parameter, or null when the dialog is closed. */
  value: string | null;
  isOpen: boolean;
  open: (_value: string, _options?: SetDialogParamsOptions) => void;
  close: () => void;
}

/**
 * Dialog state kept in the URL (`?task=<id>`): the back button closes the
 * dialog, a reload reopens it and any component can open it.
 *
 * @example
 * const task = useDialogParam('task');
 * <FullScreenDialog open={task.isOpen} onClose={task.close} ... />
 */
export function useDialogParam(key: string): DialogParam {
  const search = useSearch();
  const value = useMemo(
    () => new URLSearchParams(search).get(key),
    [search, key],
  );

  const open = useCallback(
    (next: string, options?: SetDialogParamsOptions) =>
      setDialogParams({[key]: next}, options),
    [key],
  );
  const close = useCallback(() => closeDialogParam(key), [key]);

  return {value, isOpen: value !== null, open, close};
}
