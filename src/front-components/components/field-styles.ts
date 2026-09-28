import { type CSSProperties } from 'react';

// Theme tokens as CSS variables: twenty-ui is mocked during manifest extraction, so none of its constants is read.
export const FIELD_STYLES = {
  field: { display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-1)' },
  label: {
    fontSize: 'var(--t-font-size-xs)',
    fontWeight: 'var(--t-font-weight-medium)',
    color: 'var(--t-font-color-secondary)',
  },
  control: {
    background: 'var(--t-background-secondary)',
    border: '1px solid var(--t-border-color-medium)',
    borderRadius: 'var(--t-border-radius-sm)',
    padding: 'var(--t-spacing-2) var(--t-spacing-3)',
    color: 'var(--t-font-color-primary)',
    fontFamily: 'var(--t-font-family)',
    fontSize: 'var(--t-font-size-sm)',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: { fontSize: 'var(--t-font-size-xs)', color: 'var(--t-font-color-tertiary)' },
  stack: { display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' },
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)', listStyle: 'none', margin: 0, padding: 0 },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--t-spacing-2)' },
  text: { fontSize: 'var(--t-font-size-sm)', color: 'var(--t-font-color-primary)', margin: 0 },
  strong: {
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-font-color-primary)',
    margin: 0,
    fontWeight: 'var(--t-font-weight-semi-bold)',
  },
  muted: { fontSize: 'var(--t-font-size-sm)', color: 'var(--t-font-color-tertiary)', margin: 0 },
  card: {
    border: '1px solid var(--t-border-color-light)',
    borderRadius: 'var(--t-border-radius-md)',
    padding: 'var(--t-spacing-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--t-spacing-3)',
    margin: 0,
  },
  container: {
    fontFamily: 'var(--t-font-family)',
    color: 'var(--t-font-color-primary)',
    padding: 'var(--t-spacing-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--t-spacing-4)',
    boxSizing: 'border-box',
  },
} satisfies Record<string, CSSProperties>;
