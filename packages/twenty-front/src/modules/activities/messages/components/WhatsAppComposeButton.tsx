import { useGetWhatsAppConnectedAccounts } from '@/activities/messages/hooks/useGetWhatsAppConnectedAccounts';
import { useSendWhatsappMessage } from '@/activities/messages/hooks/useSendWhatsappMessage';
import { ComposeWhatsappMessageButton } from '@/activities/messages/components/ComposeWhatsappMessageButton';

export const WhatsAppComposeButton = () => {
  const { accounts, loading: accountsLoading } =
    useGetWhatsAppConnectedAccounts();
  const { sendMessage, loading: sendLoading } = useSendWhatsappMessage();

  if (accountsLoading || accounts.length === 0) {
    return null;
  }

  return (
    <ComposeWhatsappMessageButton
      connectedAccounts={accounts}
      onSend={sendMessage}
      loading={sendLoading}
    />
  );
};
