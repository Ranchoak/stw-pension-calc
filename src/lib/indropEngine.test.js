import { describe, it, expect } from 'vitest';
import {
  elapsedDropTime,
  accrueSimpleInterest,
  projectBalanceRange,
  portfolioAssumptions,
  simulateSelfDirected,
  projectWithConversion,
  parseInDropForm,
  calculateInDrop,
} from './indropEngine.js';
import { mulberry32 } from './engine.js';
import { ASSUMPTIONS } from './assumptions.js';

// ---------------------------------------------------------------------------
// Every expected value below is hand-computable — that's the point. Deposits
// land at END of month m (time m/12), so under a flat rate r the interest is
// P·r·Σ(time each deposit sits), computed with explicit loops here and
// compared against the engine.
// ---------------------------------------------------------------------------

describe('elapsedDropTime', () => {
  it('day one: entry date === as-of date', () => {
    const t = elapsedDropTime('2026-01-15', '2026-01-15');
    expect(t.years).toBe(0);
    expect(t.days).toBe(0);
    expect(t.fractionalYears).toBe(0);
  });

  it('exact anniversaries are whole numbers, even across a leap year', () => {
    // 2023-06-15 → 2024-06-15 spans Feb 29 2024 (366 days), but it's still
    // exactly one anniversary year.
    const t = elapsedDropTime('2023-06-15', '2024-06-15');
    expect(t.years).toBe(1);
    expect(t.days).toBe(0);
    expect(t.fractionalYears).toBe(1);
  });

  it('half a year in: 183 days of a 366-day anniversary year', () => {
    // 2023-06-15 → 2023-12-15 is 183 days; the anniversary year ends
    // 2024-06-15, 366 days long → exactly 0.5.
    const t = elapsedDropTime('2023-06-15', '2023-12-15');
    expect(t.years).toBe(0);
    expect(t.days).toBe(183);
    expect(t.fractionalYears).toBeCloseTo(183 / 366, 12);
  });

  it('throws when the as-of date precedes entry', () => {
    expect(() => elapsedDropTime('2023-06-15', '2023-06-14')).toThrow(/before/);
  });
});

describe('accrueSimpleInterest (end-of-month deposits, simple interest)', () => {
  it('matches the hand-summed closed form for whole years at one flat rate', () => {
    // P = 1000/mo, r = 6%, 2 years. Deposit m lands at m/12 and sits until
    // 24/12, so interest = P·r·Σ(24−m)/12 — the remaining-fraction sum,
    // computed by hand here month by month.
    const P = 1000, r = 0.06, months = 24;
    let remainingSum = 0;
    for (let m = 1; m <= months; m++) remainingSum += (months - m) / 12;
    const expected = P * months + P * r * remainingSum; // 24000 + 1380 = 25380
    expect(remainingSum).toBeCloseTo(23, 12); // 276/12, sanity on the hand math
    const got = accrueSimpleInterest({ monthlyPension: P, years: 2, rateSchedule: () => r });
    expect(got).toBeCloseTo(expected, 6);
    expect(got).toBeCloseTo(25380, 6);
  });

  it('earlier deposits earn more than one flat factor on the year total', () => {
    // One year at 6%: 12 deposits of 1000 → interest 1000·0.06·(Σ(12−m)/12)
    // = 60·5.5 = 330, NOT 12000·0.06 = 720 (whole-total flat factor) and NOT
    // 0 (no interest). The month-weighting is the point.
    const got = accrueSimpleInterest({ monthlyPension: 1000, years: 1, rateSchedule: () => 0.06 });
    expect(got).toBeCloseTo(12000 + 330, 6);
  });

  it('is zero for zero years (day-one entrant)', () => {
    expect(accrueSimpleInterest({ monthlyPension: 5000, years: 0, rateSchedule: () => 0.06 })).toBe(0);
  });

  it('supports fractional final years (deposits and interest stop mid-year)', () => {
    // 1.5 years at 6%: 18 deposits; deposit m sits (18−m)/12 years.
    const P = 2000, r = 0.06;
    let remainingSum = 0;
    for (let m = 1; m <= 18; m++) remainingSum += (18 - m) / 12;
    const expected = P * 18 + P * r * remainingSum;
    expect(accrueSimpleInterest({ monthlyPension: P, years: 1.5, rateSchedule: () => r }))
      .toBeCloseTo(expected, 6);
  });

  it('applies each DROP year\'s rate to the balance during that year', () => {
    // 6 years: years 1-5 at 6%, year 6 at 3%. Month m carries principal
    // P·(m−1) for 1/12 of a year at that year's rate:
    //   interest = P/12·[0.06·Σ₀⁵⁹k + 0.03·Σ₆₀⁷¹k]
    //            = 1000/12·(0.06·1770 + 0.03·786) = 10,815
    const rateSchedule = (y) => (y <= 5 ? 0.06 : 0.03);
    const got = accrueSimpleInterest({ monthlyPension: 1000, years: 6, rateSchedule });
    expect(got).toBeCloseTo(72000 + 10815, 6);
  });
});

