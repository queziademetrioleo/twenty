import { type EncryptedString } from 'src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';

/**
 * Parameters required to connect a WhatsApp Business Cloud API account.
 *
 * `Secret` parameterizes the sensitive fields (`accessToken`, `verifyToken`)
 * so the same shape can describe both the at-rest encrypted form and the
 * in-flight plaintext form, mirroring the IMAP/SMTP/CalDAV connection params
 * pattern. Non-sensitive identifiers (phone number ID, WABA ID, phone number)
 * are stored as plain strings even at rest.
 */
export type WhatsappConnectionParameters<Secret extends string = string> = {
  accessToken: Secret;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  phoneNumber: string;
  verifyToken: Secret;
};

export type PlaintextWhatsappConnectionParameters =
  WhatsappConnectionParameters<PlaintextString>;

export type EncryptedWhatsappConnectionParameters =
  WhatsappConnectionParameters<EncryptedString>;
