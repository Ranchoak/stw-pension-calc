// In-DROP results view — the ending balance range is the centerpiece. Same
// visual language as Results.jsx: $0-anchored range bar so proportions are
// honest, three scenarios, market money never shown as one precise number.

import { ASSUMPTIONS } from '../lib/assumptions.js';

const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
const pctStr = (v) => (v * 100).toFixed(2).replace(/\.?0+$/, '');

function BalanceRow({ label, sub, total, breakdown, emphasized }) {
  return (
    <div className={`scen-row ${emphasized ? 'em' : ''}`}>
      <div className="scen-head">
        <span className="scen-label">{label}<span className="scen-sub"> · {sub}</span></span>
        <span className="scen-total">{usd(total)}</span>
      </div>
      {breakdown && <div className="scen-breakdown">{breakdown}</div>}
    </div>
  );
}

export default function InDropResults({ result, onEdit }) {
  const { converting, projection: p, inputs, elapsed, warnings } = result;
  const rates = inputs.rates;
  const hasSpread = p.high - p.low >= 1;

  // Range bar geometry — $0 to a hair past the optimistic case.
  const max = p.high * 1.06;
  const pct = (v) => Math.min((v / max) * 100, 100);
  // The dark "floor" segment is the money that doesn't ride the market: for a
  // conversion that's the plan track's low case; otherwise the plan-low case
  // for the whole balance.
  const floor = converting ? p.remainderBalance.low : p.low;
  const floorLabel = converting
    ? `plan track alone: ${usd(p.remainderBalance.mid)}`
    : `if every year credits the low end: ${usd(p.low)}`;

  return (
    <main className="card results">
      <h2>Your DROP balance at exit (year {inputs.exitYear})</h2>
      <p className="step-intro">
        {converting
          ? `Plan interest to year ${inputs.convertAtYear}, then ${inputs.convertPct}% of the balance self-directed at ${inputs.equityPct}% stocks. `
          : 'Your frozen pension deposits plus the plan’s simple interest. '}
        {hasSpread ? 'Three scenarios, because nobody can promise the in-between years.' : 'Every year to your exit is plan-fixed, so this one is arithmetic, not a forecast.'}
      </p>

      {warnings && warnings.length > 0 && (
        <div className="warnings" role="alert">
          <strong>Worth double-checking:</strong>
          <ul>{warnings.map((w, idx) => <li key={idx}>{w}</li>)}</ul>
        </div>
      )}

      <div className="hero">
        <div className="hero-label">{hasSpread ? 'Middle scenario' : 'Projected balance'}</div>
        <div className="hero-number">{usd(p.mid)}</div>
        {hasSpread && <div className="hero-range">likely range {usd(p.low)} – {usd(p.high)}</div>}
      </div>

      {hasSpread && (
        <div className="range-wrap" aria-hidden="true">
          <div className="range-floor-label" style={{ left: `${pct(converting ? p.remainderBalance.mid : p.low)}%` }}>
            {floorLabel}
          </div>
          <div className="range-track">
            <div className="range-guaranteed" style={{ width: `${pct(floor)}%` }} />
            <div
              className="range-band"
              style={{ left: `${pct(p.low)}%`, width: `${pct(p.high) - pct(p.low)}%` }}
            />
            <div className="range-dot" style={{ left: `${pct(p.mid)}%` }} />
          </div>
          <div className="range-scale"><span>$0</span><span>{usd(max)}</span></div>
        </div>
      )}

      {hasSpread && (
        <div className="scen-list">
          <BalanceRow
            label="Conservative" sub={converting ? '10th percentile + plan low' : 'plan low every year'}
            total={p.low}
            breakdown={converting && <>self-directed {usd(p.selfDirectedRange.low)} + plan track {usd(p.remainderBalance.low)}</>}
          />
          <BalanceRow
            label="Middle" sub={converting ? 'median + plan mid' : 'plan mid every year'}
            total={p.mid} emphasized
            breakdown={converting && <>self-directed {usd(p.selfDirectedRange.mid)} + plan track {usd(p.remainderBalance.mid)}</>}
          />
          <BalanceRow
            label="Optimistic" sub={converting ? '90th percentile + plan high' : 'plan high every year'}
            total={p.high}
            breakdown={converting && <>self-directed {usd(p.selfDirectedRange.high)} + plan track {usd(p.remainderBalance.high)}</>}
          />
        </div>
      )}

      <div className="detail-grid">
        <section className="detail">
          <h3>Where you are today</h3>
          <div className="detail-big">
            {elapsed.years} yr{elapsed.years === 1 ? '' : 's'}, {Math.floor(elapsed.days / 30.44)} mo
            <span> into DROP</span>
          </div>
          <p>
            {usd(inputs.monthlyPension)}/mo frozen pension credited monthly.
            {inputs.knownCurrentBalance != null
              ? ` Anchored on your statement balance of ${usd(inputs.knownCurrentBalance)}.`
              : ' Estimated from your entry date — no statement balance entered.'}
          </p>
        </section>

        {converting ? (
          <>
            <section className="detail">
              <h3>Self-directed slice</h3>
              <div className="detail-big">{usd(p.selfDirectedRange.mid)}<span> median</span></div>
              <p>
                {inputs.convertPct}% of the {usd(p.balanceAtConversion)} balance at
                year {inputs.convertAtYear}, invested {inputs.equityPct}% stocks /
                {' '}{100 - inputs.equityPct}% bonds — plus every pension deposit from
                that point on, since converting redirects them here too. 10th–90th
                percentile: {usd(p.selfDirectedRange.low)} – {usd(p.selfDirectedRange.high)},
                across {ASSUMPTIONS.numPaths.toLocaleString()} simulated market paths.
              </p>
            </section>
            <section className="detail">
              <h3>Plan track</h3>
              <div className="detail-big">{usd(p.remainderBalance.mid)}<span> mid</span></div>
              <p>
                Only what you left behind at conversion — no new deposits land
                here once you convert.
                {inputs.exitYear > 8
                  ? ` Plan crediting (${pctStr(rates.low)}%–${pctStr(rates.high)}%) through year 8, then the year-8 balance rides the pension fund's own returns for years 9–10. Range ${usd(p.remainderBalance.low)} – ${usd(p.remainderBalance.high)}.`
                  : ` Range ${usd(p.remainderBalance.low)} – ${usd(p.remainderBalance.high)} from the ${pctStr(rates.low)}%–${pctStr(rates.high)}% years-6+ crediting range.`}
              </p>
            </section>
          </>
        ) : (
          <section className="detail">
            <h3>How it accrues</h3>
            <div className="detail-big">6%<span> simple, years 1–5</span></div>
            <p>
              Then {pctStr(rates.low)}%–{pctStr(rates.high)}% simple for years 6+
              (mid case {pctStr(rates.mid)}%). Each month's deposit earns from the
              day it lands; interest never compounds.
            </p>
          </section>
        )}
      </div>

      <div className="assumptions">
        Assumptions you can argue with: 6% simple interest years 1–5 (plan-fixed),
        {' '}{pctStr(rates.low)}/{pctStr(rates.mid)}/{pctStr(rates.high)}% simple for years {inputs.exitYear > 8 ? '6–8' : '6+'}.
        {inputs.exitYear > 8 && ` The plan states no crediting rate for years 9–10, so anything not self-directed rides the pension fund's own historical performance — ${pctStr(ASSUMPTIONS.planReturn.mean)}%/yr (±${pctStr(ASSUMPTIONS.planReturn.stdDev)}%), simulated the same way as the self-directed slice. That's our stand-in, not a stated plan rule.`}
        {converting && ` Self-directed returns blend stocks at ${pctStr(ASSUMPTIONS.equityReturn.mean)}%/yr (±${pctStr(ASSUMPTIONS.equityReturn.stdDev)}%) and bonds at ${pctStr(ASSUMPTIONS.bondReturn.mean)}%/yr (±${pctStr(ASSUMPTIONS.bondReturn.stdDev)}%), ignoring stock/bond correlation.`}
        {' '}{converting
          ? 'New pension deposits after conversion go to the self-directed track, not the plan track.'
          : 'Deposits keep landing on the plan track until you exit.'}
      </div>

      <div className="disclaimer-box">
        This is an educational estimate, not financial advice. It runs on
        simplified assumptions and the numbers you typed — it has never read
        your plan document. DROP crediting rules, conversion windows, and
        self-directed terms vary system to system, and actual investment
        returns will not politely follow a bell curve. Your plan document wins
        every time: verify the DROP terms with your pension office and the
        investment side with a fee-only fiduciary advisor before moving real
        money.
      </div>

      <div className="nav-row">
        <button type="button" className="btn ghost" onClick={onEdit}>Adjust my inputs</button>
        <button type="button" className="btn" onClick={() => window.print()}>Print / save PDF</button>
      </div>
    </main>
  );
}