describe('projectBalanceRange — no known balance', () => {
  it('day-one entrant, exit before year 6: low = mid = high', () => {
    // The range only exists in years 6+, so a year-5 exit collapses to one
    // number: 60 deposits + 1000·0.06/12·Σ₀⁵⁹k = 60000 + 8850.
    const r = projectBalanceRange({
      monthlyPension: 1000,
      entryDate: '2026-01-01',
      asOfDate: '2026-01-01',
      exitYear: 5,
    });
    expect(r.low).toBeCloseTo(68850, 6);
    expect(r.mid).toBeCloseTo(68850, 6);
    expect(r.high).toBeCloseTo(68850, 6);
    expect(r.balanceMismatch).toBe(false);
  });

  it('3 years in, exit year 8: hand-checked low/mid/high diverge past year 5', () => {
    // 96 deposits. Years 1-5 interest: 1000/12·0.06·Σ₀⁵⁹k = 8850 for all
    // three cases. Years 6-8 interest: 1000/12·r₆₊·Σ₆₀⁹⁵k, Σ₆₀⁹⁵k = 2790:
    //   low 3% → 6975   mid 4.5% → 10462.5   high 6% → 13950
    const r = projectBalanceRange({
      monthlyPension: 1000,
      entryDate: '2023-01-01',
      asOfDate: '2026-01-01',
      exitYear: 8,
    });
    expect(r.low).toBeCloseTo(96000 + 8850 + 6975, 6);
    expect(r.mid).toBeCloseTo(96000 + 8850 + 10462.5, 6);
    expect(r.high).toBeCloseTo(96000 + 8850 + 13950, 6);
    expect(r.low).toBeLessThan(r.mid);
    expect(r.mid).toBeLessThan(r.high);
  });

  it('6 years in (past the tier boundary) still projects the full range', () => {
    const r = projectBalanceRange({
      monthlyPension: 4000,
      entryDate: '2020-03-01',
      asOfDate: '2026-03-01',
      exitYear: 8,
    });
    expect(r.low).toBeLessThan(r.mid);
    expect(r.mid).toBeLessThan(r.high);
    // The first five years are tier-1 in every case — only years 6+ differ.
    const first5 = (rate) =>
      accrueSimpleInterest({ monthlyPension: 4000, years: 5, rateSchedule: (y) => (y <= 5 ? 0.06 : rate) });
    expect(first5(0.03)).toBeCloseTo(first5(0.06), 6);
  });
});

