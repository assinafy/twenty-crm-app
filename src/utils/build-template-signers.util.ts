import { type SignerInput } from 'src/types/signer-input';
import { buildAssignmentSigners } from 'src/utils/build-assignment-signers.util';
import { requireRoleId } from 'src/utils/require-role-id.util';

export const buildTemplateSigners = (
  signers: Array<{ input: SignerInput; assinafySignerId: string }>,
  sequential: boolean,
) =>
  buildAssignmentSigners(signers, sequential).map((signer, index) => ({
    role_id: requireRoleId(signers[index]?.input.roleId),
    ...signer,
  }));
