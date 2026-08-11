import { z } from 'zod';

const envSchema = z.object({
  PUBLIC_SITE_URL: z.url().optional(),
});

export const env = envSchema.parse(import.meta.env);
