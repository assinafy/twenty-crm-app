import { useId } from 'react';

import { FIELD_STYLES } from 'src/front-components/components/field-styles';
import { readEventValue } from 'src/front-components/utils/read-event-value.util';

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'date';
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  disabled?: boolean;
};

export const TextInput = ({ label, value, onChange, type = 'text', hint, multiline, ...rest }: TextInputProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const props = {
    id,
    value,
    style: FIELD_STYLES.control,
    'aria-describedby': hint ? hintId : undefined,
    onChange: (event: unknown) => onChange(readEventValue(event)),
    ...rest,
  };

  return (
    <div style={FIELD_STYLES.field}>
      <label htmlFor={id} style={FIELD_STYLES.label}>
        {label}
      </label>
      {multiline ? <textarea rows={3} {...props} /> : <input type={type} {...props} />}
      {hint ? (
        <span id={hintId} style={FIELD_STYLES.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
};
