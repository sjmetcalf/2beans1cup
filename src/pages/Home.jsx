import { BlurText, CountUp, SpotlightCard, Marquee, ShinyText } from "../bits.jsx";
import { useData } from "../hooks.js";
import { loadPeople, loadEvents, loadActivities } from "../api.js";
import { daysUntil, fmtDay, fmtMiles, fmtFeet, fmtDuration, fmtWhen, miles, feet, startOfWeek, SPORTS, activityDay, dayKey } from "../format.js";
import { SectionHead, BeanDot, SportTag, Empty, Loading } from "../ui.jsx";

const LEGS = [
  { sport: "ski", title: "The Ski", route: "Crested Butte → Aspen", detail: "Overnight backcountry ski race over the Elk Mountains, in teams of two.", date: null, note: "Late March · date TBA" },
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

function nextRace(events) {
  const races = (events || []).filter((e) => e.kind === "race" && daysUntil(e.starts_on) >= 0).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  if (races[0]) return { title: races[0].title.split(":")[0].replace(/^GT /, "The "), date: races[0].starts_on, sport: races[0].sport };
  const leg = LEGS.find((l) => l.date && daysUntil(l.date) >= 0);
  return leg ? { title: leg.title, date: leg.date, sport: leg.sport } : null;
}

function TodayPanel({ people, acts, events }) {
  const race = nextRace(events);
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

      {race && (
        <div className="today-race">
          <CountUp to={daysUntil(race.date)} className="today-big" />
          <div>
            <p className="today-race-title">days to {race.title}</p>
            <p className="muted small">{fmtDay(race.date, { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
        </div>
      )}

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
          <p className="eyebrow">Est. 2026 · Crested Butte ⇄ Aspen</p>
          <BlurText as="h1" text="Two beans. One cup. Three races." className="hero-title" />
          <p className="hero-lede">
            A small-batch training house for two athletes chasing the Grand Traverse Triple Crown: a ski, a run and a bike
            across the Elk Mountains, all in one season.
          </p>
          <div className="hero-actions">
            <a className="btn btn-dark" href="#/side-by-side">Compare our pours</a>
            <a className="btn btn-ghost" href="#/menu">See the menu</a>
          </div>
        </div>
        <div className="hero-panel">
          {ready ? <TodayPanel people={people.data} acts={acts.data} events={events.data} /> : <div className="today today-loading"><Loading /></div>}
        </div>
      </section>

      <Marquee items={["Ski", "Run", "Bike", "Espresso", "Elk Mountains", "Star Pass", "Pearl Pass", "Flat white", "Vert", "Cortado"]} />

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
