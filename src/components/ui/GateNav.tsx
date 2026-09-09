import type { Ref } from 'react';

import { SpecularButton } from './SpecularButton';

type GateNavProps = {
  logoSrc: string;
  contactIconSrc: string;
  menuIconSrc: string;
  // Accessible name for the navigation landmark.
  label: string;
  brand: string;
  contactLabel: string;
  menuLabel: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onContact: () => void;
  // Lets the opener take focus back once the menu has closed.
  menuButtonRef?: Ref<HTMLButtonElement>;
};

/**
 * Navigation bar carried by the top gate pane. The menu control shuts the gate
 * and opens the navigation dial behind it. Contact jumps the page to the form.
 */
export function GateNav({
  logoSrc,
  contactIconSrc,
  menuIconSrc,
  label,
  brand,
  contactLabel,
  menuLabel,
  menuOpen,
  onMenuToggle,
  onContact,
  menuButtonRef,
}: GateNavProps) {
  return (
    <nav className="gate-nav" aria-label={label}>
      <SpecularButton className="gate-nav-button" onClick={onContact}>
        {contactLabel}
        <img src={contactIconSrc} alt="" className="gate-nav-button-dot" />
      </SpecularButton>

      <div className="gate-nav-brand">
        <img
          src={logoSrc}
          alt=""
          className="gate-nav-logo"
          fetchPriority="high"
        />
        <p className="gate-nav-title">{brand}</p>
        <div className="gate-nav-flag" aria-hidden="true">
          <span className="bg-flag-white"></span>
          <span className="bg-flag-green"></span>
          <span className="bg-flag-red"></span>
        </div>
      </div>

      <SpecularButton
        ref={menuButtonRef}
        className="gate-nav-button"
        aria-expanded={menuOpen}
        aria-controls="gate-menu"
        onClick={onMenuToggle}
      >
        {menuLabel}
        <img src={menuIconSrc} alt="" className="gate-nav-button-icon" />
      </SpecularButton>
    </nav>
  );
}
