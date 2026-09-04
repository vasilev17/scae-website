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
    holdChallengeTitle: 'Our technical challenge:',
    holdChallengeBody: 'Reach the Kármán line and execute propulsive landing',
    holdGoalTitle: 'Our goal:',
    holdGoalBody:
      'Solve real-life engineering problems to enhance our education',
    outro: 'Ready for launch.',
    commodore: 'Commodore',
    ourWork: 'Our Work',
    sectionView: 'Section view',
    missionConcept: 'Mission & Concept',
    groundSegment: 'Ground Segment',
    exhibitFx: 'Interactive interior view of the Commodore rocket',
    partners: 'Partners',
    partnersAria: 'Industry and academic partners',
    aboutClub: 'About the Club',
    aboutClubBody:
      'We are students from various schools and universities, pursuing specialization in diverse engineering fields, all united by the idea of getting better at what we love to do. We recognize the importance of practice, an interdisciplinary approach, and teamwork, so we have chosen to use one of the most complex fields, rocket science, as both a challenge and an opportunity for growth.',
    aboutClubPhotoAlt:
      'SCAE workspace with a rocket model and simulation stations',
    partnerAlts: {
      ansys: 'Ansys',
      dassault: 'Dassault Systèmes',
      fluidCodes: 'Fluid Codes',
      gdb: 'GDB',
      mator: 'Mator',
      mp: 'MP',
      tu: 'Technical University of Sofia',
    },
  },
};

/** Shape every locale dictionary must satisfy. English is the source of truth. */
export type UiDictionary = typeof en;
