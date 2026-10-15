import 'mdui/components/text-field.js';

import type {JSX} from 'preact';

import {joinClasses} from '@/components/list/classNames';

import './IntegerField.css';

/** Props of {@link IntegerField}. */
export interface IntegerFieldProps {
  label: string;
  /** `null` is an empty field. */
  value: number | null;
  onChange: (_value: number | null) => void;
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  className?: string;
}

function parseInteger(text: string): number | null {
  if (text.trim() === '') {
    return null;
  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Whole-number input (units, inventory counts) with the numeric keyboard.
 *
 * It reports what was typed; range and "not a whole number" errors come from
 * native validation (`min`, `max`, `step`), so call `reportValidity()` on the
 * form before sending, as `Login` does.
 */
export function IntegerField({
  label,
  value,
  onChange,
  min = 0,
  max,
  required = false,
  disabled = false,
  helper,
  className,
}: IntegerFieldProps): JSX.Element {
  return (
    <mdui-text-field
      class={joinClasses('integer-field', className)}
      type="number"
      variant="outlined"
      inputmode="numeric"
      step={1}
      min={min}
      max={max}
      label={label}
      helper={helper}
      required={required}
      disabled={disabled}
      value={value === null ? '' : String(value)}
      onInput={e =>
        onChange(parseInteger((e.currentTarget as HTMLInputElement).value))
      }
    />
  );
}
