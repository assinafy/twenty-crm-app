// A CRM person offered as a signer; phone already normalized to E.164 when both parts exist.
export type Contact = {
  personId: string;
  name: string;
  email: string | null;
  phone: string | null;
};
