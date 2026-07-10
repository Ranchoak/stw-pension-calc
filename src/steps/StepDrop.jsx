import { Field, NumberInput, Choice } from '../components/Field.jsx';

export default function StepDrop({ form, set }) {
  return (
    <>
      <p className="step-intro">
        DROP (Deferred Retirement Option Plan): your pension "retires" while you
        keep working — payments pile up in a side account with interest until
        you actually leave. Not every department has one.
      </p>
      <Choice
        name="DROP participation"
        value={form.hasDrop}
        onChange={(v) => set('hasDrop', v)}
        options={[
          { value: 'no', label: 'No DROP / not using it' },
          { value: 'yes', label: 'I plan to use DROP' },
        ]}
      />
      {form.hasDrop === 'yes' && (
        <>
          <div className="grid" style={{ marginTop: 16 }}>
            <Field label="DROP entry age" hint="When you'd enter DROP. Exit is your retirement age from the previous step.">
              <NumberInput value={form.dropEntryAge} onChange={(v) => set('dropEntryAge', v)} min="38" max="65" placeholder="50" />
            </Field>
            <Field label="DROP interest rate" suffix="%" hint="What your plan credits on the DROP balance. Many plans fix this — check yours.">
              <NumberInput value={form.dropRate} onChange={(v) => set('dropRate', v)} min="0" max="15" step="0.25" />
            </Field>
          </div>
          <div className="subhead">How is that interest credited?</div>
          <Choice
            name="DROP interest method"
            value={form.dropCompounding}
            onChange={(v) => set('dropCompounding', v)}
            options={[
              { value: 'compound', label: 'Compound' },
              { value: 'simple', label: 'Simple' },
            ]}
          />
          <p className="field-hint" style={{ marginTop: 8 }}>
            Compound means the interest itself earns interest each year; simple means
            only your deposits earn interest. Plans vary — check yours. Compound ends
            up a bit higher.
          </p>
        </>
      )}
    </>
  );
}
