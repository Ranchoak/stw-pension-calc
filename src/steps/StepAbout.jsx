import { Field, NumberInput } from '../components/Field.jsx';

export default function StepAbout({ form, set }) {
  return (
    <>
      <p className="step-intro">
        The basics — where you are today. Nothing leaves this page unless you
        sign in and choose to save.
      </p>
      <div className="grid">
        <Field label="Current age">
          <NumberInput value={form.age} onChange={(v) => set('age', v)} min="18" max="70" placeholder="38" />
        </Field>
        <Field label="Years of service so far" hint="Credited pension service, not calendar years on the job if they differ.">
          <NumberInput value={form.yearsOfService} onChange={(v) => set('yearsOfService', v)} min="0" max="50" placeholder="12" />
        </Field>
        <Field label="Current annual salary" prefix="$" hint="Base pensionable pay. Skip overtime unless your system counts it.">
          <NumberInput value={form.salary} onChange={(v) => set('salary', v)} min="0" step="1000" placeholder="95000" />
        </Field>
        <Field label="Expected annual raises" suffix="%" hint="Step increases + COLAs on pay, averaged. 2–4% is typical.">
          <NumberInput value={form.raisePct} onChange={(v) => set('raisePct', v)} min="0" max="15" step="0.5" />
        </Field>
      </div>
    </>
  );
}
