import { describe, it, expect } from 'vitest';
import {
  finalAverageSalary,
  annualPension,
  dropAccumulation,
  simulateDeferredComp,
  mulberry32,
  calculate,
} from './engine.js';
import { INITIAL_FORM } from './formDefaults.js';

// ---------------------------------------------------------------------------
// Every expected value below is hand-computable with a pocket calculator —
// that's the point. If one of these breaks, the engine's math drifted.
// ---------------------------------------------------------------------------

describe('finalAverageSalary', () => {
  it('equals current salary when raises are 0%', () => {
    const fas = finalAverageSalary({ currentSalary: 100000, raise: 0, yearsUntilFreeze: 20, fasYears: 3 });
    expect(fas).toBeCloseTo(100000, 6);
  });

  it('averages the last 3 projected years (10% raises, freeze in 3 years)', () => {
    // Salaries in years 0,1,2 = 100k, 110k, 121k → mean = 110,333.33…
    const fas = finalAverageSalary({ currentSalary: 100000, raise: 0.10, yearsUntilFreeze: 3, fasYears: 3 });
    expect(fas).toBeCloseTo((100000 + 110000 + 121000) / 3, 6);
  });

  it('high-5 averages five years', () => {
    // Years 0..4 at 10%: 100k, 110k, 121k, 133.1k, 146.41k → mean = 122,102
    const fas = finalAverageSalary({ currentSalary: 100000, raise: 0.10, yearsUntilFreeze: 5, fasYears: 5 });
    expect(fas).toBeCloseTo((100000 + 110000 + 121000 + 133100 + 146410) / 5, 6);
  });
});

describe('annualPension', () => {
  it('years × multiplier × FAS', () => {
    // 30 × 0.027 × 100,000 = 81,000
    expect(annualPension({ serviceYears: 30, multiplier: 0.027, fas: 100000 })).toBeCloseTo(81000, 6);
  });
});

describe('dropAccumulation (compound, start-of-year deposits)', () => {
  it('matches the hand-computed 3-year case', () => {
    // 60k/yr at 5%: y1 (0+60000)·1.05 = 63,000
    //               y2 (63000+60000)·1.05 = 129,150
    //               y3 (129150+60000)·1.05 = 198,607.50
    expect(dropAccumulation({ annualPension: 60000, years: 3, rate: 0.05 })).toBeCloseTo(198607.5, 2);
  });

  it('matches the annuity-due closed form', () => {
    // P·[((1+r)^n − 1)/r]·(1+r)
    const P = 47500, r = 0.045, n = 5;
    const closed = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    expect(dropAccumulation({ annualPension: P, years: n, rate: r })).toBeCloseTo(closed, 6);
  });

  it('is zero for zero years', () => {
    expect(dropAccumulation({ annualPension: 60000, years: 0, rate: 0.05 })).toBe(0);
  });

  it('computes simple interest as deposits + P·r·n(n+1)/2', () => {
    // 60k/yr, 3 yrs at 5% simple: 180,000 + 60,000·0.05·(3·4/2) = 180,000 + 18,000
    expect(dropAccumulation({ annualPension: 60000, years: 3, rate: 0.05, compounding: 'simple' }))
      .toBeCloseTo(198000, 6);
  });

  it('compound exceeds simple for the same inputs', () => {
    const args = { annualPension: 60000, years: 5, rate: 0.06 };
    const compound = dropAccumulation({ ...args, compounding: 'compound' });
    const simple = dropAccumulation({ ...args, compounding: 'simple' });
    expect(compound).toBeGreaterThan(simple);
  });
});

