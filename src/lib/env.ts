import { z } from 'zod';

// Form credentials are optional so a clone without a .env still builds. The
// contact island degrades to a disabled notice when they are missing.
//
// Vite hands a declared-but-empty key through as `''`, and `.env.example`
// ships these blank, so a fresh clone would otherwise fail `min(1)`. Blank
// counts as absent.
const blankAsAbsent = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalText = z.preprocess(blankAsAbsent, z.string().min(1).optional());

const optionalUrl = z.preprocess(blankAsAbsent, z.url().optional());

const envSchema = z.object({
  PUBLIC_SITE_URL: optionalUrl,
  PUBLIC_FORMSPREE_CONTACT_ID: optionalText,
  PUBLIC_FORMSPREE_APPLICATION_ID: optionalText,
  PUBLIC_HCAPTCHA_SITEKEY: optionalText,
  PUBLIC_POSTHOG_KEY: optionalText,
  PUBLIC_POSTHOG_HOST: optionalUrl,
});

export const env = envSchema.parse(import.meta.env);