describe('projectBalanceRange — known balance anchoring', () => {
  // 3 years in at $4,000/mo. Computed mid balance as of then:
  // 144000 + 4000·0.06/12·Σ₀³⁵k = 144000 + 20·630 = 156,600.
  const base = {
    monthlyPension: 4000,
    entryDate: '2020-06-15',
    asOfDate: '2023-06-15',
    exitYear: 5,
  };

  it('within tolerance: statement is used quietly, no mismatch flag', () => {
    // 160,000 vs computed 156,600 → ~2.2% off, well under 15%.
    const r = projectBalanceRange({ ...base, knownCurrentBalance: 160000 });
    expect(r.balanceMismatch).toBe(false);
    expect(r.computedBalance).toBeCloseTo(156600, 6);
    expect(r.statedBalance).toBe(160000);
    // Projection is anchored on THEIR number for the remaining 2 years:
    //   anchor interest 160000·0.06·2 = 19,200
    //   24 new deposits = 96,000, earning 4000·0.06/12·Σ₀²³k = 20·276 = 5,520
    expect(r.mid).toBeCloseTo(160000 + 19200 + 96000 + 5520, 6);
  });

  it('beyond tolerance: mismatch flagged, statement still trusted as anchor', () => {
    // 100,000 vs computed 156,600 → ~36% off.
    const r = projectBalanceRange({ ...base, knownCurrentBalance: 100000 });
    expect(r.balanceMismatch).toBe(true);
    expect(r.statedBalance).toBe(100000);
    expect(r.computedBalance).toBeCloseTo(156600, 6);
    // Still anchored on the stated 100k, not silently overridden:
    expect(r.mid).toBeCloseTo(100000 + 100000 * 0.06 * 2 + 96000 + 5520, 6);
  });

  it('anchored range diverges only when the remaining years cross the tier boundary', () => {
    const r = projectBalanceRange({ ...base, exitYear: 7, knownCurrentBalance: 160000 });
    expect(r.low).toBeLessThan(r.mid);
    expect(r.mid).toBeLessThan(r.high);
    const r5 = projectBalanceRange({ ...base, exitYear: 5, knownCurrentBalance: 160000 });
    expect(r5.low).toBeCloseTo(r5.high, 6); // years 4-5 are all tier-1
  });
});

describe('projectBalanceRange — validation', () => {
  it('rejects non-whole or out-of-range exit years', () => {
    const base = { monthlyPension: 4000, entryDate: '2024-01-01', asOfDate: '2026-01-01' };
    expect(() => projectBalanceRange({ ...base, exitYear: 1 })).toThrow(/between 2 and 8/);
    expect(() => projectBalanceRange({ ...base, exitYear: 9 })).toThrow(/between 2 and 8/);
    expect(() => projectBalanceRange({ ...base, exitYear: 5.5 })).toThrow(/whole number/);
  });

  it('rejects an exit year already in the past', () => {
    expect(() => projectBalanceRange({
      monthlyPension: 4000, entryDate: '2019-01-01', asOfDate: '2026-01-01', exitYear: 4,
    })).toThrow(/behind you/);
  });
});

describe('portfolioAssumptions', () => {
  it('blends the equity/bond building blocks linearly', () => {
    expect(portfolioAssumptions(1)).toEqual(ASSUMPTIONS.equityReturn);
    expect(portfolioAssumptions(0)).toEqual(ASSUMPTIONS.bondReturn);
    // 70/30: mean 0.7·10 + 0.3·4.5 = 8.35%, stdDev 0.7·16 + 0.3·6 = 13% —
    // the stdDev lands exactly on the main calculator's 13%.
    const blend = portfolioAssumptions(0.7);
    expect(blend.mean).toBeCloseTo(0.0835, 12);
    expect(blend.stdDev).toBeCloseTo(0.13, 12);
  });

  it('rejects weights outside 0-1', () => {
    expect(() => portfolioAssumptions(1.2)).toThrow(/between 0 and 1/);
    expect(() => portfolioAssumptions(-0.1)).toThrow(/between 0 and 1/);
  });
});