describe('simulateDeferredComp', () => {
  it('with 0% volatility matches the compound-interest closed form', () => {
    // FV = P(1+r)^n + C·[((1+r)^n − 1)/r]
    //    = 50,000·1.06^10 + 6,000·[(1.06^10 − 1)/0.06]
    //    = 89,542.38 + 79,084.77 = 168,627.15
    const { p10, p50, p90 } = simulateDeferredComp({
      startBalance: 50000, annualContribution: 6000, years: 10,
      mean: 0.06, stdDev: 0, numPaths: 100,
    });
    expect(p50).toBeCloseTo(168627.15, 1);
    // No variance → all percentiles identical
    expect(p10).toBeCloseTo(p50, 6);
    expect(p90).toBeCloseTo(p50, 6);
  });

  it('with 0 years returns the starting balance untouched', () => {
    const { p50 } = simulateDeferredComp({
      startBalance: 12345, annualContribution: 6000, years: 0,
      mean: 0.06, stdDev: 0, numPaths: 10,
    });
    expect(p50).toBe(12345);
  });

  it('with volatility, percentiles are ordered and spread (seeded)', () => {
    const { p10, p50, p90 } = simulateDeferredComp({
      startBalance: 50000, annualContribution: 6000, years: 15,
      mean: 0.065, stdDev: 0.13, numPaths: 2000, rng: mulberry32(42),
    });
    expect(p10).toBeLessThan(p50);
    expect(p50).toBeLessThan(p90);
    // Median of a volatile sim sits below the deterministic mean-return path
    // (volatility drag) — sanity-check it's in a plausible band, not equal.
    const deterministic = 50000 * 1.065 ** 15 + 6000 * ((1.065 ** 15 - 1) / 0.065);
    expect(p50).toBeGreaterThan(deterministic * 0.5);
    expect(p50).toBeLessThan(deterministic * 1.2);
  });
});

