import { RING } from "./badgeRing.js";

// The 2beans1cup badge: lettering ring (slowly turns, like a stamp being pressed) + the beans.
export function Badge({ size = 320, spin = true, tone = "cream", className = "" }) {
  const art = tone === "cream" ? "/assets/beans-cream.webp" : "/assets/beans-roast.webp";
  // Illustration box from logo/build_badge.py: 590 wide, aspect 383:315
  const w = 590;
  const h = (w * 315) / 383;
  return (
    <svg
      className={`badge ${spin ? "badge-spin" : ""} badge-${tone} ${className}`}
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      role="img"
      aria-label="Two Beans, One Cup"
    >
      <g className="badge-ring" dangerouslySetInnerHTML={{ __html: RING }} />
      <image href={art} x={500 - w / 2} y={500 - h / 2 + 6} width={w} height={h} />
    </svg>
  );
}
