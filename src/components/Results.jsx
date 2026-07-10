// Results view — the three-scenario combined income is the centerpiece.
// The range bar is anchored at $0 so proportions are honest: for most DB
// pension holders the guaranteed pension is the bulk of the bar and the
// market only moves the top slice. That IS the message.

const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');

function ScenarioRow({ label, sub, s, emphasized, showReal }) {
  return (
    <div className={`scen-row ${emphasized ? 'em' : ''}`}>
      <div className="scen-head">
        <span className="scen-label">{label}<span className="scen-sub"> · {sub}</span></span>
        <span className="scen-total">
          {usd(s.totalMonthly)}<span className="scen-mo">/mo</span>
          {showReal && <span className="scen-real">≈ {usd(s.totalMonthlyReal)} in today's $</span>}
        </span>
      </div>
      <div className="scen-breakdown">
        pension {usd(s.monthlyPension)}
        {' + '}457(b) draw {usd(s.monthlySavingsDraw)}
        {s.monthlySocialSecurity > 0 && <> + Social Security {usd(s.monthlySocialSecurity)}</>}
      </div>
    </div>
  );
}

export default function Results({ result, onEdit }) {
  const {
    income, pension, drop, deferredComp, retirementAge, socialSecurity,
    assumptions, inputs, warnings, publicSafetyPenaltyException,
  } = result;
  const cons = income.conservative, med = income.median, opt = income.optimistic;
  const swrPct = Math.round(assumptions.safeWithdrawalRate * 1000) / 10;

  // Range bar geometry — $0 to a hair past the optimistic case.
  const max = opt.totalMonthly * 1.06;
  const pct = (v) => Math.min((v / max) * 100, 100);

  const ssStartsLater = socialSecurity && socialSecurity.claimAge > retirementAge;
  // With no 457(b) balance and no contributions, all three scenarios collapse
  // onto the pension (+ SS). Showing a "range $X – $X" and a zero-width band
  // would look broken — treat it as a single guaranteed figure instead.
  const hasSpread = opt.totalMonthly - cons.totalMonthly >= 1;
  // Today's-dollars figure only means something once retirement is a few years
  // out; for retire-now it equals the nominal number, so skip it.
  const yrs = result.yearsToRetirement;
  const showReal = yrs >= 2;

  return (
    <main className="card results">
      <h2>Your retirement picture at {retirementAge}</h2>
      <p className="step-intro">
        Estimated total monthly income — pension
        {deferredComp.p50 > 0 && ` plus a ${Math.round(assumptions.safeWithdrawalRate * 1000) / 10}% withdrawal on the 457(b)`}
        {socialSecurity ? ' plus your Social Security number' : ''}.
        {hasSpread ? ' Three scenarios, because markets don\'t promise anything.' : ' With no 457(b) to model, this is your guaranteed pension income.'}
      </p>

      {warnings && warnings.length > 0 && (
        <div className="warnings" role="alert">
          <strong>Worth double-checking:</strong>
          <ul>{warnings.map((w, idx) => <li key={idx}>{w}</li>)}</ul>
        </div>
      )}

      <div className="hero">
        <div className="hero-label">{hasSpread ? 'Median scenario' : 'Guaranteed monthly income'}</div>
        <div className="hero-number">{usd(med.totalMonthly)}<span className="hero-mo">/mo</span></div>
        {hasSpread && <div className="hero-range">likely range {usd(cons.totalMonthly)} – {usd(opt.totalMonthly)}</div>}
        {showReal && (
          <div className="hero-real">
            ≈ {usd(med.totalMonthlyReal)}/mo in today's dollars
            <span className="hero-real-note"> · what it'd buy now after {yrs} yrs at {(assumptions.inflation * 100).toFixed(1)}% inflation</span>
          </div>
        )}
      </div>

      {hasSpread && (
        <div className="range-wrap" aria-hidden="true">
          <div className="range-floor-label" style={{ left: `${pct(med.monthlyPension)}%` }}>
            pension alone: {usd(med.monthlyPension)}
          </div>
          <div className="range-track">
            <div className="range-guaranteed" style={{ width: `${pct(med.monthlyPension)}%` }} />
            <div
              className="range-band"
              style={{ left: `${pct(cons.totalMonthly)}%`, width: `${pct(opt.totalMonthly) - pct(cons.totalMonthly)}%` }}
            />
            <div className="range-dot" style={{ left: `${pct(med.totalMonthly)}%` }} />
          </div>
          <div className="range-scale"><span>$0</span><span>{usd(max)}/mo</span></div>
        </div>
      )}

      {hasSpread && (
        <div className="scen-list">
          <ScenarioRow label="Conservative" sub="10th percentile" s={cons} showReal={showReal} />
          <ScenarioRow label="Median" sub="50th percentile" s={med} emphasized showReal={showReal} />
          <ScenarioRow label="Optimistic" sub="90th percentile" s={opt} showReal={showReal} />
        </div>
      )}

      {drop && (
        <div className="drop-add">
          <div className="drop-add-head">
            <span>If you also draw {swrPct}% on the DROP balance</span>
            <span className="drop-add-plus">+{usd(drop.monthlyDraw)}<span className="scen-mo">/mo</span></span>
          </div>
          <div className="drop-add-total">
            Median total becomes <strong>{usd(med.totalMonthlyWithDrop)}/mo</strong>
            {hasSpread && <> · range {usd(cons.totalMonthlyWithDrop)} – {usd(opt.totalMonthlyWithDrop)}</>}
            {showReal && <span className="drop-add-real"> (≈ {usd(med.totalMonthlyWithDropReal)}/mo in today's dollars)</span>}
          </div>
          <div className="drop-add-note">
            The figures above leave the DROP out on purpose — it's a lump sum, and
            plenty of people use it to pay off a house or buy an annuity instead of
            investing it. This line shows what it adds if you do invest it alongside
            the 457(b).
          </div>
        </div>
      )}
      {ssStartsLater && (
        <p className="ss-note">
          Social Security starts at {socialSecurity.claimAge}, {socialSecurity.claimAge - retirementAge} year{socialSecurity.claimAge - retirementAge > 1 ? 's' : ''} after
          you retire — until then, subtract {usd(socialSecurity.monthly)} from each total.
        </p>
      )}

      <div className="detail-grid">
        <section className="detail">
          <h3>Pension{pension.frozenAtDropEntry ? ' (frozen at DROP entry)' : ''}</h3>
          <div className="detail-big">{usd(pension.monthly)}<span>/mo</span></div>
          <p>
            {pension.serviceYears} yrs × {(pension.multiplier * 100).toFixed(3).replace(/\.?0+$/, '')}% × {usd(pension.finalAverageSalary)} final
            average salary = {usd(pension.annual)}/yr
          </p>
        </section>

        <section className="detail">
          <h3>457(b) at retirement</h3>
          {deferredComp.p50 > 0 ? (
            <>
              <div className="detail-big">{usd(deferredComp.p50)}<span> median</span></div>
              <p>
                10th–90th percentile: {usd(deferredComp.p10)} – {usd(deferredComp.p90)}, across {assumptions.numPaths.toLocaleString()} simulated
                market paths.
              </p>
            </>
          ) : (
            <>
              <div className="detail-big">$0</div>
              <p>No 457(b) balance or contributions entered — add them on the savings step to see how deferred comp could supplement your pension.</p>
            </>
          )}
        </section>

        {drop && (
          <section className="detail">
            <h3>DROP account at retirement</h3>
            <div className="detail-big">{usd(drop.balance)}</div>
            <p>
              {drop.years} year{drop.years > 1 ? 's' : ''} of frozen pension deposits
              at {(drop.rate * 100).toFixed(2).replace(/\.?0+$/, '')}% {drop.compounding} interest.
              Kept separate from the monthly figures above — most people roll it
              over as a lump sum at retirement.
            </p>
          </section>
        )}
      </div>

      <div className="tax-note">
        <strong>Every figure here is before taxes.</strong> Your pension, DROP, and
        457(b) are all pre-tax dollars — you owe ordinary income tax as you draw
        them. The separate question is the IRS 10% early-withdrawal penalty:
        <ul>
          <li>
            <b>Governmental 457(b):</b> generally no 10% penalty at any age — one of
            the quiet advantages of deferred comp over a 401(k). (Money you rolled
            <em> into</em> the 457(b) from an IRA or 401(k) can keep its penalty.)
          </li>
          <li>
            <b>Pension and DROP:</b> the public-safety exception (IRC §72(t)(10))
            waives the 10% penalty when you separate from service at age 50 or later,
            or with 25 years of service — whichever comes first.
            {publicSafetyPenaltyException
              ? ` On the numbers you entered — retiring at ${retirementAge} with ${pension.serviceYears} years of service — you'd expect to qualify.`
              : ` On the numbers you entered — retiring at ${retirementAge} with ${pension.serviceYears} years of service — you would not yet meet either test.`}
          </li>
          <li>
            <b>The rollover trap:</b> moving DROP or pension money into a traditional
            IRA gives up that public-safety exception. IRA withdrawals before 59½ can
            trigger the 10% penalty again, even for a retired firefighter.
          </li>
        </ul>
        Tax rules change and your plan's terms govern. Confirm with your pension board
        and a tax professional before you move any of this money.
      </div>

      <div className="assumptions">
        Assumptions you can argue with: {(assumptions.returnMean * 100).toFixed(1)}% average annual
        return with {(assumptions.returnStdDev * 100).toFixed(0)}% year-to-year swings (a rough
        diversified-mix stand-in), {Math.round(assumptions.safeWithdrawalRate * 1000) / 10}% withdrawal
        rate, {inputs.raise > 0 ? `${(inputs.raise * 100).toFixed(1)}% annual raises, ` : ''}
        {showReal ? `${(assumptions.inflation * 100).toFixed(1)}% inflation for the today's-dollars figures, ` : ''}annual
        compounding throughout.
        {showReal && socialSecurity && ' A Social Security estimate from your SSA statement is already in today\'s dollars, so the real figures run slightly conservative.'}
      </div>

      <div className="disclaimer-box">
        This is an educational estimate, not financial advice. It runs on
        simplified assumptions and the numbers you typed — it has never read
        your plan document. Multipliers, final-average-salary definitions,
        DROP terms, and survivor options vary system to system, and actual
        investment returns will not politely follow a bell curve. Before
        making any real decision, verify the pension math with your pension
        board and the rest with a fee-only fiduciary advisor.
      </div>

      <div className="nav-row">
        <button type="button" className="btn ghost" onClick={onEdit}>Adjust my inputs</button>
        <button type="button" className="btn" onClick={() => window.print()}>Print / save PDF</button>
      </div>
    </main>
  );
}
