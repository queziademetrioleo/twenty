import { type SelectQueryBuilder } from 'typeorm';

import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export interface AddPersonPhoneFiltersToQueryBuilderOptions {
  queryBuilder: SelectQueryBuilder<PersonWorkspaceEntity>;
  phones: string[];
  excludePersonIds?: string[];
}

/**
 * Adds filters to a query builder to only return people with the given phone
 * numbers. Mirrors `addPersonEmailFiltersToQueryBuilder` but queries the
 * `phones` composite field instead of `emails`.
 *
 * The `phones` composite type stores:
 *  - `phonesPrimaryPhoneNumber` (scalar column)
 *  - `phonesAdditionalPhones` (JSONB array of `{ number, countryCode, callingCode }`)
 *
 * Phone numbers are expected in E.164 format (e.g., `+5511999999999`).
 *
 * @param queryBuilder - The query builder to add the filters to
 * @param phones - The phone numbers to filter by (E.164)
 * @param excludePersonIds - The person IDs to exclude from the results
 */
export function addPersonPhoneFiltersToQueryBuilder({
  queryBuilder,
  phones,
  excludePersonIds = [],
}: AddPersonPhoneFiltersToQueryBuilderOptions): SelectQueryBuilder<PersonWorkspaceEntity> {
  const normalizedPhones = phones.map((phone) => phone.toLowerCase());

  queryBuilder = queryBuilder
    .select([
      'person.id',
      'person.phonesPrimaryPhoneNumber',
      'person.phonesAdditionalPhones',
      'person.deletedAt',
    ])
    .where('LOWER(person.phonesPrimaryPhoneNumber) IN (:...phones)', {
      phones: normalizedPhones,
    })
    .withDeleted();

  if (excludePersonIds.length > 0) {
    queryBuilder = queryBuilder.andWhere(
      'person.id NOT IN (:...excludePersonIds)',
      {
        excludePersonIds,
      },
    );
  }

  // Additional phones are stored as a JSONB array:
  // [{"number": "+5511999999999", "countryCode": "BR", "callingCode": "55"}]
  // The @> containment operator checks if the JSONB array contains an object
  // with a matching "number" field.
  for (const [index, phone] of normalizedPhones.entries()) {
    const phoneParamName = `phone${index}`;
    const orWhereIsInAdditionalPhone =
      excludePersonIds.length > 0
        ? `person.id NOT IN (:...excludePersonIds) AND person.phonesAdditionalPhones @> :${phoneParamName}::jsonb`
        : `person.phonesAdditionalPhones @> :${phoneParamName}::jsonb`;

    queryBuilder = queryBuilder.orWhere(orWhereIsInAdditionalPhone, {
      ...(excludePersonIds.length > 0 && { excludePersonIds }),
      [phoneParamName]: JSON.stringify([{ number: phone }]),
    });
  }

  queryBuilder = queryBuilder.withDeleted();

  return queryBuilder;
}
