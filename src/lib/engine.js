// ---------------------------------------------------------------------------
// Calculation engine — pure functions, no React, no DOM. Import and unit-test
// independently of the UI. All tunable assumptions come from assumptions.js
// and can be overridden per-call: calculate(form, { returnStdDev: 0, ... }).
//
// Time conventions (used consistently, and what the tests assume):
// - Everything steps in whole years. Year 0 is "now".
// - Salary in year t = currentSalary × (1 + raise)^t.
// - 457(b) contributions are deposited at END of year (ordinary annuity), so
//   with zero volatility the balance matches the textbook formula
//   FV = P(1+r)^n + C·[((1+r)^n − 1)/r].
// - DROP deposits land at START of each DROP year and the balance compounds
//   annually (compound, not simple, interest — most plans credit compound).
// ---------------------------------------------------------------------------

import { ASSUMPTIONS } from './assumptions.js';
import { CONTRIB_FREQ } from './formDefaults.js';
// New DROP entrants pick a track at entry: an 8-year plan-administered track
// (tiered simple interest) or a 10-year self-directed track (deposits invested
// in the market). Both models already exist, tested, in the In-DROP engine —
// we reuse its two calendar-free primitives rather than re-deriving the math.
// (Its date-based top-level functions aren't used here; a new entrant has no
// past entry date or statement to reconcile.)
import { accrueSimpleInterest, simulateSelfDirected } from './indropEngine.js';

// ---- Salary & pension (deterministic) -------------------------------------

export function salaryAt(currentSalary, raise, yearsFromNow) {
  return currentSalary * Math.pow(1 + raise, yearsFromNow);
}

// Average of the last `fasYears` full years of pay ending at the freeze date
// (retirement, or DROP entry if DROP is used). With a non-negative raise
// assumption those are automatically the highest-earning years. For freeze
// dates sooner than `fasYears` out this back-projects salary history with the
// same raise rate — i.e. we assume past raises looked like future ones.
export function finalAverageSalary({ currentSalary, raise, yearsUntilFreeze, fasYears }) {
  let sum = 0;
  for (let k = 1; k <= fasYears; k++) {
    sum += salaryAt(currentSalary, raise, yearsUntilFreeze - k);
  }
  return sum / fasYears;
}

// Standard DB formula: years of service × multiplier × final average salary.
// `multiplier` is a decimal (2.7%/yr → 0.027).
export function annualPension({ serviceYears, multiplier, fas }) {
  return serviceYears * multiplier * fas;
}

// DROP account: the frozen annual pension is deposited at the start of each
// DROP year and the balance earns `rate`.
//   compound (default): interest itself earns interest. Annuity-due closed
//     form P·[((1+r)^n − 1)/r]·(1+r); the loop matches it exactly.
//   simple: each deposit earns rate·(years it sits) but that interest never
//     compounds. Deposit made at the start of year k sits for (n−k+1) years,
//     so total interest = P·r·(n + (n−1) + … + 1) = P·r·n(n+1)/2.
// Plans differ on which they credit, so it's a user choice.
export function dropAccumulation({ annualPension, years, rate, compounding = 'compound' }) {
  if (compounding === 'simple') {
    const interest = annualPension * rate * ((years * (years + 1)) / 2);
    return annualPension * years + interest;
  }
  let balance = 0;
  for (let y = 0; y < years; y++) {
    balance = (balance + annualPension) * (1 + rate);
  }
  return balance;
}

// ---- Monte Carlo for the 457(b) --------------------------------------------

// Deterministic PRNG (mulberry32) so tests can seed the simulation.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  // Box-Muller; u1 guarded away from 0.
  const u1 = Math.max(rng(), 1e-12), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Simulates `numPaths` paths of the deferred-comp balance from now to
