import { z } from 'zod';

import { HONEYPOT_FIELD } from '@/lib/submit-form';

export const CONTACT_TABS = ['general', 'application'] as const;

export type ContactTab = (typeof CONTACT_TABS)[number];

export const NAME_MIN = 3;
export const NAME_MAX = 70;
export const EMAIL_MIN = 6;
export const EMAIL_MAX = 254;
export const SOCIAL_MIN = 3;
export const SOCIAL_MAX = 150;
export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 2000;

/** Localized copy for every failure the schema can produce. */
export type ContactFieldErrors = {
  name: string;
  email: string;
  social: string;
  messageShort: string;
  messageLong: string;
};

/**
 * Both tabs post the same shape. The general tab never renders `social`, and
 * the schema leaves it unconstrained there, so the field simply stays empty.
 */
export type ContactValues = {
  name: string;
  email: string;
  social?: string;
  message: string;
  [HONEYPOT_FIELD]?: string;
};

export function contactSchema(tab: ContactTab, errors: ContactFieldErrors) {
  const social =
    tab === 'application'
      ? z
          .string()
          .trim()
          .min(SOCIAL_MIN, errors.social)
          .max(SOCIAL_MAX, errors.social)
          .optional()
          .or(z.literal(''))
      : z.string().optional();

  return z.object({
    name: z.string().trim().min(NAME_MIN, errors.name).max(NAME_MAX, errors.name),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(EMAIL_MIN, errors.email)
      .max(EMAIL_MAX, errors.email)
      .pipe(z.email(errors.email)),
    social,
    message: z
      .string()
      .trim()
      .min(MESSAGE_MIN, errors.messageShort)
      .max(MESSAGE_MAX, errors.messageLong),
    [HONEYPOT_FIELD]: z.string().optional(),
  });
}
