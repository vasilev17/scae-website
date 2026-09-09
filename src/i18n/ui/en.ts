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
      home: 'Home',
      contact: 'Contacts',
      ourWork: 'Our Work',
      gallery: 'Gallery',
      about: 'About',
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
    missionModal: {
      close: 'Close mission and concept',
      missionTitle: 'Mission',
      missionBody:
        'Commodore must achieve an altitude of 100 meters and autonomously deploy a parachute on apogee, while recording all flight parameters such as position, speed, acceleration, and both software and hardware failures during the entire mission duration.',
      conceptTitle: 'Concept',
      conceptBody:
        'The purpose of building Commodore is to grasp the basics of flight dynamics. We aim to simulate the flight trajectory and precisely measure every event onboard for both model verification and forensics capabilities. All systems and processes developed for Commodore are going to be used as a foundation for future developments.',
    },
    groundSegment: 'Ground Segment',
    groundModal: {
      close: 'Close ground segment',
      body: 'A test stand for solid fuel rocket engines was developed to safely test and verify our engine models. It provides full protection against failures via constructive safety mechanisms and wireless operation capabilities. It can measure up to 200 N of thrust, and temperatures up to 1000°C on the external wall of an engine. The stand is designed with the capability to be extended with more sensors such as pressure and temperature ones.',
      launchBody:
        'A launching stand will reuse this architecture so pad operations stay remote, instrumented, and fail-safe as the vehicle moves from static fire to flight.',
      standAlt: 'SCAE ground-station launch dashboard with live thrust and temperature plots',
      padAlt: 'SCAE SFETI ground-station hardware with emergency stop and telemetry ports',
      expandPhoto: 'Open photo',
      closePhoto: 'Close photo',
    },
    exhibitFx: 'Interactive interior view of the Commodore rocket',
    sectionPoints: {
      close: 'Close callout',
      open: 'Open callout',
      fins: {
        title: 'Fins',
        body: 'The aerodynamic stabilizing surfaces are based on an established profile with linear properties. It has been thickened to ensure sufficient strength after being manufactured via 3D printing using ABS. Following the modification, a new CFD analysis was performed to determine its new aerodynamic characteristics.',
      },
      engine: {
        title: 'Engine',
        body: 'A relatively safe and technologically accessible fuel was selected for Commodore. The combustion chamber is made of aluminum and steel. For the design process, we developed software for semi-automated design, and production was handled entirely by club members.',
      },
      parachute: {
        title: 'Parachute Compartment',
        body: 'Due to the low expected apogee, a design featuring a single hexagonal parachute was chosen. It is made of ripstop nylon and reinforced threads.',
      },
      pyro: {
        title: 'Pyro',
        body: 'Upon reaching apogee, an electrical signal ignites a pyrotechnic charge and splits the rocket into two parts to deploy a parachute for a smooth landing. The design is engineered to ensure reliable deployment despite the rough tolerances of the manufacturing process.',
      },
      avionics: {
        title: 'Electronics Bay',
        body: 'The first generation of our electronics is designed to monitor all key parameters of the rocket. These include location, acceleration, engine and nose temperatures, the status of the electronics, and other critical parameters. It records the data on an SD card and transmits it via a telecommunications link. It consists of an onboard computer, a power supply, a GNSS module, and a data acquisition module.',
      },
      nose: {
        title: 'Nose',
        body: "The rocket's nose is designed based on the LD-HAACK profile, which has been modified for the low speeds predicted by our simulations. The new shape has undergone additional CFD analysis to determine its aerodynamic characteristics.",
      },
    },
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
      captchaCancelled: 'The captcha was closed. Please try again.',
      captchaFailed: 'The captcha could not be completed. Please try again.',
      alreadySubmitted: {
        general: 'You have already sent us a message.',
        application: 'You have already submitted an application.',
      },
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
  },
};

export type UiDictionary = typeof en;
