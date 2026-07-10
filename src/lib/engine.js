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

  const yearsToRetirement = form.retireBy === 'age'
    ? need(num(form.retireAge), 'retirement age') - age
    : need(num(form.targetYears), 'years-of-service target') - serviceYears;
  check(yearsToRetirement >= 0,
    form.retireBy === 'age'
      ? 'Your planned retirement age is already behind you — set it to your current age to model retiring now.'
      : 'You already have more service than your target — set the target to your current years of service to model retiring now.');
  check(yearsToRetirement <= 50, 'Retirement is more than 50 years out — double-check the ages.');

  let drop = null;
  if (form.hasDrop === 'yes') {
    const entryIn = need(num(form.dropEntryAge), 'DROP entry age') - age;
    const rate = (num(form.dropRate) ?? ASSUMPTIONS.dropRateDefault * 100) / 100;
    check(entryIn >= 0, 'DROP entry age is in the past — use your current age or later.');
    check(entryIn < yearsToRetirement, 'DROP entry must come before retirement.');
    check(rate >= 0 && rate <= 0.15, 'DROP interest above 15% is not a real plan rate — double-check it.');
    if (rate > 0.09) warnings.push(`${(rate * 100).toFixed(1)}% DROP interest is above any plan we know of — verify it against your plan document.`);
    const compounding = form.dropCompounding === 'simple' ? 'simple' : 'compound';
    drop = { entryIn, rate, compounding };
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
    yearsToRetirement, drop, startBalance, annualContribution, socialSecurity,
    warnings,
  };
}

// ---- Top-level --------------------------------------------------------------

// form: UI form state. overrides: any ASSUMPTIONS key, plus optional `rng`
// for a seeded simulation.
export function calculate(form, overrides = {}) {
  const A = { ...ASSUMPTIONS, ...overrides };
  const i = parseForm(form);

  // Pension freezes at DROP entry when DROP is used, else at retirement.
  const freezeIn = i.drop ? i.drop.entryIn : i.yearsToRetirement;
  const fas = finalAverageSalary({
    currentSalary: i.salary,
    raise: i.raise,
    yearsUntilFreeze: freezeIn,
    fasYears: i.fasYears,
  });
  const serviceAtFreeze = i.serviceYears + freezeIn;
  const pensionAnnual = annualPension({ serviceYears: serviceAtFreeze, multiplier: i.multiplier, fas });

  const drop = i.drop
    ? {
        years: i.yearsToRetirement - i.drop.entryIn,
        rate: i.drop.rate,
        compounding: i.drop.compounding,
        balance: dropAccumulation({
          annualPension: pensionAnnual,
          years: i.yearsToRetirement - i.drop.entryIn,
          rate: i.drop.rate,
          compounding: i.drop.compounding,
        }),
      }
    : null;
  if (drop) drop.monthlyDraw = (drop.balance * A.safeWithdrawalRate) / 12;

  const mc = simulateDeferredComp({
    startBalance: i.startBalance,
    annualContribution: i.annualContribution,
    years: i.yearsToRetirement,
    mean: A.returnMean,
    stdDev: A.returnStdDev,
    numPaths: A.numPaths,
    rng: overrides.rng ?? Math.random,
  });

  const ssMonthly = i.socialSecurity ? i.socialSecurity.monthly : 0;
  // Deflator from retirement back to today's purchasing power. Applied to the
  // whole nominal monthly total; over a long horizon this is what a dollar of
  // that future income actually buys now. (Simplification: a Social Security
  // figure taken from an SSA statement is already in today's dollars, so for
  // SS-heavy cases the real number is a touch conservative — noted in the UI.)
  const realFactor = 1 / Math.pow(1 + A.inflation, i.yearsToRetirement);

  // A DROP payout is a lump sum, and people do different things with it (roll
  // it over, pay off a house, buy an annuity). So it is NOT folded into the
  // headline income; instead we surface what a safe-withdrawal draw on it
  // would add, as an explicit "if you also invest the DROP" line.
  const dropMonthlyDraw = drop ? (drop.balance * A.safeWithdrawalRate) / 12 : 0;

  const scenario = (balance) => {
    const totalMonthly = pensionAnnual / 12 + (balance * A.safeWithdrawalRate) / 12 + ssMonthly;
    const totalMonthlyWithDrop = totalMonthly + dropMonthlyDraw;
    return {
      savingsBalance: balance,
      monthlyPension: pensionAnnual / 12,
      monthlySavingsDraw: (balance * A.safeWithdrawalRate) / 12,
      monthlySocialSecurity: ssMonthly,
      monthlyDropDraw: dropMonthlyDraw,
      totalMonthly,
      totalMonthlyReal: totalMonthly * realFactor,
      totalMonthlyWithDrop,
      totalMonthlyWithDropReal: totalMonthlyWithDrop * realFactor,
    };
  };

  return {
    inputs: i,
    warnings: i.warnings,
    assumptions: {
      returnMean: A.returnMean,
      returnStdDev: A.returnStdDev,
      numPaths: A.numPaths,
      safeWithdrawalRate: A.safeWithdrawalRate,
      inflation: A.inflation,
    },
    retirementAge: i.age + i.yearsToRetirement,
    yearsToRetirement: i.yearsToRetirement,
    // Whether the 10% early-withdrawal penalty exception for qualified public
    // safety employees (IRC §72(t)(10)) is likely to apply at retirement:
    // separation at age 50+, or 25+ years of service, whichever comes first.
    // Informational only — the plan and a tax pro decide, not this calculator.
    publicSafetyPenaltyException:
      i.age + i.yearsToRetirement >= 50 || i.serviceYears + i.yearsToRetirement >= 25,
    pension: {
      annual: pensionAnnual,
      monthly: pensionAnnual / 12,
      finalAverageSalary: fas,
      serviceYears: serviceAtFreeze,
      multiplier: i.multiplier,
      frozenAtDropEntry: !!i.drop,
    },
    drop,
    deferredComp: mc,
    // Conservative / median / optimistic map to P10 / P50 / P90 ending
    // balances with the safe withdrawal rate applied — three scenarios,
    // never one falsely-precise number.
    income: {
      conservative: scenario(mc.p10),
      median: scenario(mc.p50),
      optimistic: scenario(mc.p90),
    },
    // If SS is included, it starts at the claiming age, which may be years
    // after retirement — the UI should label that gap.
    socialSecurity: i.socialSecurity,
  };
}
