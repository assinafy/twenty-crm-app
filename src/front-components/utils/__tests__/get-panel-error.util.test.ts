import { describe, expect, it } from 'vitest';

import { getPanelError } from 'src/front-components/utils/get-panel-error.util';

const INTERNAL = { code: 'INTERNAL', message: '' };

describe('getPanelError', () => {
  it('keeps an action error when the record read after it fails', () => {
    expect(getPanelError({ code: 'UNCERTAIN', message: '' }, true)).toEqual({ code: 'UNCERTAIN', message: '' });
    expect(getPanelError({ code: 'COST_CHANGED', message: '' }, true)).toEqual({ code: 'COST_CHANGED', message: '' });
  });

  it('keeps an action error when the record read after it succeeds', () => {
    expect(getPanelError({ code: 'UNCERTAIN', message: '' }, false)).toEqual({ code: 'UNCERTAIN', message: '' });
  });

  it('reports a failed read on its own and nothing once a read succeeds', () => {
    expect(getPanelError(null, true)).toEqual(INTERNAL);
    expect(getPanelError(null, false)).toBeNull();
  });
});
