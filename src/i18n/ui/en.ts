export const en = {
  site: {
    name: 'SCAE',
    description: 'Student Club Aerospace Engineering',
  },
  nav: {
    switchLanguage: 'Switch language',
    home: 'Home',
    label: 'Main',
    brand: 'Student Club Aerospace Engineering (SCAE) Bulgaria',
    contact: 'Contact Us',
    menu: 'Menu',
  },
  menu: {
    label: 'Site navigation',
    close: 'Close menu',
    items: {
      about: 'About Us',
      projects: 'Projects',
      team: 'Team',
      events: 'Events',
      join: 'Join Us',
      contact: 'Contact',
    },
  },
  home: {
    title: 'Ready for Dev',
    heading: 'Ready for Dev',
    tagline: 'The sky is where we start.',
    seeMore: 'See more',
    outro: 'Ready for launch.',
  },
};

/** Shape every locale dictionary must satisfy. English is the source of truth. */
export type UiDictionary = typeof en;
