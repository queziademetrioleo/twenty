/**
 * Types for Meta Cloud API webhook payloads sent to the WhatsApp Business
 * Account webhook endpoint.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

// ── Top-level structure ────────────────────────────────────────────

export type WhatsappWebhookPayload = {
  object: 'whatsapp_business_account';
  entry: WhatsappWebhookEntry[];
};

export type WhatsappWebhookEntry = {
  id: string;
  changes: WhatsappWebhookChange[];
};

export type WhatsappWebhookChange = {
  field: 'messages';
  value:
    | WhatsappWebhookMessageValue
    | WhatsappWebhookStatusValue
    | WhatsappWebhookUnknownValue;
};

// ── Message value (inbound messages) ────────────────────────────────

export type WhatsappWebhookMessageValue = {
  messaging_product: 'whatsapp';
  metadata: WhatsappWebhookMetadata;
  contacts: WhatsappWebhookContact[];
  messages: WhatsappWebhookMessage[];
};

export type WhatsappWebhookMetadata = {
  display_phone_number: string;
  phone_number_id: string;
};

export type WhatsappWebhookContact = {
  wa_id: string;
  profile: {
    name: string;
  };
};

// ── Individual inbound message variants ─────────────────────────────

export type WhatsappWebhookMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsappWebhookMessageType;
  context?: WhatsappWebhookContext;
  // Only one of the following is present, discriminated by `type`:
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; sha256: string };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename: string;
    caption?: string;
  };
  sticker?: { id: string; mime_type: string; sha256: string };
  button?: { payload: string | null; text: string };
  interactive?: object;
};

export type WhatsappWebhookMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'button'
  | 'interactive';

export type WhatsappWebhookContext = {
  from: string;
  id: string;
};

// ── Status value (delivery receipts) ────────────────────────────────

export type WhatsappWebhookStatusValue = {
  messaging_product: 'whatsapp';
  metadata: WhatsappWebhookMetadata;
  statuses: WhatsappWebhookStatus[];
};

export type WhatsappWebhookStatus = {
  id: string;
  status: 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: { type: string };
  };
  pricing?: {
    category: string;
    pricing_model: string;
    billable: boolean;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
};

// ── Fallback for unexpected value shapes ────────────────────────────

export type WhatsappWebhookUnknownValue = {
  messaging_product?: string;
};
