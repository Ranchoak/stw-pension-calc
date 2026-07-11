import { Field, NumberInput } from '../components/Field.jsx';

export default function StepPlanTerms({ form, set }) {
  return (
    <>
      <p className="step-intro">
        These are the plan rules that drive the math. Years 1–5 are fixed by
        the plan; years 6–8 credit whatever the plan's investments return, so
        we run that as a range — never one falsely-precise number.
      </p>
      <div className="review">
        <div className="review-row">
          <span className="review-k">Years 1–5</span>
          <span className="review-v">6% simple interest, fixed by the plan</span>
        </div>
        <div className="review-row">
          <span className="review-k">Years 6–8</span>
          <span className="review-v">{form.lateRateLow || '—'}%–{form.lateRateHigh || '—'}% simple, plan returns</span>
        </div>
      </div>
      <div className="subhead">Years 6–8 return range</div>
      <p className="field-hint" style={{ marginTop: 0 }}>
        The defaults below are this calculator's working range. If your plan
        posts its actual returns, put them in.
      </p>
      <div className="grid">
        <Field label="Low year" suffix="%" hint="A bad year for the plan's investments.">
          <NumberInput value={form.lateRateLow} onChange={(v) => set('lateRateLow', v)} min="0" max="15" step="0.25" />
        </Field>
        <Field label="Middle of the road" suffix="%" hint="What a typical year credits.">
          <NumberInput value={form.lateRateMid} onChange={(v) => set('lateRateMid', v)} min="0" max="15" step="0.25" />
        </Field>
        <Field label="Good year" suffix="%" hint="A strong year for the plan's investments.">
          <NumberInput value={form.lateRateHigh} onChange={(v) => set('lateRateHigh', v)} min="0" max="15" step="0.25" />
        </Field>
      </div>
      <div className="notice" style={{ marginTop: 14 }}>
        If you later convert to the 10-year self-directed option, anything you
        <em> don't</em> self-direct in years 9–10 is modeled at this same range.
        That's this calculator's assumption, not a stated plan rule — your plan
        document may treat those years differently.
      </div>
      <p className="field-hint" style={{ marginTop: 8 }}>
        Simple interest means only your credited pension payments earn interest —
        the interest itself doesn't compound. Your plan document beats this
        calculator every time: verify both tiers with your pension office before
        leaning on these numbers.
      </p>
    </>
  );
}
