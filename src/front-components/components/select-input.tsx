import { useId } from 'react';

import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { readEventValue } from 'src/front-components/utils/read-event-value.util';

type SelectInputProps = {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange: (value: string) => void;
  // Shown first with an empty value when nothing is selected.
  placeholder?: string;
  disabled?: boolean;
};

// A native select: popover selects need a portal, which the sandbox cannot render.
export const SelectInput = ({ label, value, options, onChange, placeholder, disabled }: SelectInputProps) => {
  const id = useId();

  return (
    <div style={FIELD_STYLES.field}>
      <label htmlFor={id} style={FIELD_STYLES.label}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        style={FIELD_STYLES.control}
        onChange={(event) => onChange(readEventValue(event))}
      >
        {placeholder === undefined ? null : <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
