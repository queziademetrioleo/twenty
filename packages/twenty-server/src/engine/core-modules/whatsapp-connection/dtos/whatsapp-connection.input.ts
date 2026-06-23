import { Field, InputType } from '@nestjs/graphql';

@InputType('WhatsappConnectionParameters')
export class WhatsappConnectionParametersInput {
  @Field(() => String)
  accessToken: string;

  @Field(() => String)
  phoneNumberId: string;

  @Field(() => String)
  whatsappBusinessAccountId: string;

  @Field(() => String)
  phoneNumber: string;

  @Field(() => String)
  verifyToken: string;
}
