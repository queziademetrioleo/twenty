import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

import { useMutation } from '@apollo/client/react';
import { t } from '@lingui/core/macro';
import { SettingsPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

import { SAVE_WHATSAPP_ACCOUNT } from '@/settings/accounts/graphql/mutations/saveWhatsappAccount';

const whatsappConnectionValidationSchema = z.object({
  handle: z.string().min(1, t`Phone number (WABA) is required`),
  accessToken: z.string().min(1, t`Access token is required`),
  phoneNumberId: z.string().min(1, t`Phone number ID is required`),
  whatsappBusinessAccountId: z
    .string()
    .min(1, t`WABA ID is required`),
  phoneNumber: z.string().min(1, t`Phone number is required`),
  verifyToken: z.string().min(1, t`Verify token is required`),
});

export type WhatsappConnectionFormData = z.infer<
  typeof whatsappConnectionValidationSchema
>;

type UseWhatsappConnectionFormProps = {
  connectedAccountId?: string;
};

export const useWhatsappConnectionForm = ({
  connectedAccountId,
}: UseWhatsappConnectionFormProps) => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const navigate = useNavigateSettings();

  const formMethods = useForm<WhatsappConnectionFormData>({
    resolver: zodResolver(whatsappConnectionValidationSchema),
    defaultValues: {
      handle: '',
      accessToken: '',
      phoneNumberId: '',
      whatsappBusinessAccountId: '',
      phoneNumber: '',
      verifyToken: '',
    },
  });

  const [saveWhatsappAccount, { loading }] = useMutation(
    SAVE_WHATSAPP_ACCOUNT,
  );

  const handleSave = useCallback(
    async (data: WhatsappConnectionFormData) => {
      try {
        const result = await saveWhatsappAccount({
          variables: {
            handle: data.handle,
            connectionParameters: {
              accessToken: data.accessToken,
              phoneNumberId: data.phoneNumberId,
              whatsappBusinessAccountId: data.whatsappBusinessAccountId,
              phoneNumber: data.phoneNumber,
              verifyToken: data.verifyToken,
            },
            id: connectedAccountId,
          },
        });

        const savedData = result.data as
          | { saveWhatsappAccount?: { success: boolean; connectedAccountId?: string } }
          | undefined;

        if (savedData?.saveWhatsappAccount?.success !== true) {
          throw new Error('Failed to save WhatsApp account');
        }

        enqueueSuccessSnackBar({
          message: t`WhatsApp account saved`,
        });

        const savedAccountId =
          savedData.saveWhatsappAccount.connectedAccountId;

        if (isDefined(savedAccountId)) {
          navigate(SettingsPath.AccountsConfiguration, {
            connectedAccountId: savedAccountId,
          });
        } else {
          navigate(SettingsPath.Accounts);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        enqueueErrorSnackBar({
          message,
        });
      }
    },
    [saveWhatsappAccount, connectedAccountId, navigate, enqueueSuccessSnackBar, enqueueErrorSnackBar],
  );

  const { isValid } = formMethods.formState;

  const canSave = isValid;

  return {
    formMethods,
    handleSave,
    handleSubmit: formMethods.handleSubmit,
    canSave,
    isSubmitting: formMethods.formState.isSubmitting,
    loading,
  };
};
