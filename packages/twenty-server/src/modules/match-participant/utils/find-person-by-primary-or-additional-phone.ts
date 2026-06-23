import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

/**
 * Finds a person whose primary or additional phone number matches the given
 * phone string. Mirrors `findPersonByPrimaryOrAdditionalEmail`.
 *
 * Phone numbers are compared case-insensitively.
 */
export const findPersonByPrimaryOrAdditionalPhone = ({
  people,
  phone,
}: {
  people: PersonWorkspaceEntity[];
  phone: string;
}): PersonWorkspaceEntity | undefined => {
  const lowercasePhone = phone.toLowerCase();

  const personWithPrimaryPhone = people.find(
    (person) =>
      person.phones?.primaryPhoneNumber?.toLowerCase() === lowercasePhone,
  );

  if (personWithPrimaryPhone) {
    return personWithPrimaryPhone;
  }

  const personWithAdditionalPhone = people.find((person) => {
    const additionalPhones = person.phones?.additionalPhones;

    if (!Array.isArray(additionalPhones)) {
      return false;
    }

    return additionalPhones.some(
      (additionalPhone) =>
        additionalPhone.number?.toLowerCase() === lowercasePhone,
    );
  });

  return personWithAdditionalPhone;
};
