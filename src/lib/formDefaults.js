// Single source of truth for the form's shape. Values are kept as strings
// (they come from inputs); the calculation engine parses/validates on its side.

export const MULTIPLIER_OPTIONS = [
  { value: '3.375', label: '3.375% per year of service' },
  { value: '2.0', label: '2.0% per year of service' },
  { value: '2.5', label: '2.5% per year of service' },
  { value: '2.7', label: '2.7% per year of service' },
  { value: '3.0', label: '3.0% per year of service' },
  { value: 'other', label: 'Other — enter my multiplier' },
];

export const FAS_OPTIONS = [
  { value: 'high2', label: 'Highest 2 years (high-2)' },
  { value: 'high3', label: 'Highest 3 years (high-3)' },
  { value: 'high5', label: 'Highest 5 years (high-5)' },
];

// Pay-period multipliers to turn a per-period contribution into an annual one.
export const CONTRIB_FREQ = {
  biweekly: { label: 'Every 2 weeks', perYear: 26 },
  monthly: { label: 'Per month', perYear: 12 },
  annual: { label: 'Per year', perYear: 1 },
};

export const INITIAL_FORM = {
  // About you
  age: '',
  yearsOfService: '',
  salary: '',
  raisePct: '3',

  // Pension system
  multiplier: '3.375',
  customMultiplier: '',
  fasBasis: 'high2',
  // Separation is now OPTIONAL. Blank means "use each DROP track's natural end"
  // (entry + 8 for the plan track, entry + 10 for self-directed) so the review
  // compares the two side by side. Filled in, both tracks are evaluated at that
  // shared separation point instead.
  retireBy: 'age', // 'age' | 'years'
  retireAge: '',
  targetYears: '',

  // DROP — new entrants choose a track at entry (8-year plan vs 10-year
  // self-directed). dropEntryAge anchors the DROP timeline; sdEquityPct is the
  // self-directed track's stock allocation (the rest modeled as bonds).
  dropTrack: 'none', // 'none' | 'plan8' | 'self10'
  dropEntryAge: '',
  sdEquityPct: '70',

  // Deferred comp
  savingsBalance: '',
  contribAmount: '',
  contribFreq: 'biweekly', // 'biweekly' | 'monthly' | 'annual'

  // Social Security (optional — never guessed for the user)
  includeSS: 'no', // 'yes' | 'no'
  ssMonthly: '',
  ssClaimAge: '62',
};

// Required numeric fields per step, used for lightweight validation.
// Separation (retireAge/targetYears) is intentionally NOT required — leaving it
// blank is a valid, meaningful choice (compare both tracks at their natural
// ends). The engine's parseForm does the real cross-field validation.
export const STEP_REQUIREMENTS = {
  about: ['age', 'yearsOfService', 'salary'],
  pension: (form) => (form.multiplier === 'other' ? ['customMultiplier'] : []),
  drop: (form) => (form.dropTrack === 'none' ? [] : ['dropEntryAge']),
  savings: ['savingsBalance', 'contribAmount'],
  social: (form) => (form.includeSS === 'yes' ? ['ssMonthly', 'ssClaimAge'] : []),
  review: [],
};
