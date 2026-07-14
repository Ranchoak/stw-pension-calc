// Results view. Two shapes come out of calculate():
//   'single'  → no DROP track. The original layout: combined monthly income as
//               the centerpiece, range bar anchored at $0, detail cards.
//   'compare' → a DROP track was chosen. Both the 8-year plan and 10-year
//               self-directed tracks are shown side by side so the member can
//               see "8 vs 10" — that comparison IS the point.

const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
const multPct = (m) => (m * 100).toFixed(3).replace(/\.?0+$/, '');

// Shared pre-tax / early-withdrawal-penalty disclosure. `qualifies` and the age
// summary are computed by the caller (they differ between single and compare).
function TaxNote({ qualifies, ageSummary }) {
  return (
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
          or with 25 years of service — whichever comes first. {ageSummary}
          {qualifies ? " you'd expect to qualify." : ' you would not yet meet either test.'}
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
  );
}

function Disclaimer() {
  return (
    <div className="disclaimer-box">
      This is an educational estimate, not financial advice. It runs on
      simplified assumptions and the numbers you typed — it has never read
      your plan document. Multipliers, final-average-salary definitions,
      DROP terms, and survivor options vary system to system, and actual
      investment returns will not politely follow a bell curve. Before
      making any real decision, verify the pension math with your pension
      board and the rest with a fee-only fiduciary advisor.
    </div>
  );
}

function NavRow({ onEdit }) {
  return (
    <div className="nav-row">
      <button type="button" className="btn ghost" onClick={onEdit}>Adjust my inputs</button>
      <button type="button" className="btn" onClick={() => window.print()}>Print / save PDF</button>
    </div>
  );
}

// ---- Single (no-DROP) view --------------------------------------------------

