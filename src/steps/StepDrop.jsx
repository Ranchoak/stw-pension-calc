import { Field, NumberInput, Choice } from '../components/Field.jsx';

export default function StepDrop({ form, set }) {
  const usingDrop = form.dropTrack === 'plan8' || form.dropTrack === 'self10';
  return (
    <>
      <p className="step-intro">
        DROP (Deferred Retirement Option Plan): your pension "retires" while you
        keep working — payments pile up in a side account until you actually
        leave. New entrants pick a track at entry. We'll show you both side by
        side so you can compare.
      </p>
      <Choice
        name="DROP track"
        value={form.dropTrack}
        onChange={(v) => set('dropTrack', v)}
        options={[
          { value: 'none', label: 'No DROP / not using it' },
          { value: 'plan8', label: '8-year plan track' },
          { value: 'self10', label: '10-year self-directed' },
        ]}
      />

      {usingDrop && (
        <>
          <div className="notice" style={{ marginTop: 16 }}>
            <strong>You'll see both tracks on the results screen.</strong> The
            8-year plan track credits fixed interest (6% years 1–5, a plan-set
            range years 6–8). The 10-year self-directed track invests your DROP
            deposits in the market from day one — more potential upside, real
            downside, two extra years. Your pick above just highlights the one
            you're leaning toward.
          </div>

          <div className="grid" style={{ marginTop: 16 }}>
            <Field label="DROP entry age" hint="When you'd enter DROP. The clock starts here.">
              <NumberInput value={form.dropEntryAge} onChange={(v) => set('dropEntryAge', v)} min="38" max="65" placeholder="50" />
            </Field>
            <Field label="Self-directed stock allocation" suffix="% stocks" hint="Drives the 10-year track. The rest is modeled as bonds. More stocks = higher middle, wider range.">
              <NumberInput value={form.sdEquityPct} onChange={(v) => set('sdEquityPct', v)} min="0" max="100" step="5" />
            </Field>
          </div>
          <p className="field-hint" style={{ marginTop: 8 }}>
            The self-directed track is a Monte Carlo simulation — the plan doesn't
            promise a return, so it's shown as a range, never one number. Verify
            both tracks' terms with your pension office before leaning on these.
          </p>
        </>
      )}
    </>
  );
}
