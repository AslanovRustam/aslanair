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
} as const;
