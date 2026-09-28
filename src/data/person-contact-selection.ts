// Person fields read by toContact; `name` is also what toPersonName reads (genql selection).
export const PERSON_CONTACT_SELECTION = {
  id: true,
  name: { firstName: true, lastName: true },
  emails: { primaryEmail: true },
  phones: { primaryPhoneNumber: true, primaryPhoneCallingCode: true },
} as const;
