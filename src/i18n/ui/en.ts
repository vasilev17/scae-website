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
    headline:
      'A Bulgarian student-led initiative that brings applied engineering into our education',
    subtitle: "by launching the nation's first modern high-powered rockets.",
    seeMore: 'See more',
    outro: 'Ready for launch.',
    commodore: 'Commodore',
    ourWork: 'Our Work',
    sectionView: 'Section view',
    missionConcept: 'Mission & Concept',
    groundSegment: 'Ground Segment',
    exhibitFx: 'Interactive interior view of the Commodore rocket',
  },
};

/** Shape every locale dictionary must satisfy. English is the source of truth. */
export type UiDictionary = typeof en;
