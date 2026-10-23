// Every user-facing string. Button labels marked "pinned" are asserted by the e2e tests.

export const copy = {
  brand: 'AslanAir',
  fallback: {
    noWebgl: 'This experience needs WebGL2. Please open it in a recent Chrome, Edge, Firefox or Safari.',
  },
  loader: {
    label: 'Preparing your night flight',
  },
  chapters: {
    door: { title: 'Welcome aboard.', body: 'Step in — the cabin is yours to explore.' },
    aisle: { title: 'Find your seat.', body: 'Hover a seat to see it, click to sit down.' },
  },
  hero: {
    title: 'Night flight',
    notes: {
      route: { label: 'Tonight', value: 'IST → LIS · 22:40' },
      cabin: { label: 'Cabin', value: '180 seats · 3+3' },
      price: { label: 'Seats from', value: (usd: number) => `$${usd}` },
    },
    lead: {
      title: 'Board a fictional night flight.',
      body: 'Walk the aisle in real-time 3D, pick the seat you like and see your own window view.',
    },
    scroll: 'Scroll to board',
  },
  nav: {
    flight: 'Flight',
    cabin: 'Cabin',
    seat: 'Your seat',
    pass: 'Boarding pass',
    made: "How it's made",
    cta: 'Choose your seat',
    menu: 'Menu',
    close: 'Close',
    label: 'Sections',
  },
  rail: {
    label: 'Chapters',
    flight: 'Flight',
    boarding: 'Boarding',
    cabin: 'Cabin',
    seat: 'Your seat',
    takeoff: 'Take-off',
  },
  aisle: {
    hint: 'Choose a seat to continue',
    pickForMe: 'Pick for me', // pinned
  },
  seatCard: {
    kinds: { window: 'Window seat', middle: 'Middle seat', aisle: 'Aisle seat' },
    extra: 'Extra legroom',
    click: 'Click to sit',
    tap: 'Tap again to sit',
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
    made: {
      lead: 'The airliner, the cabin and every seat are real-time 3D built from code; the clouds are raymarched live in your browser.',
      open: "Read how it's made",
    },
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
    exitSign: 'EXIT',
    exitSignArrows: '← EXIT →',
  },
  footer: {
    disclaimer: 'AslanAir is a fictional airline — a concept project.',
  },
} as const;
