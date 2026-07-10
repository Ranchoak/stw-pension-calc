// Small shared form primitives so every step lays out the same way.

export function Field({ label, hint, suffix, prefix, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className={`field-input ${suffix ? 'has-suffix' : ''} ${prefix ? 'has-prefix' : ''}`}>
        {prefix && <span className="affix">{prefix}</span>}
        {children}
        {suffix && <span className="affix">{suffix}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function NumberInput({ value, onChange, ...rest }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

// A horizontal set of pill-style radio choices (used for yes/no and toggles).
export function Choice({ value, onChange, options, name }) {
  return (
    <div className="choice" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`choice-pill ${value === opt.value ? 'on' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
