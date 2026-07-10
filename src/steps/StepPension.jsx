import { Field, NumberInput, Choice } from '../components/Field.jsx';
import { MULTIPLIER_OPTIONS, FAS_OPTIONS } from '../lib/formDefaults.js';

export default function StepPension({ form, set }) {
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

      <div className="subhead">When do you plan to go?</div>
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
          <Field label="Planned retirement age">
            <NumberInput value={form.retireAge} onChange={(v) => set('retireAge', v)} min="38" max="70" />
          </Field>
        ) : (
          <Field label="Years-of-service target" hint="Total credited years when you pull the pin.">
            <NumberInput value={form.targetYears} onChange={(v) => set('targetYears', v)} min="10" max="45" />
          </Field>
        )}
      </div>
    </>
  );
}
