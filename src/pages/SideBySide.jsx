import { useMemo, useState } from "react";
import { useData, useInView } from "../hooks.js";
import { loadPeople, loadActivities } from "../api.js";
import { miles, feet, startOfWeek, SPORTS } from "../format.js";
import { Segmented, Loading, Empty, ErrorNote, BeanDot } from "../ui.jsx";
import { BlurText } from "../bits.jsx";
import { Positions, PosFirst, pctChange, fmtPct, toneFor } from "../Positions.jsx";

const METRICS = [
  { key: "dist", label: "Miles", unit: "mi", get: (a) => miles(a.distance_m || 0), fmt: (v) => v.toFixed(1) },
  { key: "vert", label: "Vert", unit: "ft", get: (a) => feet(a.elevation_gain_m || 0), fmt: (v) => Math.round(v).toLocaleString() },
  { key: "time", label: "Hours", unit: "h", get: (a) => (a.duration_s || 0) / 3600, fmt: (v) => v.toFixed(1) },
  { key: "count", label: "Pours", unit: "", get: () => 1, fmt: (v) => Math.round(v).toString() },
];

const sum = (list, get) => list.reduce((s, a) => s + get(a), 0);

// Each bean gets a gradient from its own color to a lighter, warmer tint (oec.fyi-style brand stroke).
function tint(hex, amount = 0.38) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c, t) => Math.round(c + (t - c) * amount);
  const r = mix((n >> 16) & 255, 0xe8), g = mix((n >> 8) & 255, 0xc9), b = mix(n & 255, 0x9a);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
