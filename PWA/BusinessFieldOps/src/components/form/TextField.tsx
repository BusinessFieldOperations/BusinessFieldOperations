import 'mdui/components/text-field.js';

import type {JSX} from 'preact';

import {joinClasses} from '@/components/list/classNames';

import './FormFields.css';

/** Props of {@link TextField}. */
export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (_value: string) => void;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  /** More than one row makes it a multi-line field. */
  rows?: number;
  maxLength?: number;
  autocomplete?: string;
  /** Called on Enter (which then does not submit the surrounding form). */
  onEnter?: () => void;
  className?: string;
}

/** Single or multi-line text input. */
export function TextField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  helper,
  rows,
  maxLength,
  autocomplete,
  onEnter,
  className,
}: TextFieldProps): JSX.Element {
  return (
    <mdui-text-field
      class={joinClasses('form-field', className)}
      variant="outlined"
      label={label}
      helper={helper}
      required={required}
      disabled={disabled}
      rows={rows}
      maxlength={maxLength}
      autocomplete={autocomplete}
      value={value}
      onInput={e => onChange((e.currentTarget as HTMLInputElement).value)}
      onKeyDown={e => {
        if (onEnter && e.key === 'Enter') {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}
