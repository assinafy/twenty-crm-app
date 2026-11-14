import { useId } from 'react';

import { FIELD_STYLES } from 'src/front-components/components/field-styles';

type CheckboxInputProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  hint?: string;
};

// Toggles from the controlled value: the sandbox does not reliably serialize `checked` on change events.
export const CheckboxInput = ({ label, checked, onToggle, disabled, hint }: CheckboxInputProps) => {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div style={{ ...FIELD_STYLES.field, ...(disabled ? FIELD_STYLES.disabled : {}) }}>
      <div style={FIELD_STYLES.checkboxRow}>
        <input
          id={id}
          type="checkbox"
          style={FIELD_STYLES.checkbox}
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={onToggle}
        />
        <label htmlFor={id} style={FIELD_STYLES.checkboxLabel}>
          {label}
        </label>
      </div>
      {hint ? (
        <span id={hintId} style={FIELD_STYLES.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
};
