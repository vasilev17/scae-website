import { ContactBadge } from '@/components/ui/ContactBadge';
import { ContactForm, type ContactCopy } from '@/components/ui/ContactForm';
import {
  ContactSocials,
  type SocialLink,
} from '@/components/ui/ContactSocials';
import { env } from '@/lib/env';

type ContactSectionProps = {
  copy: ContactCopy;
  locale: string;
  logoSrc: string;
  socialLinks: SocialLink[];
};

export function ContactSection({
  copy,
  locale,
  logoSrc,
  socialLinks,
}: ContactSectionProps) {
  return (
    <section
      className="contact"
      id="contact"
      aria-labelledby="contact-title"
    >
      <div className="contact-inner">
        <div className="contact-lead">
          <h2 className="contact-title" id="contact-title">
            <span>{copy.title}</span>
          </h2>
          <p className="contact-intro">{copy.intro}</p>
          <ContactForm
            copy={copy}
            locale={locale}
            formIds={{
              general: env.PUBLIC_FORMSPREE_CONTACT_ID,
              application: env.PUBLIC_FORMSPREE_APPLICATION_ID,
            }}
            captchaSiteKey={env.PUBLIC_HCAPTCHA_SITEKEY}
          />
        </div>
        <div className="contact-aside">
          <ContactBadge logoSrc={logoSrc} alt={copy.badge.alt} />
          <ContactSocials
            title={copy.socials.title}
            label={copy.socials.label}
            links={socialLinks}
          />
        </div>
      </div>
    </section>
  );
}
