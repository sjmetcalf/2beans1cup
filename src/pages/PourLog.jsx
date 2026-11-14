import { useState } from "react";
import { useData } from "../hooks.js";
import { loadPeople, loadActivities } from "../api.js";
import { fmtMiles, fmtFeet, fmtDuration, fmtPace, fmtWhen } from "../format.js";
import { SectionHead, BeanDot, SportTag, Segmented, Empty, Loading, ErrorNote } from "../ui.jsx";
import { BlurText } from "../bits.jsx";

export function PourLog() {
  const people = useData(loadPeople);
  const acts = useData(() => loadActivities());
  const [sport, setSport] = useState("all");
  const [who, setWho] = useState("both");

  const byId = Object.fromEntries((people.data || []).map((p) => [p.id, p]));
  const rows = (acts.data || []).filter((a) => (sport === "all" || a.sport === sport) && (who === "both" || a.person_id === who));

  return (
    <section className="section section-first">
      <p className="eyebrow">The Pour Log</p>
      <BlurText as="h1" text="Every pull, logged." className="page-title" />
      <p className="lede">Every activity from both Garmins, newest first. Distances in miles, climbing in feet.</p>

      <div className="toolbar">
        <Segmented
          label="Sport"
          value={sport}
          onChange={setSport}
          options={[{ value: "all", label: "All" }, { value: "ski", label: "Ski" }, { value: "run", label: "Run" }, { value: "bike", label: "Bike" }, { value: "other", label: "Other" }]}
        />
        <Segmented
          label="Who"
          value={who}
          onChange={setWho}
          options={[{ value: "both", label: "Both" }, ...(people.data || []).map((p) => ({ value: p.id, label: p.name }))]}
        />
      </div>

      {acts.error && <ErrorNote error={acts.error} />}
      {acts.loading ? <Loading /> : rows.length === 0 ? (
        <Empty title="No pours match.">Try another filter, or connect Garmin on the <a href="#/barista">Barista</a> page.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="log-table">
            <thead>
              <tr>
                <th>Date</th><th>Who</th><th>Sport</th><th>Name</th>
                <th className="num">Distance</th><th className="num">Time</th><th className="num">Vert</th><th className="num">Pace</th><th className="num">Avg HR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const p = byId[a.person_id];
                return (
                  <tr key={a.id}>
                    <td className="nowrap">{fmtWhen(a)}</td>
                    <td className="nowrap"><BeanDot person={p} /> {p?.name}</td>
                    <td><SportTag sport={a.sport} /></td>
                    <td className="name-cell">{a.name}</td>
                    <td className="num">{fmtMiles(a.distance_m)}</td>
                    <td className="num">{fmtDuration(a.duration_s)}</td>
                    <td className="num">{fmtFeet(a.elevation_gain_m)}</td>
                    <td className="num">{fmtPace(a.distance_m, a.duration_s, a.sport)}</td>
                    <td className="num">{a.avg_hr ? Math.round(a.avg_hr) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
