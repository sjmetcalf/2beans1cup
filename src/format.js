export const SPORTS = {
  ski: { label: "Ski", verb: "Skied", glyph: "❄" },
  run: { label: "Run", verb: "Ran", glyph: "↟" },
  bike: { label: "Bike", verb: "Rode", glyph: "◎" },
  other: { label: "Other", verb: "Moved", glyph: "·" },
};

export const miles = (m) => (m == null ? null : m / 1609.344);
export const feet = (m) => (m == null ? null : m * 3.28084);

export function fmtMiles(m, digits = 1) {
  const v = miles(m);
  return v == null || v === 0 ? "—" : `${v.toFixed(digits)} mi`;
}
export function fmtFeet(m) {
  const v = feet(m);
  return v == null || v === 0 ? "—" : `${Math.round(v).toLocaleString()} ft`;
}
export function fmtDuration(s) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
export function fmtHours(s) {
  return s ? `${(s / 3600).toFixed(1)} h` : "—";
}
export function fmtPace(distM, durS, sport) {
  if (!distM || !durS) return "—";
  if (sport === "bike") return `${(miles(distM) / (durS / 3600)).toFixed(1)} mph`;
  const secPerMile = durS / miles(distM);
  const mm = Math.floor(secPerMile / 60);
  const ss = Math.round(secPerMile % 60);
  return `${mm}:${String(ss).padStart(2, "0")} /mi`;
}

// Dates. Date-only strings (YYYY-MM-DD) are treated as local calendar days.
export function parseDay(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}
export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export function activityDay(a) {
  if (a.start_time_local) return a.start_time_local.slice(0, 10);
  return dayKey(new Date(a.start_time));
}
export function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDay(dateStr) - today) / 864e5);
}
export function fmtDay(dateStr, opts = { month: "short", day: "numeric" }) {
  return parseDay(dateStr).toLocaleDateString("en-US", opts);
}
export function fmtWhen(a) {
  const d = parseDay(activityDay(a));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday start
  d.setDate(d.getDate() - dow);
  return d;
}
