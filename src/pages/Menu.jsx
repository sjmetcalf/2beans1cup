import { useState } from "react";
import { useData, useBaristaCode } from "../hooks.js";
import { loadPeople, loadEvents, loadActivities, barista, invalidate } from "../api.js";
import { dayKey, parseDay, activityDay, fmtDay, daysUntil, SPORTS } from "../format.js";
import { Loading, ErrorNote, NeedCode, BeanDot } from "../ui.jsx";
import { BlurText } from "../bits.jsx";

const KIND_LABEL = { race: "Race", training: "Training", rest: "Rest", logistics: "Logistics" };

function MonthGrid({ month, events, acts, people }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - offset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = dayKey(new Date());
  const eventsByDay = {};
  events.forEach((e) => {
    const s = parseDay(e.starts_on);
    const end = e.ends_on ? parseDay(e.ends_on) : s;
    for (let d = new Date(s); d <= end; d.setDate(d.getDate() + 1)) (eventsByDay[dayKey(d)] ||= []).push(e);
  });
  const actsByDay = {};
  acts.forEach((a) => (actsByDay[activityDay(a)] ||= []).push(a));
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  return (
    <div className="month">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="month-dow">{d}</div>)}
      {cells.map((d) => {
        const k = dayKey(d);
        const inMonth = d.getMonth() === month.getMonth();
        const ev = eventsByDay[k] || [];
        const ac = actsByDay[k] || [];
        return (
          <div key={k} className={`month-cell ${inMonth ? "" : "is-out"} ${k === today ? "is-today" : ""}`}>
            <span className="month-num">{d.getDate()}</span>
            {ev.map((e) => <span key={e.id} className={`cal-event kind-${e.kind}`} title={e.notes || e.title}>{e.title}</span>)}
            {ac.length > 0 && (
              <span className="cal-acts">
                {ac.map((a) => (
                  <span key={a.id} className="cal-act" style={{ background: byId[a.person_id]?.color }} title={`${byId[a.person_id]?.name}: ${a.name || SPORTS[a.sport].label}`} />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddEvent() {
  const [form, setForm] = useState({ title: "", kind: "training", sport: "", who: "both", starts_on: dayKey(new Date()), notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await barista("event.upsert", { event: { ...form, sport: form.sport || null } });
      setForm((f) => ({ ...f, title: "", notes: "" }));
      invalidate();
    } catch (e2) { setErr(e2); } finally { setBusy(false); }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h3>Add to the menu</h3>
      <label>Title<input value={form.title} onChange={set("title")} required maxLength={120} placeholder="Long run, Star Pass recon…" /></label>
      <div className="form-row">
        <label>Date<input type="date" value={form.starts_on} onChange={set("starts_on")} required /></label>
        <label>Type
          <select value={form.kind} onChange={set("kind")}>{Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label>Sport
          <select value={form.sport} onChange={set("sport")}><option value="">—</option>{Object.entries(SPORTS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}</select>
        </label>
      </div>
      <label>Notes<textarea value={form.notes} onChange={set("notes")} rows={2} maxLength={1000} /></label>
      {err && <ErrorNote error={err} />}
      <button className="btn btn-dark" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
    </form>
  );
}

export function Menu() {
  const people = useData(loadPeople);
  const events = useData(loadEvents);
  const acts = useData(() => loadActivities());
  const code = useBaristaCode();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const remove = async (id) => {
    if (!code) return;
    try { await barista("event.delete", { id }); invalidate(); } catch (e) { window.console.error(e); }
  };

  const upcoming = (events.data || []).filter((e) => daysUntil(e.ends_on || e.starts_on) >= 0);

  return (
    <section className="section section-first">
      <p className="eyebrow">The Menu</p>
      <BlurText as="h1" text="What's brewing, and when." className="page-title" />
      <p className="lede">Our shared calendar: races, key sessions and logistics, with each of our activities dotted in.</p>

      <div className="toolbar">
        <div className="month-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)} aria-label="Previous month">←</button>
          <h2 className="month-title">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(1)} aria-label="Next month">→</button>
        </div>
        <div className="legend">
          {(people.data || []).map((p) => <span key={p.id}><BeanDot person={p} size={10} /> {p.name}</span>)}
        </div>
      </div>

      {events.error && <ErrorNote error={events.error} />}
      {events.loading || people.loading ? <Loading /> : (
        <MonthGrid month={month} events={events.data || []} acts={acts.data || []} people={people.data || []} />
      )}

      <div className="menu-columns">
        <div>
          <h3 className="col-title">Coming up</h3>
          <ul className="menu-list">
            {upcoming.map((e) => (
              <li key={e.id} className={`menu-item kind-${e.kind}`}>
                <span className="menu-date">{fmtDay(e.starts_on, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="menu-dots" aria-hidden="true" />
                <span className="menu-title">
                  {e.title}
                  <span className="menu-kind">{KIND_LABEL[e.kind]}</span>
                </span>
                {code && <button className="icon-btn" onClick={() => remove(e.id)} aria-label={`Remove ${e.title}`}>×</button>}
              </li>
            ))}
          </ul>
        </div>
        <div>{code ? <AddEvent /> : <NeedCode />}</div>
      </div>
    </section>
  );
}