describe('simulateSelfDirected', () => {
  it('with volatility overridden to zero, every path is the compound closed form', () => {
    const r = simulateSelfDirected(
      { startingBalance: 100000, yearsRemaining: 4, equityWeight: 1, numPaths: 50, rng: mulberry32(1) },
      { equityReturn: { mean: 0.10, stdDev: 0 }, bondReturn: { mean: 0.045, stdDev: 0 } },
    );
    const closed = 100000 * Math.pow(1.10, 4);
    expect(r.p10).toBeCloseTo(closed, 6);
    expect(r.p50).toBeCloseTo(closed, 6);
    expect(r.p90).toBeCloseTo(closed, 6);
  });

  it('is seed-deterministic and ordered p10 ≤ p50 ≤ p90', () => {
    const run = () => simulateSelfDirected(
      { startingBalance: 100000, yearsRemaining: 3, equityWeight: 0.7, numPaths: 500, rng: mulberry32(42) },
    );
    const a = run(), b = run();
    expect(a).toEqual(b);
    expect(a.p10).toBeLessThan(a.p50);
    expect(a.p50).toBeLessThan(a.p90);
  });
});

describe('projectWithConversion', () => {
  // Day-one entrant so the pre-conversion balance is fully hand-checkable:
  // accrue 0→5 = 60000 + 8850 = 68,850 (all tier-1, mid rate irrelevant).
  const dayOne = {
    monthlyPension: 1000,
    entryDate: '2026-01-01',
    asOfDate: '2026-01-01',
    equityWeight: 1,
    convertAtYear: 5,
  };

  it('convertPct 0 equals the baseline exactly, with components broken out', () => {
    const args = { monthlyPension: 4000, entryDate: '2020-06-15', asOfDate: '2023-06-15', exitYear: 8 };
    const baseline = projectBalanceRange(args);
    const r = projectWithConversion({ ...args, convertPct: 0, convertAtYear: 5, equityWeight: 0.5 });
    expect(r.low).toBe(baseline.low);
    expect(r.mid).toBe(baseline.mid);
    expect(r.high).toBe(baseline.high);
    expect(r.selfDirectedRange).toEqual({ low: 0, mid: 0, high: 0 });
    expect(r.remainderBalance).toEqual({ low: baseline.low, mid: baseline.mid, high: baseline.high });
    expect(r.balanceAtConversion).toBeNull();
  });

  it('convertPct 100, all equity: hand-checked split, zero-volatility closed form', () => {
    // Self-directed slice starts at 68,850 and now ALSO receives every future
    // deposit (converting redirects the account): 12,000/yr for 3 years,
    // compounding at 10%: 68850·1.1+12000=87,735; ·1.1+12000=108,508.5;
    // ·1.1+12000=131,359.35. Plan track keeps nothing (100% converted) and
    // gets no new deposits either way, so it's 0.
    const r = projectWithConversion(
      { ...dayOne, exitYear: 8, convertPct: 100 },
      { equityReturn: { mean: 0.10, stdDev: 0 }, bondReturn: { mean: 0.045, stdDev: 0 }, rng: mulberry32(1) },
    );
    expect(r.balanceAtConversion).toBeCloseTo(68850, 6);
    expect(r.selfDirectedRange.mid).toBeCloseTo(131359.35, 4);
    expect(r.remainderBalance).toEqual({ low: 0, mid: 0, high: 0 });
    expect(r.mid).toBeCloseTo(131359.35, 4);
  });

  it('convertPct 100, all equity: MC range is wider than the simple-interest track, across seeds', () => {
    const baseline = projectBalanceRange({
      monthlyPension: 1000, entryDate: '2026-01-01', asOfDate: '2026-01-01', exitYear: 8,
    });
    const planSpread = baseline.high - baseline.low; // 6,975 — plan-rate range only
    for (const seed of [1, 2, 42]) {
      const r = projectWithConversion(
        { ...dayOne, exitYear: 8, convertPct: 100 },
        { rng: mulberry32(seed) },
      );
      expect(r.selfDirectedRange.low).toBeLessThan(r.selfDirectedRange.mid);
      expect(r.selfDirectedRange.mid).toBeLessThan(r.selfDirectedRange.high);
      expect(r.high - r.low).toBeGreaterThan(planSpread);
    }
  });

  it('full 10-year path: tiered simple interest to year 8, fund-return MC for years 9-10', () => {
    // 6 years in exactly. Balance at conversion (mid): 72 deposits +
    // 1000/12·(0.06·Σ₀⁵⁹k + 0.045·Σ₆₀⁷¹k) = 72000 + 11,797.5 = 83,797.5.
    // Plan track keeps half (41,898.75) with NO new deposits (they're
    // redirected to self-directed post-conversion). Phase A: tiered simple
    // interest for years 7-8 only → ×(1 + r·2). Phase B: years 9-10 ride the
    // fund's planReturn — volatility overridden to 0 here so the closed form
    // is exact: phaseA(r) · 1.073². The self-directed slice, meanwhile,
    // receives 41,898.75 plus every deposit from year 6 to 10 (48,000 more).
    const r = projectWithConversion(
      {
        monthlyPension: 1000, entryDate: '2020-01-01', asOfDate: '2026-01-01',
        convertAtYear: 6, exitYear: 10, convertPct: 50, equityWeight: 0.7,
      },
      { rng: mulberry32(7), planReturn: { mean: 0.073, stdDev: 0 } },
    );
    expect(r.balanceAtConversion).toBeCloseTo(83797.5, 6);
    const fund2yr = 1.073 ** 2;
    expect(r.remainderBalance.low).toBeCloseTo(41898.75 * 1.06 * fund2yr, 6);
    expect(r.remainderBalance.mid).toBeCloseTo(41898.75 * 1.09 * fund2yr, 6);
    expect(r.remainderBalance.high).toBeCloseTo(41898.75 * 1.12 * fund2yr, 6);
    // Self-directed median should clear its 41,898.75 start plus 48,000 of
    // deposits even before any market growth.
    expect(r.selfDirectedRange.mid).toBeGreaterThan(41898.75 + 48000);
    // Combined is component-wise: pessimist with pessimist, optimist with optimist.
    expect(r.low).toBeCloseTo(r.selfDirectedRange.low + r.remainderBalance.low, 8);
    expect(r.mid).toBeCloseTo(r.selfDirectedRange.mid + r.remainderBalance.mid, 8);
    expect(r.high).toBeCloseTo(r.selfDirectedRange.high + r.remainderBalance.high, 8);
    expect(r.selfDirectedRange.low).toBeLessThan(r.selfDirectedRange.high);
  });

  it('exit at year 8 or earlier is untouched by the years-9-10 change', () => {
    // Same scenario as the 10-year path but exiting at 8: the plan track is
    // pure tiered simple interest — 41,898.75·(1 + r·2) for years 7-8 —
    // which is exactly the pre-change closed form. No Monte Carlo touches it.
    const r = projectWithConversion(
      {
        monthlyPension: 1000, entryDate: '2020-01-01', asOfDate: '2026-01-01',
        convertAtYear: 6, exitYear: 8, convertPct: 50, equityWeight: 0.7,
      },
      { rng: mulberry32(7) },
    );
    expect(r.remainderBalance.low).toBeCloseTo(41898.75 * 1.06, 6);
    expect(r.remainderBalance.mid).toBeCloseTo(41898.75 * 1.09, 6);
    expect(r.remainderBalance.high).toBeCloseTo(41898.75 * 1.12, 6);
  });

  it('years 9-10: the leftover rides fund volatility, so its spread widens past year 8', () => {
    const base = {
      monthlyPension: 1000, entryDate: '2020-01-01', asOfDate: '2026-01-01',
      convertAtYear: 6, convertPct: 50, equityWeight: 0.7,
    };
    const at8 = projectWithConversion({ ...base, exitYear: 8 }, { rng: mulberry32(11) });
    const at10 = projectWithConversion({ ...base, exitYear: 10 }, { rng: mulberry32(11) });
    expect(at10.remainderBalance.high - at10.remainderBalance.low)
      .toBeGreaterThan(at8.remainderBalance.high - at8.remainderBalance.low);
  });

  it('a statement balance anchors the conversion balance, mismatch logic intact', () => {
    // Converting exactly at the as-of point: the statement IS the balance.
    const r = projectWithConversion(
      {
        monthlyPension: 1000, entryDate: '2020-06-15', asOfDate: '2026-06-15',
        convertAtYear: 6, exitYear: 9, convertPct: 100, equityWeight: 0.5,
        knownCurrentBalance: 90000,
      },
      { rng: mulberry32(3) },
    );
    expect(r.balanceAtConversion).toBe(90000);
    expect(r.statedBalance).toBe(90000);
    // Computed mid at 6 years is 83,797.5 → ~7.4% off, under the 15% tolerance.
    expect(r.balanceMismatch).toBe(false);
    expect(r.computedBalance).toBeCloseTo(83797.5, 6);
  });

  it('validation: the 10-year window and conversion ordering are enforced', () => {
    const base = { monthlyPension: 1000, entryDate: '2020-01-01', asOfDate: '2026-01-01', equityWeight: 0.5 };
    // Converting after exit
    expect(() => projectWithConversion({ ...base, convertAtYear: 8, exitYear: 6, convertPct: 50 }))
      .toThrow(/before the conversion year/);
    // Converting in the past (6 years elapsed)
    expect(() => projectWithConversion({ ...base, convertAtYear: 5, exitYear: 9, convertPct: 50 }))
      .toThrow(/behind you/);
    // No conversion → no 10-year window
    expect(() => projectWithConversion({ ...base, convertAtYear: 7, exitYear: 10, convertPct: 0 }))
      .toThrow(/year 8/);
    // Even converting can't stretch past year 10
    expect(() => projectWithConversion({ ...base, convertAtYear: 7, exitYear: 11, convertPct: 50 }))
      .toThrow(/10 years/);
    expect(() => projectWithConversion({ ...base, convertAtYear: 7, exitYear: 9, convertPct: 120 }))
      .toThrow(/between 0 and 100/);
  });
});

