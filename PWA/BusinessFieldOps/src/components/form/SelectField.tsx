import 'mdui/components/select.js';
import 'mdui/components/menu-item.js';

import type {JSX} from 'preact';
import {useEffect, useLayoutEffect, useRef} from 'preact/hooks';

import {joinClasses} from '@/components/list/classNames';

import './FormFields.css';

/** The bits of `mdui-select` this component relies on. */
interface SelectElement extends HTMLElement {
  value: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

/** Props of {@link SelectField}. */
export interface SelectFieldProps {
  label: string;
  /** '' means nothing selected. */
  value: string;
  options: readonly SelectOption[];
  /** Called with the chosen value, or '' when cleared. */
  onChange: (_value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Shows a button that clears the selection (use it for filters). */
  clearable?: boolean;
  helper?: string;
  className?: string;
}

/** Combo box: pick one of a list of options. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  clearable = false,
  helper,
  className,
}: SelectFieldProps): JSX.Element {
  const selectRef = useRef<SelectElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // The select only shows the label of a value if the menu items already
  // exist when the value is set (otherwise it shows the raw value, e.g. an
  // id). So the element is re-created when the options change, and the value
  // is set from an effect, after its items are in the DOM.
  const optionsKey = options
    .map(option => `${option.value}\u0000${option.label}`)
    .join('\u0001');

  useLayoutEffect(() => {
    const select = selectRef.current;

    if (select) {
      select.value = value;
    }
  }, [value, optionsKey]);

  // Native listeners: custom element events are not reliably cased in JSX.
  useEffect(() => {
    const select = selectRef.current;

    if (!select) {
      return;
    }

    const handleChange = (event: Event) => {
      // Only this select's own change (not one bubbling from something else).
      if (event.target === select) {
        onChangeRef.current(String(select.value ?? ''));
      }
    };
    const handleClear = () => onChangeRef.current('');

    select.addEventListener('change', handleChange);
    select.addEventListener('clear', handleClear);

    return () => {
      select.removeEventListener('change', handleChange);
      select.removeEventListener('clear', handleClear);
    };
  }, [optionsKey]);

  return (
    <mdui-select
      key={optionsKey}
      ref={selectRef}
      class={joinClasses('form-field', className)}
      variant="outlined"
      label={label}
      helper={helper}
      required={required}
      disabled={disabled}
      clearable={clearable}
    >
      {options.map(option => (
        <mdui-menu-item key={option.value} value={option.value}>
          {option.label}
        </mdui-menu-item>
      ))}
    </mdui-select>
  );
}
