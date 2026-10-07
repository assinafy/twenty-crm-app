import { describe, expect, it } from 'vitest';

import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { toLoadError } from 'src/front-components/utils/to-load-error.util';

describe('toLoadError', () => {
  it('names the missing read permission', () => {
    expect(toLoadError(permissionDenied())).toEqual({
      code: 'FORBIDDEN',
      message: '',
      details: { reason: 'member_read_permission' },
    });
  });

  it('reports any other failure as internal', () => {
    expect(toLoadError(new Error('boom'))).toEqual({ code: 'INTERNAL', message: '' });
  });
});