const gradId = (p) => `bean-grad-${p.id}`;

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function TrendChart({ people, acts, weeks, metric }) {
  const [ref, inView] = useInView({ threshold: 0.25 });
  const m = METRICS.find((x) => x.key === metric);
  const width = 960;
  const height = 300;
  const pad = { left: 40, right: 16, top: 16, bottom: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const start = startOfWeek(new Date());
  start.setDate(start.getDate() - 7 * (weeks - 1));
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 7 * i);
    return { start: d, vals: people.map(() => 0) };
  });
  acts.forEach((a) => {
    const idx = Math.floor((startOfWeek(new Date(a.start_time)) - start) / (7 * 864e5));
    const pi = people.findIndex((p) => p.id === a.person_id);
    if (idx >= 0 && idx < weeks && pi >= 0) buckets[idx].vals[pi] += m.get(a);
  });

  const all = buckets.flatMap((b) => b.vals);
  const top = niceMax(Math.max(...all, 0));
  const avg = all.length ? all.reduce((s, v) => s + v, 0) / all.length : 0;
  const x = (i) => (weeks <= 1 ? pad.left + innerW / 2 : pad.left + (i / (weeks - 1)) * innerW);
  const y = (v) => pad.top + (1 - v / top) * innerH;
  const labelEvery = Math.ceil(weeks / 6);

  const series = people.map((p, pi) => {
    const pts = buckets.map((b, i) => ({ x: x(i), y: y(b.vals[pi]), v: b.vals[pi], week: b.start }));
    const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
    return { p, pts, d };
  });

  const label = series
    .map((s) => `${s.p.name}: ${s.pts.map((pt) => `${pt.week.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${m.fmt(pt.v)}`).join(", ")}`)
    .join(". ");

  return (
    <svg ref={ref} className={`trend-chart ${inView ? "is-in" : ""}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Weekly ${m.label.toLowerCase()}. ${label}`}>
      <defs>
        {people.map((p) => (
          <linearGradient key={p.id} id={gradId(p)} gradientUnits="userSpaceOnUse" x1={pad.left} y1="0" x2={width - pad.right} y2="0">
            <stop offset="0%" stopColor={p.color} />
            <stop offset="100%" stopColor={tint(p.color)} />
          </linearGradient>
        ))}
      </defs>
      {[0, top].map((mark) => (
        <g key={mark}>
          <line className="trend-grid" x1={pad.left} x2={width - pad.right} y1={y(mark)} y2={y(mark)} />
          <text className="trend-label" x={pad.left - 8} y={y(mark) + 4} textAnchor="end">{m.fmt(mark)}</text>
        </g>
      ))}
      {avg > 0 && (
        <g>
          <line className="trend-ref" x1={pad.left} x2={width - pad.right} y1={y(avg)} y2={y(avg)} />
          <text className="trend-label" x={pad.left - 8} y={y(avg) + 4} textAnchor="end">{m.fmt(avg)}</text>
        </g>
      )}
      {buckets.map((b, i) =>
        i % labelEvery === 0 || i === weeks - 1 ? (
          <text key={i} className="trend-label" x={x(i)} y={height - 8} textAnchor="middle">
            {b.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        ) : null,
      )}
      {series.map((s) => (
        <g key={s.p.id}>
          {s.pts.length > 1 && <path className="trend-line" d={s.d} stroke={`url(#${gradId(s.p)})`} pathLength="1" />}
          {s.pts.map((pt, i) => (
            <circle key={i} className="trend-point" cx={pt.x} cy={pt.y} r={weeks > 16 ? 3.5 : 5} stroke={`url(#${gradId(s.p)})`} style={{ transitionDelay: `${300 + i * 25}ms` }}>
              <title>{`${s.p.name}, week of ${pt.week.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${m.fmt(pt.v)} ${m.unit}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}

const POS_COLUMNS = [
  { key: "dist", label: "Miles", fmt: (v) => v.toFixed(1) },
  { key: "distChg", label: "Change", sub: "Miles", fmt: fmtPct, tone: toneFor },
  { key: "vert", label: "Vert ft", fmt: (v) => Math.round(v).toLocaleString() },
  { key: "vertChg", label: "Change", sub: "Vert", fmt: fmtPct, tone: toneFor },
  { key: "time", label: "Hours", fmt: (v) => v.toFixed(1) },
  { key: "timeChg", label: "Change", sub: "Hours", fmt: fmtPct, tone: toneFor },
  { key: "count", label: "Pours", fmt: (v) => Math.round(v).toString() },
];

function stats(list) {
  return {
    dist: sum(list, METRICS[0].get),
    vert: sum(list, METRICS[1].get),
    time: sum(list, METRICS[2].get),
    count: list.length,
  };
}
function withChange(now, before) {
  return {
    ...now,
    distChg: pctChange(now.dist, before.dist),
    vertChg: pctChange(now.vert, before.vert),
    timeChg: pctChange(now.time, before.time),
  };
}
const signed = (fmt) => (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));

export function SideBySide() {
  const people = useData(loadPeople);
  const acts = useData(() => loadActivities());
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState("time");

  const filtered = useMemo(() => {
    const since = Date.now() - days * 864e5;
    return (acts.data || []).filter((a) => new Date(a.start_time).getTime() >= since);
  }, [acts.data, days]);

  const previous = useMemo(() => {
    const end = Date.now() - days * 864e5;
    const start = end - days * 864e5;
    return (acts.data || []).filter((a) => { const t = new Date(a.start_time).getTime(); return t >= start && t < end; });
  }, [acts.data, days]);

  const ps = people.data || [];
  const periodName = days === 365 ? "year" : `${days} days`;
  const posRows = [];
  for (const sport of ["ski", "run", "bike", "other"]) {
    for (const p of ps) {
      const now = filtered.filter((a) => a.sport === sport && a.person_id === p.id);
      const before = previous.filter((a) => a.sport === sport && a.person_id === p.id);
      if (!now.length && !before.length) continue;
      posRows.push({
        id: `${sport}-${p.id}`,
        first: <PosFirst dot={p.color} pill={SPORTS[sport].label.toUpperCase()} pillColor={p.color} title={p.name} />,
        values: withChange(stats(now), stats(before)),
      });
    }
  }
  const totalsRows = ps.map((p) => ({
    id: `total-${p.id}`,
    first: <span className="pos-person"><BeanDot person={p} size={10} /> {p.name}</span>,
    values: withChange(stats(filtered.filter((a) => a.person_id === p.id)), stats(previous.filter((a) => a.person_id === p.id))),
  }));
  const summaries = [{ label: "Total", rows: totalsRows }];
  if (ps.length === 2) {
    const [a, b] = totalsRows.map((r) => r.values);
    summaries.push({
      label: "Gap",
      rows: [{
        id: "gap",
        first: <span className="pos-person muted">{ps[0].name} vs {ps[1].name}</span>,
        values: { dist: a.dist - b.dist, vert: a.vert - b.vert, time: a.time - b.time, count: a.count - b.count },
      }],
    });
  }
  const gapColumns = POS_COLUMNS.map((c) => (["dist", "vert", "time", "count"].includes(c.key) ? { ...c, fmt: (v, row) => (row && row.distChg === undefined ? signed(c.fmt)(v) : c.fmt(v)) } : c));

  const weeks = days <= 30 ? 6 : days <= 90 ? 13 : 26;
  const m = METRICS.find((x) => x.key === metric);

  return (
    <section className="section section-first">
      <p className="eyebrow">Side by Side</p>
      <BlurText as="h1" text="Same beans, different roasts." className="page-title" />
      <p className="lede">How the two of us stack up by sport, and how this period compares with the last.</p>

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
          <div className="pos-section">
            <div className="chart-card-head chart-card-head-row pos-section-head">
              <div>
                <h3>By sport</h3>
                <p>Last {periodName}, with change vs the {periodName} before.</p>
              </div>
            </div>
            <Positions label="Training by sport" firstLabel="Sport" columns={gapColumns} rows={posRows} summaries={summaries} firstWidth={150} colWidth={88} />
          </div>

          <div className="chart-card trend-card">
            <header className="chart-card-head chart-card-head-row">
              <div>
                <h3>Week by week</h3>
                <p>{m.label} per week, last {weeks} weeks.</p>
              </div>
              <Segmented label="Metric" value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.key, label: x.label }))} />
            </header>
            <TrendChart people={ps} acts={acts.data || []} weeks={weeks} metric={metric} />
            <p className="chart-caption">Dashed line = our average week.</p>
          </div>


        </>
      )}
    </section>
  );
}
