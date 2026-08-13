type SeeMoreCueProps = {
  label: string;
  href: string;
};

export function SeeMoreCue({ label, href }: SeeMoreCueProps) {
  return (
    <a className="see-more" href={href}>
      <span className="see-more-label">
        <span>{label}</span>
      </span>
      <span className="see-more-track" aria-hidden="true" />
    </a>
  );
}