// retirement. Returns 10th/50th/90th percentile ending balances. With
// stdDev = 0 every path equals the compound-interest closed form (see tests).
export function simulateDeferredComp({
  startBalance,
  annualContribution,
  years,
  mean,
  stdDev,
  numPaths,
  rng = Math.random,
}) {
  const finals = new Float64Array(numPaths);
  for (let p = 0; p < numPaths; p++) {
    let bal = startBalance;
    for (let y = 0; y < years; y++) {
      const r = stdDev > 0 ? mean + stdDev * gaussian(rng) : mean;
      bal = bal * (1 + r) + annualContribution;
      if (bal < 0) bal = 0;
    }
    finals[p] = bal;
  }
  const sorted = Array.from(finals).sort((a, b) => a - b);
  const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { p10: pct(0.10), p50: pct(0.50), p90: pct(0.90) };
}

// ---- Form-state adapter -----------------------------------------------------

// Parses the UI's string-typed form state (see formDefaults.js) into numbers.
// Throws with a readable message on anything unusable or clearly impossible
// (typo territory), and collects soft `warnings` for values that compute fine
// but deserve a "verify this with your plan" flag on the results screen.
export function parseForm(form) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const need = (v, label) => {
    if (v == null || Number.isNaN(v)) throw new Error(`Missing or invalid: ${label}`);
    return v;
  };
  const check = (cond, msg) => { if (!cond) throw new Error(msg); };
  const warnings = [];

  const age = need(num(form.age), 'current age');
  check(age >= 16 && age <= 75, 'Current age should be between 16 and 75.');

  const serviceYears = need(num(form.yearsOfService), 'years of service');
  check(serviceYears >= 0 && serviceYears <= 50, 'Years of service should be between 0 and 50.');

  const salary = need(num(form.salary), 'current salary');
  check(salary > 0, 'Current salary must be above zero — the pension formula multiplies by it.');
  check(salary <= 2_000_000, 'That salary looks like a typo — double-check the amount.');

  const raise = (num(form.raisePct) ?? 0) / 100;
  check(raise >= 0 && raise <= 0.15,
    'Annual raises above 15% compound into nonsense over a career — double-check that field (2–4% is typical).');

  const multRaw = form.multiplier === 'other' ? num(form.customMultiplier) : num(form.multiplier);
  const multiplier = need(multRaw, 'pension multiplier') / 100;
  check(multiplier >= 0.005 && multiplier <= 0.06,
    `A multiplier of ${multRaw}%/yr isn't a real pension formula — enter it as percent per year of service, e.g. 2.7, not 27 or 0.027.`);
  if (multiplier > 0.035) {
    warnings.push(`A ${multRaw}% multiplier is richer than almost every municipal/state system (most top out near 3%) — verify it against your plan document.`);
  }
  const fasYears = { high2: 2, high3: 3, high5: 5 }[form.fasBasis] ?? 3;

  // Separation is optional. Blank (null) means "use each DROP track's natural
  // end" — only valid when a DROP track is chosen (below).
  const sepRaw = form.retireBy === 'age' ? form.retireAge : form.targetYears;
  const sepProvided = sepRaw !== '' && sepRaw != null;
  let separationYears = null;
  if (sepProvided) {
    separationYears = form.retireBy === 'age'
      ? need(num(form.retireAge), 'retirement age') - age
      : need(num(form.targetYears), 'years-of-service target') - serviceYears;
    check(separationYears >= 0,
      form.retireBy === 'age'
        ? 'Your planned retirement age is already behind you — set it to your current age to model retiring now.'
        : 'You already have more service than your target — set the target to your current years of service to model retiring now.');
    check(separationYears <= 50, 'Retirement is more than 50 years out — double-check the ages.');
  }

  const dropTrack = ['none', 'plan8', 'self10'].includes(form.dropTrack) ? form.dropTrack : 'none';
  let entryIn = null, sdEquity = null;
  if (dropTrack === 'none') {
    check(separationYears != null,
      'Enter a planned retirement age (or years-of-service target), or pick a DROP track — the calculator needs to know when you retire.');
  } else {
    entryIn = need(num(form.dropEntryAge), 'DROP entry age') - age;
    check(entryIn >= 0, 'DROP entry age is in the past — use your current age or later.');
    check(entryIn <= 40, 'That DROP entry age is decades out — double-check it.');
    sdEquity = (num(form.sdEquityPct) ?? ASSUMPTIONS.selfDirectedEquityDefault * 100) / 100;
    check(sdEquity >= 0 && sdEquity <= 1, 'Stock allocation must be between 0 and 100 percent.');
    if (sdEquity === 1) {
      warnings.push('100% stocks in the self-directed track means no bond cushion — not wrong, but aggressive for money on a fixed DROP clock. Make sure it matches your risk appetite.');
    }
    if (separationYears != null) {
      check(entryIn < separationYears, 'DROP entry must come before your separation date.');
      const sepDropYears = separationYears - entryIn;
      check(sepDropYears >= 1,
        'That leaves less than a year in DROP — set separation at least a year after DROP entry, or leave it blank to compare the full 8- and 10-year windows.');
    }
  }

  const contribAmount = need(num(form.contribAmount), '457(b) contribution');
  check(contribAmount >= 0, "A negative 457(b) contribution doesn't make sense — use 0 if you're not contributing.");
  const perYear = (CONTRIB_FREQ[form.contribFreq] ?? CONTRIB_FREQ.annual).perYear;
  const annualContribution = contribAmount * perYear;
  check(annualContribution <= 500_000, 'That contribution looks like a typo — double-check the amount and how often it goes in.');
  if (annualContribution > 48_000) {
    warnings.push(`$${Math.round(annualContribution).toLocaleString('en-US')}/yr is above the 457(b) contribution limit even with full catch-up (roughly $48k) — double-check the amount and whether it's per month or per year.`);
  }

  const startBalance = need(num(form.savingsBalance), '457(b) balance');
  check(startBalance >= 0, "The 457(b) balance can't be negative — use 0 if you haven't started.");
  check(startBalance <= 50_000_000, 'That balance looks like a typo — double-check the amount.');

  const socialSecurity = form.includeSS === 'yes'
    ? { monthly: need(num(form.ssMonthly), 'Social Security benefit'), claimAge: need(num(form.ssClaimAge), 'claiming age') }
    : null;
  if (socialSecurity) {
    check(socialSecurity.monthly >= 0 && socialSecurity.monthly <= 15_000,
      'That Social Security benefit looks like a typo — the SSA maximum is around $5k/mo.');
    if (socialSecurity.monthly > 5_200) warnings.push('That Social Security benefit is above the current SSA maximum — double-check your statement.');
    check(socialSecurity.claimAge >= 62 && socialSecurity.claimAge <= 70, 'Social Security claiming age must be between 62 and 70.');
  }

  return {
    age, serviceYears, salary, raise, multiplier, fasYears,
    separationYears, dropTrack, entryIn, sdEquity,
    startBalance, annualContribution, socialSecurity,
    warnings,
  };
}

