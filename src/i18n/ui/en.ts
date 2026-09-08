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
  contact: {
    title: 'Contact',
    intro:
      'We would love to hear your ideas, applications, propositions, and opportunities',
    tabsLabel: 'Choose what you are writing about',
    tabs: {
      general: 'General',
      application: 'Application',
    },
    labels: {
      name: 'Name',
      email: 'E-mail',
      social: 'Contact / Social Media',
      message: 'Message',
      optional: '(Optional)',
      messageHint:
        'About you / Major / Experience / Interests / Personal or team projects',
      maxChars: 'Max 2000 characters',
      submit: 'Send',
      applyName: 'Full Name',
      applyEmail: 'Email Address',
      applyMessage: 'Why do you want to join?',
      applySubmit: 'Submit Application',
    },
    placeholders: {
      name: 'Ivan Petrov',
      email: 'ivan_petrov@gmail.com',
      social: 'LinkedIn: @ivan_petrov, GitHub: @ivan-petrov-gh',
      message: '...',
    },
    errors: {
      name: 'Please enter 3-70 characters',
      email: 'Please enter a valid email address',
      social: 'Please enter 3-150 characters or leave empty',
      messageShort: 'Please write at least 20 characters',
      messageLong: 'Message is too long (max 2000 chars)',
      generic: 'Something went wrong. Please try again.',
      alreadySubmitted: 'You have already submitted an application.',
    },
    success: {
      general: {
        title: 'Success',
        body: 'Thanks for reaching out, we will get back to you.',
      },
      application: {
        title: 'Success',
        body: 'Application received, we will contact you!',
      },
    },
    badge: {
      alt: 'SCAE member badge hanging from a lanyard',
    },
    socials: {
      title: 'Socials',
      label: 'SCAE on other platforms',
      linkedin: 'LinkedIn',
      instagram: 'Instagram',
      email: 'E-mail',
    },
  },
  gallery: {
    title: 'Gallery',
    headline: 'More from US',
    body: 'You can view moments from our research, development, testing and launch days.',
    cta: 'See gallery',
    close: 'Close gallery',
    logoAlt: 'SCAE emblem',
    alts: {
      workshop: 'SCAE workspace with a rocket model and simulation stations',
      exhibit: 'Commodore recovery and interior exhibit view',
      launch: 'Rocket climbing through cloud after liftoff',
      vehicle: 'Launch vehicle on the pad at dusk',
      orbit: 'Earth limb seen from orbit',
      earth: 'Planet Earth from space',
    },
  },
};

/** Shape every locale dictionary must satisfy. English is the source of truth. */
export type UiDictionary = typeof en;
