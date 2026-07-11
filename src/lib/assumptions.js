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

  // --- In-DROP calculator ------------------------------------------------------
  // Rates for members already in DROP (indropEngine.js). All simple interest —
  // this plan credits interest without compounding. Years 1-5 are fixed by the
  // plan document.
  inDropYear1to5Rate: 0.06,
  // Years 6-8: "plan returns" — the board sets the rate each year, so it's
  // modeled as a range (low/mid/high), never a point estimate; same product
  // rule as everywhere else in this app. NOTE: DROP years 9-10 are only
  // reachable via the 10-year self-directed conversion (built in a later
  // step); whatever is NOT self-directed in years 9-10 currently reuses this
  // same range. That is our assumption to verify against the actual plan
  // document, not a stated plan rule.
  inDropYear6to8Range: { low: 0.03, mid: 0.045, high: 0.06 },
  // How far a user's statement balance may diverge from our computed estimate
  // before the projection flags it for the UI ("your statement says X, our
  // estimate says Y"). Below this, the gap is rounding/timing noise and the
  // statement is used quietly.
  inDropBalanceMismatchTolerance: 0.15,
  // The two building blocks behind the self-directed option's user-chosen
  // allocation (blended in portfolioAssumptions, indropEngine.js). The main
  // calculator's returnMean/returnStdDev above approximates a ~70/30 mix of
  // exactly these — the 13% stdDev IS the 70/30 blend; the 6.5% mean sits
  // below the naive 8.35% blend on purpose (conservatism). The in-DROP
  // self-directed option exposes the blend directly via an equity weight
  // instead of hardcoding one mix.
  equityReturn: { mean: 0.10, stdDev: 0.16 },
  bondReturn: { mean: 0.045, stdDev: 0.06 },
};
