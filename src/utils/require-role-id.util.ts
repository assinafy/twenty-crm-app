import { AppFailure } from 'src/utils/app-failure.util';

// validateSigners requires a role on every template signer; this narrows the type where the payload is built.
export const requireRoleId = (roleId: string | null | undefined): string => {
  if (!roleId) {
    throw new AppFailure('INTERNAL', 'Há um signatário do modelo sem papel definido.');
  }
  return roleId;
};
