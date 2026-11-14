// Private: only visible with the barista code. Busy blocks come from the barista edge function,
// never from the public database API.
import { useEffect, useMemo, useRef, useState } from "react";
import { useData, useBaristaCode } from "../hooks.js";
import { loadPeople, loadEvents, barista } from "../api.js";
import { icsToBusy } from "../ics.js";
import { dayKey, parseDay, startOfWeek } from "../format.js";
import { Segmented, Loading, ErrorNote, BeanDot } from "../ui.jsx";
import { BlurText } from "../bits.jsx";

const VIEW_START = 5;  // 5am
const VIEW_END = 22;   // 10pm
const HOUR_PX = 34;

const fmtTime = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(" ", "").toLowerCase();
const fmtLen = (ms) => {
  const h = Math.floor(ms / 36e5), m = Math.round((ms % 36e5) / 6e4);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

function atHour(day, h) {
  const d = new Date(day);
  d.setHours(h, 0, 0, 0);
  return d.getTime();
}

function subtract(windows, busy) {
  let out = windows;
  for (const [bs, be] of busy) {
    const next = [];
    for (const [ws, we] of out) {
      if (be <= ws || bs >= we) { next.push([ws, we]); continue; }
      if (bs > ws) next.push([ws, bs]);
      if (be < we) next.push([be, we]);
    }
    out = next;
  }
  return out;
}

function useBusy(code, from, to, tick) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    if (!code) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    barista("busy.list", { from: new Date(from).toISOString(), to: new Date(to).toISOString() })
      .then((d) => alive && setState({ loading: false, data: d, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => { alive = false; };
  }, [code, from, to, tick]);
  return state;
}

export function Upload({ people, onDone, uploads = [] }) {
  const [personId, setPersonId] = useState(people[0]?.id);
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const onFile = async (e) => {
    setErr(null); setMsg(null); setParsed(null);
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const text = await f.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("That doesn't look like an .ics calendar file.");
      setParsed(icsToBusy(text));
    } catch (e2) { setErr(e2); }
  };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await barista("busy.replace", { person_id: personId, blocks: parsed.blocks, range_start: parsed.stats.from, range_end: parsed.stats.to });
      setMsg(`Saved ${r.saved} busy blocks for ${people.find((p) => p.id === personId)?.name}.`);
      setParsed(null); setFileName("");
      onDone();
    } catch (e2) { setErr(e2); } finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true); setErr(null);
    try { await barista("busy.clear", { person_id: personId }); setMsg("Calendar cleared."); onDone(); }
    catch (e2) { setErr(e2); } finally { setBusy(false); }
  };

  return (
    <div className="chart-card upload-card">
      <header className="chart-card-head">
        <h3>Add a work calendar</h3>
        <p>Your browser reads the .ics file and sends only busy start and end times. Titles, attendees, locations and notes never leave this page. A new upload replaces that person's previous one.</p>
      </header>
      {people.length > 0 && (
        <ul className="upload-status">
          {people.map((p) => {
            const u = uploads.find((x) => x.person_id === p.id);
            return (
              <li key={p.id}>
                <span className="bean-dot" style={{ background: p.color, width: 9, height: 9 }} /> <strong>{p.name}</strong>{" "}
                <span className="muted">{u ? `${u.block_count} busy blocks · uploaded ${new Date(u.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "no calendar yet"}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="upload-row">
        <Segmented label="Whose calendar" value={personId} onChange={setPersonId} options={people.map((p) => ({ value: p.id, label: p.name }))} />
        <label className="file-btn">
          <input type="file" accept=".ics,text/calendar" onChange={onFile} />
          <span>{fileName || "Choose .ics file"}</span>
        </label>
      </div>
      {parsed && (
        <div className="upload-preview">
          <p>
            Found <strong>{parsed.stats.blocks}</strong> busy blocks from {parsed.stats.events} events
            {parsed.stats.skippedFree ? `, skipped ${parsed.stats.skippedFree} marked free or cancelled` : ""}.
            Covers {new Date(parsed.stats.from).toLocaleDateString("en-US", { month: "short", day: "numeric" })} to {new Date(parsed.stats.to).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
          </p>
          <button className="btn btn-dark btn-sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save busy times"}</button>
        </div>
      )}
      <div className="upload-foot">
        <button className="btn btn-ghost btn-sm" onClick={clear} disabled={busy}>Clear {people.find((p) => p.id === personId)?.name}'s calendar</button>
      </div>
      {msg && <p className="ok-note">{msg}</p>}
      {err && <ErrorNote error={err} />}
    </div>
  );
}

export function FreeTime() {
  const code = useBaristaCode();
  const people = useData(loadPeople);
  const events = useData(loadEvents);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()).getTime());
  const [minLen, setMinLen] = useState(60);
  const [tick, setTick] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const from = weekStart;
  const to = weekStart + 7 * 864e5;
  const busy = useBusy(code, from, to, tick);
  const wrapRef = useRef(null);
  useEffect(() => {
    const el = wrapRef.current?.querySelector(".week-day.is-today");
    const wrap = wrapRef.current;
    if (el && wrap && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = el.offsetLeft - 52;
  }, [busy.data, weekStart]);

  const ps = people.data || [];
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const uploaded = new Set((busy.data?.uploads || []).map((u) => u.person_id));

  const byDay = useMemo(() => {
    const blocks = busy.data?.blocks || [];
    return days.map((day) => {
      const ds = atHour(day, 0), de = ds + 864e5;
      const winS = atHour(day, VIEW_START), winE = atHour(day, VIEW_END);
      const timed = blocks.filter((b) => !b.all_day).map((b) => ({ ...b, s: Date.parse(b.starts_at), e: Date.parse(b.ends_at) })).filter((b) => b.e > ds && b.s < de);
      const allDay = blocks.filter((b) => b.all_day && Date.parse(b.ends_at) > ds && Date.parse(b.starts_at) < de);
      const free = subtract([[winS, winE]], timed.filter((b) => uploaded.has(b.person_id)).map((b) => [b.s, b.e]))
        .filter(([s, e]) => e - s >= minLen * 6e4 && e > Date.now());
      return { day, timed, allDay, free };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy.data, weekStart, minLen]);

  if (!code) {
    return (
      <section className="section section-first">
        <p className="eyebrow">Free Time</p>
        <BlurText as="h1" text="Behind the bar only." className="page-title" />
        <p className="lede">Our work calendars are private. <a href="#/barista">Enter the barista code</a> to see when we're both free.</p>
      </section>
    );
  }

  const shift = (n) => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7 * n); return startOfWeek(d).getTime(); });
  const hours = Array.from({ length: VIEW_END - VIEW_START }, (_, i) => VIEW_START + i);
  const top = (ms, day) => ((ms - atHour(day, VIEW_START)) / 36e5) * HOUR_PX;
  const eventsOn = (d) => (events.data || []).filter((e) => {
    const k = dayKey(d);
    return e.starts_on <= k && (e.ends_on || e.starts_on) >= k;
  });
  const allFree = byDay.flatMap((d) => d.free.map(([s, e]) => ({ s, e, day: d.day })));
  const missing = ps.filter((p) => !uploaded.has(p.id));

  return (
    <section className="section section-first">
      <p className="eyebrow">Behind the bar · Free Time</p>
      <BlurText as="h1" text="When can we both pull a shot?" className="page-title" />
      <p className="lede">Both work calendars, busy times only, with the windows where we're both free highlighted. Only visible with the barista code.</p>

      <div className="toolbar">
        <div className="month-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => shift(-1)} aria-label="Previous week">←</button>
          <h2 className="month-title">
            {days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(1)} aria-label="Next week">→</button>
        </div>
        <Segmented label="Minimum free window" value={minLen} onChange={setMinLen} options={[{ value: 60, label: "1h+" }, { value: 120, label: "2h+" }, { value: 240, label: "4h+" }]} />
      </div>

      {people.data && (missing.length > 0 || showUpload) ? (
        <div className="free-upload"><Upload people={ps} uploads={busy.data?.uploads || []} onDone={() => { setTick((t) => t + 1); setShowUpload(false); }} /></div>
      ) : (
        <button className="btn btn-ghost btn-sm free-upload-toggle" onClick={() => setShowUpload(true)}>Upload a new calendar</button>
      )}

      <div className="legend free-legend">
        {ps.map((p) => <span key={p.id}><BeanDot person={p} size={10} /> {p.name} busy{!uploaded.has(p.id) ? " (no calendar yet)" : ""}</span>)}
        <span><span className="free-swatch" /> Both free</span>
      </div>

      {busy.error && <ErrorNote error={busy.error} />}
      {busy.loading && !busy.data ? <Loading /> : (
        <div className="week-wrap" ref={wrapRef}>
          <div className="week" style={{ "--hour": `${HOUR_PX}px`, "--hours": hours.length }}>
            <div className="week-gutter">
              <div className="week-head" />
              <div className="week-body">
                {hours.map((h) => <span key={h} className="week-hour" style={{ top: (h - VIEW_START) * HOUR_PX }}>{fmtTime(new Date(2000, 0, 1, h).getTime())}</span>)}
              </div>
            </div>
            {byDay.map(({ day, timed, allDay, free }) => {
              const isToday = dayKey(day) === dayKey(new Date());
              return (
                <div key={day.toISOString()} className={`week-day ${isToday ? "is-today" : ""}`}>
                  <div className="week-head">
                    <span className="week-dow">{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
                    <span className="week-date">{day.getDate()}</span>
                    <div className="week-chips">
                      {eventsOn(day).map((e) => <span key={e.id} className={`cal-event kind-${e.kind}`} title={e.title}>{e.title}</span>)}
                      {allDay.map((b, i) => {
                        const p = ps.find((x) => x.id === b.person_id);
                        return <span key={i} className="allday-chip" style={{ "--bean": p?.color }}>{p?.name}: all day</span>;
                      })}
                    </div>
                  </div>
                  <div className="week-body">
                    {hours.map((h) => <span key={h} className="week-line" style={{ top: (h - VIEW_START) * HOUR_PX }} />)}
                    {free.map(([s, e], i) => (
                      <div key={`f${i}`} className="free-block" style={{ top: top(s, day), height: top(e, day) - top(s, day) }} title={`Both free ${fmtTime(s)}–${fmtTime(e)}`}>
                        {e - s >= 90 * 6e4 && <span>{fmtTime(s)}–{fmtTime(e)}</span>}
                      </div>
                    ))}
                    {timed.map((b, i) => {
                      const pi = ps.findIndex((p) => p.id === b.person_id);
                      const p = ps[pi];
                      const s = Math.max(b.s, atHour(day, VIEW_START)), e = Math.min(b.e, atHour(day, VIEW_END));
                      if (e <= s) return null;
                      return (
                        <div key={i} className="busy-block" style={{ top: top(s, day), height: Math.max(3, top(e, day) - top(s, day)), left: pi === 0 ? "4%" : "52%", background: p?.color }} title={`${p?.name} busy ${fmtTime(b.s)}–${fmtTime(b.e)}`} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="free-list">
        <div>
          <h3 className="col-title">Free together this week</h3>
          {missing.length > 0 && <p className="need-code">{missing.map((p) => p.name).join(" and ")} {missing.length === 1 ? "hasn't" : "haven't"} uploaded a calendar yet, so these windows only count {ps.filter((p) => uploaded.has(p.id)).map((p) => p.name).join(" and ") || "nobody"}.</p>}
          <ul className="menu-list">
            {allFree.map((f, i) => (
              <li key={i} className="menu-item">
                <span className="menu-date">{f.day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                <span className="menu-dots" aria-hidden="true" />
                <span className="menu-title">{fmtTime(f.s)}–{fmtTime(f.e)}<span className="menu-kind">{fmtLen(f.e - f.s)}</span></span>
              </li>
            ))}
            {!allFree.length && <li className="muted menu-item">No shared windows of {minLen / 60}h+ between {VIEW_START}am and {VIEW_END - 12}pm left this week.</li>}
          </ul>
          <p className="muted small">All-day events (PTO, holidays) are shown but don't block time. Free windows only count {VIEW_START}am to {VIEW_END - 12}pm.</p>
        </div>

      </div>
    </section>
  );
}

// re-export for tests
export { subtract, parseDay };
