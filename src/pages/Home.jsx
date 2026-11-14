import { useRef, useState } from "react";
import { BlurText, CountUp, SpotlightCard, Marquee, ShinyText } from "../bits.jsx";
import { useData } from "../hooks.js";
import { loadPeople, loadEvents, loadActivities } from "../api.js";
import { daysUntil, fmtDay, fmtMiles, fmtFeet, fmtDuration, fmtWhen, miles, feet, startOfWeek, SPORTS, activityDay, dayKey } from "../format.js";
import { Badge } from "../Badge.jsx";
import { SectionHead, BeanDot, SportTag, Empty, Loading } from "../ui.jsx";

const LEGS = [
  { sport: "ski", title: "The Ski", route: "Crested Butte → Aspen", detail: "Overnight backcountry ski race over the Elk Mountains, in teams of two.", date: "2027-03-28" },
  { sport: "run", title: "The Run", route: "Crested Butte → Aspen", detail: "Point-to-point mountain ultra on the ski route.", date: "2027-09-04" },
  { sport: "bike", title: "The Bike", route: "Aspen → Crested Butte", detail: "The next morning, ride it all the way back.", date: "2027-09-05" },
];
const REG_DATE = "2026-11-16";
const REG_URL = "https://runsignup.com/Race/CO/CrestedButte/TheGrandTraverse";

