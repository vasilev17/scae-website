import { getCollection } from 'astro:content';

import type { GalleryImage } from '@/components/sections/GallerySection';
import type { Locale } from '@/i18n/config';

/** Build-time gallery rows. Same shape the gallery island already consumes. */
export async function loadGalleryImages(locale: Locale): Promise<GalleryImage[]> {
  const entries = await getCollection('gallery');
  return entries
    .toSorted((left, right) => left.data.order - right.data.order)
    .map((entry) => ({
      src: entry.data.image.src,
      alt: entry.data.alt[locale],
      width: entry.data.image.width,
      height: entry.data.image.height,
    }));
}
