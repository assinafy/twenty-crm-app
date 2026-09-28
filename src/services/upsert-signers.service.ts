import { type AssinafyClient, type IUpdateSignerPayload } from '@assinafy/sdk';

import { type SignerInput } from 'src/types/signer-input';
import { toAppError } from 'src/utils/to-app-error.util';

// signers.create reuses the account signer with the same email unchanged, so one update brings it in line with the
// input. The email is never changed (it identifies the signer); a phone is only sent for a WhatsApp invitation.
const upsertSigner = async (client: AssinafyClient, input: SignerInput): Promise<string> => {
  const whatsapp = input.notificationMethod === 'Whatsapp' ? input.phone : null;
  const signer = await client.signers.create({
    full_name: input.name,
    ...(input.email === null ? {} : { email: input.email }),
    ...(whatsapp === null ? {} : { whatsapp_phone_number: whatsapp }),
  });

  const patch: IUpdateSignerPayload = {
    ...(signer.full_name === input.name ? {} : { full_name: input.name }),
    ...(whatsapp === null || signer.whatsapp_phone_number === whatsapp ? {} : { whatsapp_phone_number: whatsapp }),
    // Assinafy never echoes the government id back, so a certificate signer always gets it.
    ...(input.verificationMethod === 'DigitalCertificate' && input.governmentId !== null
      ? { government_id: input.governmentId }
      : {}),
  };
  if (Object.keys(patch).length > 0) {
    await client.signers.update(signer.id, patch);
  }

  return signer.id;
};

export const upsertSigners = async (
  client: AssinafyClient,
  signers: SignerInput[],
): Promise<Array<{ input: SignerInput; assinafySignerId: string }>> => {
  const upserted: Array<{ input: SignerInput; assinafySignerId: string }> = [];

  try {
    // Sequential: parallel creates of the same email race Assinafy's duplicate check.
    for (const input of signers) {
      upserted.push({ input, assinafySignerId: await upsertSigner(client, input) });
    }
  } catch (error) {
    throw toAppError(error, 'mutation');
  }

  return upserted;
};
