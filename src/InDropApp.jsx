import { useState } from 'react';
import { INITIAL_FORM, STEP_REQUIREMENTS } from './lib/indropFormDefaults.js';
import { calculateInDrop } from './lib/indropEngine.js';
import { isEmbedded, wantsTransparentBg, fullPageHref } from './lib/embed.js';
import InDropResults from './components/InDropResults.jsx';

// Evaluated once — neither changes without a full page load.
const EMBEDDED = isEmbedded();
if (wantsTransparentBg()) document.body.classList.add('transparent');
import StepInDropStatus from './indrop-steps/StepInDropStatus.jsx';
import StepPlanTerms from './indrop-steps/StepPlanTerms.jsx';
import StepConversion from './indrop-steps/StepConversion.jsx';
import StepInDropReview from './indrop-steps/StepInDropReview.jsx';

const STEPS = [
  { id: 'drop', title: 'Your DROP', Component: StepInDropStatus },
  { id: 'terms', title: 'Plan terms', Component: StepPlanTerms },
  { id: 'selfdirected', title: 'Self-directed option', Component: StepConversion },
  { id: 'review', title: 'Review', Component: StepInDropReview },
];

function missingFields(stepId, form) {
  const req = STEP_REQUIREMENTS[stepId];
  const fields = typeof req === 'function' ? req(form) : req;
  // Dates aren't numbers, so a field passes if it parses as either.
  return fields.filter((f) => {
    const v = form[f];
    if (v === '' || v == null) return true;
    return isNaN(Number(v)) && isNaN(Date.parse(v));
  });
}

export default function InDropApp() {
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
      setResult(calculateInDrop(form));
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
          <h1>In-DROP Calculator</h1>
          {EMBEDDED && (
            <a className="fullpage" href={fullPageHref()} target="_blank" rel="noopener">
              Open in full page ↗
            </a>
          )}
        </div>
        <p>Already in DROP? Project your balance from the number your board gave you. From <em>Shift to Wealth</em>.</p>
      </header>

      {result ? (
        <InDropResults result={result} onEdit={editInputs} />
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
        calculator every time — verify DROP rates and terms with your pension
        office.
      </footer>
    </div>
  );
}
