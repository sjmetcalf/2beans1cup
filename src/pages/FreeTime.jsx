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

const OFF_RE = /\b(off|pto|vacation|leave|holiday|holidays|ooo)\b/i;
const prettyName = (fileName) => {
  const base = fileName.replace(/\.ics$/i, "").replace(/[_-]+/g, " ").replace(/\s*\(\d+\)$/, "").trim();
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 40) || "Calendar";
};
const KIND_OPTIONS = [{ value: "busy", label: "Busy" }, { value: "off", label: "Time off" }];

export function Upload({ people, sources = [], onDone }) {
  const [personId, setPersonId] = useState(people[0]?.id);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [inputKey, setInputKey] = useState(0);
  const person = people.find((p) => p.id === personId);
  const mine = sources.filter((s) => s.person_id === personId);

  const onFiles = async (e) => {
    setErr(null); setMsg(null);
    const list = [...(e.target.files || [])];
    const parsed = await Promise.all(list.map(async (f, i) => {
      const name = prettyName(f.name);
      const kind = OFF_RE.test(f.name) ? "off" : "busy";
      try {
        const text = await f.text();
        if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("Not an .ics calendar file.");
        return { key: `${Date.now()}-${i}`, fileName: f.name, name, kind, asBusy: icsToBusy(text), asOff: icsToBusy(text, { keepFree: true }) };
      } catch (e2) {
        return { key: `${Date.now()}-${i}`, fileName: f.name, name, kind, error: e2.message };
      }
    }));
    setFiles(parsed);
  };
  const update = (key, patch) => setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const parsedFor = (f) => (f.kind === "off" ? f.asOff : f.asBusy);
  const ready = files.filter((f) => f.asBusy);

  const saveAll = async () => {
    setBusy(true); setErr(null);
    try {
      let total = 0;
      for (const f of ready) {
        const parsed = parsedFor(f);
        const r = await barista("busy.replace", { person_id: personId, name: f.name, kind: f.kind, blocks: parsed.blocks, range_start: parsed.stats.from, range_end: parsed.stats.to });
        total += r.saved;
      }
      setMsg(`Saved ${ready.length} calendar${ready.length === 1 ? "" : "s"} for ${person?.name} (${total} blocks).`);
      setFiles([]); setInputKey((k) => k + 1);
      onDone();
    } catch (e2) { setErr(e2); } finally { setBusy(false); }
  };
  const remove = async (src) => {
    setBusy(true); setErr(null);
    try { await barista("busy.clear", { source_id: src.id }); setMsg(`Removed ${src.name}.`); onDone(); }
    catch (e2) { setErr(e2); } finally { setBusy(false); }
  };
  const setKind = async (src, kind) => {
    try { await barista("busy.kind", { source_id: src.id, kind }); onDone(); } catch (e2) { setErr(e2); }
  };

  return (
    <div className="chart-card upload-card">
      <header className="chart-card-head">
        <h3>Add calendars</h3>
        <p>Add as many .ics files as you like (work, time off, holidays). Your browser reads them and sends only start and end times; titles and details never leave this page. Re-uploading a calendar with the same name replaces it.</p>
      </header>

      <div className="upload-row">
        <Segmented label="Whose calendars" value={personId} onChange={(v) => { setPersonId(v); setFiles([]); setInputKey((k) => k + 1); }} options={people.map((p) => ({ value: p.id, label: p.name }))} />
        <label className="file-btn">
          <input key={inputKey} type="file" accept=".ics,text/calendar" multiple onChange={onFiles} />
          <span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} chosen` : "Choose .ics files"}</span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="upload-files">
          {files.map((f) => (
            <div key={f.key} className="upload-file">
              <div className="upload-file-main">
                <input className="upload-name" value={f.name} maxLength={40} onChange={(e) => update(f.key, { name: e.target.value })} aria-label={`Name for ${f.fileName}`} />
                <Segmented label="Calendar type" value={f.kind} onChange={(v) => update(f.key, { kind: v })} options={KIND_OPTIONS} />
              </div>
              <p className="muted small">
                {f.error ? <span className="error-text">{f.fileName}: {f.error}</span> : (
                  <>{f.fileName} · {parsedFor(f).stats.blocks} {f.kind === "off" ? (parsedFor(f).stats.blocks === 1 ? "day off" : "days off") : "busy blocks"}{parsedFor(f).stats.skippedFree ? ` · ${parsedFor(f).stats.skippedFree} ${f.kind === "off" ? "cancelled" : "free/cancelled"} skipped` : ""}</>
                )}
              </p>
            </div>
          ))}
          <button className="btn btn-dark btn-sm" onClick={saveAll} disabled={busy || !ready.length}>
            {busy ? "Saving…" : `Save ${ready.length} calendar${ready.length === 1 ? "" : "s"} for ${person?.name}`}
          </button>
        </div>
      )}

      <div className="source-list">
        <p className="today-sub">{person?.name}'s calendars</p>
        {mine.length === 0 && <p className="muted small">None yet.</p>}
        {mine.map((src) => (
          <div key={src.id} className="source-row">
            <div className="source-info">
              <strong>{src.name}</strong>
              <span className="muted small">{src.block_count} blocks · {new Date(src.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
            <Segmented label={`${src.name} type`} value={src.kind} onChange={(v) => setKind(src, v)} options={KIND_OPTIONS} />
            <button className="icon-btn" onClick={() => remove(src)} aria-label={`Remove ${src.name}`} disabled={busy}>×</button>
          </div>
        ))}
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
  const sources = busy.data?.sources || [];
  const kindOf = Object.fromEntries(sources.map((x) => [x.id, x.kind]));
  const uploaded = new Set(sources.filter((x) => x.kind === "busy").map((x) => x.person_id));

  const byDay = useMemo(() => {
    const blocks = busy.data?.blocks || [];
    return days.map((day) => {
      const ds = atHour(day, 0), de = ds + 864e5;
      const winS = atHour(day, VIEW_START), winE = atHour(day, VIEW_END);
      const inDay = blocks.map((b) => ({ ...b, s: Date.parse(b.starts_at), e: Date.parse(b.ends_at), kind: kindOf[b.source_id] || "busy" })).filter((b) => b.e > ds && b.s < de);
      // A person is "off" if a time-off calendar covers the day (all-day, or 6h+ of it)
      const offPeople = new Set(inDay.filter((b) => b.kind === "off" && (b.all_day || Math.min(b.e, de) - Math.max(b.s, ds) >= 6 * 36e5)).map((b) => b.person_id));
      const timed = inDay.filter((b) => b.kind === "busy" && !b.all_day && !offPeople.has(b.person_id));
      const allDay = inDay.filter((b) => b.kind === "busy" && b.all_day);
      const free = subtract([[winS, winE]], timed.filter((b) => uploaded.has(b.person_id)).map((b) => [b.s, b.e]))
        .filter(([s, e]) => e - s >= minLen * 6e4 && e > Date.now());
      return { day, timed, allDay, free, offPeople };
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
      <p className="lede">All our calendars, busy times and days off only, with the windows where we're both free highlighted. Only visible with the barista code.</p>

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
        <div className="free-upload"><Upload people={ps} sources={sources} onDone={() => { setTick((t) => t + 1); setShowUpload(false); }} /></div>
      ) : (
        <button className="btn btn-ghost btn-sm free-upload-toggle" onClick={() => setShowUpload(true)}>Manage calendars</button>
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
            {byDay.map(({ day, timed, allDay, free, offPeople }) => {
              const isToday = dayKey(day) === dayKey(new Date());
              return (
                <div key={day.toISOString()} className={`week-day ${isToday ? "is-today" : ""}`}>
                  <div className="week-head">
                    <span className="week-dow">{day.toLocaleDateString("en-US", { weekday: "short" })}</span>
                    <span className="week-date">{day.getDate()}</span>
                    <div className="week-chips">
                      {eventsOn(day).map((e) => <span key={e.id} className={`cal-event kind-${e.kind}`} title={e.title}>{e.title}</span>)}
                      {ps.filter((p) => offPeople.has(p.id)).map((p) => <span key={`off-${p.id}`} className="allday-chip off-chip" style={{ "--bean": p.color }}>{p.name}: off</span>)}
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
          <p className="muted small">Days off from a Time off calendar override work meetings that day. Other all-day events are shown but don't block time. Free windows only count {VIEW_START}am to {VIEW_END - 12}pm.</p>
        </div>

      </div>
    </section>
  );
}

// re-export for tests
export { subtract, parseDay };
