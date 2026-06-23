import { Module } from '@nestjs/common';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { AddMessageMediaFieldCommand } from 'src/database/commands/upgrade-version-command/2-16/2-16-workspace-command-1782152097000-add-message-media-field.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [
    ApplicationModule,
    FieldMetadataModule,
    WorkspaceCacheModule,
    WorkspaceIteratorModule,
  ],
  providers: [AddMessageMediaFieldCommand],
})
export class V2_16_UpgradeVersionCommandModule {}
