import { Field, NumberInput, DateInput } from '../components/Field.jsx';
import { elapsedDropTime } from '../lib/indropEngine.js';

// Live read-back of the entry date so the user can confirm it immediately —
// a wrong year here quietly poisons every number downstream.
function elapsedStatus(dateStr) {
  if (!dateStr) return null;
  try {
    const t = elapsedDropTime(dateStr);
    const months = Math.floor(t.days / 30.44);
    if (t.years === 0 && months === 0) {
      return { ok: true, text: "You're on day one (or close to it) — we'll project your whole DROP window from scratch." };
    }
    const y = t.years === 1 ? '1 year' : `${t.years} years`;
    const m = months === 1 ? '1 month' : `${months} months`;
    return { ok: true, text: `You're ${y}, ${m} into DROP.` };
  } catch {
    return { ok: false, text: 'That entry date is in the future — double-check it.' };
  }
}

export default function StepInDropStatus({ form, set }) {
  const status = elapsedStatus(form.dropEntryDate);
  return (
    <>
      <p className="step-intro">
        You're already in DROP, so the hard part is done — your pension board
        froze your monthly pension when you entered. We just need that number
        and when the clock started.
      </p>
      <div className="grid">
        <Field label="DROP entry date" hint="The date you entered DROP — it's on your entry paperwork.">
          <DateInput value={form.dropEntryDate} onChange={(v) => set('dropEntryDate', v)} />
        </Field>
        <Field label="Monthly pension amount" prefix="$" hint="The frozen monthly benefit credited to your DROP account each month.">
          <NumberInput value={form.monthlyPensionAmount} onChange={(v) => set('monthlyPensionAmount', v)} min="0" placeholder="5,000" />
        </Field>
      </div>
      {status && (
        <div className={status.ok ? 'notice' : 'error'} style={{ marginTop: 4 }}>{status.text}</div>
      )}
      <Field
        label="Current DROP balance (optional)"
        prefix="$"
        hint="From your most recent DROP statement, if you have one — we'll use it instead of estimating from scratch."
      >
        <NumberInput value={form.knownCurrentBalance} onChange={(v) => set('knownCurrentBalance', v)} min="0" placeholder="Leave blank to estimate from your entry date" />
      </Field>
    </>
  );
}
