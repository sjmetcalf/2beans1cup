import { useMemo, useState } from "react";
import { useData } from "../hooks.js";
import { loadPeople, loadActivities } from "../api.js";
import { miles, feet, startOfWeek, SPORTS } from "../format.js";
import { Segmented, Loading, Empty, ErrorNote, BeanDot } from "../ui.jsx";
import { BlurText, CountUp } from "../bits.jsx";

const METRICS = [
  { key: "dist", label: "Miles", get: (a) => miles(a.distance_m || 0), fmt: (v) => v.toFixed(1) },
  { key: "vert", label: "Vert ft", get: (a) => feet(a.elevation_gain_m || 0), fmt: (v) => Math.round(v).toLocaleString() },
  { key: "time", label: "Hours", get: (a) => (a.duration_s || 0) / 3600, fmt: (v) => v.toFixed(1) },
  { key: "count", label: "Pours", get: () => 1, fmt: (v) => Math.round(v).toString() },
];

function sum(list, get) {
  return list.reduce((s, a) => s + get(a), 0);
}

function DuelRow({ label, people, values, fmt }) {
  const max = Math.max(...values, 0.0001);
  return (
    <div className="duel-row">
      <p className="duel-label">{label}</p>
      <div className="duel-bars">
        {people.map((p, i) => (
          <div key={p.id} className="duel-bar">
            <span className="duel-fill" style={{ width: `${(values[i] / max) * 100}%`, background: p.color }} />
            <span className="duel-val">{fmt(values[i])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyChart({ people, acts, weeks, metric }) {
  const m = METRICS.find((x) => x.key === metric);
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() - 7 * (weeks - 1));
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 7 * i);
    return { start: d, vals: people.map(() => 0) };
  });
  acts.forEach((a) => {
    const t = new Date(a.start_time);
    const idx = Math.floor((startOfWeek(t) - start) / (7 * 864e5));
    const pi = people.findIndex((p) => p.id === a.person_id);
    if (idx >= 0 && idx < weeks && pi >= 0) buckets[idx].vals[pi] += m.get(a);
  });
  const max = Math.max(...buckets.flatMap((b) => b.vals), 0.0001);
  const W = 760, H = 220, padL = 36, padB = 26, padT = 10;
  const bw = (W - padL) / weeks;
  const barW = Math.max(3, (bw - 6) / people.length);
  const ticks = [0, 0.5, 1].map((f) => f * max);

  return (
    <svg className="weekly-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Weekly ${m.label} for each of us`}>
      {ticks.map((t, i) => {
        const y = H - padB - (t / max) * (H - padB - padT);
        return (
          <g key={i}>
            <line x1={padL} x2={W} y1={y} y2={y} className="grid-line" />
            <text x={padL - 6} y={y + 4} className="axis-label" textAnchor="end">{m.fmt(t)}</text>
          </g>
        );
      })}
      {buckets.map((b, i) => (
        <g key={i} transform={`translate(${padL + i * bw + 3},0)`}>
          {b.vals.map((v, pi) => {
            const h = (v / max) * (H - padB - padT);
            return (
              <rect key={pi} x={pi * barW} y={H - padB - h} width={barW - 1} height={Math.max(0, h)} rx="2" fill={people[pi].color}>
                <title>{`${people[pi].name}, week of ${b.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${m.fmt(v)} ${m.label.toLowerCase()}`}</title>
              </rect>
            );
          })}
          {(i % Math.ceil(weeks / 8) === 0) && (
            <text x={(bw - 6) / 2} y={H - 8} className="axis-label" textAnchor="middle">
              {b.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function SideBySide() {
  const people = useData(loadPeople);
  const acts = useData(() => loadActivities());
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState("time");

  const filtered = useMemo(() => {
    const since = Date.now() - days * 864e5;
    return (acts.data || []).filter((a) => new Date(a.start_time).getTime() >= since);
  }, [acts.data, days]);

  const ps = people.data || [];
  const weeks = days <= 30 ? 6 : days <= 90 ? 13 : 26;

  return (
    <section className="section section-first">
      <p className="eyebrow">Side by Side</p>
      <BlurText as="h1" text="Same beans, different roasts." className="page-title" />
      <p className="lede">How the two of us stack up by sport. Bars are scaled to whoever did more.</p>

      <div className="toolbar">
        <Segmented label="Period" value={days} onChange={setDays} options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }, { value: 365, label: "Year" }]} />
        <div className="legend">
          {ps.map((p) => <span key={p.id}><BeanDot person={p} size={12} /> {p.name}</span>)}
        </div>
      </div>

      {acts.error && <ErrorNote error={acts.error} />}
      {people.loading || acts.loading ? <Loading /> : !filtered.length ? (
        <Empty title="No pours in this window.">Pick a longer period, or connect Garmin on the <a href="#/barista">Barista</a> page.</Empty>
      ) : (
        <>
          <div className="totals-grid">
            {ps.map((p) => {
              const mine = filtered.filter((a) => a.person_id === p.id);
              return (
                <div key={p.id} className="split-card" style={{ "--bean": p.color }}>
                  <p className="split-name"><BeanDot person={p} size={12} /> {p.name}</p>
                  <dl className="split-stats">
                    {METRICS.map((m) => (
                      <div key={m.key}><dt>{m.label}</dt><dd><CountUp to={sum(mine, m.get)} format={m.fmt} /></dd></div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>

          <div className="duel-grid">
            {["ski", "run", "bike", "other"].map((sport) => {
              const list = filtered.filter((a) => a.sport === sport);
              if (!list.length) return null;
              return (
                <div key={sport} className="duel-card">
                  <h3>{SPORTS[sport].label}</h3>
                  {METRICS.map((m) => (
                    <DuelRow
                      key={m.key}
                      label={m.label}
                      people={ps}
                      values={ps.map((p) => sum(list.filter((a) => a.person_id === p.id), m.get))}
                      fmt={m.fmt}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          <div className="chart-card">
            <div className="chart-head">
              <h3>Week by week</h3>
              <Segmented label="Metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.key, label: m.label }))} />
            </div>
            <WeeklyChart people={ps} acts={acts.data || []} weeks={weeks} metric={metric} />
          </div>
        </>
      )}
    </section>
  );
}
