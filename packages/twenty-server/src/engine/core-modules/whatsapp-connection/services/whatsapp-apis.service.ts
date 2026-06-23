import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  ConnectedAccountProvider,
  MessageChannelType,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { EntityManager, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { CreateMessageChannelService } from 'src/engine/core-modules/auth/services/create-message-channel.service';
import { NotFoundError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { type PlaintextWhatsappConnectionParameters } from 'src/engine/core-modules/whatsapp-connection/types/whatsapp-connection.type';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountTokenEncryptionService } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { AccountsToReconnectService } from 'src/modules/connected-account/services/accounts-to-reconnect.service';

@Injectable()
export class WhatsappApisService {
  private readonly logger = new Logger(WhatsappApisService.name);

  constructor(
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectRepository(MessageChannelEntity)
    private readonly messageChannelRepository: Repository<MessageChannelEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly createMessageChannelService: CreateMessageChannelService,
    private readonly accountsToReconnectService: AccountsToReconnectService,
    private readonly connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionService,
  ) {}

  async upsertConnectedAccount(input: {
    handle: string;
    userWorkspaceId: string;
    workspaceId: string;
    // Caller (resolver) has already validated the input through
    // `WhatsappConnectionService.validateAndTestConnectionParameters`, which
    // produces plaintext secrets ready for re-encryption.
    connectionParameters: PlaintextWhatsappConnectionParameters;
    existingAccount?: ConnectedAccountEntity | null;
  }): Promise<string> {
    const { handle, workspaceId, userWorkspaceId } = input;

    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { id: userWorkspaceId, workspaceId },
    });

    if (!isDefined(userWorkspace)) {
      throw new NotFoundError(
        `UserWorkspace with id ${userWorkspaceId} not found in workspace ${workspaceId}`,
      );
    }

    const existingAccount =
      input.existingAccount ??
      (await this.connectedAccountRepository.findOne({
        where: { handle, userWorkspaceId, workspaceId },
      }));

    const newOrExistingAccountId = existingAccount?.id ?? v4();

    const existingMessageChannel = existingAccount
      ? await this.messageChannelRepository.findOne({
          where: { connectedAccountId: existingAccount.id, workspaceId },
        })
      : null;

    const shouldCreateMessageChannel = !isDefined(existingMessageChannel);

    await this.connectedAccountRepository.manager.transaction(
      async (transactionManager: EntityManager) => {
        const encryptedConnectionParameters =
          this.connectedAccountTokenEncryptionService.encryptWhatsappConnectionParameters(
            {
              connectionParameters: input.connectionParameters,
              workspaceId,
            },
          );

        // The `connectionParameters` JSONB column is shared with IMAP accounts
        // and typed as `EncryptedImapSmtpCaldavParams`. WhatsApp params are a
        // different shape but JSONB is schemaless and the column's CHECK
        // constraint only enforces encryption of IMAP/SMTP/CALDAV passwords
        // (absent keys evaluate to NULL → pass), so we cast at the boundary.
        await transactionManager.getRepository(ConnectedAccountEntity).save({
          id: newOrExistingAccountId,
          handle,
          provider: ConnectedAccountProvider.WHATSAPP,
          connectionParameters: encryptedConnectionParameters as unknown as ConnectedAccountEntity['connectionParameters'],
          userWorkspaceId,
          workspaceId,
          authFailedAt: null,
        });

        if (shouldCreateMessageChannel) {
          await this.createMessageChannelService.createMessageChannel({
            workspaceId,
            connectedAccountId: newOrExistingAccountId,
            handle,
            messageChannelType: MessageChannelType.WHATSAPP,
            transactionManager,
          });
        }
      },
    );

    if (isDefined(existingAccount)) {
      await this.accountsToReconnectService.removeAccountToReconnect(
        userWorkspace.userId,
        workspaceId,
        newOrExistingAccountId,
      );
    }

    return newOrExistingAccountId;
  }
}
