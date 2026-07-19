import { Field, NumberInput, Choice } from '../components/Field.jsx';
import { MULTIPLIER_OPTIONS, FAS_OPTIONS, BENEFIT_OPTIONS } from '../lib/formDefaults.js';

export default function StepPension({ form, set }) {
  // Picking an option fills in its default factor; the factor stays editable so
  // a member can drop in the exact number from their own benefit estimate.
  const pickBenefit = (value) => {
    const opt = BENEFIT_OPTIONS.find((o) => o.value === value);
    set('benefitOption', value);
    if (opt) set('benefitFactor', String(opt.factor));
  };

  return (
    <>
      <p className="step-intro">
        Your defined-benefit pension formula: years of service × multiplier ×
        final average salary. Your summary plan description has the exact
        numbers — close is fine for a first pass.
      </p>
      <div className="grid">
        <Field label="Pension multiplier">
          <select value={form.multiplier} onChange={(e) => set('multiplier', e.target.value)}>
            {MULTIPLIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        {form.multiplier === 'other' && (
          <Field label="Custom multiplier" suffix="% / yr" hint="Whatever your plan credits per year of service.">
            <NumberInput value={form.customMultiplier} onChange={(v) => set('customMultiplier', v)} min="0.5" max="5" step="0.05" placeholder="2.75" />
          </Field>
        )}
        <Field label="Final average salary basis" hint="How your plan averages your top earning years.">
          <select value={form.fasBasis} onChange={(e) => set('fasBasis', e.target.value)}>
            {FAS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="subhead">How do you want it paid?</div>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Your payment election scales the base pension: a survivor option trades
        some monthly income for protecting a beneficiary. The factors here are
        typical, but yours depend on your and your beneficiary's ages — if your
        benefit estimate lists an exact factor, type it in.
      </p>
      <div className="grid">
        <Field label="Payment option">
          <select value={form.benefitOption} onChange={(e) => pickBenefit(e.target.value)}>
            {BENEFIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Option factor" hint="Multiplies your base pension. 1.0 = the plan's normal form.">
          <NumberInput value={form.benefitFactor} onChange={(v) => set('benefitFactor', v)} min="0.5" max="1.5" step="0.0001" />
        </Field>
      </div>

      <div className="subhead">When do you plan to separate? <span className="optional-tag">optional</span></div>
      <p className="field-hint" style={{ marginTop: 0 }}>
        If you'll use DROP, you can leave this blank — the next step lets you
        compare the 8-year and 10-year DROP windows at their natural ends. Set a
        date to pin both tracks to the same separation point instead. (Without
        DROP, a date is required so we know when you retire.)
      </p>
      <Choice
        name="Retirement target"
        value={form.retireBy}
        onChange={(v) => set('retireBy', v)}
        options={[
          { value: 'age', label: 'At an age' },
          { value: 'years', label: 'After N years of service' },
        ]}
      />
      <div className="grid" style={{ marginTop: 12 }}>
        {form.retireBy === 'age' ? (
          <Field label="Planned separation age" hint="Leave blank to compare DROP windows.">
            <NumberInput value={form.retireAge} onChange={(v) => set('retireAge', v)} min="38" max="70" placeholder="optional" />
          </Field>
        ) : (
          <Field label="Years-of-service target" hint="Total credited years when you pull the pin. Leave blank to compare DROP windows.">
            <NumberInput value={form.targetYears} onChange={(v) => set('targetYears', v)} min="10" max="45" placeholder="optional" />
          </Field>
        )}
      </div>
    </>
  );
}
