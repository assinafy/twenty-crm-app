import { describe, expect, it } from 'vitest';

import { getErrorTitle } from 'src/front-components/utils/get-error-title.util';

describe('getErrorTitle', () => {
  it('warns instead of reporting a failure when a send may have gone out', () => {
    expect(getErrorTitle('UNCERTAIN')).toMatchObject({
      variant: 'warning',
      title: { message: 'Confira na Assinafy antes de enviar de novo' },
    });
  });

  it('reports a failure for any other code', () => {
    expect(getErrorTitle('PROVIDER_REJECTED')).toMatchObject({
      variant: 'error',
      title: { message: 'Não foi possível continuar' },
    });
  });
});
