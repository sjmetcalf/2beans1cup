import { useMemo, useState } from "react";
import { useData } from "../hooks.js";
import { loadPeople, loadActivities } from "../api.js";
import { fmtMiles, fmtFeet, fmtDuration, fmtPace, fmtWhen, startOfWeek, SPORTS } from "../format.js";
import { Segmented, Empty, Loading, ErrorNote, BeanDot } from "../ui.jsx";
import { BlurText } from "../bits.jsx";
import { Positions, PosFirst } from "../Positions.jsx";
import { GlanceTile, ZonesTile, ActivityTile, SportIcon } from "../Tiles.jsx";
import { miles as toMiles, feet as toFeet } from "../format.js";

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

const WEEK = 7 * 864e5;
const METRIC_TILES = [
  { key: "dist", title: "Distance", unit: "miles", get: (a) => toMiles(a.distance_m || 0), fmt: (v) => v.toFixed(1), icon: <SportIcon sport="run" size={18} /> },
  { key: "vert", title: "Vert", unit: "feet", get: (a) => toFeet(a.elevation_gain_m || 0), fmt: (v) => Math.round(v).toLocaleString(), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="m3 19 6-10 4 6 3-4 5 8z" /></svg> },
  { key: "time", title: "Time", unit: "hours", get: (a) => (a.duration_s || 0) / 3600, fmt: (v) => v.toFixed(1), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M10 2h4" /></svg> },
];

function weekLabel(start) {
  const thisWeek = startOfWeek(new Date()).getTime();
  if (start === thisWeek) return "This week";
  if (start === thisWeek - WEEK) return "Last week";
  const d = new Date(start);
  return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function TilesView({ rows, shown, byId }) {
  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = rows.filter((a) => new Date(a.start_time).getTime() >= weekStart);
  const prior = rows.filter((a) => { const t = new Date(a.start_time).getTime(); return t >= weekStart - 4 * WEEK && t < weekStart; });
  // Usual week = average of the previous 4 weeks, scaled to how far into this week we are
  const elapsed = Math.min(1, Math.max(1 / 7, (Date.now() - weekStart) / WEEK));
  const groups = [];
  for (const a of rows) {
    const ws = startOfWeek(new Date(a.start_time)).getTime();
    let g = groups[groups.length - 1];
    if (!g || g.start !== ws) { g = { start: ws, items: [] }; groups.push(g); }
    g.items.push(a);
  }
  return (
    <>
      <div className="glance-head">
        <h2 className="col-title">This week at a glance</h2>
        <p className="muted small">Rings fill toward your usual week so far (average of the last 4 weeks).</p>
      </div>
      <div className="glance-grid">
        {METRIC_TILES.map((m) => {
          const parts = shown.map((p) => ({ value: thisWeek.filter((a) => a.person_id === p.id).reduce((s, a) => s + m.get(a), 0), color: p.color }));
          const total = parts.reduce((s, x) => s + x.value, 0);
          const usual = prior.length ? (prior.reduce((s, a) => s + m.get(a), 0) / 4) * elapsed : 0;
          return <GlanceTile key={m.key} title={m.title} icon={m.icon} unit={m.unit} parts={parts} target={usual} total={total} fmt={m.fmt} people={shown} />;
        })}
        <ZonesTile acts={thisWeek} />
      </div>

      {groups.map((g) => (
        <section key={g.start} className="week-group">
          <div className="week-group-head">
            <h2 className="col-title">{weekLabel(g.start)}</h2>
            <p className="muted small">
              {g.items.length} {g.items.length === 1 ? "pour" : "pours"} · {toMiles(g.items.reduce((s, a) => s + (a.distance_m || 0), 0)).toFixed(1)} mi · {(g.items.reduce((s, a) => s + (a.duration_s || 0), 0) / 3600).toFixed(1)} h
            </p>
          </div>
          <div className="act-grid">
            {g.items.map((a) => <ActivityTile key={a.id} a={a} person={byId[a.person_id]} />)}
          </div>
        </section>
      ))}
    </>
  );
}

export function PourLog() {
  const people = useData(loadPeople);
  const acts = useData(() => loadActivities());
  const [sport, setSport] = useState("all");
  const [who, setWho] = useState("both");
  const [view, setView] = useState(() => { try { return localStorage.getItem("2b1c.logview") || "tiles"; } catch { return "tiles"; } });
  const pickView = (v) => { setView(v); try { localStorage.setItem("2b1c.logview", v); } catch { /* ignore */ } };

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
      <p className="lede">Every activity from both Garmins, newest first.</p>

      <div className="toolbar">
        <Segmented
          label="Sport"
          value={sport}
          onChange={setSport}
          options={[{ value: "all", label: "All" }, { value: "ski", label: "Ski" }, { value: "run", label: "Run" }, { value: "bike", label: "Bike" }, { value: "other", label: "Other" }]}
        />
        <Segmented label="Who" value={who} onChange={setWho} options={[{ value: "both", label: "Both" }, ...ps.map((p) => ({ value: p.id, label: p.name }))]} />
        <Segmented label="View" value={view} onChange={pickView} options={[{ value: "tiles", label: "Tiles" }, { value: "table", label: "Table" }]} />
      </div>

      {acts.error && <ErrorNote error={acts.error} />}
      {acts.loading || people.loading ? <Loading /> : rows.length === 0 ? (
        <Empty title="No pours match.">Try another filter, or connect Garmin on the <a href="#/barista">Barista</a> page.</Empty>
      ) : view === "tiles" ? (
        <TilesView rows={rows} shown={shown} byId={byId} />
      ) : (
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
