import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { LightIconButton } from 'twenty-ui/input';
import { IconBrandWhatsapp } from 'twenty-ui/icon';
import { styled } from '@linaria/react';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid ${() => 'var(--theme-border-color)'};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StyledLabel = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: var(--theme-font-color-secondary);
`;

const StyledSelect = styled.select`
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--theme-border-color);
  background: var(--theme-background-color);
  color: var(--theme-font-color-primary);
  font-size: 13px;
`;

const StyledInput = styled.input`
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--theme-border-color);
  background: var(--theme-background-color);
  color: var(--theme-font-color-primary);
  font-size: 13px;
`;

const StyledTextarea = styled.textarea`
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--theme-border-color);
  background: var(--theme-background-color);
  color: var(--theme-font-color-primary);
  font-size: 13px;
  resize: vertical;
  min-height: 60px;
`;

const StyledButton = styled.button`
  padding: 6px 16px;
  border-radius: 4px;
  border: none;
  background: var(--theme-accent-color);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

type ComposeWhatsappMessageButtonProps = {
  connectedAccounts: Array<{ id: string; handle: string }>;
  onSend: (params: {
    connectedAccountId: string;
    to: string;
    body: string;
  }) => Promise<boolean>;
  loading?: boolean;
};

export const ComposeWhatsappMessageButton = ({
  connectedAccounts,
  onSend,
  loading,
}: ComposeWhatsappMessageButtonProps) => {
  const { t } = useLingui();
  const [isOpen, setIsOpen] = useState(false);
  const [connectedAccountId, setConnectedAccountId] = useState(
    connectedAccounts[0]?.id ?? '',
  );
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');

  const handleSend = async () => {
    if (!connectedAccountId || !to.trim() || !body.trim()) return;

    const success = await onSend({
      connectedAccountId,
      to: to.trim(),
      body: body.trim(),
    });

    if (success) {
      setTo('');
      setBody('');
      setIsOpen(false);
    }
  };

  return (
    <div>
      <LightIconButton
        Icon={IconBrandWhatsapp}
        title={t`Compose WhatsApp message`}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <StyledContainer>
          <StyledField>
            <StyledLabel>{t`From`}</StyledLabel>
            <StyledSelect
              value={connectedAccountId}
              onChange={(e) => setConnectedAccountId(e.target.value)}
            >
              {connectedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.handle}
                </option>
              ))}
            </StyledSelect>
          </StyledField>
          <StyledField>
            <StyledLabel>{t`To`}</StyledLabel>
            <StyledInput
              type="tel"
              placeholder="+15551234567"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </StyledField>
          <StyledField>
            <StyledLabel>{t`Message`}</StyledLabel>
            <StyledTextarea
              placeholder={t`Type a message...`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </StyledField>
          <StyledButton
            onClick={handleSend}
            disabled={loading || !to.trim() || !body.trim()}
          >
            {loading ? t`Sending...` : t`Send`}
          </StyledButton>
        </StyledContainer>
      )}
    </div>
  );
};
