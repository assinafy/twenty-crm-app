import { toPersonName } from 'src/data/to-person-name';
import { type Contact } from 'src/types/contact';
import { buildE164Phone } from 'src/utils/build-e164-phone.util';

export const toContact = (person: {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null; primaryPhoneCallingCode?: string | null } | null;
}): Contact => ({
  personId: person.id,
  name: toPersonName(person.name),
  email: person.emails?.primaryEmail?.trim() || null,
  phone: buildE164Phone(person.phones?.primaryPhoneCallingCode, person.phones?.primaryPhoneNumber),
});
