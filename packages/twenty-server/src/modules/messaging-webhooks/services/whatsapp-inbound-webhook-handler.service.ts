import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  ConnectedAccountProvider,
  MessageParticipantRole,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type EncryptedWhatsappConnectionParameters } from 'src/engine/core-modules/whatsapp-connection/types/whatsapp-connection.type';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountTokenEncryptionService } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { MessagingSaveMessagesAndEnqueueContactCreationService } from 'src/modules/messaging/message-import-manager/services/messaging-save-messages-and-enqueue-contact-creation.service';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { MessagingWebhookExceptionCode } from 'src/modules/messaging-webhooks/messaging-webhook-exception-code.enum';
import { MessagingWebhookException } from 'src/modules/messaging-webhooks/messaging-webhook.exception';
import {
  type WhatsappWebhookMessage,
  type WhatsappWebhookMessageValue,
  type WhatsappWebhookStatusValue,
} from 'src/modules/messaging-webhooks/types/whatsapp-webhook-payload.type';

// ── Resolved channel + account pair ──────────────────────────────────

type ResolvedWhatsappChannel = {
  messageChannel: MessageChannelEntity;
  connectedAccount: ConnectedAccountEntity;
};

// ── Type guards for discriminated value shapes ───────────────────────

const isMessageValue = (
  value: WhatsappWebhookMessageValue | WhatsappWebhookStatusValue | object,
): value is WhatsappWebhookMessageValue => {
  const v = value as Record<string, unknown>;

  return (
    v.messaging_product === 'whatsapp' &&
    Array.isArray(v.messages) &&
    v.messages.length > 0
  );
};

const isStatusValue = (
  value: WhatsappWebhookMessageValue | WhatsappWebhookStatusValue | object,
): value is WhatsappWebhookStatusValue => {
  const v = value as Record<string, unknown>;

  return (
    v.messaging_product === 'whatsapp' &&
    Array.isArray(v.statuses) &&
    v.statuses.length > 0
  );
};

// ── Handler service ──────────────────────────────────────────────────