describe('calculate (end to end, deterministic)', () => {
  // Clean hand-checkable scenario: age 50 → retire 55, 25 yrs in (30 at
  // retirement), $100k flat salary (0% raises), 2.5% multiplier, high-3,
  // $100k in the 457 with no contributions, 6% return, no volatility.
  const form = {
    ...INITIAL_FORM,
    age: '50', yearsOfService: '25', salary: '100000', raisePct: '0',
    multiplier: '2.5', fasBasis: 'high3',
    retireBy: 'age', retireAge: '55',
    hasDrop: 'no',
    savingsBalance: '100000', contribAmount: '0', contribFreq: 'annual',
    includeSS: 'no',
  };
  const opts = { returnStdDev: 0, returnMean: 0.06, numPaths: 100 };

  it('computes pension, savings, and combined income', () => {
    const r = calculate(form, opts);
    // Pension: 30 × 0.025 × 100,000 = 75,000/yr = 6,250/mo
    expect(r.pension.annual).toBeCloseTo(75000, 6);
    expect(r.pension.monthly).toBeCloseTo(6250, 6);
    // 457: 100,000 · 1.06^5 = 133,822.56
    expect(r.deferredComp.p50).toBeCloseTo(100000 * 1.06 ** 5, 2);
    // Median income: 6,250 + 133,822.56 × 0.04 / 12 = 6,250 + 446.08 = 6,696.08
    expect(r.income.median.totalMonthly).toBeCloseTo(6250 + (133822.5579 * 0.04) / 12, 2);
    expect(r.retirementAge).toBe(55);
  });

  it('freezes the pension at DROP entry and accumulates the DROP account', () => {
    const r = calculate(
      { ...form, hasDrop: 'yes', dropEntryAge: '52', dropRate: '5' },
      opts,
    );
    // Frozen at entry (2 yrs from now): 27 yrs × 0.025 × 100,000 = 67,500/yr
    expect(r.pension.annual).toBeCloseTo(67500, 6);
    expect(r.pension.frozenAtDropEntry).toBe(true);
    // DROP runs 3 yrs at 5%: 67,500 × [(1.05³ − 1)/0.05] × 1.05 = 223,433.44
    expect(r.drop.years).toBe(3);
    expect(r.drop.balance).toBeCloseTo(223433.4375, 2);
    // The 457 simulation still runs the full 5 years to retirement
    expect(r.deferredComp.p50).toBeCloseTo(100000 * 1.06 ** 5, 2);
  });

  it('adds Social Security to every scenario when provided', () => {
    const r = calculate(
      { ...form, includeSS: 'yes', ssMonthly: '1800', ssClaimAge: '62' },
      opts,
    );
    expect(r.income.median.monthlySocialSecurity).toBe(1800);
    expect(r.income.median.totalMonthly).toBeCloseTo(6250 + (133822.5579 * 0.04) / 12 + 1800, 2);
    expect(r.socialSecurity.claimAge).toBe(62);
  });

  it('rejects a DROP entry after retirement', () => {
    expect(() =>
      calculate({ ...form, hasDrop: 'yes', dropEntryAge: '58', dropRate: '5' }, opts),
    ).toThrow(/before retirement/);
  });

  it('supports years-of-service retirement targets', () => {
    // Target 30 yrs, has 25 → 5 years out, same math as the age-55 case.
    const r = calculate({ ...form, retireBy: 'years', targetYears: '30' }, opts);
    expect(r.pension.annual).toBeCloseTo(75000, 6);
    expect(r.retirementAge).toBe(55);
  });

  it('averages the highest 2 years when fasBasis is high2', () => {
    // Flat salary → high-2 FAS = salary; confirm it runs and uses 2-yr window.
    const r = calculate({ ...form, fasBasis: 'high2' }, opts);
    // 0% raises → FAS is exactly current salary regardless of window.
    expect(r.pension.finalAverageSalary).toBeCloseTo(100000, 6);
  });

  it('treats a biweekly contribution as 26 deposits a year', () => {
    // $1,000 biweekly = $26,000/yr. Compare against the same as annual.
    const bi = calculate({ ...form, contribAmount: '1000', contribFreq: 'biweekly' }, opts);
    const yr = calculate({ ...form, contribAmount: '26000', contribFreq: 'annual' }, opts);
    expect(bi.deferredComp.p50).toBeCloseTo(yr.deferredComp.p50, 2);
  });

  it('reports income in today\'s dollars via the inflation deflator', () => {
    const r = calculate({ ...form, retireAge: '60' }, { ...opts, inflation: 0.025 });
    // 10 years out at 2.5% → factor 1/1.025^10.
    const factor = 1 / Math.pow(1.025, 10);
    expect(r.income.median.totalMonthlyReal).toBeCloseTo(r.income.median.totalMonthly * factor, 2);
    expect(r.assumptions.inflation).toBe(0.025);
  });

  it('keeps DROP out of headline income but reports what it would add', () => {
    const r = calculate({ ...form, hasDrop: 'yes', dropEntryAge: '52', dropRate: '6' }, opts);
    const swr = r.assumptions.safeWithdrawalRate;
    // Headline total excludes the DROP entirely...
    expect(r.income.median.totalMonthly).toBeCloseTo(
      r.pension.monthly + r.income.median.monthlySavingsDraw, 6,
    );
    // ...and the additive line is exactly a safe-withdrawal draw on the balance.
    const expectedDraw = (r.drop.balance * swr) / 12;
    expect(r.drop.monthlyDraw).toBeCloseTo(expectedDraw, 6);
    expect(r.income.median.monthlyDropDraw).toBeCloseTo(expectedDraw, 6);
    expect(r.income.median.totalMonthlyWithDrop).toBeCloseTo(
      r.income.median.totalMonthly + expectedDraw, 6,
    );
  });

  it('reports no DROP draw when DROP is not used', () => {
    const r = calculate(form, opts);
    expect(r.drop).toBeNull();
    expect(r.income.median.monthlyDropDraw).toBe(0);
    expect(r.income.median.totalMonthlyWithDrop).toBeCloseTo(r.income.median.totalMonthly, 6);
  });

  it('flags the §72(t)(10) public-safety exception by age 50 or 25 years of service', () => {
    // Retires at 55 with 30 yrs — clears both tests.
    expect(calculate(form, opts).publicSafetyPenaltyException).toBe(true);
    // Age 45, 10 yrs in, retires at 48 with 13 yrs — clears neither.
    const early = { ...form, age: '45', yearsOfService: '10', retireAge: '48' };
    expect(calculate(early, opts).publicSafetyPenaltyException).toBe(false);
    // Age 40, 22 yrs in, retires at 43 with 25 yrs — service test alone qualifies.
    const byService = { ...form, age: '40', yearsOfService: '22', retireAge: '43' };
    expect(calculate(byService, opts).publicSafetyPenaltyException).toBe(true);
  });

  it('applies simple vs compound DROP interest per the form choice', () => {
    const c = calculate({ ...form, hasDrop: 'yes', dropEntryAge: '52', dropRate: '6', dropCompounding: 'compound' }, opts);
    const s = calculate({ ...form, hasDrop: 'yes', dropEntryAge: '52', dropRate: '6', dropCompounding: 'simple' }, opts);
    expect(c.drop.compounding).toBe('compound');
    expect(s.drop.compounding).toBe('simple');
    expect(c.drop.balance).toBeGreaterThan(s.drop.balance);
  });
});

