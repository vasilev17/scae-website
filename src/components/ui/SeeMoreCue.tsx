import type { MouseEvent } from 'react';

type SeeMoreCueProps = {
  label: string;
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function SeeMoreCue({ label, href, onClick }: SeeMoreCueProps) {
  return (
    <a
      className="see-more"
      href={href}
      data-lenis-prevent
      onClick={onClick}
    >
      <span className="see-more-label">
        <span>{label}</span>
      </span>
      <span className="see-more-track" aria-hidden="true" />
    </a>
  );
}
