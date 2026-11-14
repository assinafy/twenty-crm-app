import { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('twenty-sdk/front-component', () => ({
  useTranslate: () => ({ t: (value: unknown) => value }),
  msg: (value: string) => value,
}));

import { AppButton } from 'src/front-components/components/app-button';
import { ErrorCallout } from 'src/front-components/components/error-callout';
import { FIELD_STYLES } from 'src/front-components/components/field-styles';

const luminance = (hex: string) => {
  const rgb = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
};
const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].toSorted((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
};

describe('v2 controls', () => {
  it('preserves host button behavior and wraps the complete label', () => {
    const onClick = vi.fn<() => void>();
    const label = 'Confirmar o custo e enviar para assinatura';
    const button = AppButton({ children: label, onClick, disabled: true, loading: true, 'aria-label': label });
    expect(button.props).toMatchObject({ onClick, disabled: true, loading: true, 'aria-label': label });
    expect(button.props.children.props.children).toBe(label);
    expect(button.props.children.props.style.whiteSpace).toBe('normal');
    expect(button.props.style.minHeight).toBeGreaterThanOrEqual(44);
    expect(button.props.style.height).toBe('auto');
  });

  it('keeps the recovery action executable with the new Callout API', () => {
    const onClick = vi.fn<() => void>();
    const callout = ErrorCallout({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'Unavailable' }, action: { label: 'Tentar novamente', onClick } });
    expect(callout.props.role).toBe('alert');
    const content = callout.props.children;
    expect(content.props.status).toBeDefined();
    const action = content.props.action as ReactElement<{ onClick: () => void; children: string }>;
    expect(action.type).toBe(AppButton);
    expect(action.props.children).toBe('Tentar novamente');
    action.props.onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps every callout readable without inheriting dark host colors', () => {
    const tokens: Record<string, string | number> = FIELD_STYLES.container;
    for (const color of ['blue', 'green', 'orange', 'red', 'gray']) {
      const background = String(tokens[`--t-color-${color}1`]);
      expect(contrast(String(tokens['--t-font-color-primary']), background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(String(tokens['--t-font-color-secondary']), background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const color of ['blue', 'sky', 'green', 'gray', 'red', 'orange', 'amber']) {
      expect(contrast(String(tokens[`--t-tag-text-${color}`]), String(tokens[`--t-tag-background-${color}`])))
        .toBeGreaterThanOrEqual(4.5);
    }
  });
});
