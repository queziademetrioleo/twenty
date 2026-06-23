import { gql } from '@apollo/client';

export const SAVE_WHATSAPP_ACCOUNT = gql`
  mutation SaveWhatsappAccount(
    $handle: String!
    $connectionParameters: WhatsappConnectionParameters!
    $id: UUID
  ) {
    saveWhatsappAccount(
      handle: $handle
      connectionParameters: $connectionParameters
      id: $id
    ) {
      success
      connectedAccountId
    }
  }
`;
