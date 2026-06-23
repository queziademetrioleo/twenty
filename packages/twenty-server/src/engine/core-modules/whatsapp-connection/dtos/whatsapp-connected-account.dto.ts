import { Field, ObjectType } from '@nestjs/graphql';

import { ConnectedAccountProvider } from 'twenty-shared/types';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('WhatsappPublicConnectionParameters')
export class WhatsappPublicConnectionParametersDTO {
  @Field(() => String)
  phoneNumberId: string;

  @Field(() => String)
  whatsappBusinessAccountId: string;

  @Field(() => String)
  phoneNumber: string;

  // Returned in plaintext so the user can copy it into the Meta webhook config.
  @Field(() => String)
  verifyToken: string;

  @Field(() => Boolean)
  accessTokenIsSet: boolean;
}

@ObjectType('ConnectedWhatsappAccount')
export class ConnectedWhatsappAccountDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => String)
  handle: string;

  @Field(() => String)
  provider: ConnectedAccountProvider;

  @Field(() => UUIDScalarType)
  userWorkspaceId: string;

  @Field(() => WhatsappPublicConnectionParametersDTO, { nullable: true })
  connectionParameters: WhatsappPublicConnectionParametersDTO | null;
}
