import { Badge } from "../Badge.jsx";
import { BlurText, CountUp, SpotlightCard, Marquee, ShinyText } from "../bits.jsx";
import { useData } from "../hooks.js";
import { loadPeople, loadEvents, loadActivities } from "../api.js";
import { daysUntil, fmtDay, fmtMiles, fmtFeet, fmtDuration, fmtWhen, miles, feet } from "../format.js";
import { SectionHead, BeanDot, SportTag, Empty, Loading } from "../ui.jsx";

const LEGS = [
  { sport: "ski", title: "The Ski", route: "Crested Butte → Aspen", detail: "Overnight backcountry ski race over the Elk Mountains, in teams of two.", date: null, note: "Late March · date TBA" },
  { sport: "run", title: "The Run", route: "Crested Butte → Aspen", detail: "Point-to-point mountain ultra on the ski route.", date: "2027-09-04" },
  { sport: "bike", title: "The Bike", route: "Aspen → Crested Butte", detail: "The next morning, ride it all the way back.", date: "2027-09-05" },
];

function Countdown() {
  const reg = "2026-11-16";
  const regDays = daysUntil(reg);
  return (
    <section className="section">
      <SectionHead eyebrow="Today's specials" title="Three legs, one season." />
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
      {regDays >= 0 && (
        <a className="reg-banner" href="https://runsignup.com/Race/CO/CrestedButte/TheGrandTraverse" target="_blank" rel="noreferrer">
          <ShinyText>Triple Crown priority registration opens {regDays === 0 ? "tonight at midnight" : `in ${regDays} day${regDays === 1 ? "" : "s"}`}</ShinyText>
          <span aria-hidden="true">→</span>
        </a>
      )}
    </section>
  );
}

function Roasting({ people, acts }) {
  const byPerson = Object.fromEntries(people.map((p) => [p.id, p]));
  const recent = acts.slice(0, 6);
  if (!recent.length) {
    return (
      <Empty title="Nothing brewing yet.">
        Connect Garmin on the <a href="#/barista">Barista</a> page and your activities will show up here.
      </Empty>
    );
  }
  return (
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
  );
}

function ThisMonth({ people, acts }) {
  const since = new Date(Date.now() - 30 * 864e5);
  const recent = acts.filter((a) => new Date(a.start_time) >= since);
  return (
    <div className="split-grid">
      {people.map((p) => {
        const mine = recent.filter((a) => a.person_id === p.id);
        const dist = mine.reduce((s, a) => s + (a.distance_m || 0), 0);
        const vert = mine.reduce((s, a) => s + (a.elevation_gain_m || 0), 0);
        const time = mine.reduce((s, a) => s + (a.duration_s || 0), 0);
        return (
          <div key={p.id} className="split-card" style={{ "--bean": p.color }}>
            <p className="split-name"><BeanDot person={p} size={12} /> {p.name}</p>
            <dl className="split-stats">
              <div><dt>Miles</dt><dd><CountUp to={miles(dist)} format={(v) => v.toFixed(0)} /></dd></div>
              <div><dt>Vert ft</dt><dd><CountUp to={feet(vert)} /></dd></div>
              <div><dt>Hours</dt><dd><CountUp to={time / 3600} format={(v) => v.toFixed(1)} /></dd></div>
              <div><dt>Pours</dt><dd><CountUp to={mine.length} /></dd></div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

export function Home() {
  const people = useData(loadPeople);
  const acts = useData(() => loadActivities());
  const events = useData(loadEvents);
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
        <div className="hero-badge">
          <Badge size={420} />
        </div>
      </section>

      <Marquee items={["Ski", "Run", "Bike", "Espresso", "Elk Mountains", "Star Pass", "Pearl Pass", "Flat white", "Vert", "Cortado"]} />

      <Countdown />

      <section className="section">
        <SectionHead eyebrow="Last 30 days" title="Side by side, at a glance.">
          Totals from Garmin. The full comparison lives on <a href="#/side-by-side">Side by Side</a>.
        </SectionHead>
        {people.loading || acts.loading ? <Loading /> : people.data && acts.data ? <ThisMonth people={people.data} acts={acts.data} /> : <Empty title="Couldn't reach the espresso machine." />}
      </section>

      <section className="section">
        <SectionHead eyebrow="Fresh off the bar" title="Latest pours." />
        {people.loading || acts.loading ? <Loading /> : people.data && acts.data ? <Roasting people={people.data} acts={acts.data} /> : null}
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
