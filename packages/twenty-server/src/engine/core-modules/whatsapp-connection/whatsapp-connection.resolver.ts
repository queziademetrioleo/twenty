import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';
import { ConnectedAccountProvider } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { ConnectedWhatsappAccountDTO } from 'src/engine/core-modules/whatsapp-connection/dtos/whatsapp-connected-account.dto';
import { WhatsappConnectionSuccessDTO } from 'src/engine/core-modules/whatsapp-connection/dtos/whatsapp-connection-success.dto';
import { WhatsappConnectionParametersInput } from 'src/engine/core-modules/whatsapp-connection/dtos/whatsapp-connection.input';
import { WhatsappConnectionService } from 'src/engine/core-modules/whatsapp-connection/services/whatsapp-connection.service';
import { type EncryptedWhatsappConnectionParameters } from 'src/engine/core-modules/whatsapp-connection/types/whatsapp-connection.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { ConnectedAccountMetadataService } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.service';
import { ConnectedAccountTokenEncryptionService } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';
import { WhatsappApisService } from 'src/engine/core-modules/whatsapp-connection/services/whatsapp-apis.service';

@MetadataResolver()
@UsePipes(ResolverValidationPipe)
@UseFilters(AuthGraphqlApiExceptionFilter, PermissionsGraphqlApiExceptionFilter)
export class WhatsappConnectionResolver {
  constructor(
    private readonly whatsappConnectionService: WhatsappConnectionService,
    private readonly whatsappApisService: WhatsappApisService,
    private readonly connectedAccountMetadataService: ConnectedAccountMetadataService,
    private readonly connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionService,
  ) {}

  @Query(() => ConnectedWhatsappAccountDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.CONNECTED_ACCOUNTS),
  )
  async getConnectedWhatsappAccount(
    @Args('id', { type: () => UUIDScalarType }) id: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<ConnectedWhatsappAccountDTO> {
    const connectedAccount =
      await this.connectedAccountMetadataService.findByIdAndUserWorkspaceId({
        id,
        userWorkspaceId,
        workspaceId: workspace.id,
      });

    if (
      !isDefined(connectedAccount) ||
      connectedAccount.provider !== ConnectedAccountProvider.WHATSAPP
    ) {
      throw new UserInputError('Connected account not found');
    }

    const decryptedParams = connectedAccount.connectionParameters
      ? this.connectedAccountTokenEncryptionService.decryptWhatsappConnectionParameters(
          {
            connectionParameters:
              connectedAccount.connectionParameters as unknown as EncryptedWhatsappConnectionParameters,
            workspaceId: workspace.id,
          },
        )
      : null;

    return {
      id: connectedAccount.id,
      handle: connectedAccount.handle,
      provider: connectedAccount.provider,
      userWorkspaceId: connectedAccount.userWorkspaceId,
      connectionParameters: decryptedParams
        ? {
            phoneNumberId: decryptedParams.phoneNumberId,
            whatsappBusinessAccountId:
              decryptedParams.whatsappBusinessAccountId,
            phoneNumber: decryptedParams.phoneNumber,
            verifyToken: decryptedParams.verifyToken,
            accessTokenIsSet: isDefined(decryptedParams.accessToken),
          }
        : null,
    };
  }

  @Mutation(() => WhatsappConnectionSuccessDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.CONNECTED_ACCOUNTS),
  )
  async saveWhatsappAccount(
    @Args('handle') handle: string,
    @Args('connectionParameters')
    connectionParameters: WhatsappConnectionParametersInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @Args('id', { type: () => UUIDScalarType, nullable: true }) id?: string,
  ): Promise<WhatsappConnectionSuccessDTO> {
    const existingAccount = isDefined(id)
      ? await this.connectedAccountMetadataService.findByIdAndUserWorkspaceId({
          id,
          userWorkspaceId,
          workspaceId: workspace.id,
        })
      : null;

    if (
      isDefined(id) &&
      (!existingAccount ||
        existingAccount.provider !== ConnectedAccountProvider.WHATSAPP)
    ) {
      throw new UserInputError('Connected account not found');
    }

    const decryptedExistingParams = existingAccount?.connectionParameters
      ? this.connectedAccountTokenEncryptionService.decryptWhatsappConnectionParameters(
          {
            connectionParameters:
              existingAccount.connectionParameters as unknown as EncryptedWhatsappConnectionParameters,
            workspaceId: workspace.id,
          },
        )
      : null;

    const validatedParams =
      await this.whatsappConnectionService.validateAndTestConnectionParameters({
        connectionParameters,
        existingConnectionParameters: decryptedExistingParams,
      });

    const connectedAccountId =
      await this.whatsappApisService.upsertConnectedAccount({
        handle,
        userWorkspaceId,
        workspaceId: workspace.id,
        connectionParameters: validatedParams,
        existingAccount,
      });

    return {
      success: true,
      connectedAccountId,
    };
  }
}
