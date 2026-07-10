import { useState } from 'react';
import { INITIAL_FORM, STEP_REQUIREMENTS } from './lib/formDefaults.js';
import { calculate } from './lib/engine.js';
import { isEmbedded, wantsTransparentBg, fullPageHref } from './lib/embed.js';
import AccountBar from './components/AccountBar.jsx';
import Results from './components/Results.jsx';

// Evaluated once — neither changes without a full page load.
const EMBEDDED = isEmbedded();
if (wantsTransparentBg()) document.body.classList.add('transparent');
import StepAbout from './steps/StepAbout.jsx';
import StepPension from './steps/StepPension.jsx';
import StepDrop from './steps/StepDrop.jsx';
import StepSavings from './steps/StepSavings.jsx';
import StepSocial from './steps/StepSocial.jsx';
import StepReview from './steps/StepReview.jsx';

const STEPS = [
  { id: 'about', title: 'About you', Component: StepAbout },
  { id: 'pension', title: 'Your pension', Component: StepPension },
  { id: 'drop', title: 'DROP', Component: StepDrop },
  { id: 'savings', title: '457(b) savings', Component: StepSavings },
  { id: 'social', title: 'Social Security', Component: StepSocial },
  { id: 'review', title: 'Review', Component: StepReview },
];

function missingFields(stepId, form) {
  const req = STEP_REQUIREMENTS[stepId];
  const fields = typeof req === 'function' ? req(form) : req;
  return fields.filter((f) => form[f] === '' || form[f] == null || isNaN(Number(form[f])));
}

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [stepIdx, setStepIdx] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState(null);
  const [calcError, setCalcError] = useState('');

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const step = STEPS[stepIdx];
  const missing = missingFields(step.id, form);
  const isLast = stepIdx === STEPS.length - 1;

  const next = () => {
    if (missing.length > 0) { setShowErrors(true); return; }
    setShowErrors(false);
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const back = () => { setShowErrors(false); setStepIdx((i) => Math.max(i - 1, 0)); };

  const run = () => {
    try {
      setCalcError('');
      setResult(calculate(form));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setCalcError(err.message);
    }
  };
  const editInputs = () => { setResult(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className={`app ${EMBEDDED ? 'embedded' : ''}`}>
      <header className="masthead">
        <div className="masthead-row">
          <h1>Firefighter Retirement Calculator</h1>
          {EMBEDDED && (
            <a className="fullpage" href={fullPageHref()} target="_blank" rel="noopener">
              Open in full page ↗
            </a>
          )}
        </div>
        <p>Pension + DROP + 457(b), run honestly — ranges, not promises. From <em>Shift to Wealth</em>.</p>
      </header>

      <AccountBar
        formPristine={result === null && JSON.stringify(form) === JSON.stringify(INITIAL_FORM)}
        currentInputs={form}
        onLoadInputs={(inputs) => {
          // Loading a saved scenario returns to the form and clears any
          // results currently on screen (they belonged to the old inputs).
          setForm({ ...INITIAL_FORM, ...inputs });
          setStepIdx(0);
          setShowErrors(false);
          setResult(null);
          setCalcError('');
        }}
      />

      {result ? (
        <Results result={result} onEdit={editInputs} />
      ) : (
        <>
          <nav className="progress" aria-label="Steps">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`prog-step ${i === stepIdx ? 'on' : ''} ${i < stepIdx ? 'done' : ''}`}
                onClick={() => i < stepIdx && setStepIdx(i)}
                disabled={i > stepIdx}
              >
                <span className="prog-num">{i + 1}</span>
                <span className="prog-title">{s.title}</span>
              </button>
            ))}
          </nav>

          <main className="card">
            <h2>{step.title}</h2>
            <step.Component form={form} set={set} />
            {showErrors && missing.length > 0 && (
              <div className="error">{missing.length} required field{missing.length > 1 ? 's are' : ' is'} still empty on this step.</div>
            )}
            {isLast && calcError && <div className="error">{calcError}</div>}
            <div className="nav-row">
              <button type="button" className="btn ghost" onClick={back} disabled={stepIdx === 0}>Back</button>
              {isLast ? (
                <button type="button" className="btn" onClick={run}>Run my numbers</button>
              ) : (
                <button type="button" className="btn" onClick={next}>Next</button>
              )}
            </div>
          </main>
        </>
      )}

      <footer className="fineprint">
        Planning estimate, not financial advice. Your plan document beats this
        calculator every time — verify multipliers and DROP terms with your
        pension office.
      </footer>
    </div>
  );
}
