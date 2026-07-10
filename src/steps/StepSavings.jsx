import { Field, NumberInput, Choice } from '../components/Field.jsx';
import { CONTRIB_FREQ } from '../lib/formDefaults.js';
import { ASSUMPTIONS } from '../lib/assumptions.js';

export default function StepSavings({ form, set }) {
  const meanPct = (ASSUMPTIONS.returnMean * 100).toFixed(1);
  const sdPct = (ASSUMPTIONS.returnStdDev * 100).toFixed(0);
  return (
    <>
      <p className="step-intro">
        Your 457(b) / deferred comp. This is the part we'll run through a Monte
        Carlo simulation — market returns aren't a straight line, so the result
        will be a range, not one falsely-precise number.
      </p>
      <div className="grid">
        <Field label="Current balance" prefix="$">
          <NumberInput value={form.savingsBalance} onChange={(v) => set('savingsBalance', v)} min="0" step="1000" placeholder="50000" />
        </Field>
        <Field label="Contribution per paycheck" prefix="$" hint="Just your own deferral — employer match isn't modeled.">
          <NumberInput value={form.contribAmount} onChange={(v) => set('contribAmount', v)} min="0" step="25" placeholder="500" />
        </Field>
      </div>
      <div className="subhead">How often does that go in?</div>
      <Choice
        name="Contribution frequency"
        value={form.contribFreq}
        onChange={(v) => set('contribFreq', v)}
        options={Object.entries(CONTRIB_FREQ).map(([value, { label }]) => ({ value, label }))}
      />
      <p className="field-hint" style={{ marginTop: 12 }}>
        Growth is modeled at about {meanPct}% average annual return with {sdPct}% year-to-year
        swings (a diversified stock/bond mix) — no employer match assumed. You can
        picture that as your money doing the work; anything your department kicks in
        is upside on top.
      </p>
    </>
  );
}
