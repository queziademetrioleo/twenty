import { useCallback } from 'react';
import { useMutation } from '@apollo/client/react';

import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SEND_WHATSAPP_MESSAGE } from '@/activities/messages/graphql/mutations/sendWhatsappMessage';

type SendWhatsappMessageParams = {
  connectedAccountId: string;
  to: string;
  body: string;
  inReplyTo?: string;
};

export const useSendWhatsappMessage = () => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [sendWhatsappMessage, { loading }] = useMutation(
    SEND_WHATSAPP_MESSAGE,
  );

  const sendMessage = useCallback(
    async (params: SendWhatsappMessageParams) => {
      const result = await sendWhatsappMessage({
        variables: { input: params },
      });

      const response = (
        result.data as
          | { sendWhatsappMessage?: { success: boolean; error?: string } }
          | undefined
      )?.sendWhatsappMessage;

      if (response?.success) {
        enqueueSuccessSnackBar({ message: 'WhatsApp message sent' });
      } else {
        enqueueErrorSnackBar({
          message: response?.error ?? 'Failed to send WhatsApp message',
        });
      }

      return response?.success ?? false;
    },
    [sendWhatsappMessage, enqueueSuccessSnackBar, enqueueErrorSnackBar],
  );

  return {
    sendMessage,
    loading,
  };
};
