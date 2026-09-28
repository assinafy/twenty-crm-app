import { AppFailure } from 'src/utils/app-failure.util';

// Twenty refuses write permission without read permission, so a denied read or create means the same thing.
export const cannotCreateDocuments = (): AppFailure =>
  new AppFailure('FORBIDDEN', 'Sua função no Twenty não permite criar Documentos Assinafy.', {
    reason: 'member_create_permission',
  });