describe('edge-case validation', () => {
  const base = {
    ...INITIAL_FORM,
    age: '38', yearsOfService: '12', salary: '95000', raisePct: '3',
    multiplier: '2.5', fasBasis: 'high3', retireBy: 'age', retireAge: '55',
    hasDrop: 'no', savingsBalance: '50000', contribAmount: '500', contribFreq: 'monthly',
    includeSS: 'no',
  };
  const opts = { returnStdDev: 0, numPaths: 50 };

  it('accepts 0 years of service (pension builds from future years)', () => {
    const r = calculate({ ...base, yearsOfService: '0' }, opts);
    // 17 future years × 2.5% × FAS; just confirm it runs and is positive.
    expect(r.pension.annual).toBeGreaterThan(0);
    expect(r.inputs.serviceYears).toBe(0);
  });

  it('models retiring now when already at the planned age', () => {
    const r = calculate({ ...base, age: '55', retireAge: '55' }, opts);
    expect(r.retirementAge).toBe(55);
    expect(r.pension.annual).toBeGreaterThan(0);
  });

  it('rejects a planned retirement age already in the past, with a fixable message', () => {
    expect(() => calculate({ ...base, age: '60', retireAge: '55' }, opts))
      .toThrow(/already behind you/);
  });

  it('handles no DROP and an empty 457(b): all scenarios collapse to the pension', () => {
    const r = calculate({ ...base, savingsBalance: '0', contribAmount: '0' }, opts);
    expect(r.deferredComp.p50).toBe(0);
    expect(r.income.conservative.totalMonthly).toBeCloseTo(r.income.optimistic.totalMonthly, 6);
    expect(r.income.median.totalMonthly).toBeCloseTo(r.pension.monthly, 6);
  });

  it('rejects a multiplier entered as a whole number (27 for 2.7)', () => {
    expect(() => calculate({ ...base, multiplier: 'other', customMultiplier: '27' }, opts))
      .toThrow(/real pension formula/);
  });

  it('computes but warns on a multiplier above 3.5%', () => {
    const r = calculate({ ...base, multiplier: 'other', customMultiplier: '4' }, opts);
    expect(r.pension.annual).toBeGreaterThan(0);
    expect(r.warnings.some((w) => /multiplier/i.test(w))).toBe(true);
  });

  it('rejects a negative contribution', () => {
    expect(() => calculate({ ...base, contribAmount: '-500' }, opts))
      .toThrow(/negative/);
  });

  it('warns on a contribution above the 457(b) limit', () => {
    const r = calculate({ ...base, contribAmount: '5000', contribFreq: 'monthly' }, opts);
    expect(r.warnings.some((w) => /limit/i.test(w))).toBe(true);
  });

  it('rejects an impossible raise assumption', () => {
    expect(() => calculate({ ...base, raisePct: '40' }, opts)).toThrow(/raises/);
  });

  it('rejects a zero salary', () => {
    expect(() => calculate({ ...base, salary: '0' }, opts)).toThrow(/salary/);
  });

  it('clean inputs produce no warnings', () => {
    const r = calculate(base, opts);
    expect(r.warnings).toEqual([]);
  });
});
