import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WhatsappConnectionResolver } from 'src/engine/core-modules/whatsapp-connection/whatsapp-connection.resolver';
import { WhatsappApisService } from 'src/engine/core-modules/whatsapp-connection/services/whatsapp-apis.service';
import { WhatsappConnectionService } from 'src/engine/core-modules/whatsapp-connection/services/whatsapp-connection.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { ConnectedAccountMetadataModule } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.module';
import { ConnectedAccountTokenEncryptionModule } from 'src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.module';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';
import { ConnectedAccountModule } from 'src/modules/connected-account/connected-account.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConnectedAccountEntity,
      MessageChannelEntity,
      UserWorkspaceEntity,
    ]),
    AuthModule,
    ConnectedAccountModule,
    ConnectedAccountMetadataModule,
    ConnectedAccountTokenEncryptionModule,
    TwentyORMModule,
    TwentyConfigModule,
    FeatureFlagModule,
    PermissionsModule,
    SecureHttpClientModule,
  ],
  providers: [
    WhatsappConnectionResolver,
    WhatsappConnectionService,
    WhatsappApisService,
  ],
  exports: [WhatsappConnectionService, WhatsappApisService],
})
export class WhatsappConnectionModule {}
