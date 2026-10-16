import 'mdui/components/switch.js';

import type {JSX} from 'preact';

import {joinClasses} from '@/components/list/classNames';

import './FormFields.css';

/** Props of {@link SwitchField}. */
export interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (_checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** A labelled on/off switch. */
export function SwitchField({
  label,
  checked,
  onChange,
  disabled = false,
  className,
}: SwitchFieldProps): JSX.Element {
  return (
    <label class={joinClasses('switch-field', className)}>
      <span>{label}</span>
      <mdui-switch
        checked={checked}
        disabled={disabled}
        onChange={e => onChange((e.currentTarget as HTMLInputElement).checked)}
      />
    </label>
  );
}
