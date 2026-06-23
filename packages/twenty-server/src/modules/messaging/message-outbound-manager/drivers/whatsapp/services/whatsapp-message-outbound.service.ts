import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { SecureHttpClientService } from 'src/engine/core-modules/secure-http-client/secure-http-client.service';
import { type EncryptedWhatsappConnectionParameters } from 'src/engine/core-modules/whatsapp-connection/types/whatsapp-connection.type';
import { type ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountTokenEncryptionService } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
import { type SendMessageInput } from 'src/modules/messaging/message-outbound-manager/types/send-message-input.type';
import { type SendMessageResult } from 'src/modules/messaging/message-outbound-manager/types/send-message-result.type';

const META_API_BASE_URL = 'https://graph.facebook.com';

// ── Meta API response types ──────────────────────────────────────────

type MetaSendMessageResponse = {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
};

type MetaUploadMediaResponse = {
  id: string;
};

// ── Media type mapping ───────────────────────────────────────────────

type WhatsappMediaType = 'image' | 'audio' | 'video' | 'document' | 'sticker';

const contentTypeToWhatsappMediaType = (
  contentType: string,
): WhatsappMediaType => {
  const [type] = contentType.split('/');

  switch (type) {
    case 'image':
      return 'image';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    default:
      return 'document';
  }
};

// ── Driver ───────────────────────────────────────────────────────────

@Injectable()
export class WhatsappMessageOutboundService {
  private readonly logger = new Logger(WhatsappMessageOutboundService.name);

  constructor(
    private readonly secureHttpClientService: SecureHttpClientService,
    private readonly connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  async sendMessage(
    sendMessageInput: SendMessageInput,
    connectedAccount: ConnectedAccountEntity,
  ): Promise<SendMessageResult> {
    const isEnabled = this.twentyConfigService.get(
      'IS_WHATSAPP_MESSAGING_ENABLED',
    );

    if (isEnabled !== true) {
      throw new Error('WhatsApp messaging is not enabled');
    }

    const { accessToken, phoneNumberId } =
      this.decryptConnectionParameters(connectedAccount);

    const recipient = Array.isArray(sendMessageInput.to)
      ? sendMessageInput.to[0]
      : sendMessageInput.to;

    const contextMessageId = this.resolveContextMessageId(
      sendMessageInput.inReplyTo,
    );

    const httpClient = this.secureHttpClientService.getHttpClient();
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
    };

    const hasAttachments =
      isDefined(sendMessageInput.attachments) &&
      sendMessageInput.attachments.length > 0;

    // ── Media message ──────────────────────────────────────────────

    if (hasAttachments) {
      const attachment = sendMessageInput.attachments![0];
      const mediaType = contentTypeToWhatsappMediaType(
        attachment.contentType,
      );

      const mediaId = await this.uploadMedia({
        httpClient,
        authHeaders,
        phoneNumberId,
        attachment,
        mediaType,
      });

      const mediaPayload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: mediaType,
        [mediaType]: {
          id: mediaId,
          ...(mediaType !== 'sticker' && {
            caption: sendMessageInput.body || undefined,
          }),
        },
      };

      if (isDefined(contextMessageId)) {
        mediaPayload.context = { message_id: contextMessageId };
      }

      this.logger.log(
        `Sending WhatsApp ${mediaType} message to ${recipient}`,
      );

      const mediaResponse =
        await httpClient.post<MetaSendMessageResponse>(
          `${META_API_BASE_URL}/v22.0/${phoneNumberId}/messages`,
          mediaPayload,
          {
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
          },
        );

      const sentMessage = mediaResponse.data.messages?.[0];

      if (!isDefined(sentMessage)) {
        throw new Error(
          `WhatsApp API did not return a message ID: ${JSON.stringify(mediaResponse.data)}`,
        );
      }

      const messageExternalId = `whatsapp:${sentMessage.id}`;

      return {
        headerMessageId: sentMessage.id,
        messageExternalId,
        threadExternalId:
          sendMessageInput.threadExternalId ?? messageExternalId,
        deliveredRecipients: {
          to: [recipient],
          cc: [],
          bcc: [],
        },
      };
    }

    // ── Text message ───────────────────────────────────────────────

