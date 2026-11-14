// Motion pieces in the spirit of React Bits (reactbits.dev), rebuilt dependency-free
// and tuned to the cafe palette: BlurText, CountUp, SpotlightCard, Marquee, ShinyText, Grain.
import { useEffect, useRef, useState } from "react";
import { useInView, usePrefersReducedMotion } from "./hooks.js";

export function BlurText({ text, as: Tag = "h1", className = "", delay = 70, start = 0 }) {
  const [ref, inView] = useInView({ threshold: 0.1 });
  const words = text.split(" ");
  return (
    <Tag ref={ref} className={`blur-text ${inView ? "is-in" : ""} ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className="blur-word" style={{ transitionDelay: `${start + i * delay}ms` }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

export function CountUp({ to, duration = 1600, format = (v) => Math.round(v).toLocaleString(), className = "" }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView || to == null) return;
    if (reduced) { setValue(to); return; }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);
  return <span ref={ref} className={`count-up ${className}`}>{format(value)}</span>;
}

export function SpotlightCard({ children, className = "", as: Tag = "div", tint = "rgba(227, 168, 87, 0.10)", ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Tag ref={ref} onPointerMove={onMove} className={`spotlight ${className}`} style={{ "--spot": tint }} {...rest}>
      {children}
    </Tag>
  );
}

export function Marquee({ items, speed = 40 }) {
  const row = items.map((t, i) => (
    <span key={i} className="marquee-item">
      {t}
      <span className="marquee-dot" aria-hidden="true">●</span>
    </span>
  ));
  return (
    <div className="marquee" aria-label={items.join(", ")}>
      <div className="marquee-track" style={{ animationDuration: `${speed}s` }} aria-hidden="true">
        {row}
        {row}
        {row}
        {row}
      </div>
    </div>
  );
}

export function ShinyText({ children, className = "" }) {
  return <span className={`shiny ${className}`}>{children}</span>;
}

export function Grain() {
  return <div className="grain" aria-hidden="true" />;
}
