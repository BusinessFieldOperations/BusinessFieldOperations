import 'mdui/components/text-field.js';

import type {JSX} from 'preact';
import {useEffect, useRef} from 'preact/hooks';

import './SearchBar.css';

/** The bits of `mdui-text-field` this component relies on. */
interface TextFieldElement extends HTMLElement {
  value: string;
}

/** Props of {@link SearchBar}. */
export interface SearchBarProps {
  /** Current text. */
  value: string;
  /** Called with the new text on every change, and with '' when cleared. */
  onChange: (_value: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
}

/**
 * Search input with a leading search icon and a clear button.
 *
 * It only reports text; debouncing and filtering belong to the caller (see
 * `useListSearch`). Takes focus when it appears.
 */
export function SearchBar({
  value,
  onChange,
  placeholder,
  label,
  autoFocus = true,
}: SearchBarProps): JSX.Element {
  const fieldRef = useRef<TextFieldElement | null>(null);

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  useEffect(() => {
    if (autoFocus) fieldRef.current?.focus();
  }, [autoFocus]);

  // Native listeners: custom element events are not reliably cased in JSX.
  useEffect(() => {
    const field = fieldRef.current;

    if (!field) {
      return;
    }

    const handleInput = () => onChange(field.value);
    const handleClear = () => onChange('');

    field.addEventListener('input', handleInput);
    field.addEventListener('clear', handleClear);

    return () => {
      field.removeEventListener('input', handleInput);
      field.removeEventListener('clear', handleClear);
    };
  }, [onChange]);

  return (
    <mdui-text-field
      ref={fieldRef}
      class="search-bar"
      variant="outlined"
      icon="search"
      clearable
      value={value}
      placeholder={placeholder}
      label={label}
    />
  );
}
