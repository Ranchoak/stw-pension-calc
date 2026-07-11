// Single source of truth for the in-DROP calculator's form shape. Values are
// kept as strings (they come from inputs); InDropApp parses on its side before
// calling indropEngine.js. This calculator is for members already in DROP —
// their monthly pension was fixed by the pension board at entry, so there is
// no accrual math here.

import { ASSUMPTIONS } from './assumptions.js';

// 0.045 → '4.5' without float dust (0.03 * 100 === 3.0000000000000004).
const asPct = (v) => String(Math.round(v * 1000) / 10);

export const INITIAL_FORM = {
  // Your DROP
  dropEntryDate: '',
  monthlyPensionAmount: '',
  knownCurrentBalance: '', // optional — from a recent statement, anchors the projection when present

  // Plan terms — years 1-5 are fixed at 6% simple; years 6+ credit a range
  // the board sets annually. Editable for users whose plan posts different
  // numbers; defaults come from assumptions.js so there is one source.
  lateRateLow: asPct(ASSUMPTIONS.inDropYear6to8Range.low),
  lateRateMid: asPct(ASSUMPTIONS.inDropYear6to8Range.mid),
  lateRateHigh: asPct(ASSUMPTIONS.inDropYear6to8Range.high),

  // Self-directed conversion
  selfDirected: 'no', // 'yes' | 'no'
  exitYear: '8',
  convertAtYear: '',
  convertPct: '100',
  equityPct: '70', // % stocks; the rest is modeled as bonds
};

// Required fields per step, used for lightweight validation.
export const STEP_REQUIREMENTS = {
  drop: ['dropEntryDate', 'monthlyPensionAmount'],
  terms: ['lateRateLow', 'lateRateMid', 'lateRateHigh'],
  selfdirected: (form) =>
    form.selfDirected === 'yes'
      ? ['exitYear', 'convertAtYear', 'convertPct', 'equityPct']
      : ['exitYear'],
  review: [],
};
