import { describe, expect, it } from 'vitest';

import { AppFailure } from 'src/utils/app-failure.util';
import { cannotCreateDocuments } from 'src/utils/cannot-create-documents.util';

describe('cannotCreateDocuments', () => {
  it('builds the FORBIDDEN failure for a role that cannot create Assinafy documents', () => {
    const failure = cannotCreateDocuments();

    expect(failure).toBeInstanceOf(AppFailure);
    expect(failure.code).toBe('FORBIDDEN');
    expect(failure.message).toBe('Sua função no Twenty não permite criar Documentos Assinafy.');
    expect(failure.details).toEqual({ reason: 'member_create_permission' });
  });
});
