// Fidelity-style "positions" table:
// - first column frozen, remaining columns swipe sideways on narrow screens
// - header sticks under the nav and scrolls sideways in sync with the body
// - summary sections at the bottom with pill labels
import { useEffect, useRef } from "react";

export function Positions({ columns, rows, summaries = [], firstLabel = "", firstWidth = 168, colWidth = 96, empty = null, label }) {
  const headRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    const body = bodyRef.current, head = headRef.current;
    if (!body || !head) return;
    const sync = () => { head.scrollLeft = body.scrollLeft; body.parentElement?.classList.toggle("is-scrolled", body.scrollLeft > 2); };
    body.addEventListener("scroll", sync, { passive: true });
    return () => body.removeEventListener("scroll", sync);
  }, []);

  const template = `${firstWidth}px repeat(${columns.length}, minmax(${colWidth}px, 1fr))`;
  const minWidth = firstWidth + columns.length * colWidth;
  const style = { "--pos-cols": template, "--pos-min": `${minWidth}px` };

  const Cell = ({ col, value }) => {
    const v = value?.[col.key];
    const tone = col.tone ? col.tone(v, value) : "";
    return <div className={`pos-cell ${col.align === "left" ? "is-left" : ""} ${tone}`}>{v == null || v === "" ? "--" : col.fmt ? col.fmt(v, value) : v}</div>;
  };

  return (
    <div className="positions" style={style} role="table" aria-label={label}>
      <div className="pos-head" ref={headRef} role="rowgroup">
        <div className="pos-grid pos-head-row" role="row">
          <div className="pos-first pos-th" role="columnheader">{firstLabel}</div>
          {columns.map((c) => (
            <div key={c.key} className={`pos-th ${c.align === "left" ? "is-left" : ""}`} role="columnheader">
              {c.sub && <span className="pos-th-sub">{c.sub}</span>}
              {c.label}
            </div>
          ))}
        </div>
      </div>
      <div className="pos-body" ref={bodyRef} role="rowgroup">
        <div className="pos-inner">
          {rows.length === 0 && empty}
          {rows.map((r) => (
            <div key={r.id} className={`pos-grid pos-row ${r.className || ""}`} role="row" style={r.style}>
              <div className="pos-first" role="rowheader">{r.first}</div>
              {columns.map((c) => <Cell key={c.key} col={c} value={r.values} />)}
            </div>
          ))}
          {summaries.map((s) => (
            <div key={s.label} className="pos-summary" role="rowgroup">
              <div className="pos-summary-label"><span className="pos-pill pos-pill-dark">{s.label}</span></div>
              {s.rows.map((r) => (
                <div key={r.id} className="pos-grid pos-row pos-summary-row" role="row">
                  <div className="pos-first" role="rowheader">{r.first}</div>
                  {columns.map((c) => <Cell key={c.key} col={c} value={r.values} />)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PosFirst({ pill, pillColor, dot, title, meta }) {
  return (
    <div className="pos-id">
      {dot && <span className="pos-dot" style={{ background: dot }} aria-hidden="true" />}
      <div className="pos-id-text">
        <div className="pos-id-top">
          {pill && <span className="pos-pill" style={pillColor ? { "--pill": pillColor } : undefined}>{pill}</span>}
          {meta && <span className="pos-meta">{meta}</span>}
        </div>
        {title && <div className="pos-title">{title}</div>}
      </div>
    </div>
  );
}

// Change helpers (green = more than last period, clay-red = less)
export function pctChange(now, before) {
  if (!before && !now) return null;
  if (!before) return Infinity;
  return ((now - before) / before) * 100;
}
export const fmtPct = (v) => (v === Infinity ? "new" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(0)}%`);
export const toneFor = (v) => (v == null ? "" : v === Infinity || v > 0.5 ? "is-up" : v < -0.5 ? "is-down" : "");
