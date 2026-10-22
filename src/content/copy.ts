// Every user-facing string. Button labels marked "pinned" are asserted by the e2e tests.

export const copy = {
  brand: 'AslanAir',
  fallback: {
    noWebgl: 'This experience needs WebGL2. Please open it in a recent Chrome, Edge, Firefox or Safari.',
  },
  chapters: {
    sky: { title: 'Above the clouds, a seat is waiting for you.', body: 'Scroll to board flight ASLAN 270.' },
    door: { title: 'Welcome aboard.', body: 'Step in — the cabin is yours to explore.' },
    aisle: { title: 'Find your seat.', body: 'Hover a seat to see it, click to sit down.' },
  },
  aisle: {
    hint: 'Choose a seat to continue',
    pickForMe: 'Pick for me', // pinned
  },
  seated: {
    choose: 'Choose this seat', // pinned
    another: 'See another', // pinned
  },
  pass: {
    title: 'Your boarding pass.',
    flipHint: 'Click the pass to turn it over.',
    change: 'Change seat', // pinned
    scrollHint: 'Scroll to take off',
  },
  boardingPass: {
    heading: 'Boarding pass',
    passenger: 'Passenger',
    flight: 'Flight',
    date: 'Date',
    seat: 'Seat',
    gate: 'Gate',
    zone: 'Zone',
    boarding: 'Boarding',
    backNote: 'AslanAir is a fictional airline — a concept project.',
  },
  outro: {
    title: 'Have a nice flight.',
    lead: 'Leave your details and we will hold this seat for you.',
    name: 'Name', // pinned
    email: 'E-mail', // pinned
    comment: 'Comment', // pinned
    buy: 'Buy', // pinned
    thanks: 'Thank you! AslanAir is a concept, so nothing was sent — but that seat suits you.', // contains "concept" (pinned)
    restart: 'Start again', // pinned
    howItsMade: {
      title: "How it's made",
      items: [
        'Next.js, React Three Fiber, GSAP ScrollTrigger and Lenis.',
        'The airliner is built from code — a Python script drives Blender.',
        'Clouds are raymarched in a shader, live, every frame.',
        'Every seat is a real 3D object you can pick.',
      ],
      author: 'Concept & code: [Author name] · [Portfolio link]',
    },
  },
  cabin: {
    /** Row label under the bins: the row number and that side's seat letters. */
    rowLabel: (row: number, side: -1 | 1) => `${row} ${side < 0 ? 'ABC' : 'DEF'}`,
  },
  footer: {
    disclaimer: 'AslanAir is a fictional airline — a concept project.',
  },
} as const;
