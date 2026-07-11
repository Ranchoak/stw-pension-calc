const fmt$ = (v) => (v === '' || v == null ? '—' : '$' + Number(v).toLocaleString('en-US'));

export default function StepInDropReview({ form }) {
  const converting = form.selfDirected === 'yes';
  const rows = [
    ['DROP entry date', form.dropEntryDate || '—'],
    ['Monthly pension to DROP', fmt$(form.monthlyPensionAmount)],
    ['Current balance', form.knownCurrentBalance ? `${fmt$(form.knownCurrentBalance)} (from statement)` : 'Not entered — estimating from your entry date'],
    ['Years 1–5 rate', '6% simple (plan-fixed)'],
    ['Years 6+ range', `${form.lateRateLow || '—'}% / ${form.lateRateMid || '—'}% / ${form.lateRateHigh || '—'}% simple`],
    ['Exit', `Year ${form.exitYear || '—'}`],
    ['Self-directed option', converting
      ? `Convert ${form.convertPct || '—'}% at year ${form.convertAtYear || '—'} · ${form.equityPct || '—'}% stocks / ${form.equityPct ? 100 - Number(form.equityPct) : '—'}% bonds`
      : 'Not converting'],
  ];

  return (
    <>
      <p className="step-intro">Here's what you told us. Fix anything that's off, then run the numbers.</p>
      <div className="review">
        {rows.map(([k, v]) => (
          <div className="review-row" key={k}>
            <span className="review-k">{k}</span>
            <span className="review-v">{v}</span>
          </div>
        ))}
      </div>
      <div className="notice">
        "Run my numbers" projects your balance at exit under the plan's simple
        interest{converting ? ` — and simulates thousands of market paths for the self-directed slice` : ''}.
        You'll get a low, middle, and high figure, not one falsely-precise number.
      </div>
    </>
  );
}
