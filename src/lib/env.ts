import { z } from 'zod';

// Form credentials are optional so a clone without a .env still builds. The
// contact island degrades to a disabled notice when they are missing.
const envSchema = z.object({
  PUBLIC_SITE_URL: z.url().optional(),
  PUBLIC_FORMSPREE_CONTACT_ID: z.string().min(1).optional(),
  PUBLIC_FORMSPREE_APPLICATION_ID: z.string().min(1).optional(),
  PUBLIC_HCAPTCHA_SITEKEY: z.string().min(1).optional(),
  PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  PUBLIC_POSTHOG_HOST: z.url().optional(),
});

export const env = envSchema.parse(import.meta.env);
