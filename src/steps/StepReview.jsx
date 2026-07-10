import { MULTIPLIER_OPTIONS, FAS_OPTIONS, CONTRIB_FREQ } from '../lib/formDefaults.js';
import { ASSUMPTIONS } from '../lib/assumptions.js';

const fmt$ = (v) => (v === '' || v == null ? '—' : '$' + Number(v).toLocaleString('en-US'));

export default function StepReview({ form }) {
  const mult = form.multiplier === 'other'
    ? `${form.customMultiplier || '—'}% (custom)`
    : MULTIPLIER_OPTIONS.find((o) => o.value === form.multiplier)?.label;
  const fas = FAS_OPTIONS.find((o) => o.value === form.fasBasis)?.label;
  const freqLabel = (CONTRIB_FREQ[form.contribFreq] ?? CONTRIB_FREQ.annual).label.toLowerCase();

  const rows = [
    ['Age / years of service', `${form.age || '—'} yrs old · ${form.yearsOfService || '—'} yrs in`],
    ['Salary & raises', `${fmt$(form.salary)} / yr, +${form.raisePct || 0}%/yr`],
    ['Pension formula', `${mult} · ${fas}`],
    ['Retirement target', form.retireBy === 'age' ? `Age ${form.retireAge}` : `${form.targetYears} years of service`],
    ['DROP', form.hasDrop === 'yes' ? `Enter at ${form.dropEntryAge || '—'}, ${form.dropRate}% ${form.dropCompounding} interest` : 'Not using'],
    ['Deferred comp', `${fmt$(form.savingsBalance)} now, ${fmt$(form.contribAmount)} ${freqLabel} going in`],
    ['Social Security', form.includeSS === 'yes' ? `${fmt$(form.ssMonthly)}/mo at ${form.ssClaimAge}` : 'Left out'],
  ];

  return (
    <>
      <p className="step-intro">Here's what you told us. Fix anything that's off before running the numbers.</p>
      <div className="review">
        {rows.map(([k, v]) => (
          <div className="review-row" key={k}>
            <span className="review-k">{k}</span>
            <span className="review-v">{v}</span>
          </div>
        ))}
      </div>
      <div className="notice">
        "Run my numbers" simulates {ASSUMPTIONS.numPaths.toLocaleString()} market paths for the 457(b) and
        combines them with your pension math — you'll get a conservative,
        median, and optimistic monthly income, not one falsely-precise number.
      </div>
    </>
  );
}
