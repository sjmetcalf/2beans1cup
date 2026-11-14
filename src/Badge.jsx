import { RING } from "./badgeRing.js";
import { MARK } from "./markArt.js";

// The Doppio Drifters badge: lettering ring (slowly turns) + the drifting doppio.
export function Badge({ size = 320, spin = true, tone = "roast", className = "" }) {
  return (
    <svg
      className={`badge ${spin ? "badge-spin" : ""} badge-${tone} ${className}`}
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      role="img"
      aria-label="Doppio Drifters"
    >
      <g className="badge-ring" dangerouslySetInnerHTML={{ __html: RING }} />
      <g className="badge-art" dangerouslySetInnerHTML={{ __html: MARK }} />
    </svg>
  );
}
