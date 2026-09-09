import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const gallery = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/gallery' }),
  schema: ({ image }) =>
    z.object({
      order: z.number().int().positive(),
      image: image(),
      alt: z.object({
        bg: z.string().min(1),
        en: z.string().min(1),
      }),
    }),
});

export const collections = { gallery };
