export function Field({ label, hint, error, children, id }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12.5px] font-medium text-clay-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className = '', ...rest }) {
  return <input className={`field-input ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }) {
  return <textarea className={`field-input resize-none ${className}`} {...rest} />;
}
