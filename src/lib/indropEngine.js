// ---------------------------------------------------------------------------
// In-DROP calculation engine — pure functions, no React, no DOM. For members
// ALREADY in DROP: their monthly pension was fixed by the pension board at
// entry, so there is no accrual math here, only balance projection. Tunables
// live in assumptions.js and can be overridden per-call.
//
// Time conventions (used consistently, and what the tests assume):
// - Time is measured in years since DROP entry. DROP year 1 is [0, 1).
// - The monthly pension is deposited at the END of each month from entry — a
//   month must be completed before its credit exists, so the day-one balance
//   is $0 and month 12's deposit lands exactly on the first anniversary.
// - Interest is SIMPLE: each DROP year's annual rate applies pro-rata to the
//   principal on deposit during that year, and interest never earns interest.
//   Equivalently, each deposit earns each year's rate for the time it sits in
//   that year — deposits made earlier in a year earn more than later ones.
// - A user-stated statement balance becomes interest-earning principal for
//   the remaining years. It includes past interest, which pure simple
//   interest wouldn't credit on, but it's the plan's official figure and the
//   anchor the user asked us to trust.
// ---------------------------------------------------------------------------

import { ASSUMPTIONS } from './assumptions.js';
import { simulateDeferredComp } from './engine.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Guards float comparisons around month boundaries (m/12 is not exact).
const EPS = 1e-9;

