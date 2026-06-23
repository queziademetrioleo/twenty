import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  type RawBodyRequest,
  Req,
  UseFilters,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';

import { type Request, type Response } from 'express';

import { MessagingWebhookApiExceptionFilter } from 'src/modules/messaging-webhooks/filters/messaging-webhook-api-exception.filter';
import { MessagingWebhookExceptionCode } from 'src/modules/messaging-webhooks/messaging-webhook-exception-code.enum';
import { MessagingWebhookException } from 'src/modules/messaging-webhooks/messaging-webhook.exception';
import { SesInboundWebhookRouterService } from 'src/modules/messaging-webhooks/services/ses-inbound-webhook-router.service';
import { SesOutboundWebhookRouterService } from 'src/modules/messaging-webhooks/services/ses-outbound-webhook-router.service';
import { WhatsappInboundWebhookHandlerService } from 'src/modules/messaging-webhooks/services/whatsapp-inbound-webhook-handler.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { isDefined } from 'twenty-shared/utils';

@Controller()
@UseFilters(MessagingWebhookApiExceptionFilter)
export class MessagingWebhooksController {
  constructor(
    private readonly sesInboundWebhookRouterService: SesInboundWebhookRouterService,
    private readonly sesOutboundWebhookRouterService: SesOutboundWebhookRouterService,
    private readonly whatsappInboundWebhookHandlerService: WhatsappInboundWebhookHandlerService,
  ) {}

  @Post(['webhooks/messaging/ses/inbound'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async handleSesInboundWebhook(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<void> {
    if (!isDefined(request.rawBody)) {
      throw new MessagingWebhookException(
        'Missing SNS payload',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_MISSING_REQUEST_BODY,
      );
    }

    await this.sesInboundWebhookRouterService.route(request.rawBody);
  }

  @Post(['webhooks/messaging/ses/outbound'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async handleSesOutboundWebhook(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<void> {
    if (!isDefined(request.rawBody)) {
      throw new MessagingWebhookException(
        'Missing SNS payload',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_MISSING_REQUEST_BODY,
      );
    }

    await this.sesOutboundWebhookRouterService.route(request.rawBody);
  }

  // ── WhatsApp Cloud API webhook ────────────────────────────────────

  @Get(['webhooks/messaging/whatsapp/inbound'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async handleWhatsappWebhookGet(
    @Query() query: { [key: string]: string },
    @Res() response: Response,
  ): Promise<void> {
    const challenge =
      await this.whatsappInboundWebhookHandlerService.handleGetHandshake(
        query,
      );

    response.status(HttpStatus.OK).send(challenge);
  }

  @Post(['webhooks/messaging/whatsapp/inbound'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  @HttpCode(200)
  async handleWhatsappWebhookPost(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signatureHeader: string,
  ): Promise<void> {
    const rawBody = request.rawBody;

    if (!isDefined(rawBody)) {
      throw new MessagingWebhookException(
        'Missing WhatsApp webhook payload body',
        MessagingWebhookExceptionCode.MESSAGING_WEBHOOK_MISSING_REQUEST_BODY,
      );
    }

    await this.whatsappInboundWebhookHandlerService.handleInboundWebhook(
      rawBody,
      signatureHeader ?? '',
    );
  }
}
