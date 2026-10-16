import 'mdui/components/chip.js';

import type {JSX} from 'preact';
import {useEffect, useRef} from 'preact/hooks';

/** Props of {@link DeletableChip}. */
export interface DeletableChipProps {
  label: string;
  onDelete: () => void;
}

/** A chip with a delete icon (tags, salesfloors...). */
export function DeletableChip({
  label,
  onDelete,
}: DeletableChipProps): JSX.Element {
  const chipRef = useRef<HTMLElement | null>(null);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  // Native listener: custom element events are not reliably cased in JSX.
  useEffect(() => {
    const chip = chipRef.current;

    if (!chip) {
      return;
    }

    const handleDelete = () => onDeleteRef.current();

    chip.addEventListener('delete', handleDelete);

    return () => chip.removeEventListener('delete', handleDelete);
  }, []);

  return (
    <mdui-chip ref={chipRef} deletable>
      {label}
    </mdui-chip>
  );
}