function relDay(a) {
  const k = activityDay(a);
  const today = dayKey(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (k === today) return "today";
  if (k === dayKey(y)) return "yesterday";
  return fmtWhen(a);
}

function RaceCountdown() {
  const races = LEGS.filter((l) => l.date && daysUntil(l.date) >= 0);
  const [i, setI] = useState(0);
  const start = useRef(null);
  if (!races.length) return null;
  const idx = Math.min(i, races.length - 1);
  const race = races[idx];
  const go = (n) => setI((cur) => (cur + n + races.length) % races.length);
  const onDown = (e) => { start.current = e.clientX; };
  const onUp = (e) => {
    if (start.current == null) return;
    const dx = e.clientX - start.current;
    start.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };
  return (
    <div className="today-race" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { start.current = null; }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
      role="group" aria-roledescription="carousel" aria-label="Race countdowns">
      <div className="today-race-body" key={race.sport} aria-live="polite">
        <CountUp to={daysUntil(race.date)} className="today-big" duration={900} />
        <div className="today-race-text">
          <p className="today-race-title">days to {race.title}</p>
          <p className="muted small">{race.route} · {fmtDay(race.date, { month: "short", day: "numeric", year: "numeric" })}</p>
        </div>
      </div>
      {races.length > 1 && (
        <div className="today-race-nav">
          <button className="chev" onClick={() => go(-1)} aria-label="Previous race">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="race-dots" role="tablist">
            {races.map((r, n) => (
              <button key={r.sport} role="tab" aria-selected={n === idx} aria-label={r.title} className={`race-dot ${n === idx ? "is-on" : ""}`} onClick={() => setI(n)}>
                <span>{r.sport}</span>
              </button>
            ))}
          </div>
          <button className="chev" onClick={() => go(1)} aria-label="Next race">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function TodayPanel({ people, acts }) {
  const weekStart = startOfWeek(new Date()).getTime();
  const week = acts.filter((a) => new Date(a.start_time).getTime() >= weekStart);
  const latest = acts[0];
  const latestBy = latest && people.find((p) => p.id === latest.person_id);
  const regDays = daysUntil(REG_DATE);

  return (
    <SpotlightCard className="today">
      <div className="today-top">
        <p className="today-label">Today at the cafe</p>
        <p className="today-date">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
      </div>

      <RaceCountdown />

      <div className="today-week">
        <p className="today-sub">This week</p>
        {people.map((p) => {
          const mine = week.filter((a) => a.person_id === p.id);
          const dist = mine.reduce((s, a) => s + (a.distance_m || 0), 0);
          const vert = mine.reduce((s, a) => s + (a.elevation_gain_m || 0), 0);
          const time = mine.reduce((s, a) => s + (a.duration_s || 0), 0);
          return (
            <div key={p.id} className="today-row">
              <span className="today-name"><BeanDot person={p} size={9} /> {p.name}</span>
              <span><strong><CountUp to={miles(dist)} format={(v) => v.toFixed(1)} /></strong> mi</span>
              <span><strong><CountUp to={feet(vert)} /></strong> ft</span>
              <span><strong><CountUp to={time / 3600} format={(v) => v.toFixed(1)} /></strong> h</span>
            </div>
          );
        })}
      </div>

      {latest ? (
        <a className="today-latest" href="#/pour-log">
          <span className="today-sub">Latest pour</span>
          <span className="today-latest-line">
            <BeanDot person={latestBy} size={9} /> <strong>{latestBy?.name}</strong> · {latest.name || SPORTS[latest.sport].label} · {fmtMiles(latest.distance_m)} · {relDay(latest)}
          </span>
        </a>
      ) : (
        <p className="today-latest muted small">No pours yet. Connect Garmin on the <a href="#/barista">Barista</a> page.</p>
      )}

      {regDays >= 0 && (
        <a className="today-reg" href={REG_URL} target="_blank" rel="noreferrer">
          <ShinyText>Triple Crown registration opens {regDays === 0 ? "tonight" : `in ${regDays} day${regDays === 1 ? "" : "s"}`}</ShinyText>
          <span aria-hidden="true">→</span>
        </a>
      )}
    </SpotlightCard>
  );
}

function Legs() {
  return (
    <div className="legs-grid">
      {LEGS.map((leg, i) => {
        const d = leg.date ? daysUntil(leg.date) : null;
        return (
          <SpotlightCard key={leg.sport} className="leg-card">
            <div className="leg-top">
              <span className="leg-num">0{i + 1}</span>
              <SportTag sport={leg.sport} />
            </div>
            <h3>{leg.title}</h3>
            <p className="leg-route">{leg.route}</p>
            <p className="muted">{leg.detail}</p>
            <div className="leg-count">
              {d != null && d >= 0 ? (
                <>
                  <CountUp to={d} className="big-num" />
                  <span className="muted">days · {fmtDay(leg.date, { month: "long", day: "numeric", year: "numeric" })}</span>
                </>
              ) : (
                <span className="muted">{leg.note}</span>
              )}
            </div>
          </SpotlightCard>
        );
      })}
    </div>
  );
}

function FreshOffTheBar({ people, acts }) {
  const since = Date.now() - 30 * 864e5;
  const month = acts.filter((a) => new Date(a.start_time).getTime() >= since);
  const byPerson = Object.fromEntries(people.map((p) => [p.id, p]));
  const recent = acts.slice(0, 6);
  return (
    <>
      <div className="month-strip">
        {people.map((p) => {
          const mine = month.filter((a) => a.person_id === p.id);
          return (
            <div key={p.id} className="month-strip-item" style={{ "--bean": p.color }}>
              <span className="today-name"><BeanDot person={p} size={10} /> {p.name}</span>
              <div className="stat-row">
                <div><span>Miles</span><strong><CountUp to={miles(mine.reduce((s, a) => s + (a.distance_m || 0), 0))} format={(v) => v.toFixed(0)} /></strong></div>
                <div><span>Vert ft</span><strong><CountUp to={feet(mine.reduce((s, a) => s + (a.elevation_gain_m || 0), 0))} /></strong></div>
                <div><span>Hours</span><strong><CountUp to={mine.reduce((s, a) => s + (a.duration_s || 0), 0) / 3600} format={(v) => v.toFixed(1)} /></strong></div>
                <div><span>Pours</span><strong><CountUp to={mine.length} /></strong></div>
              </div>
            </div>
          );
        })}
      </div>
      {recent.length ? (
        <div className="pour-grid">
          {recent.map((a) => {
            const p = byPerson[a.person_id];
            return (
              <SpotlightCard key={a.id} className="pour-card" tint={`${p?.color ?? "#b4683f"}26`}>
                <div className="pour-meta">
                  <BeanDot person={p} /> <span>{p?.name}</span>
                  <span className="muted">· {fmtWhen(a)}</span>
                </div>
                <h4>{a.name || "Untitled pour"}</h4>
                <div className="pour-stats">
                  <SportTag sport={a.sport} />
                  <span>{fmtMiles(a.distance_m)}</span>
                  <span>{fmtFeet(a.elevation_gain_m)}</span>
                  <span>{fmtDuration(a.duration_s)}</span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      ) : (
        <Empty title="Nothing brewing yet.">Connect Garmin on the <a href="#/barista">Barista</a> page and activities will show up here.</Empty>
      )}
      <p className="section-more"><a href="#/pour-log">Every pour →</a> <a href="#/side-by-side">Side by side →</a></p>
    </>
  );
}

export function Home() {
  const people = useData(loadPeople);
  const acts = useData(() => loadActivities());
  const events = useData(loadEvents);
  const ready = people.data && acts.data;
  const upcoming = (events.data || []).filter((e) => daysUntil(e.starts_on) >= 0).slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">The Fast &amp; the Caffeinated<span className="hide-narrow"> · Elk Mountain Drift</span></p>
          <BlurText as="h1" text={"Two shots.\nNo brakes.\nThree races."} className="hero-title" />
          <p className="hero-lede">
            Two drifters, one doppio, and the Grand Traverse Triple Crown: 40 miles from Crested Butte to Aspen on skis in
            March, then again on foot and on wheels in September.
          </p>
          <div className="hero-actions">
            <a className="btn btn-dark" href="#/side-by-side">Compare our pours</a>
            <a className="btn btn-ghost" href="#/menu">See the menu</a>
            <a href="#/drift" className="hero-badge-link" aria-label="Play Doppio Drift" title="Play Doppio Drift"><Badge size={128} className="hero-badge" /></a>
          </div>
        </div>
        <div className="hero-panel">
          {ready ? <TodayPanel people={people.data} acts={acts.data} /> : <div className="today today-loading"><Loading /></div>}
        </div>
      </section>

      <Marquee items={["Doppio", "Ski", "Drift", "Run", "Ristretto", "Bike", "Star Pass", "No brakes", "Pearl Pass", "Vert", "Cortado"]} />

      <section className="section">
        <SectionHead eyebrow="Fresh off the bar" title="The last 30 days." />
        {ready ? <FreshOffTheBar people={people.data} acts={acts.data} /> : <Loading />}
      </section>

      <section className="section">
        <SectionHead eyebrow="Today's specials" title="Three legs, one season." />
        <Legs />
      </section>

      <section className="section">
        <SectionHead eyebrow="Coming up" title="On the menu." />
        {events.loading ? <Loading /> : (
          <ul className="menu-list">
            {upcoming.map((e) => (
              <li key={e.id} className={`menu-item kind-${e.kind}`}>
                <span className="menu-date">{fmtDay(e.starts_on, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="menu-dots" aria-hidden="true" />
                <span className="menu-title">{e.title}</span>
              </li>
            ))}
            {!upcoming.length && <li className="muted">Nothing scheduled yet.</li>}
          </ul>
        )}
      </section>
    </>
  );
}