@Injectable()
export class WhatsappInboundWebhookHandlerService {
  private readonly logger = new Logger(
    WhatsappInboundWebhookHandlerService.name,
  );

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly messagingSaveMessagesAndEnqueueContactCreationService: MessagingSaveMessagesAndEnqueueContactCreationService,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectRepository(MessageChannelEntity)
    private readonly messageChannelRepository: Repository<MessageChannelEntity>,
  ) {}

  // ── GET handshake ──────────────────────────────────────────────────

  /**
   * Handles the Meta webhook verification GET request.
   *
   * Meta sends a GET with `hub.mode=subscribe`, `hub.verify_token`, and
   * `hub.challenge`. The handshake succeeds when the provided verify_token
   * matches the verify token of any WhatsApp connected account.
   *
   * @returns The `hub.challenge` value to echo back.
   * @throws MessagingWebhookException if the handshake validation fails.
   */
  async handleGetHandshake(queryParams: {
    [key: string]: string;
  }): Promise<string> {
    const mode = queryParams['hub.mode'];
    const verifyToken = queryParams['hub.verify_token'];
    const challenge = queryParams['hub.challenge'];

    if (mode !== 'subscribe') {
      throw new MessagingWebhookException(
        `Invalid hub.mode: ${mode}`,
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_SUBSCRIBE_URL,
      );
    }

    if (!isDefined(verifyToken) || !isDefined(challenge)) {
      throw new MessagingWebhookException(
        'Missing hub.verify_token or hub.challenge',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_SUBSCRIBE_URL,
      );
    }

    const whatsappAccounts = await this.connectedAccountRepository.find({
      where: { provider: ConnectedAccountProvider.WHATSAPP },
    });

    for (const account of whatsappAccounts) {
      try {
        const decrypted =
          this.connectedAccountTokenEncryptionService.decryptWhatsappConnectionParameters(
            {
              connectionParameters:
                account.connectionParameters as EncryptedWhatsappConnectionParameters,
              workspaceId: account.workspaceId,
            },
          );

        if (decrypted.verifyToken === verifyToken) {
          this.logger.log(
            `WhatsApp webhook handshake verified for account ${account.id}`,
          );

          return challenge;
        }
      } catch {
        // Skip accounts whose connectionParameters cannot be decrypted —
        // they may be stored in a different format (e.g. IMAP).
      }
    }

    throw new MessagingWebhookException(
      'No WhatsApp connected account matches the provided verify_token',
      MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_SUBSCRIBE_URL,
    );
  }

  // ── POST inbound webhook ───────────────────────────────────────────

  /**
   * Processes an inbound WhatsApp webhook POST from Meta.
   *
   * 1. Verifies the HMAC SHA-256 signature in `X-Hub-Signature-256` against
   *    the configured `WHATSAPP_APP_SECRET`.
   * 2. Parses the JSON payload and dispatches message/status changes.
   * 3. For inbound messages: resolves the channel, maps to
   *    `MessageWithParticipants[]`, and saves via the shared save service
   *    inside a workspace context.
   *
   * Status updates (delivered/read/failed) are logged and ignored for v1.
   */
  async handleInboundWebhook(
    rawBody: Buffer,
    signatureHeader: string,
  ): Promise<void> {
    this.verifySignature(rawBody, signatureHeader);

    const payload = JSON.parse(rawBody.toString('utf-8'));

    if (!isDefined(payload.entry) || !Array.isArray(payload.entry)) {
      throw new MessagingWebhookException(
        'Missing or invalid webhook payload',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_PAYLOAD,
      );
    }

    for (const entry of payload.entry) {
      if (!isDefined(entry.changes) || !Array.isArray(entry.changes)) {
        continue;
      }

      for (const change of entry.changes) {
        if (change.field !== 'messages') {
          continue;
        }

        const { value } = change;

        if (isMessageValue(value)) {
          await this.handleMessageValue(value);
        } else if (isStatusValue(value)) {
          this.logger.log(
            `WhatsApp status updates for ${value.metadata.phone_number_id}: ` +
              value.statuses
                .map((s) => `${s.id} → ${s.status}`)
                .join(', '),
          );
        } else {
          this.logger.warn(
            `Unknown WhatsApp webhook value shape: ${JSON.stringify(value)}`,
          );
        }
      }
    }
  }

  // ── Message value handler ──────────────────────────────────────────

  private async handleMessageValue(
    value: WhatsappWebhookMessageValue,
  ): Promise<void> {
    const phoneNumberId = value.metadata.phone_number_id;

    const resolved = await this.resolveChannelByPhoneNumberId(phoneNumberId);

    if (!isDefined(resolved)) {
      this.logger.warn(
        `No WhatsApp channel found for phone_number_id ${phoneNumberId}`,
      );

      return;
    }

    const { messageChannel, connectedAccount } = resolved;
    const workspaceId = messageChannel.workspaceId;

    // v1: only handle text messages; media support comes after Fase 2b
    const textMessages = value.messages.filter((msg) => msg.type === 'text');

    if (textMessages.length === 0) {
      this.logger.log(
        `WhatsApp webhook for ${phoneNumberId}: ` +
          `${value.messages.length} non-text message(s) skipped (v1 limitation)`,
      );

      return;
    }

    const messagesWithParticipants = textMessages.map((msg) =>
      this.mapWhatsAppMessageToMessageWithParticipants(
        msg,
        connectedAccount.handle,
        value.contacts,
      ),
    );

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        await this.messagingSaveMessagesAndEnqueueContactCreationService.saveMessagesAndEnqueueContactCreation(
          messagesWithParticipants,
          messageChannel,
          connectedAccount,
          workspaceId,
        );
      },
      buildSystemAuthContext(workspaceId),
      { lite: true },
    );

    this.logger.log(
      `WhatsApp: saved ${textMessages.length} message(s) for channel ${messageChannel.id}`,
    );
  }

  // ── Signature verification ─────────────────────────────────────────

  /**
   * Verifies that the webhook payload was signed by Meta using the
   * configured WhatsApp App Secret.
   *
   * The `X-Hub-Signature-256` header has the format `sha256=<hex-hmac>`.
   *
   * Uses constant-time comparison (`timingSafeEqual`) to prevent timing
   * attacks against the expected signature.
   */
  private verifySignature(rawBody: Buffer, signatureHeader: string): void {
    const appSecret = this.twentyConfigService.get('WHATSAPP_APP_SECRET');

    if (!isDefined(appSecret) || typeof appSecret !== 'string') {
      this.logger.error(
        'WHATSAPP_APP_SECRET is not configured — webhook rejected',
      );

      throw new MessagingWebhookException(
        'WhatsApp App Secret is not configured',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_SIGNATURE,
      );
    }

    const prefix = 'sha256=';
    const signature = signatureHeader.startsWith(prefix)
      ? signatureHeader.slice(prefix.length)
      : signatureHeader;

    // Signature header must contain a hex-encoded HMAC
    if (!signature || !/^[a-f0-9]+$/i.test(signature)) {
      throw new MessagingWebhookException(
        'Missing or malformed X-Hub-Signature-256 header',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_SIGNATURE,
      );
    }

    const expectedSignatureBuffer = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest();
    const expectedSignature = expectedSignatureBuffer.toString('hex');

    // Re-encode both to Buffer for constant-time comparison
    const actualBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (actualBuffer.length !== expectedBuffer.length) {
      throw new MessagingWebhookException(
        'Webhook signature mismatch',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_SIGNATURE,
      );
    }

    if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
      throw new MessagingWebhookException(
        'Webhook signature mismatch',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_INVALID_SIGNATURE,
      );
    }
  }

  // ── Channel resolution ─────────────────────────────────────────────

  /**
   * Finds the `MessageChannelEntity` and `ConnectedAccountEntity` whose
   * `phoneNumberId` matches the one reported in the webhook.
   *
   * Iterates over all `ConnectedAccount` rows with `provider = WHATSAPP`,
   * decrypts their `connectionParameters`, and returns the first match.
   */
  private async resolveChannelByPhoneNumberId(
    phoneNumberId: string,
  ): Promise<ResolvedWhatsappChannel | null> {
    const whatsappAccounts = await this.connectedAccountRepository.find({
      where: { provider: ConnectedAccountProvider.WHATSAPP },
    });

    for (const account of whatsappAccounts) {
      try {
        const decrypted =
          this.connectedAccountTokenEncryptionService.decryptWhatsappConnectionParameters(
            {
              connectionParameters:
                account.connectionParameters as EncryptedWhatsappConnectionParameters,
              workspaceId: account.workspaceId,
            },
          );

        if (decrypted.phoneNumberId === phoneNumberId) {
          const messageChannel =
            await this.messageChannelRepository.findOne({
              where: {
                connectedAccountId: account.id,
                workspaceId: account.workspaceId,
              },
            });

          if (!isDefined(messageChannel)) {
            this.logger.warn(
              `Connected account ${account.id} has no message channel`,
            );

            continue;
          }

          return { messageChannel, connectedAccount: account };
        }
      } catch {
        // Connection parameters may be stored in a different format
      }
    }

    return null;
  }

  // ── Message mapping ────────────────────────────────────────────────

  /**
   * Maps a WhatsApp webhook message to a `MessageWithParticipants` object
   * that can be persisted by the shared save service.
   */
  private mapWhatsAppMessageToMessageWithParticipants(
    msg: WhatsappWebhookMessage,
    channelHandle: string,
    contacts: WhatsappWebhookMessageValue['contacts'],
  ): MessageWithParticipants {
    const timestamp = Number(msg.timestamp);

    const contact = contacts.find((c) => c.wa_id === msg.from);
    const displayName = contact?.profile?.name ?? '';

    // WhatsApp message IDs from the webhook are opaque e.g. "wamid.HBg..."
    // We prefix with "whatsapp:" for uniqueness across providers.
    const externalId = `whatsapp:${msg.id}`;

    // If this message is a reply, `context.id` holds the ID of the
    // message being replied to — use it as the thread external ID so
    // messages in the same reply chain are grouped.
    const messageThreadExternalId = msg.context?.id
      ? `whatsapp:${msg.context.id}`
      : externalId;

    const headerMessageId = msg.context?.id
      ? `whatsapp:${msg.context.id}`
      : null;

    return {
      externalId,
      headerMessageId,
      messageThreadExternalId,
      subject: '',
      // Only text messages are processed in v1
      text: msg.text?.body ?? '',
      receivedAt: new Date(timestamp * 1000),
      direction: MessageDirection.INCOMING,
      attachments: [],
      participants: [
        {
          handle: normalizeToE164(msg.from),
          role: MessageParticipantRole.FROM,
          displayName,
        },
        {
          handle: normalizeToE164(channelHandle),
          role: MessageParticipantRole.TO,
          displayName: '',
        },
      ],
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Normalizes a phone number to E.164 format by ensuring it has a leading
 * `+`. Meta Cloud API sends phone numbers without the `+` prefix (e.g.
 * `5511999999999`), but the Twenty CRM expects E.164 (`+5511999999999`).
 */
const normalizeToE164 = (phone: string): string => {
  const trimmed = phone.trim();

  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
};
