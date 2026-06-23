import {
  ForbiddenException,
  Logger,
  UseFilters,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';

import { PermissionFlagType } from 'twenty-shared/constants';
import { ConnectedAccountProvider } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { ConnectedAccountMetadataService } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { SendEmailOutputDTO } from 'src/modules/messaging/message-outbound-manager/dtos/send-email-output.dto';
import { SendWhatsappMessageInput } from 'src/modules/messaging/message-outbound-manager/dtos/send-whatsapp-message.input';
import { MessagingMessageOutboundService } from 'src/modules/messaging/message-outbound-manager/services/messaging-message-outbound.service';
import { SentMessagePersistenceService } from 'src/modules/messaging/message-outbound-manager/services/sent-message-persistence.service';

@MetadataResolver()
@UsePipes(ResolverValidationPipe)
@UseFilters(AuthGraphqlApiExceptionFilter)
@UseGuards(
  WorkspaceAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.SEND_EMAIL_TOOL),
)
export class SendWhatsappMessageResolver {
  private readonly logger = new Logger(SendWhatsappMessageResolver.name);

  constructor(
    private readonly connectedAccountMetadataService: ConnectedAccountMetadataService,
    private readonly messagingMessageOutboundService: MessagingMessageOutboundService,
    private readonly sentMessagePersistenceService: SentMessagePersistenceService,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectRepository(MessageChannelEntity)
    private readonly messageChannelRepository: Repository<MessageChannelEntity>,
  ) {}

  @Mutation(() => SendEmailOutputDTO)
  async sendWhatsappMessage(
    @Args('input') input: SendWhatsappMessageInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<SendEmailOutputDTO> {
    try {
      await this.connectedAccountMetadataService.verifyOwnership({
        id: input.connectedAccountId,
        userWorkspaceId,
        workspaceId: workspace.id,
      });

      const connectedAccount =
        await this.connectedAccountRepository.findOneOrFail({
          where: {
            id: input.connectedAccountId,
            workspaceId: workspace.id,
          },
        });

      if (connectedAccount.provider !== ConnectedAccountProvider.WHATSAPP) {
        throw new ForbiddenException(
          'Connected account is not a WhatsApp account',
        );
      }

      const messageChannel =
        await this.messageChannelRepository.findOneOrFail({
          where: {
            connectedAccountId: connectedAccount.id,
            workspaceId: workspace.id,
          },
        });

      // Strip "whatsapp:" prefix from inReplyTo if present so the driver
      // receives the raw wamid for context.message_id.
      const inReplyTo = input.inReplyTo?.startsWith('whatsapp:')
        ? input.inReplyTo.slice('whatsapp:'.length)
        : input.inReplyTo;

      const sendResult =
        await this.messagingMessageOutboundService.sendMessage(
          {
            to: input.to,
            body: input.body,
            subject: '',
            html: '',
            inReplyTo,
          },
          connectedAccount,
        );

      await this.sentMessagePersistenceService.persistSentMessage({
        sendResult,
        subject: '',
        body: input.body,
        recipients: {
          to: [input.to],
          cc: [],
          bcc: [],
        },
        connectedAccount: {
          id: connectedAccount.id,
          handle: connectedAccount.handle,
        },
        messageChannelId: messageChannel.id,
        inReplyTo: input.inReplyTo,
        workspaceId: workspace.id,
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to send WhatsApp message: ${error}`);

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send WhatsApp message',
      };
    }
  }
}
