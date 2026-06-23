import { gql } from '@apollo/client';

export const SEND_WHATSAPP_MESSAGE = gql`
  mutation SendWhatsappMessage($input: SendWhatsappMessageInput!) {
    sendWhatsappMessage(input: $input) {
      success
      error
    }
  }
`;
