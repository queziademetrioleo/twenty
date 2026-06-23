import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('WhatsappConnectionSuccess')
export class WhatsappConnectionSuccessDTO {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  connectedAccountId: string;
}
