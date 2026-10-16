import './FullScreenDialog.css';

import 'mdui/components/button.js';
import 'mdui/components/button-icon.js';

import type {ComponentChildren, JSX} from 'preact';
import {useEffect, useId, useRef} from 'preact/hooks';

import {joinClasses} from '@/components/list/classNames';

/** Primary action shown in the header (Send, Save...). */
export interface FullScreenDialogAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Shows a spinner and blocks clicks (e.g. while saving). */
  loading?: boolean;
}

/** Props of {@link FullScreenDialog}. */
export interface FullScreenDialogProps {
  open: boolean;
  title: string;
  /** Accessible name of the close button (the caller translates it). */
  closeLabel: string;
  /**
   * The user asked to close (close button, Escape). The owner decides: set
   * `open` to false, or keep it open (e.g. to ask for confirmation).
   */
  onClose: () => void;
  action?: FullScreenDialogAction;
  className?: string;
  /** Rendered only while open, so state inside starts fresh every time. */
  children?: ComponentChildren;
}

/**
 * Material 3 full-screen dialog: full screen on compact windows, a centered
 * panel from 600px up. Built on the native `<dialog>`, which gives focus
 * trap, inert background, Escape handling and stacking (a dialog opened later
 * is drawn above) for free.
 *
 * Controlled: it never closes itself, it only calls `onClose`.
 */
export function FullScreenDialog({
  open,
  title,
  closeLabel,
  onClose,
  action,
  className,
  children,
}: FullScreenDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  openRef.current = open;
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Native listeners, like SearchBar: custom/native event casing in JSX is
  // not reliable.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    // mdui components inside (select menus, dropdowns...) emit their own
    // `close` and `cancel` events and those BUBBLE up to the dialog. Only
    // the dialog's own events (target is the dialog) are the user's request.

    // Escape: let the owner decide instead of closing behind its back.
    const handleCancel = (event: Event) => {
      if (event.target !== dialog) {
        return;
      }

      event.preventDefault();
      onCloseRef.current();
    };
    // Safety net: the browser may still close it (e.g. Escape pressed twice
    // quickly). A close caused by `open` turning false is ignored.
    const handleClose = (event: Event) => {
      if (event.target === dialog && openRef.current) {
        onCloseRef.current();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
    };
  }, []);

  // Unmounted while open (the owner stopped rendering it): close it properly
  // so the browser restores focus and releases the modal state.
  useEffect(() => {
    const dialog = dialogRef.current;

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      class={joinClasses('full-screen-dialog', className)}
      aria-labelledby={titleId}
    >
      {open ? (
        <>
          <header class="header">
            <mdui-button-icon
              icon="close"
              aria-label={closeLabel}
              onClick={() => onClose()}
            />
            <h2 id={titleId} class="title">
              {title}
            </h2>
            {action ? (
              <mdui-button
                variant="text"
                loading={action.loading}
                disabled={action.disabled || action.loading}
                onClick={() => action.onClick()}
              >
                {action.label}
              </mdui-button>
            ) : null}
          </header>
          <div class="body">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
