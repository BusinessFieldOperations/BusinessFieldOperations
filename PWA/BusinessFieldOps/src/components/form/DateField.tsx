import 'mdui/components/text-field.js';

import type {JSX} from 'preact';
import {useEffect, useRef} from 'preact/hooks';

import {joinClasses} from '@/components/list/classNames';

import './FormFields.css';

/** The bits of `mdui-text-field` this component relies on. */
interface TextFieldElement extends HTMLElement {
  value: string;
}

/** Props of {@link DateField}. */
export interface DateFieldProps {
  label: string;
  /** `yyyy-mm-dd`, or '' when empty. */
  value: string;
  /** Called with `yyyy-mm-dd`, or '' when cleared. */
  onChange: (_value: string) => void;
  /** Earliest and latest day the native picker accepts (`yyyy-mm-dd`). */
  min?: string;
  max?: string;
  disabled?: boolean;
  helper?: string;
  className?: string;
}

/**
 * A day picker (the native one of the device) with a clear button. Dates are
 * plain `yyyy-mm-dd` text: no time zone is involved until the caller turns it
 * into a moment.
 */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  disabled = false,
  helper,
  className,
}: DateFieldProps): JSX.Element {
  const fieldRef = useRef<TextFieldElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Native listener: the clear button does not fire `input`, and custom
  // element events are not reliably cased in JSX.
  useEffect(() => {
    const field = fieldRef.current;

    if (!field) {
      return;
    }

    const handleClear = () => onChangeRef.current('');

    field.addEventListener('clear', handleClear);

    return () => field.removeEventListener('clear', handleClear);
  }, []);

  return (
    <mdui-text-field
      ref={fieldRef}
      class={joinClasses('form-field', className)}
      variant="outlined"
      type="date"
      clearable
      label={label}
      helper={helper}
      min={min}
      max={max}
      disabled={disabled}
      value={value}
      onInput={e => onChange((e.currentTarget as HTMLInputElement).value)}
    />
  );
}
