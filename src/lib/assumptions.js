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
  // rule as everywhere else in this app. This range stops at year 8; years
  // 9-10 are modeled separately — see planReturn below.
  inDropYear6to8Range: { low: 0.03, mid: 0.045, high: 0.06 },
  // Years 9-10 (only reachable via the 10-year self-directed conversion) are
  // no longer modeled as an extension of the years-6-8 simple-interest
  // range. Real plan documentation doesn't describe a years-9-10 crediting
  // rate at all, so instead of guessing one, whatever balance isn't
  // personally self-directed rides along with the pension FUND's own real
  // historical return and volatility for years 9-10, run through the same
  // Monte Carlo engine as the self-directed slice. Source: Fort Lauderdale
  // Police & Firefighters' Retirement System actual trailing performance
  // (10-year annualized return 7.64%, since-inception 7.32%, 3-year
  // annualized standard deviation 6.96%, 5-year annualized standard
  // deviation 8.73% — quarterly investment performance report, period
  // ending 12/31/25) and actuarial assumed long-term return (7.05%, FY2025
  // valuation). 7.3%/8.0% is the round midpoint of the real trailing-return
  // data, not user-configurable — every member gets the same number here
  // regardless of what equity weight they picked for their own self-directed
  // slice.
  planReturn: { mean: 0.073, stdDev: 0.08 },
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

  // --- New-entrant DROP track choice (main calculator) -------------------------
  // New DROP entrants choose a track at entry: an 8-year plan-administered
  // track (simple interest, years 1-5 fixed + years 6-8 range — reuses the
  // inDrop* rates above) or a 10-year self-directed track (deposits invested
  // in the market from day one at the member's chosen stock/bond mix — reuses
  // equityReturn/bondReturn above). This is the default stock weight for the
  // self-directed track's allocation field; the member can change it.
  selfDirectedEquityDefault: 0.70,
  // Window lengths for each track, in DROP years. Not expected to change, but
  // kept here so the "8 vs 10" is never hardcoded in the engine.
  planTrackYears: 8,
  selfDirectedTrackYears: 10,
};