// ---------------------------------------------------------------------------
// Form adapter — the parseForm-style two-tier layer. A "good" form plus one
// patched field per case, with `asOfDate` pinned so elapsed time is stable.
// ---------------------------------------------------------------------------

const GOOD_FORM = {
  dropEntryDate: '2023-01-01',
  monthlyPensionAmount: '5000',
  knownCurrentBalance: '',
  lateRateLow: '3',
  lateRateMid: '4.5',
  lateRateHigh: '6',
  selfDirected: 'no',
  exitYear: '8',
  convertAtYear: '',
  convertPct: '100',
  equityPct: '70',
};
const AS_OF = '2026-01-01'; // exactly 3 years in
const calc = (patch, ov = {}) => calculateInDrop({ ...GOOD_FORM, ...patch }, { asOfDate: AS_OF, ...ov });

describe('parseInDropForm / calculateInDrop — hard checks', () => {
  it('entry date in the future', () => {
    expect(() => calc({ dropEntryDate: '2027-06-01' })).toThrow(/future.*today's date/s);
  });

  it('pension at zero or annual-instead-of-monthly typo', () => {
    expect(() => calc({ monthlyPensionAmount: '0' })).toThrow(/above zero/);
    expect(() => calc({ monthlyPensionAmount: '85000' })).toThrow(/typo/);
  });

  it('exit year already behind them, with the fix in the message', () => {
    expect(() => calc({ exitYear: '2' })).toThrow(/behind you.*year 4 or later/s);
  });

  it('conversion knobs out of range', () => {
    const conv = { selfDirected: 'yes', exitYear: '8', convertAtYear: '5', convertPct: '50', equityPct: '70' };
    expect(() => calc({ ...conv, convertPct: '120' })).toThrow(/between 0 and 100/);
    expect(() => calc({ ...conv, convertPct: '-5' })).toThrow(/between 0 and 100/);
    expect(() => calc({ ...conv, equityPct: '150' })).toThrow(/between 0 and 100/);
    // Before where they are now (3 years in) or after exit
    expect(() => calc({ ...conv, convertAtYear: '2' })).toThrow(/between where you are now/);
    expect(() => calc({ ...conv, convertAtYear: '9', exitYear: '8' })).toThrow(/between where you are now/);
  });

  it('exit years 9-10 without a real conversion are a hard error, not auto-corrected', () => {
    // parseForm's convention for inputs that don't logically fit together:
    // throw with the fix spelled out, never silently rewrite the input.
    expect(() => calc({ exitYear: '10' })).toThrow(/only unlock with the self-directed conversion/);
    expect(() => calc({ selfDirected: 'yes', exitYear: '10', convertAtYear: '6', convertPct: '0', equityPct: '50' }))
      .toThrow(/only exist if you actually convert/);
  });
});

describe('parseInDropForm / calculateInDrop — soft warnings', () => {
  it('unusually rich pension warns but still computes', () => {
    const r = calc({ monthlyPensionAmount: '16000' });
    expect(r.warnings.some((w) => /richer than almost any municipal system/.test(w))).toBe(true);
    expect(r.projection.mid).toBeGreaterThan(0);
  });

  it('100% stocks warns as aggressive', () => {
    const r = calc(
      { selfDirected: 'yes', exitYear: '10', convertAtYear: '5', convertPct: '100', equityPct: '100' },
      { rng: mulberry32(1) },
    );
    expect(r.warnings.some((w) => /100% stocks/.test(w))).toBe(true);
    expect(r.projection.selfDirectedRange.high).toBeGreaterThan(r.projection.selfDirectedRange.low);
  });

  it('statement mismatch surfaces as a warning string, not just a result field', () => {
    // Computed at 3 years of $5k/mo: 180,000 + 5,000·0.06/12·Σ₀³⁵k = 195,750.
    const r = calc({ knownCurrentBalance: '100000' });
    expect(r.projection.balanceMismatch).toBe(true);
    expect(r.warnings.some((w) => /statement says \$100,000.*\$195,750/s.test(w))).toBe(true);
  });

  it('a clean run has no warnings', () => {
    expect(calc({}).warnings).toEqual([]);
  });
});

describe('hardening edge cases', () => {
  it('exact day-one entrant flows through the full pipeline with finite numbers', () => {
    const r = calculateInDrop(
      {
        ...GOOD_FORM,
        dropEntryDate: '2026-01-01',
        selfDirected: 'yes', exitYear: '10', convertAtYear: '5', convertPct: '50', equityPct: '70',
      },
      { asOfDate: '2026-01-01', rng: mulberry32(1) },
    );
    expect(r.elapsed.fractionalYears).toBe(0);
    const p = r.projection;
    for (const v of [p.low, p.mid, p.high, p.balanceAtConversion,
      p.selfDirectedRange.low, p.selfDirectedRange.mid, p.selfDirectedRange.high,
      p.remainderBalance.low, p.remainderBalance.mid, p.remainderBalance.high]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('parse keeps a typed "0" balance as 0, and a blank as null', () => {
    expect(parseInDropForm({ ...GOOD_FORM, knownCurrentBalance: '0' }, AS_OF).knownCurrentBalance).toBe(0);
    expect(parseInDropForm(GOOD_FORM, AS_OF).knownCurrentBalance).toBeNull();
  });

  it('a stated balance of $0 with years elapsed is a real value, not "no balance provided"', () => {
    // 3 years in at $4k/mo → computed mid 156,600, statement says $0.
    const r = projectBalanceRange({
      monthlyPension: 4000, entryDate: '2020-06-15', asOfDate: '2023-06-15',
      exitYear: 5, knownCurrentBalance: 0,
    });
    expect(r.statedBalance).toBe(0);
    expect(r.computedBalance).toBeCloseTo(156600, 6);
    expect(r.balanceMismatch).toBe(true);
    // Anchored on $0: only the remaining 24 deposits + their interest remain.
    expect(r.mid).toBeCloseTo(96000 + 5520, 6);
  });

  it('converting today (convertAtYear === elapsed, no statement)', () => {
    // 6 years in exactly; balance at conversion is the mid-rate accrual 0→6.
    const r = projectWithConversion({
      monthlyPension: 1000, entryDate: '2020-01-01', asOfDate: '2026-01-01',
      convertAtYear: 6, exitYear: 8, convertPct: 100, equityWeight: 0.5,
    }, { rng: mulberry32(2) });
    expect(r.balanceAtConversion).toBeCloseTo(83797.5, 6);
  });

  it('converting on the last day (convertAtYear === exitYear): slice gets no growth', () => {
    // Balance at year 8 (mid rates): 96,000 + 1000/12·(0.06·1770 + 0.045·2790) = 115,312.5.
    const r = projectWithConversion({
      monthlyPension: 1000, entryDate: '2020-01-01', asOfDate: '2026-01-01',
      convertAtYear: 8, exitYear: 8, convertPct: 100, equityWeight: 1,
    }, { rng: mulberry32(3) });
    expect(r.balanceAtConversion).toBeCloseTo(115312.5, 6);
    // Zero years of Monte Carlo → every percentile is the converted amount.
    expect(r.selfDirectedRange.low).toBeCloseTo(r.balanceAtConversion, 6);
    expect(r.selfDirectedRange.high).toBeCloseTo(r.balanceAtConversion, 6);
    // Nothing left on the plan track and no time for new deposits.
    expect(r.remainderBalance.mid).toBeCloseTo(0, 6);
    expect(r.mid).toBeCloseTo(r.balanceAtConversion, 6);
  });

  it('baseline exit at the 5/6 tier boundary', () => {
    const base = { monthlyPension: 1000, entryDate: '2026-01-01', asOfDate: '2026-01-01' };
    // Exit 5: every year is plan-fixed, the range collapses to one number.
    const r5 = projectBalanceRange({ ...base, exitYear: 5 });
    expect(r5.mid).toBeCloseTo(68850, 6);
    expect(r5.high - r5.low).toBeCloseTo(0, 8);
    // Exit 6: one range year — low is the hand-checked 72,000 + 10,815.
    const r6 = projectBalanceRange({ ...base, exitYear: 6 });
    expect(r6.low).toBeCloseTo(82815, 6);
    expect(r6.low).toBeLessThan(r6.mid);
    expect(r6.mid).toBeLessThan(r6.high);
  });
});

describe('assumptions wiring', () => {
  it('uses the in-DROP rates from assumptions.js and honors overrides', () => {
    // With every rate overridden to 0, the balance is deposits only.
    const r = projectBalanceRange(
      { monthlyPension: 1000, entryDate: '2026-01-01', asOfDate: '2026-01-01', exitYear: 8 },
      { inDropYear1to5Rate: 0, inDropYear6to8Range: { low: 0, mid: 0, high: 0 } },
    );
    expect(r.low).toBeCloseTo(96000, 6);
    expect(r.high).toBeCloseTo(96000, 6);
    // And the defaults are what the plan terms step displays.
    expect(ASSUMPTIONS.inDropYear1to5Rate).toBe(0.06);
    expect(ASSUMPTIONS.inDropYear6to8Range).toEqual({ low: 0.03, mid: 0.045, high: 0.06 });
  });
});
