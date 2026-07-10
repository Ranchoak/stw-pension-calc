// ---------------------------------------------------------------------------
// All tunable model assumptions live here — nothing in engine.js hardcodes
// these. Adjust and re-run; the engine reads them as defaults and every one
// can also be overridden per-call via calculate(form, overrides).
// ---------------------------------------------------------------------------

export const ASSUMPTIONS = {
  // --- 457(b) Monte Carlo return model -------------------------------------
  // Annual returns are sampled from a normal distribution. 6.5% mean / 13%
  // standard deviation approximates a diversified ~70/30 equity-bond mix in
  // nominal terms: long-run US stocks ≈ 10% mean & ~15-16% sd, blended with
  // investment-grade bonds ≈ 4-5% mean & ~5-7% sd. A normal distribution is a
  // common simplification (real markets have fatter tails), so treat the P10
  // as "bad decade", not "worst case".
  returnMean: 0.065,
  returnStdDev: 0.13,

  // Simulated paths per run. 2,000 keeps percentile noise under ~1% and runs
  // in a few milliseconds.
  numPaths: 2000,

  // --- Retirement income ----------------------------------------------------
  // Safe withdrawal rate applied to each percentile of the ending 457(b)
  // balance ("4% rule"). Adjustable, not a law of nature.
  safeWithdrawalRate: 0.04,

  // Long-run inflation, used only to translate the future (nominal) monthly
  // income back into today's dollars for the "in today's money" figure. 2.5%
  // is roughly the Fed's long-run target plus a hair; bump toward 3% for a
  // more conservative (lower) real number.
  inflation: 0.025,

  // --- DROP ------------------------------------------------------------------
  // Default annual interest credited on the DROP balance when the user hasn't
  // entered their plan's rate. Compounding (compound vs simple) is a per-run
  // choice on the DROP step; see dropAccumulation.
  dropRateDefault: 0.06,
};
