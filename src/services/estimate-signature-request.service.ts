import { type ITemplateCostSigner } from '@assinafy/sdk';

import { type CostEstimate } from 'src/types/cost-estimate';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type SignatureRequestInput } from 'src/types/signature-request-input';
import { type SignerInput } from 'src/types/signer-input';
import { AppFailure } from 'src/utils/app-failure.util';
import { buildEstimateSigners } from 'src/utils/build-estimate-signers.util';
import { normalizeCostEstimate } from 'src/utils/normalize-cost-estimate.util';
import { requireRoleId } from 'src/utils/require-role-id.util';
import { toAppError } from 'src/utils/to-app-error.util';

const toTemplateCostSigners = (signers: SignerInput[]): ITemplateCostSigner[] =>
  buildEstimateSigners(signers).map(({ role_id, ...channel }) => ({ role_id: requireRoleId(role_id), ...channel }));

// A dry run: Assinafy charges nothing for an estimate. Callers validate a template with findSignatureTemplate first.
export const estimateSignatureRequest = async (
  { client }: ResolvedCredential,
  input: SignatureRequestInput,
  assinafyDocumentId: string | null,
): Promise<CostEstimate> => {
  const { source, signers } = input;

  try {
    if (source.type === 'TEMPLATE') {
      return normalizeCostEstimate(
        await client.documents.estimateCostFromTemplate(source.templateId, toTemplateCostSigners(signers)),
      );
    }

    if (assinafyDocumentId === null) {
      throw new AppFailure('INTERNAL', 'A estimativa de um PDF exige o documento carregado.');
    }
    return normalizeCostEstimate(
      await client.assignments.estimateCost(assinafyDocumentId, {
        method: 'virtual',
        signers: buildEstimateSigners(signers),
      }),
    );
  } catch (error) {
    throw toAppError(error, 'read');
  }
};