// ---- DROP track balances ----------------------------------------------------

// 8-year plan track: tiered simple interest (years 1-5 fixed, years 6-8 a
// low/mid/high range), reusing the In-DROP engine's accrual primitive. Returns
// a { low, mid, high } balance range at `dropYears`.
function planTrackBalance({ monthlyPension, dropYears, A }) {
  const sched = (year6PlusRate) => (dropYear) =>
    dropYear <= 5 ? A.inDropYear1to5Rate : year6PlusRate;
  const r = A.inDropYear6to8Range;
  const at = (rate) => accrueSimpleInterest({ monthlyPension, years: dropYears, rateSchedule: sched(rate) });
  return { low: at(r.low), mid: at(r.mid), high: at(r.high) };
}

// 10-year self-directed track: DROP deposits invested in the market from day
// one at the member's chosen stock/bond mix, via the In-DROP engine's Monte
// Carlo. Returns { low, mid, high } = { p10, p50, p90 } at `dropYears`.
function selfDirectedTrackBalance({ annualPension, dropYears, equityWeight, A, rng, overrides }) {
  const mc = simulateSelfDirected({
    startingBalance: 0,
    yearsRemaining: dropYears,
    equityWeight,
    annualContribution: annualPension,
    numPaths: A.numPaths,
    rng,
  }, overrides);
  return { low: mc.p10, mid: mc.p50, high: mc.p90 };
}

