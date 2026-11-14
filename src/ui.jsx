// Shared bits of UI
import { SPORTS } from "./format.js";

export function Eyebrow({ children }) {
  return <p className="eyebrow">{children}</p>;
}

export function SectionHead({ eyebrow, title, children }) {
  return (
    <div className="section-head">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2>{title}</h2>
      {children && <p className="lede">{children}</p>}
    </div>
  );
}

export function BeanDot({ person, size = 10 }) {
  if (!person) return null;
  return <span className="bean-dot" style={{ background: person.color, width: size, height: size }} title={person.name} />;
}

export function SportTag({ sport }) {
  const s = SPORTS[sport] || SPORTS.other;
  return <span className={`sport-tag sport-${sport}`}>{s.label}</span>;
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? "is-on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children, art = true }) {
  return (
    <div className="empty">
      {art && <img className="empty-art" src="/favicon.svg" alt="" width="140" height="140" />}
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function Loading() {
  return <div className="loading" aria-label="Loading"><span /><span /><span /></div>;
}

export function ErrorNote({ error }) {
  return <p className="error-note">{String(error?.message || error)}</p>;
}

export function NeedCode() {
  return (
    <p className="need-code">
      Read-only for guests. <a href="#/barista">Enter the barista code</a> to make changes.
    </p>
  );
}
