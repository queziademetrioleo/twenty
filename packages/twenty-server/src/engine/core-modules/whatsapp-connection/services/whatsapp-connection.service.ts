import { Injectable, Logger } from '@nestjs/common';

import { msg } from '@lingui/core/macro';
import axios from 'axios';
import { isNonEmptyString } from '@sniptt/guards';

import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { type WhatsappConnectionParametersInput } from 'src/engine/core-modules/whatsapp-connection/dtos/whatsapp-connection.input';
import { type PlaintextWhatsappConnectionParameters } from 'src/engine/core-modules/whatsapp-connection/types/whatsapp-connection.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const WHATSAPP_GRAPH_API_BASE_URL = 'https://graph.facebook.com/v19.0';

@Injectable()
export class WhatsappConnectionService {
  private readonly logger = new Logger(WhatsappConnectionService.name);

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  /**
   * Validates the WhatsApp connection parameters and tests them against the
   * Meta Graph API. Returns fully plaintext parameters (secrets branded as
   * PlaintextString) ready to be re-encrypted by the upsert service.
   *
   * On update, empty secret fields fall back to the previously decrypted
   * values so the user doesn't have to re-enter them.
   */
  async validateAndTestConnectionParameters({
    connectionParameters,
    existingConnectionParameters,
  }: {
    connectionParameters: WhatsappConnectionParametersInput;
    existingConnectionParameters: PlaintextWhatsappConnectionParameters | null;
  }): Promise<PlaintextWhatsappConnectionParameters> {
    if (!connectionParameters) {
      throw new UserInputError(
        'WhatsApp connection parameters are required',
        {
          userFriendlyMessage: msg`Please provide your WhatsApp Business credentials to connect.`,
        },
      );
    }

    const phoneNumberId = connectionParameters.phoneNumberId;
    const whatsappBusinessAccountId =
      connectionParameters.whatsappBusinessAccountId;
    const phoneNumber = connectionParameters.phoneNumber;

    if (
      !isNonEmptyString(phoneNumberId) ||
      !isNonEmptyString(whatsappBusinessAccountId) ||
      !isNonEmptyString(phoneNumber)
    ) {
      throw new UserInputError(
        'WhatsApp phone number ID, business account ID and phone number are required',
        {
          userFriendlyMessage: msg`Please provide the phone number ID, WhatsApp Business Account ID and phone number.`,
        },
      );
    }

    const accessToken = isNonEmptyString(connectionParameters.accessToken)
      ? connectionParameters.accessToken
      : (existingConnectionParameters?.accessToken ?? null);

    const verifyToken = isNonEmptyString(connectionParameters.verifyToken)
      ? connectionParameters.verifyToken
      : (existingConnectionParameters?.verifyToken ?? null);

    if (!isNonEmptyString(accessToken)) {
      throw new UserInputError(
        'WhatsApp access token is required — no existing token found',
        {
          userFriendlyMessage: msg`Please provide an access token for your WhatsApp Business account.`,
        },
      );
    }

    if (!isNonEmptyString(verifyToken)) {
      throw new UserInputError(
        'WhatsApp verify token is required — no existing token found',
        {
          userFriendlyMessage: msg`Please provide a verify token for your WhatsApp webhook.`,
        },
      );
    }

    await this.testConnection({
      accessToken,
      phoneNumberId,
    });

    return {
      accessToken: accessToken as PlaintextString,
      verifyToken: verifyToken as PlaintextString,
      phoneNumberId,
      whatsappBusinessAccountId,
      phoneNumber,
    };
  }

  private async testConnection({
    accessToken,
    phoneNumberId,
  }: {
    accessToken: string;
    phoneNumberId: string;
  }): Promise<void> {
    if (
      !this.twentyConfigService.get('IS_WHATSAPP_CONNECTION_TEST_ENABLED')
    ) {
      return;
    }

    try {
      await axios.get(`${WHATSAPP_GRAPH_API_BASE_URL}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      this.logger.error(
        `WhatsApp connection test failed: ${error?.message}`,
        error?.stack,
      );

      throw new UserInputError(
        `WhatsApp connection test failed: ${error?.message}`,
        {
          userFriendlyMessage: msg`We couldn't verify your WhatsApp credentials with Meta. Please check your access token and phone number ID.`,
        },
      );
    }
  }
}
