import { useLingui } from '@lingui/react/macro';
import { Controller, FormProvider } from 'react-hook-form';
import { useParams } from 'react-router-dom';

import { SaveAndCancelButtons } from '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SettingsPath } from 'twenty-shared/types';

import { getSettingsPath } from 'twenty-shared/utils';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { useWhatsappConnectionForm } from '@/settings/accounts/hooks/useWhatsappConnectionForm';
import { H2Title } from 'twenty-ui/typography';
import { Section } from 'twenty-ui/layout';

type SettingsAccountsWhatsappConnectionProps = {
  connectedAccountId?: string;
};

export const SettingsAccountsWhatsappConnection = ({
  connectedAccountId: propConnectedAccountId,
}: SettingsAccountsWhatsappConnectionProps = {}) => {
  const { t } = useLingui();
  const navigate = useNavigateSettings();

  const { connectedAccountId: urlConnectedAccountId } = useParams<{
    connectedAccountId: string;
  }>();
  const connectedAccountId = propConnectedAccountId ?? urlConnectedAccountId;

  const {
    formMethods,
    handleSave,
    handleSubmit,
    canSave,
    isSubmitting,
    loading,
  } = useWhatsappConnectionForm({ connectedAccountId });

  const { control } = formMethods;
  const isEditing = !!connectedAccountId;

  return (
    <FormProvider {...formMethods}>
      <SettingsPageLayout
        title={isEditing ? t`Edit WhatsApp Account` : t`New WhatsApp Account`}
        links={[
          {
            children: t`User`,
            href: getSettingsPath(SettingsPath.ProfilePage),
          },
          {
            children: t`Accounts`,
            href: getSettingsPath(SettingsPath.Accounts),
          },
          {
            children: isEditing
              ? t`Edit WhatsApp Account`
              : t`New WhatsApp Account`,
          },
        ]}
        actionButton={
          <SaveAndCancelButtons
            isSaveDisabled={!canSave}
            isCancelDisabled={isSubmitting}
            isLoading={loading}
            onCancel={() => navigate(SettingsPath.Accounts)}
            onSave={handleSubmit((data) => handleSave(data))}
          />
        }
      >
        <SettingsPageContainer>
          <Section>
            <H2Title
              title={t`WhatsApp Cloud API`}
              description={t`Enter your Meta WhatsApp Business account credentials`}
            />
            <Controller
              name="handle"
              control={control}
              render={({ field, fieldState }) => (
                <SettingsTextInput
                  instanceId="whatsapp-connection-handle"
                  label={t`WABA Phone Number`}
                  placeholder="+15551234567"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="accessToken"
              control={control}
              render={({ field, fieldState }) => (
                <SettingsTextInput
                  instanceId="whatsapp-connection-access-token"
                  label={t`Access Token`}
                  placeholder="EAA..."
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="phoneNumberId"
              control={control}
              render={({ field, fieldState }) => (
                <SettingsTextInput
                  instanceId="whatsapp-connection-phone-number-id"
                  label={t`Phone Number ID`}
                  placeholder="123456789..."
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="whatsappBusinessAccountId"
              control={control}
              render={({ field, fieldState }) => (
                <SettingsTextInput
                  instanceId="whatsapp-connection-waba-id"
                  label={t`WhatsApp Business Account ID`}
                  placeholder="987654321..."
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="phoneNumber"
              control={control}
              render={({ field, fieldState }) => (
                <SettingsTextInput
                  instanceId="whatsapp-connection-phone-number"
                  label={t`Phone Number`}
                  placeholder="+15551234567"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="verifyToken"
              control={control}
              render={({ field, fieldState }) => (
                <SettingsTextInput
                  instanceId="whatsapp-connection-verify-token"
                  label={t`Webhook Verify Token`}
                  placeholder="my-verify-token"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  fullWidth
                />
              )}
            />
          </Section>
        </SettingsPageContainer>
      </SettingsPageLayout>
    </FormProvider>
  );
};