// ---- Top-level --------------------------------------------------------------

// form: UI form state. overrides: any ASSUMPTIONS key, plus optional `rng`
// for a seeded simulation.
//
// Returns one of two shapes, keyed by `mode`:
//   'single'  — no DROP track. Same shape as before this feature: top-level
//               retirementAge/pension/deferredComp/income/etc. (drop is null).
//   'compare' — a DROP track was chosen. Both tracks are always computed so the
//               review can show "8 vs 10". `tracks.plan8` and `tracks.self10`
//               each carry a full result body; `dropTrackPick` marks the one
//               the member leaned toward.
export function calculate(form, overrides = {}) {
  const A = { ...ASSUMPTIONS, ...overrides };
  const i = parseForm(form);
  const rng = overrides.rng ?? Math.random;
  const usingDrop = i.dropTrack !== 'none';

  // Pension freezes at DROP entry when DROP is used (identical for both tracks
  // — same entry), else at separation. Shared across tracks.
  const freezeIn = usingDrop ? i.entryIn : i.separationYears;
  const fas = finalAverageSalary({
    currentSalary: i.salary, raise: i.raise, yearsUntilFreeze: freezeIn, fasYears: i.fasYears,
  });
  const serviceAtFreeze = i.serviceYears + freezeIn;
  const pensionAnnual = annualPension({ serviceYears: serviceAtFreeze, multiplier: i.multiplier, fas });
  const pensionMonthly = pensionAnnual / 12;
  const ssMonthly = i.socialSecurity ? i.socialSecurity.monthly : 0;
  const pension = {
    annual: pensionAnnual, monthly: pensionMonthly, finalAverageSalary: fas,
    serviceYears: serviceAtFreeze, multiplier: i.multiplier, frozenAtDropEntry: usingDrop,
  };
  const draw = (balance) => (balance * A.safeWithdrawalRate) / 12;

  // Builds a full result body for one horizon + optional DROP balance range.
  // The 457(b) sim and the today's-dollars deflator both key off
  // yearsToRetirement, so they legitimately differ between an 8- and 10-year
  // track (the longer one gets more contribution/growth years). DROP percentiles
  // pair pessimist-with-pessimist: 457(b) P10 with the DROP low, and so on.
  function body({ yearsToRetirement, dropBalanceRange, dropTrackId, dropYears, capNote }) {
    const mc = simulateDeferredComp({
      startBalance: i.startBalance, annualContribution: i.annualContribution,
      years: yearsToRetirement, mean: A.returnMean, stdDev: A.returnStdDev,
      numPaths: A.numPaths, rng,
    });
    const realFactor = 1 / Math.pow(1 + A.inflation, yearsToRetirement);
    const scenario = (balance, dropDraw) => {
      // "Guaranteed" = pension + Social Security only — both fixed numbers,
      // not market-dependent, so this is identical across all three
      // percentiles (unlike totalMonthly, which folds in the 457(b) draw and
      // so does vary). The UI headlines this instead of totalMonthly so a
      // pension holder's certain income isn't dressed up as a "median guess."
      const totalMonthlyGuaranteed = pensionMonthly + ssMonthly;
      const totalMonthly = totalMonthlyGuaranteed + draw(balance);
      const totalMonthlyWithDrop = totalMonthly + dropDraw;
      return {
        savingsBalance: balance,
        monthlyPension: pensionMonthly,
        monthlySavingsDraw: draw(balance),
        monthlySocialSecurity: ssMonthly,
        monthlyDropDraw: dropDraw,
        totalMonthlyGuaranteed,
        totalMonthlyGuaranteedReal: totalMonthlyGuaranteed * realFactor,
        totalMonthly,
        totalMonthlyReal: totalMonthly * realFactor,
        totalMonthlyWithDrop,
        totalMonthlyWithDropReal: totalMonthlyWithDrop * realFactor,
      };
    };
    const dd = dropBalanceRange
      ? { low: draw(dropBalanceRange.low), mid: draw(dropBalanceRange.mid), high: draw(dropBalanceRange.high) }
      : { low: 0, mid: 0, high: 0 };
    const drop = dropBalanceRange
      ? { trackId: dropTrackId, years: dropYears, balance: dropBalanceRange, monthlyDraw: dd, capNote: capNote ?? null }
      : null;
    return {
      retirementAge: i.age + yearsToRetirement,
      yearsToRetirement,
      publicSafetyPenaltyException:
        i.age + yearsToRetirement >= 50 || i.serviceYears + yearsToRetirement >= 25,
      pension,
      drop,
      deferredComp: mc,
      income: {
        conservative: scenario(mc.p10, dd.low),
        median: scenario(mc.p50, dd.mid),
        optimistic: scenario(mc.p90, dd.high),
      },
      socialSecurity: i.socialSecurity,
    };
  }

  const assumptions = {
    returnMean: A.returnMean, returnStdDev: A.returnStdDev, numPaths: A.numPaths,
    safeWithdrawalRate: A.safeWithdrawalRate, inflation: A.inflation,
  };

  // --- No DROP: single result, backward-compatible shape ---
  if (!usingDrop) {
    return {
      mode: 'single',
      inputs: i,
      warnings: i.warnings,
      assumptions,
      ...body({ yearsToRetirement: i.separationYears, dropBalanceRange: null }),
    };
  }

  // --- DROP: always compute both tracks so the review can compare 8 vs 10 ---
  // Each track runs for min(natural window, separation-limited window). The
  // 8-year plan track can't exist past year 8, so an explicit separation beyond
  // that caps it at year 8 with a note (the member would have to leave then).
  const trackYears = (naturalYears) => {
    if (i.separationYears == null) return { dropYears: naturalYears, capNote: null };
    const sepDropYears = i.separationYears - i.entryIn;
    if (sepDropYears > naturalYears) {
      const short = sepDropYears - naturalYears;
      return {
        dropYears: naturalYears,
        capNote: `This track ends at year ${naturalYears} — the separation date you entered is ${short} year${short > 1 ? 's' : ''} later, so choosing it means leaving at year ${naturalYears}.`,
      };
    }
    return { dropYears: sepDropYears, capNote: null };
  };

  const plan = trackYears(A.planTrackYears);
  const self = trackYears(A.selfDirectedTrackYears);

  const plan8 = body({
    yearsToRetirement: i.entryIn + plan.dropYears,
    dropBalanceRange: planTrackBalance({ monthlyPension: pensionMonthly, dropYears: plan.dropYears, A }),
    dropTrackId: 'plan8',
    dropYears: plan.dropYears,
    capNote: plan.capNote,
  });
  const self10 = body({
    yearsToRetirement: i.entryIn + self.dropYears,
    dropBalanceRange: selfDirectedTrackBalance({
      annualPension: pensionAnnual, dropYears: self.dropYears, equityWeight: i.sdEquity, A, rng, overrides,
    }),
    dropTrackId: 'self10',
    dropYears: self.dropYears,
    capNote: self.capNote,
  });

  return {
    mode: 'compare',
    inputs: i,
    warnings: i.warnings,
    assumptions,
    dropTrackPick: i.dropTrack, // 'plan8' | 'self10' — the one they leaned toward
    dropEntryAge: i.age + i.entryIn,
    sdEquityPct: Math.round(i.sdEquity * 100),
    tracks: { plan8, self10 },
  };
}
