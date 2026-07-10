import { Field, NumberInput, Choice } from '../components/Field.jsx';

export default function StepSocial({ form, set }) {
  return (
    <>
      <p className="step-intro">
        Optional. Many firefighters are outside Social Security or hit by
        WEP/GPO rules, so we only include it if you bring a real number from
        your SSA statement — we won't guess one for you.
      </p>
      <Choice
        name="Include Social Security"
        value={form.includeSS}
        onChange={(v) => set('includeSS', v)}
        options={[
          { value: 'no', label: 'Leave it out' },
          { value: 'yes', label: 'I have a number from SSA' },
        ]}
      />
      {form.includeSS === 'yes' && (
        <div className="grid" style={{ marginTop: 16 }}>
          <Field label="Expected monthly benefit" prefix="$" hint="From ssa.gov / your statement, at the claiming age below.">
            <NumberInput value={form.ssMonthly} onChange={(v) => set('ssMonthly', v)} min="0" step="50" placeholder="1800" />
          </Field>
          <Field label="Claiming age">
            <NumberInput value={form.ssClaimAge} onChange={(v) => set('ssClaimAge', v)} min="62" max="70" />
          </Field>
        </div>
      )}
    </>
  );
}
