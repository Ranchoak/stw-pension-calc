import { Field, NumberInput, Choice } from '../components/Field.jsx';
import { elapsedDropTime } from '../lib/indropEngine.js';

export default function StepConversion({ form, set }) {
  const converting = form.selfDirected === 'yes';
  let elapsedYears = null;
  try {
    if (form.dropEntryDate) elapsedYears = elapsedDropTime(form.dropEntryDate).fractionalYears;
  } catch { /* future entry date — step 1 already flags it */ }
  const minConvert = elapsedYears == null ? 1 : Math.max(1, Math.ceil(elapsedYears));

  return (
    <>
      <p className="step-intro">
        Some plans let you convert DROP money to a self-directed account you
        invest yourself — and converting opens a 10-year window instead of the
        usual 8. More upside, more risk: we'll show it as a range, not a
        promise.
      </p>
      <Choice
        name="Self-directed conversion"
        value={form.selfDirected}
        onChange={(v) => set('selfDirected', v)}
        options={[
          { value: 'no', label: 'No — stay with plan rates' },
          { value: 'yes', label: 'Yes — convert to the 10-year self-directed option' },
        ]}
      />
      <div className="grid" style={{ marginTop: 16 }}>
        <Field
          label="DROP exit year"
          hint={converting
            ? 'Whole years from your entry date. Converting unlocks years 9 and 10.'
            : 'Whole years from your entry date. Without converting, DROP ends at year 8.'}
        >
          <NumberInput value={form.exitYear} onChange={(v) => set('exitYear', v)} min="2" max={converting ? '10' : '8'} step="1" />
        </Field>
        {converting && (
          <Field
            label="Convert at year"
            hint={`Whole DROP year when the conversion happens — now${elapsedYears != null ? ` (year ${minConvert})` : ''} or any later point before you exit.`}
          >
            <NumberInput value={form.convertAtYear} onChange={(v) => set('convertAtYear', v)} min={String(minConvert)} max="8" step="1" placeholder={String(minConvert)} />
          </Field>
        )}
      </div>
      {converting && (
        <div className="grid">
          <Field label="How much to self-direct" suffix="%" hint="% of your balance at that point that moves to the self-directed account. From then on, new pension deposits go there too — only what you leave behind stays on plan rates.">
            <NumberInput value={form.convertPct} onChange={(v) => set('convertPct', v)} min="0" max="100" step="5" />
          </Field>
          <Field label="Stock allocation" suffix="% stocks" hint="The rest is modeled as bonds. More stocks = higher middle, wider range.">
            <NumberInput value={form.equityPct} onChange={(v) => set('equityPct', v)} min="0" max="100" step="5" />
          </Field>
        </div>
      )}
    </>
  );
}