// Accepts 'YYYY-MM-DD' strings (what <input type="date"> produces) or Date
// objects; normalizes to UTC midnight so day math never crosses DST.
function toUTCDay(value) {
  const date = value instanceof Date
    ? value
    : new Date(String(value).includes('T') ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Unusable date: ${value}`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addYearsUTC(date, n) {
  // A Feb 29 anniversary rolls to Mar 1 in non-leap years, matching how most
  // plans treat it.
  return new Date(Date.UTC(date.getUTCFullYear() + n, date.getUTCMonth(), date.getUTCDate()));
}

// Time in DROP between entry and "as of" (default: today).
//   years           whole anniversaries passed
//   days            days since the last anniversary
//   fractionalYears years + days scaled by the length of the current
//                   anniversary year, so exact anniversaries land on whole
//                   numbers even across leap years
export function elapsedDropTime(entryDate, asOfDate = new Date()) {
  const entry = toUTCDay(entryDate);
  const asOf = toUTCDay(asOfDate);
  if (asOf < entry) throw new Error('The "as of" date is before the DROP entry date.');

  let years = asOf.getUTCFullYear() - entry.getUTCFullYear();
  if (addYearsUTC(entry, years) > asOf) years -= 1;
  const anniversary = addYearsUTC(entry, years);
  const days = Math.round((asOf - anniversary) / MS_PER_DAY);
  const yearLength = Math.round((addYearsUTC(entry, years + 1) - anniversary) / MS_PER_DAY);
  return { years, days, fractionalYears: years + days / yearLength };
}

// Core accrual over the window [from, to] (both in years since entry), on top
// of an optional starting balance. Deposits stay aligned to the entry date's
// month grid, so an anchored projection that starts mid-month picks up the
// real deposit schedule, not a shifted one. Walks month by month: within one
// month the principal and the DROP-year rate are both constant, so each
// month's simple interest is principal × rate × duration.
function accrueWindow({ monthlyPension, from, to, rateForYear, startingBalance = 0 }) {
  if (to <= from + EPS) return startingBalance;
  const monthsBefore = Math.floor(from * 12 + EPS); // deposits already made at `from`
  const lastMonth = Math.ceil(to * 12 - EPS);
  let deposits = 0;
  let interest = 0;
  for (let m = monthsBefore + 1; m <= lastMonth; m++) {
    const segStart = Math.max((m - 1) / 12, from);
    const segEnd = Math.min(m / 12, to);
    if (segEnd - segStart <= 0) continue;
    const dropYear = Math.floor((m - 1) / 12) + 1;
    const principal = startingBalance + monthlyPension * Math.max(0, m - 1 - monthsBefore);
    interest += principal * rateForYear(dropYear) * (segEnd - segStart);
    // The month's deposit lands at its end; it counts if the window reaches it.
    if (segEnd >= m / 12 - EPS) deposits += monthlyPension;
  }
  return startingBalance + deposits + interest;
}

// DROP balance after `years` (fractional allowed) of monthly deposits under
// simple interest. `rateSchedule` is a function (dropYear: 1-based integer) →
// annual rate, so callers control the year 1-5 / year 6+ tiers.
export function accrueSimpleInterest({ monthlyPension, years, rateSchedule }) {
  return accrueWindow({ monthlyPension, from: 0, to: years, rateForYear: rateSchedule });
}

// Main entry point for the baseline (non-self-directed) path. Projects the
// DROP balance at exit under the plan's rate tiers, run three times with the
// year-6+ range's low/mid/high — a range, never one falsely-precise number.
//
// exitYear: whole DROP years from entry (2-8) when they leave.
// knownCurrentBalance: optional statement balance as of `asOfDate`. When
// present it anchors the projection — we grow THEIR number for the remaining
// years rather than our recomputed one — and if it diverges from our mid-case
// estimate by more than the tolerance, `balanceMismatch` is set so the UI can
// say "your statement says X, our estimate says Y — we're using your
// statement". Below tolerance the statement is used quietly (rounding and
// deposit-timing noise is expected).
export function projectBalanceRange(
  { monthlyPension, entryDate, asOfDate, exitYear, knownCurrentBalance = null },
  overrides = {},
) {
  const A = { ...ASSUMPTIONS, ...overrides };
  if (!(monthlyPension > 0)) throw new Error('Monthly pension must be above zero.');
  if (!Number.isInteger(exitYear) || exitYear < 2 || exitYear > 8) {
    throw new Error('Exit year must be a whole number of DROP years between 2 and 8.');
  }
  const elapsed = elapsedDropTime(entryDate, asOfDate);
  if (elapsed.fractionalYears > exitYear + EPS) {
    throw new Error('That exit year is already behind you — pick a year you have not reached yet.');
  }

  const rateFn = (year6PlusRate) => (dropYear) =>
    dropYear <= 5 ? A.inDropYear1to5Rate : year6PlusRate;
  const range = A.inDropYear6to8Range;

  if (knownCurrentBalance == null) {
    const project = (r) =>
      accrueWindow({ monthlyPension, from: 0, to: exitYear, rateForYear: rateFn(r) });
    return {
      low: project(range.low),
      mid: project(range.mid),
      high: project(range.high),
      balanceMismatch: false,
    };
  }

  if (!(knownCurrentBalance >= 0)) throw new Error('The current DROP balance cannot be negative.');
  const computedBalance = accrueWindow({
    monthlyPension, from: 0, to: elapsed.fractionalYears, rateForYear: rateFn(range.mid),
  });
  // Day-one (or near-zero) computed balance: any stated balance is either
  // trivially consistent ($0) or unexplainable by deposits, so flag it.
  const divergence = computedBalance > 0
    ? Math.abs(knownCurrentBalance - computedBalance) / computedBalance
    : (knownCurrentBalance > 0 ? Infinity : 0);
  const project = (r) => accrueWindow({
    monthlyPension,
    from: elapsed.fractionalYears,
    to: exitYear,
    rateForYear: rateFn(r),
    startingBalance: knownCurrentBalance,
  });
  return {
    low: project(range.low),
    mid: project(range.mid),
    high: project(range.high),
    balanceMismatch: divergence > A.inDropBalanceMismatchTolerance,
    statedBalance: knownCurrentBalance,
    computedBalance,
  };
}

// ---- Self-directed option ---------------------------------------------------

// Blends the equity/bond building blocks from assumptions.js into one
// { mean, stdDev } for a given equity weight (0-1). The stdDev blend is
// linear, which ignores stock/bond correlation (true diversification would
// pull it lower) — a known simplification in the same spirit as the main
// calculator's flat 6.5%/13% approximation.
export function portfolioAssumptions(equityWeight, overrides = {}) {
  const A = { ...ASSUMPTIONS, ...overrides };
  if (!(equityWeight >= 0 && equityWeight <= 1)) {
    throw new Error('Equity weight must be between 0 and 1 — e.g. 0.7 for a 70/30 stock/bond mix.');
  }
  return {
    mean: equityWeight * A.equityReturn.mean + (1 - equityWeight) * A.bondReturn.mean,
    stdDev: equityWeight * A.equityReturn.stdDev + (1 - equityWeight) * A.bondReturn.stdDev,
  };
}

// Monte Carlo for the converted slice: compounds startingBalance annually for
// yearsRemaining at returns sampled from the blended allocation, plus an
// optional ongoing annual contribution — once conversion happens, new
// pension deposits are redirected here, not to the plan track. Reuses
// engine.js's simulateDeferredComp (same mulberry32 + gaussian machinery).
// Returns { p10, p50, p90 } like the rest of the app's Monte Carlo.
export function simulateSelfDirected(
  {
    startingBalance, yearsRemaining, equityWeight, annualContribution = 0,
    numPaths = ASSUMPTIONS.numPaths, rng = Math.random,
  },
  overrides = {},
) {
  const { mean, stdDev } = portfolioAssumptions(equityWeight, overrides);
  return simulateDeferredComp({
    startBalance: startingBalance,
    annualContribution,
    years: yearsRemaining,
    mean,
    stdDev,
    numPaths,
    rng,
  });
}

// The full picture: baseline simple-interest accrual up to convertAtYear,
// then convertPct% of that balance moves to the self-directed Monte Carlo
// track. Converting redirects the account going forward — every pension
// deposit from convertAtYear on lands in the self-directed track too, not
// the plan track. Only the portion of the balance-at-conversion you chose to
// leave behind (100 − convertPct%) stays on the plan's simple-interest
// schedule, and it receives no further deposits of its own. Converting
// unlocks exit years up to 10; without converting DROP still ends at year 8.
//
// Deliberate simplifications, both surfaced in the return value:
// - The balance at conversion uses the MID plan rate for any pre-conversion
//   years past 5; the low/high plan range applies to the leftover plan
//   balance from conversion onward (including years 9-10, an assumption —
//   see assumptions.js).
// - With convertPct 0 nothing converts and the result delegates to
//   projectBalanceRange, matching it exactly (deposits continue on the plan
//   track for the whole window, as if no conversion happened).
// Combined percentile pairing is pessimist-with-pessimist: low = MC P10 +
// plan-low remainder, high = P90 + plan-high — a range, not a promise.
export function projectWithConversion(
  {
    monthlyPension, entryDate, asOfDate, exitYear, knownCurrentBalance = null,
    convertAtYear, convertPct, equityWeight,
  },
  overrides = {},
) {
  const A = { ...ASSUMPTIONS, ...overrides };
  const check = (cond, msg) => { if (!cond) throw new Error(msg); };
  check(convertPct >= 0 && convertPct <= 100, 'Conversion percentage must be between 0 and 100.');

  if (convertPct === 0) {
    check(Number.isInteger(exitYear) && exitYear <= 8,
      'Without converting, DROP ends at year 8 — the 10-year window only opens with the self-directed option.');
    const baseline = projectBalanceRange(
      { monthlyPension, entryDate, asOfDate, exitYear, knownCurrentBalance }, overrides,
    );
    return {
      ...baseline,
      selfDirectedRange: { low: 0, mid: 0, high: 0 },
      remainderBalance: { low: baseline.low, mid: baseline.mid, high: baseline.high },
      balanceAtConversion: null,
    };
  }

  check(monthlyPension > 0, 'Monthly pension must be above zero.');
  check(equityWeight >= 0 && equityWeight <= 1,
    'Equity weight must be between 0 and 1 — e.g. 0.7 for a 70/30 stock/bond mix.');
  check(Number.isInteger(convertAtYear) && convertAtYear >= 1 && convertAtYear <= 8,
    'Conversion happens at a whole DROP year between 1 and 8 — it must be elected inside the 8-year DROP window.');
  const elapsed = elapsedDropTime(entryDate, asOfDate);
  check(convertAtYear >= elapsed.fractionalYears - EPS,
    "That conversion year is already behind you — you can't convert in the past.");
  // Equality allowed: converting on the way out the door means the slice gets
  // ~0 years of market growth, which is valid to model (it just returns the
  // converted amount unchanged).
  check(Number.isInteger(exitYear) && exitYear >= convertAtYear,
    "Exit can't come before the conversion year.");
  check(exitYear <= 10, 'Even with the self-directed option, the window ends 10 years after DROP entry.');

  const range = A.inDropYear6to8Range;
  const rateFn = (year6PlusRate) => (dropYear) =>
    dropYear <= 5 ? A.inDropYear1to5Rate : year6PlusRate;
  const midRate = rateFn(range.mid);

  // Balance at the moment of conversion (mid plan rates), reconciled against
  // a statement balance exactly like projectBalanceRange.
  let balanceAtConversion, mismatchFields = {};
  if (knownCurrentBalance != null) {
    check(knownCurrentBalance >= 0, 'The current DROP balance cannot be negative.');
    const computedBalance = accrueWindow({
      monthlyPension, from: 0, to: elapsed.fractionalYears, rateForYear: midRate,
    });
    const divergence = computedBalance > 0
      ? Math.abs(knownCurrentBalance - computedBalance) / computedBalance
      : (knownCurrentBalance > 0 ? Infinity : 0);
    mismatchFields = {
      balanceMismatch: divergence > A.inDropBalanceMismatchTolerance,
      statedBalance: knownCurrentBalance,
      computedBalance,
    };
    balanceAtConversion = accrueWindow({
      monthlyPension, from: elapsed.fractionalYears, to: convertAtYear,
      rateForYear: midRate, startingBalance: knownCurrentBalance,
    });
  } else {
    mismatchFields = { balanceMismatch: false };
    balanceAtConversion = accrueWindow({
      monthlyPension, from: 0, to: convertAtYear, rateForYear: midRate,
    });
  }

  const selfDirectedStart = balanceAtConversion * (convertPct / 100);
  const planLeftover = balanceAtConversion - selfDirectedStart;

  // Every deposit from convertAtYear on is redirected here — the plan track
  // gets none of them.
  const mc = simulateSelfDirected({
    startingBalance: selfDirectedStart,
    yearsRemaining: exitYear - convertAtYear,
    equityWeight,
    annualContribution: monthlyPension * 12,
    numPaths: A.numPaths,
    rng: overrides.rng ?? Math.random,
  }, overrides);
  const selfDirectedRange = { low: mc.p10, mid: mc.p50, high: mc.p90 };

  // Plan track: only what was left behind at conversion, earning the tiered
  // simple-interest schedule with no deposits of its own. Years 9-10 reuse
  // inDropYear6to8Range per the assumption documented in assumptions.js.
  const remainder = (r) => accrueWindow({
    monthlyPension: 0, from: convertAtYear, to: exitYear,
    rateForYear: rateFn(r), startingBalance: planLeftover,
  });
  const remainderBalance = { low: remainder(range.low), mid: remainder(range.mid), high: remainder(range.high) };

  return {
    low: selfDirectedRange.low + remainderBalance.low,
    mid: selfDirectedRange.mid + remainderBalance.mid,
    high: selfDirectedRange.high + remainderBalance.high,
    selfDirectedRange,
    remainderBalance,
    balanceAtConversion,
    ...mismatchFields,
  };
}

// ---- Form-state adapter -----------------------------------------------------

// Parses the UI's string-typed form state (see indropFormDefaults.js) into
// numbers. Same two-tier contract as engine.js's parseForm: hard `check()`
// throws with a fixable message for impossible/typo/inconsistent inputs, and
// soft `warnings[]` for values that compute fine but deserve a "double-check
// this" flag on the results screen. Inputs that don't logically fit together
// (like a year-10 exit with no conversion) are hard errors, matching how
// parseForm treats them — it never silently auto-corrects.
export function parseInDropForm(form, asOfDate = new Date()) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const need = (v, label) => {
    if (v == null || Number.isNaN(v)) throw new Error(`Missing or invalid: ${label}`);
    return v;
  };
  const check = (cond, msg) => { if (!cond) throw new Error(msg); };
  const warnings = [];

  check(form.dropEntryDate !== '' && form.dropEntryDate != null, 'Missing or invalid: DROP entry date');
  let elapsed;
  try {
    elapsed = elapsedDropTime(form.dropEntryDate, asOfDate);
  } catch (err) {
    if (/before/.test(err.message)) {
      throw new Error("Your DROP entry date is in the future — set it to today's date if you're just entering DROP now.");
    }
    throw err;
  }

  const monthlyPension = need(num(form.monthlyPensionAmount), 'monthly pension amount');
  check(monthlyPension > 0, 'Monthly pension must be above zero — it is the deposit that builds the DROP balance.');
  check(monthlyPension <= 50_000,
    'That monthly pension looks like a typo — enter the monthly amount from your DROP entry paperwork, not the annual one.');
  if (monthlyPension > 15_000) {
    warnings.push(`A frozen pension of $${Math.round(monthlyPension).toLocaleString('en-US')}/mo is richer than almost any municipal system pays — double-check it against your DROP entry paperwork.`);
  }

  // null means "no statement entered"; a typed 0 is a real stated value and
  // must survive parsing as 0, not collapse to "not provided".
  const knownCurrentBalance = num(form.knownCurrentBalance);
  if (knownCurrentBalance != null) {
    check(knownCurrentBalance >= 0, "The current DROP balance can't be negative — leave it blank if you don't have a statement handy.");
    check(knownCurrentBalance <= 5_000_000, 'That balance looks like a typo — double-check the amount.');
  }

  const rates = {
    low: need(num(form.lateRateLow), 'years-6+ low rate') / 100,
    mid: need(num(form.lateRateMid), 'years-6+ mid rate') / 100,
    high: need(num(form.lateRateHigh), 'years-6+ high rate') / 100,
  };
  check(rates.low <= rates.mid && rates.mid <= rates.high,
    'The years-6+ range should read low ≤ mid ≤ high — double-check those three rates on the plan terms step.');
  check(rates.low >= 0 && rates.high <= 0.15,
    'A years-6+ rate below 0% or above 15% is not a real plan crediting rate — double-check the plan terms step.');

  const exitYear = need(num(form.exitYear), 'DROP exit year');
  check(exitYear > elapsed.fractionalYears,
    `You're already about ${elapsed.years} year${elapsed.years === 1 ? '' : 's'} into DROP — an exit at year ${exitYear} is behind you. Set it to year ${Math.floor(elapsed.fractionalYears) + 1} or later.`);

  const converting = form.selfDirected === 'yes';
  let convertAtYear = null, convertPct = null, equityPct = null;
  if (converting) {
    convertAtYear = need(num(form.convertAtYear), 'conversion year');
    convertPct = need(num(form.convertPct), 'conversion percentage');
    equityPct = need(num(form.equityPct), 'stock allocation');
    check(convertPct >= 0 && convertPct <= 100, 'Conversion percentage must be between 0 and 100.');
    check(equityPct >= 0 && equityPct <= 100, 'Stock allocation must be between 0 and 100 percent.');
    check(convertAtYear >= elapsed.fractionalYears && convertAtYear <= exitYear,
      `The conversion year must fall between where you are now (year ${Math.max(1, Math.ceil(elapsed.fractionalYears))}) and your exit year (${exitYear}).`);
    if (equityPct === 100) {
      warnings.push('100% stocks means no bond cushion at all — not wrong, but aggressive for money on a fixed clock. Make sure that matches your risk appetite.');
    }
    check(!(convertPct === 0 && exitYear > 8),
      'Exit years 9 and 10 only exist if you actually convert — either set a conversion percentage above zero, or set your exit to year 8 or sooner.');
  } else {
    check(exitYear <= 8,
      'Exit years 9 and 10 only unlock with the self-directed conversion — either convert on the previous step, or set your exit to year 8 or sooner.');
  }

  return {
    entryDate: form.dropEntryDate, elapsed, monthlyPension, knownCurrentBalance,
    rates, exitYear, converting, convertAtYear, convertPct, equityPct,
    warnings,
  };
}

// ---- Top-level --------------------------------------------------------------

// form: UI form state. overrides: any ASSUMPTIONS key, plus optional `rng`
// for a seeded simulation and `asOfDate` for a pinned "today" in tests.
// The user-edited years-6+ range rides in as an assumptions override so the
// projection functions stay pure.
export function calculateInDrop(form, overrides = {}) {
  const asOfDate = overrides.asOfDate ?? new Date();
  const i = parseInDropForm(form, asOfDate);
  const ov = { ...overrides, inDropYear6to8Range: i.rates };
  const args = {
    monthlyPension: i.monthlyPension,
    entryDate: i.entryDate,
    asOfDate,
    exitYear: i.exitYear,
    knownCurrentBalance: i.knownCurrentBalance,
  };
  const projection = i.converting
    ? projectWithConversion({
        ...args,
        convertAtYear: i.convertAtYear,
        convertPct: i.convertPct,
        equityWeight: i.equityPct / 100,
      }, ov)
    : projectBalanceRange(args, ov);

  const warnings = [...i.warnings];
  if (projection.balanceMismatch) {
    const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
    warnings.push(projection.computedBalance > 0
      ? `Your statement says ${usd(projection.statedBalance)}, but our estimate for that same date is ${usd(projection.computedBalance)} — about ${Math.round(Math.abs(projection.statedBalance - projection.computedBalance) / projection.computedBalance * 100)}% apart. We're trusting your statement and projecting from it, but a gap that size usually means the entry date or monthly pension amount is off.`
      : `Your statement shows ${usd(projection.statedBalance)}, but by your entry date you've only just started — our day-one estimate is $0. We're trusting your statement; double-check the entry date.`);
  }

  return { converting: i.converting, projection, elapsed: i.elapsed, inputs: i, warnings };
}