    const textPayload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: false,
        body: sendMessageInput.body,
      },
    };

    if (isDefined(contextMessageId)) {
      textPayload.context = { message_id: contextMessageId };
    }

    this.logger.log(
      `Sending WhatsApp text message to ${recipient}`,
    );

    const response =
      await httpClient.post<MetaSendMessageResponse>(
        `${META_API_BASE_URL}/v22.0/${phoneNumberId}/messages`,
        textPayload,
        {
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
        },
      );

    const { data } = response;
    const sentMessage = data.messages?.[0];

    if (!isDefined(sentMessage)) {
      throw new Error(
        `WhatsApp API did not return a message ID: ${JSON.stringify(data)}`,
      );
    }

    const messageExternalId = `whatsapp:${sentMessage.id}`;

    return {
      headerMessageId: sentMessage.id,
      messageExternalId,
      threadExternalId:
        sendMessageInput.threadExternalId ?? messageExternalId,
      deliveredRecipients: {
        to: [recipient],
        cc: [],
        bcc: [],
      },
    };
  }

  async createDraft(): Promise<void> {
    throw new Error('WhatsApp does not support draft messages');
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private decryptConnectionParameters(
    connectedAccount: ConnectedAccountEntity,
  ) {
    const connectionParameters =
      connectedAccount.connectionParameters as EncryptedWhatsappConnectionParameters;

    const decrypted =
      this.connectedAccountTokenEncryptionService.decryptWhatsappConnectionParameters(
        {
          connectionParameters,
          workspaceId: connectedAccount.workspaceId,
        },
      );

    return {
      accessToken: decrypted.accessToken,
      phoneNumberId: decrypted.phoneNumberId,
    };
  }

  /**
   * Strips the "whatsapp:" prefix from inReplyTo since Meta expects the
   * raw wamid (e.g. "wamid.HBg...") in context.message_id.
   */
  private resolveContextMessageId(
    inReplyTo: string | undefined,
  ): string | undefined {
    if (!isDefined(inReplyTo)) {
      return undefined;
    }

    return inReplyTo.startsWith('whatsapp:')
      ? inReplyTo.slice('whatsapp:'.length)
      : inReplyTo;
  }

  /**
   * Uploads a media file to the WhatsApp Cloud API and returns the
   * media ID that can be referenced in a subsequent message send.
   *
   * Builds a multipart/form-data request manually to avoid dependency
   * on runtime-specific FormData/Blob implementations.
   */
  private async uploadMedia({
    httpClient,
    authHeaders,
    phoneNumberId,
    attachment,
    mediaType,
  }: {
    httpClient: ReturnType<SecureHttpClientService['getHttpClient']>;
    authHeaders: Record<string, string>;
    phoneNumberId: string;
    attachment: NonNullable<SendMessageInput['attachments']>[number];
    mediaType: WhatsappMediaType;
  }): Promise<string> {
    const boundary = `----WhatsappUpload${Date.now()}`;
    const filename = attachment.filename;
    const contentType = attachment.contentType;
    const content =
      attachment.content instanceof Buffer
        ? attachment.content
        : Buffer.from(attachment.content);

    // Build multipart body sections
    const parts: Buffer[] = [];
    const append = (str: string) =>
      parts.push(Buffer.from(str, 'utf-8'));

    append(`--${boundary}\r\n`);
    append(
      'Content-Disposition: form-data; name="messaging_product"\r\n\r\n',
    );
    append('whatsapp\r\n');

    append(`--${boundary}\r\n`);
    append(
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
    );
    append(`Content-Type: ${contentType}\r\n\r\n`);
    parts.push(content);
    append('\r\n');

    append(`--${boundary}\r\n`);
    append('Content-Disposition: form-data; name="type"\r\n\r\n');
    append(`${contentType}\r\n`);

    append(`--${boundary}--\r\n`);

    const body = Buffer.concat(parts);

    this.logger.log(
      `Uploading ${mediaType} media "${filename}" (${contentType}) to WhatsApp`,
    );

    const response = await httpClient.post<MetaUploadMediaResponse>(
      `${META_API_BASE_URL}/v22.0/${phoneNumberId}/media`,
      body,
      {
        headers: {
          ...authHeaders,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      },
    );

    const { data } = response;

    if (!isDefined(data.id)) {
      throw new Error(
        `WhatsApp media upload failed: ${JSON.stringify(data)}`,
      );
    }

    this.logger.log(`WhatsApp media uploaded: ${data.id}`);

    return data.id;
  }
}
