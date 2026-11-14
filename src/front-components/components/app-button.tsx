import { type ComponentProps } from 'react';
import { Button } from 'twenty-ui/primitives/input';

import { FIELD_STYLES } from 'src/front-components/components/field-styles';

// Keep the host's focus, loading and disabled behavior, with labels that wrap in narrow widgets.
export const AppButton = ({ children, style, ...props }: ComponentProps<typeof Button>) => (
  <Button {...props} style={{ ...FIELD_STYLES.button, ...style }}>
    <span style={FIELD_STYLES.buttonLabel}>{children}</span>
  </Button>
);
