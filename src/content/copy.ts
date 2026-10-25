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
    scroll: 'Scroll to board',
  },
  nav: {
    flight: 'Flight',
    destinations: 'Destinations',
    transfer: 'Transfer',
    cabin: 'Cabin',
    seat: 'Your seat',
    pass: 'Boarding pass',
    cta: 'Choose your seat',
    menu: 'Menu',
    close: 'Close',
    label: 'Sections',
  },
  /** The header's sound switch: it says what is on. */
  sound: { on: 'Sound on', off: 'Sound off' },
  rail: {
    label: 'Chapters',
    flight: 'Flight',
    destinations: 'Destinations',
    transfer: 'Transfer',
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
    flipHint: 'Drag or tap the pass to turn it over.',
    change: 'Change seat', // pinned
    takeOff: 'Take off',
  },
  destinations: {
    title: 'Where to tonight?',
    lead: 'Every AslanAir flight leaves Odesa after dark.',
    board: 'Departures',
    columns: { code: 'To', city: 'City', departs: 'Departs', fare: 'Fare' },
    card: 'Your flight',
    departs: (time: string) => `Departs ${time} from Odesa`,
    from: (usd: number) => `from $${usd}`,
    oneWay: 'one way, before your seat',
  },
  transfer: {
    title: 'How will you get to the airport?', // pinned
    lead: 'Times count back from your departure.',
    options: { home: 'From home', hotel: 'From your hotel', express: 'Airport express', own: 'On my own' },
    lines: {
      home: 'A car at your door, three hours before take-off.',
      hotel: 'We collect you from the lobby.',
      express: 'A reserved seat on the airport train.',
      own: 'Make your own way; check-in closes 40 minutes before.',
    },
    price: (usd: number) => (usd === 0 ? 'Free' : `$${usd}`),
    timeline: { pickup: 'Pick-up', airport: 'At the airport', own: 'On your own', checkin: 'Check-in closes', departs: 'Departs' },
    selected: 'Selected ✓',
    choose: 'Choose ↗',
  },
  ready: {
    title: 'Ready to choose your seat?',
    promise:
      'Tonight’s cabin has 180 seats, three by three. Walk the aisle, sit wherever you like and look out of its window before you decide.',
    scroll: 'Scroll to board',
  },
  takeOff: {
    title: 'Ready for take-off.',
    cue: 'Scroll to fly out',
  },
  boardingPass: {
    heading: 'Boarding pass',
    passenger: 'Passenger',
    flight: 'Flight',
    date: 'Date',
    seat: 'Seat',
    transfer: 'Transfer',
    departs: 'Departs',
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
    /** Under a field the visitor needs to put right: one short line each, in the room kept for it. */
    errors: {
      nameRequired: 'Please enter your name.',
      nameShort: 'At least two letters, please.',
      emailRequired: 'Please enter your e-mail.',
      emailInvalid: 'Check the e-mail, e.g. name@example.com',
    },
    thanks: 'Thank you! AslanAir is a concept, so nothing was sent — but that seat suits you.', // contains "concept" (pinned)
    restart: 'Start again', // pinned
    made: {
      lead: 'The airliner, the cabin and every seat are real-time 3D built from code; the night sky and clouds are drawn live in WebGL.',
    },
  },
  cabin: {
    /** Row label under the bins: the row number and that side's seat letters. */
    rowLabel: (row: number, side: -1 | 1) => `${row} ${side < 0 ? 'ABC' : 'DEF'}`,
    exitSign: 'EXIT',
    exitSignArrows: '← EXIT →',
    placard: ['FLIGHT DECK', 'CREW ONLY'],
  },
  author: { line: 'Concept & code: Aslanov Rustam', link: 'GitHub', href: 'https://github.com/AslanovRustam' },
  footer: {
    disclaimer: 'AslanAir is a fictional airline — a concept project.',
    /** The disclaimer on phones, where the footer also carries the author and the sky's credits. */
    disclaimerShort: 'A concept airline.',
    /**
     * Shown while the night sky is on screen: the panorama's credit and licence (CC BY 4.0 asks for both) and the
     * cloud deck's source.
     */
    sky: {
      line: 'Milky Way: ESO/S. Brunier, adapted',
      href: 'https://www.eso.org/public/images/eso0932a/',
      licence: 'CC BY 4.0',
      licenceHref: 'https://creativecommons.org/licenses/by/4.0/',
      clouds: 'Clouds: NASA',
    },
  },
} as const;
