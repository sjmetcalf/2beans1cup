// Garmin "At a Glance"-style tiles for the Pour Log.
import { useInView } from "./hooks.js";
import { CountUp } from "./bits.jsx";
import { BeanDot } from "./ui.jsx";
import { SPORTS, fmtDuration, fmtFeet, fmtPace, fmtWhen, miles } from "./format.js";

// ---- sport icons (simple line drawings) ----
export function SportIcon({ sport, size = 20 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (sport === "ski") return (
    <svg {...common}><path d="M4 20 20 4" /><path d="M8 21l13-13" /><circle cx="15.5" cy="5" r="1.6" /><path d="m13 9-3 3 3 2-2 4" /></svg>
  );
  if (sport === "run") return (
    <svg {...common}><circle cx="14.5" cy="4.5" r="1.8" /><path d="m9 21 3-6 3 2v4" /><path d="M6 12l3-4 4 1 2 3 3 1" /><path d="m12 15-2-4" /></svg>
  );
  if (sport === "bike") return (
    <svg {...common}><circle cx="5.5" cy="16.5" r="3.5" /><circle cx="18.5" cy="16.5" r="3.5" /><path d="M5.5 16.5 9 9h6l3.5 7.5M9 9l3 7.5h-6.5M14 6h2l-1 3" /></svg>
  );
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>;
}

// ---- ring gauge: 270° arc, one segment per person, track = "usual week" ----
export function Gauge({ parts, target, size = 132, stroke = 10, children }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75; // 270°
  const total = parts.reduce((s, p) => s + p.value, 0);
  const scale = Math.max(target || 0, total, 1e-9);
  let offset = 0;
  return (
    <div className="gauge" ref={ref} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="gauge-track" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
          {parts.map((p, i) => {
            const len = (p.value / scale) * arc;
            const gap = parts.length > 1 && len > 4 ? 3 : 0;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${inView ? Math.max(0, len - gap) : 0} ${c}`} strokeDashoffset={-offset} className="gauge-seg" />
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <div className="gauge-center">{children}</div>
    </div>
  );
}

export function GlanceTile({ title, icon, parts, target, total, fmt, unit, people }) {
  const pct = target ? Math.round((total / target) * 100) : null;
  return (
    <div className="tile glance-tile">
      <p className="tile-title">{icon}<span>{title}</span></p>
      <Gauge parts={parts} target={target}>
        <strong><CountUp to={total} format={fmt} /></strong>
        <span>{unit}</span>
      </Gauge>
      <div className="tile-foot">
        <p className="tile-big">{pct == null ? "First week" : `${pct}%`}<span> of a usual week</span></p>
        <p className="tile-split">
          {people.map((p, i) => (
            <span key={p.id}><BeanDot person={p} size={7} /> {p.name} {fmt(parts[i]?.value || 0)}</span>
          ))}
        </p>
      </div>
    </div>
  );
}

// Heart-rate zones tile: how the week's time split between easy and hard
const ZONE_COLORS = ["#b9aea2", "#6f9cc2", "#6fa77f", "#d8913f", "#c4553f"];
const ZONE_NAMES = ["Warm-up", "Easy", "Aerobic", "Threshold", "Max"];
export function ZonesTile({ acts }) {
  const zones = [0, 0, 0, 0, 0];
  acts.forEach((a) => (a.hr_zones_s || []).forEach((s, i) => { if (s) zones[i] += s; }));
  const total = zones.reduce((s, v) => s + v, 0);
  const easy = total ? Math.round(((zones[0] + zones[1] + zones[2]) / total) * 100) : null;
  return (
    <div className="tile glance-tile zones-tile">
      <p className="tile-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg><span>Heart-rate zones</span></p>
      {total ? (
        <>
          <div className="zones-big"><strong>{easy}%</strong><span>easy / aerobic</span></div>
          <div className="zones-bar" role="img" aria-label={ZONE_NAMES.map((n, i) => `${n} ${Math.round((zones[i] / total) * 100)}%`).join(", ")}>
            {zones.map((z, i) => z > 0 && <span key={i} style={{ flexGrow: z, background: ZONE_COLORS[i] }} />)}
          </div>
          <ul className="zones-legend">
            {zones.map((z, i) => (
              <li key={i}><span className="zone-swatch" style={{ background: ZONE_COLORS[i] }} />Z{i + 1} <span className="muted">{fmtDuration(z)}</span></li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted small zones-empty">No heart-rate data this week yet.</p>
      )}
    </div>
  );
}

// One activity as a tile
export function ActivityTile({ a, person }) {
  const timeFirst = a.sport === "other" || !a.distance_m;
  const zones = a.hr_zones_s && a.hr_zones_s.some(Boolean) ? a.hr_zones_s : null;
  const pace = a.distance_m && a.duration_s && a.sport !== "other" ? fmtPace(a.distance_m, a.duration_s, a.sport) : null;
  return (
    <article className="tile act-tile" style={{ "--bean": person?.color }}>
      <header className="act-head">
        <span className={`act-icon sport-${a.sport}`}><SportIcon sport={a.sport} /></span>
        <div className="act-id">
          <h3 title={a.name}>{a.name || SPORTS[a.sport].label}</h3>
          <p><BeanDot person={person} size={7} /> {person?.name} · {fmtWhen(a)}</p>
        </div>
      </header>
      <p className="act-big">
        {timeFirst ? fmtDuration(a.duration_s) : <>{miles(a.distance_m).toFixed(1)}<span>mi</span></>}
      </p>
      <dl className="act-stats">
        {!timeFirst && <div><dt>Time</dt><dd>{fmtDuration(a.duration_s)}</dd></div>}
        <div><dt>Vert</dt><dd>{fmtFeet(a.elevation_gain_m)}</dd></div>
        {pace && <div><dt>{a.sport === "bike" ? "Speed" : "Pace"}</dt><dd>{pace}</dd></div>}
        {a.avg_hr ? <div><dt>Avg HR</dt><dd>{Math.round(a.avg_hr)}</dd></div> : null}
      </dl>
      {zones && (
        <div className="zones-bar zones-bar-thin" role="img" aria-label="Heart-rate zones">
          {zones.map((z, i) => z > 0 && <span key={i} style={{ flexGrow: z, background: ZONE_COLORS[i] }} />)}
        </div>
      )}
    </article>
  );
}