function SingleView({ result, onEdit }) {
  const {
    income, pension, deferredComp, retirementAge, socialSecurity,
    assumptions, inputs, warnings, publicSafetyPenaltyException,
  } = result;
  const cons = income.conservative, med = income.median, opt = income.optimistic;

  const ssStartsLater = socialSecurity && socialSecurity.claimAge > retirementAge;
  const has457 = deferredComp.p50 > 0;
  // Whether the 457(b) draw itself varies meaningfully across percentiles —
  // decides whether the boost line below shows a range or just one number.
  const boostHasSpread = opt.monthlySavingsDraw - cons.monthlySavingsDraw >= 1;
  const yrs = result.yearsToRetirement;
  const showReal = yrs >= 2;
  const swrPct = Math.round(assumptions.safeWithdrawalRate * 1000) / 10;

  return (
    <main className="card results">
      <h2>Your retirement picture at {retirementAge}</h2>
      <p className="step-intro">
        Estimated guaranteed monthly income — pension
        {socialSecurity ? ' plus your Social Security number' : ''}.
        {has457
          ? ' Your 457(b) is shown separately below, since it rides the market instead of being guaranteed.'
          : ' Add 457(b) savings on an earlier step to see how much extra income it could add.'}
      </p>

      {warnings && warnings.length > 0 && (
        <div className="warnings" role="alert">
          <strong>Worth double-checking:</strong>
          <ul>{warnings.map((w, idx) => <li key={idx}>{w}</li>)}</ul>
        </div>
      )}

      <div className="hero">
        <div className="hero-label">Guaranteed monthly income</div>
        <div className="hero-number">{usd(med.totalMonthlyGuaranteed)}<span className="hero-mo">/mo</span></div>
        {showReal && (
          <div className="hero-real">
            ≈ {usd(med.totalMonthlyGuaranteedReal)}/mo in today's dollars
            <span className="hero-real-note"> · what it'd buy now after {yrs} yrs at {(assumptions.inflation * 100).toFixed(1)}% inflation</span>
          </div>
        )}
      </div>

      {ssStartsLater && (
        <p className="ss-note">
          Social Security starts at {socialSecurity.claimAge}, {socialSecurity.claimAge - retirementAge} year{socialSecurity.claimAge - retirementAge > 1 ? 's' : ''} after
          you retire — until then, subtract {usd(socialSecurity.monthly)} from the guaranteed figure above.
        </p>
      )}

      {has457 && (
        <div className="drop-add">
          <div className="drop-add-head">
            <span>If you also draw {swrPct}% on your 457(b)</span>
            <span className="drop-add-plus">+{usd(med.monthlySavingsDraw)}<span className="scen-mo">/mo</span></span>
          </div>
          <div className="drop-add-total">
            Median total becomes <strong>{usd(med.totalMonthly)}/mo</strong>
            {boostHasSpread && <> · range {usd(cons.totalMonthly)} – {usd(opt.totalMonthly)}</>}
            {showReal && <span className="drop-add-real"> (≈ {usd(med.totalMonthlyReal)}/mo in today's dollars)</span>}
          </div>
          <div className="drop-add-note">
            This assumes a {swrPct}% withdrawal rate on your simulated 457(b) balance — a
            range, not a promise, since it rides the market. Kept separate from the
            guaranteed figure above so the two don't get confused with each other.
          </div>
        </div>
      )}

      <div className="detail-grid">
        <section className="detail">
          <h3>Pension</h3>
          <div className="detail-big">{usd(pension.monthly)}<span>/mo</span></div>
          <p>
            {pension.serviceYears} yrs × {multPct(pension.multiplier)}% × {usd(pension.finalAverageSalary)} final
            average salary = {usd(pension.annual)}/yr
          </p>
        </section>

        <section className="detail">
          <h3>457(b) at retirement</h3>
          {has457 ? (
            <>
              <div className="detail-big">{usd(deferredComp.p50)}<span> median</span></div>
              <p>10th–90th percentile: {usd(deferredComp.p10)} – {usd(deferredComp.p90)}, across {assumptions.numPaths.toLocaleString()} simulated market paths.</p>
            </>
          ) : (
            <>
              <div className="detail-big">$0</div>
              <p>No 457(b) balance or contributions entered — add them on the savings step to see how deferred comp could supplement your pension.</p>
            </>
          )}
        </section>
      </div>

      <TaxNote
        qualifies={publicSafetyPenaltyException}
        ageSummary={`On the numbers you entered — retiring at ${retirementAge} with ${pension.serviceYears} years of service —`}
      />

      <div className="assumptions">
        Assumptions you can argue with: {(assumptions.returnMean * 100).toFixed(1)}% average annual
        return with {(assumptions.returnStdDev * 100).toFixed(0)}% year-to-year swings (a rough
        diversified-mix stand-in), {Math.round(assumptions.safeWithdrawalRate * 1000) / 10}% withdrawal
        rate, {inputs.raise > 0 ? `${(inputs.raise * 100).toFixed(1)}% annual raises, ` : ''}
        {showReal ? `${(assumptions.inflation * 100).toFixed(1)}% inflation for the today's-dollars figures, ` : ''}annual
        compounding throughout.
        {showReal && socialSecurity && ' A Social Security estimate from your SSA statement is already in today\'s dollars, so the real figures run slightly conservative.'}
      </div>

      <Disclaimer />
      <NavRow onEdit={onEdit} />
    </main>
  );
}

// ---- Compare (DROP track) view ----------------------------------------------

const TRACK_META = {
  plan8: { name: '8-year plan track', blurb: 'Fixed interest — 6% years 1–5, a plan-set range years 6–8.' },
  self10: { name: '10-year self-directed', blurb: 'Invested in the market from day one; two extra years.' },
};

function TrackCard({ track, id, isPick, showReal }) {
  const meta = TRACK_META[id];
  const b = track.drop.balance;
  const med = track.income.median;
  const cons = track.income.conservative;
  const opt = track.income.optimistic;
  return (
    <section className={`track-card ${isPick ? 'pick' : ''}`}>
      <div className="track-head">
        <h3>{meta.name}</h3>
        {isPick && <span className="track-badge">your pick</span>}
      </div>
      <div className="track-sub">Leave at age {track.retirementAge} · {track.drop.years} DROP years</div>

      <div className="track-metric">
        <div className="track-metric-label">DROP balance at exit</div>
        <div className="track-metric-big">{usd(b.mid)}</div>
        <div className="track-metric-range">range {usd(b.low)} – {usd(b.high)}</div>
      </div>

      <div className="track-metric">
        <div className="track-metric-label">Total monthly income</div>
        <div className="track-metric-big">{usd(med.totalMonthly)}<span className="scen-mo">/mo</span></div>
        <div className="track-metric-range">
          range {usd(cons.totalMonthly)} – {usd(opt.totalMonthly)}
          {showReal && <> · ≈ {usd(med.totalMonthlyReal)}/mo in today's $</>}
        </div>
        <div className="track-metric-note">
          pension {usd(med.monthlyPension)} + 457(b) draw {usd(med.monthlySavingsDraw)}
          {med.monthlySocialSecurity > 0 && <> + SS {usd(med.monthlySocialSecurity)}</>}
          . Plus ~{usd(med.monthlyDropDraw)}/mo more if you also draw 4% on the DROP.
        </div>
      </div>

      {track.drop.capNote && <div className="track-cap">{track.drop.capNote}</div>}
    </section>
  );
}

function CompareView({ result, onEdit }) {
  const { tracks, dropTrackPick, warnings, assumptions, inputs, dropEntryAge, sdEquityPct } = result;
  const plan8 = tracks.plan8, self10 = tracks.self10;
  const pension = plan8.pension; // identical across tracks (frozen at entry)
  const showReal = plan8.yearsToRetirement >= 2;

  const bothQualify = plan8.publicSafetyPenaltyException && self10.publicSafetyPenaltyException;
  const eitherQualifies = plan8.publicSafetyPenaltyException || self10.publicSafetyPenaltyException;
  const ageSummary = bothQualify
    ? `Leaving in your 50s after a full career — separating at age ${plan8.retirementAge} (plan) or ${self10.retirementAge} (self-directed) —`
    : `On the numbers you entered — separating at age ${plan8.retirementAge} (plan) or ${self10.retirementAge} (self-directed) —`;

  return (
    <main className="card results">
      <h2>8-year plan vs 10-year self-directed</h2>
      <p className="step-intro">
        You enter DROP at age {dropEntryAge}. Your pension is frozen there either
        way — {usd(pension.monthly)}/mo, {pension.serviceYears} yrs × {multPct(pension.multiplier)}% ×
        {' '}{usd(pension.finalAverageSalary)}. What differs is how your DROP account
        grows and how long it runs. The self-directed figures use a {sdEquityPct}% stock
        allocation and are a range, never a promise.
      </p>

      {warnings && warnings.length > 0 && (
        <div className="warnings" role="alert">
          <strong>Worth double-checking:</strong>
          <ul>{warnings.map((w, idx) => <li key={idx}>{w}</li>)}</ul>
        </div>
      )}

      <div className="track-grid">
        <TrackCard track={plan8} id="plan8" isPick={dropTrackPick === 'plan8'} showReal={showReal} />
        <TrackCard track={self10} id="self10" isPick={dropTrackPick === 'self10'} showReal={showReal} />
      </div>

      <div className="drop-compare-note">
        <strong>What's driving the gap:</strong> the plan track credits fixed
        interest and ends at year 8; the self-directed track rides the market for
        up to 10 years, so its balance is a wide range — better in good markets,
        worse in bad ones. The two extra years also mean two more years of pension
        deposits and 457(b) contributions, which is why the totals differ beyond
        just the DROP. The self-directed downside (the low end) is real money you
        could actually end up with — it isn't a worst case.
      </div>

      <TaxNote qualifies={eitherQualifies} ageSummary={ageSummary} />

      <div className="assumptions">
        Assumptions you can argue with: the 8-year track credits 6% (years 1–5)
        and a plan-set range (years 6–8), all simple interest; the self-directed
        track invests at a {sdEquityPct}% stock / {100 - sdEquityPct}% bond mix run over
        {' '}{assumptions.numPaths.toLocaleString()} market paths; {Math.round(assumptions.safeWithdrawalRate * 1000) / 10}% withdrawal rate on the
        457(b){inputs.raise > 0 ? `, ${(inputs.raise * 100).toFixed(1)}% annual raises` : ''}
        {showReal ? `, ${(assumptions.inflation * 100).toFixed(1)}% inflation for the today's-dollars figures` : ''}.
      </div>

      <Disclaimer />
      <NavRow onEdit={onEdit} />
    </main>
  );
}

export default function Results({ result, onEdit }) {
  return result.mode === 'compare'
    ? <CompareView result={result} onEdit={onEdit} />
    : <SingleView result={result} onEdit={onEdit} />;
}
