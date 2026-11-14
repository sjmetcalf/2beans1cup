import { useMemo, useState } from "react";
import { useData } from "../hooks.js";
import { loadPeople, loadActivities } from "../api.js";
import { fmtMiles, fmtFeet, fmtDuration, fmtPace, fmtWhen, startOfWeek, SPORTS } from "../format.js";
import { Segmented, Empty, Loading, ErrorNote, BeanDot } from "../ui.jsx";
import { BlurText } from "../bits.jsx";
import { Positions, PosFirst } from "../Positions.jsx";

const COLUMNS = [
  { key: "dist", label: "Distance", fmt: (v) => fmtMiles(v) },
  { key: "time", label: "Time", fmt: (v) => fmtDuration(v) },
  { key: "vert", label: "Vert", fmt: (v) => fmtFeet(v) },
  { key: "pace", label: "Pace", sub: "Avg", fmt: (v) => v },
  { key: "hr", label: "Heart rate", sub: "Avg", fmt: (v) => `${Math.round(v)} bpm` },
  { key: "load", label: "Load", sub: "Training", fmt: (v) => Math.round(v).toLocaleString() },
];

function totals(list, sport) {
  const dist = list.reduce((s, a) => s + (a.distance_m || 0), 0);
  const time = list.reduce((s, a) => s + (a.duration_s || 0), 0);
  const vert = list.reduce((s, a) => s + (a.elevation_gain_m || 0), 0);
  const withHr = list.filter((a) => a.avg_hr && a.duration_s);
  const hrTime = withHr.reduce((s, a) => s + a.duration_s, 0);
  const hr = hrTime ? withHr.reduce((s, a) => s + a.avg_hr * a.duration_s, 0) / hrTime : null;
  const load = list.reduce((s, a) => s + (a.training_load || 0), 0);
  return {
    dist: dist || null,
    time: time || null,
    vert: vert || null,
    pace: sport !== "all" && sport !== "other" && dist && time ? fmtPace(dist, time, sport) : null,
    hr,
    load: load || null,
  };
}

export function PourLog() {
  const people = useData(loadPeople);
  const acts = useData(() => loadActivities());
  const [sport, setSport] = useState("all");
  const [who, setWho] = useState("both");

  const ps = people.data || [];
  const byId = Object.fromEntries(ps.map((p) => [p.id, p]));
  const rows = useMemo(
    () => (acts.data || []).filter((a) => (sport === "all" || a.sport === sport) && (who === "both" || a.person_id === who)),
    [acts.data, sport, who],
  );

  const tableRows = rows.map((a) => {
    const p = byId[a.person_id];
    return {
      id: a.id,
      first: <PosFirst dot={p?.color} pill={SPORTS[a.sport]?.label.toUpperCase()} pillColor={p?.color} meta={fmtWhen(a)} title={a.name || "Untitled pour"} />,
      values: {
        dist: a.distance_m || null,
        time: a.duration_s || null,
        vert: a.elevation_gain_m || null,
        pace: a.distance_m && a.duration_s && a.sport !== "other" ? fmtPace(a.distance_m, a.duration_s, a.sport) : null,
        hr: a.avg_hr || null,
        load: a.training_load || null,
      },
    };
  });

  const now = Date.now();
  const windows = [
    { label: "This week", since: startOfWeek(new Date()).getTime() },
    { label: "Last 30 days", since: now - 30 * 864e5 },
    { label: "Season", since: new Date(new Date().getFullYear(), 0, 1).getTime() },
  ];
  const shown = who === "both" ? ps : ps.filter((p) => p.id === who);
  const summaries = rows.length
    ? windows.map((w) => ({
        label: w.label,
        rows: shown.map((p) => ({
          id: `${w.label}-${p.id}`,
          first: <span className="pos-person"><BeanDot person={p} size={10} /> {p.name}</span>,
          values: totals(rows.filter((a) => a.person_id === p.id && new Date(a.start_time).getTime() >= w.since), sport),
        })),
      }))
    : [];

  return (
    <section className="section section-first">
      <p className="eyebrow">The Pour Log</p>
      <BlurText as="h1" text="Every pull, logged." className="page-title" />
      <p className="lede">Every activity from both Garmins, newest first. Swipe the numbers sideways on your phone.</p>

      <div className="toolbar">
        <Segmented
          label="Sport"
          value={sport}
          onChange={setSport}
          options={[{ value: "all", label: "All" }, { value: "ski", label: "Ski" }, { value: "run", label: "Run" }, { value: "bike", label: "Bike" }, { value: "other", label: "Other" }]}
        />
        <Segmented label="Who" value={who} onChange={setWho} options={[{ value: "both", label: "Both" }, ...ps.map((p) => ({ value: p.id, label: p.name }))]} />
      </div>

      {acts.error && <ErrorNote error={acts.error} />}
      {acts.loading || people.loading ? <Loading /> : (
        <Positions
          label="Activities"
          firstLabel="Activity"
          columns={COLUMNS}
          rows={tableRows}
          summaries={summaries}
          empty={<Empty title="No pours match.">Try another filter, or connect Garmin on the <a href="#/barista">Barista</a> page.</Empty>}
        />
      )}
    </section>
  );
}
