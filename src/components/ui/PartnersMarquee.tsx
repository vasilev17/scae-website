import LogoLoop, { type LogoItem } from '@/components/ui/LogoLoop';
import { useMediaQuery } from '@/lib/use-media-query';
import { PHONE_QUERY } from '@/lib/viewport';

// Inline px the loop measures itself against. The slot CSS in global.css
// carries the matching phone values.
const LOGO_HEIGHT = 76;
const LOGO_HEIGHT_PHONE = 52;
const GAP = 90;
const GAP_PHONE = 44;

export type PartnerLogo = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

type PartnersMarqueeProps = {
  ariaLabel: string;
  logos: PartnerLogo[];
};

/**
 * Partner logos. Lives on the void field under the Partners title.
 */
export function PartnersMarquee({ ariaLabel, logos }: PartnersMarqueeProps) {
  const phone = useMediaQuery(PHONE_QUERY);
  const items: LogoItem[] = logos.map((logo) => ({
    src: logo.src,
    alt: logo.alt,
    title: logo.alt,
    width: logo.width,
    height: logo.height,
  }));

  return (
    <section className="partners-marquee" aria-label={ariaLabel}>
      <div className="partners-marquee-track">
        <span
          className="partners-marquee-portal partners-marquee-portal--left"
          aria-hidden="true"
        />
        <span
          className="partners-marquee-portal partners-marquee-portal--right"
          aria-hidden="true"
        />
        <LogoLoop
          logos={items}
          speed={phone ? 40 : 60}
          direction="left"
          logoHeight={phone ? LOGO_HEIGHT_PHONE : LOGO_HEIGHT}
          gap={phone ? GAP_PHONE : GAP}
          hoverSpeed={0}
          scaleOnHover
          fadeOut
          fadeOutColor="var(--color-void)"
          ariaLabel={ariaLabel}
          renderItem={(item) => {
            if (!('src' in item)) return null;
            return (
              <span className="partners-marquee-slot">
                <img
                  src={item.src}
                  alt={item.alt ?? ''}
                  width={item.width}
                  height={item.height}
                  draggable={false}
                />
              </span>
            );
          }}
        />
      </div>
    </section>
  );
}
