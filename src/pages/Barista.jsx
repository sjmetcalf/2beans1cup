import { useState } from "react";
import { useData, useBaristaCode } from "../hooks.js";
import { loadPeople, barista, setCode, invalidate } from "../api.js";
import { Loading, ErrorNote } from "../ui.jsx";
import { BlurText } from "../bits.jsx";
import { Upload } from "./FreeTime.jsx";
import { useEffect } from "react";

function CodeForm() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await barista("verify", {}, value);
      setCode(value);
      setValue("");
    } catch (e2) { setErr(e2); } finally { setBusy(false); }
  };
  return (
    <form className="card form narrow" onSubmit={submit}>
      <h3>Barista code</h3>
      <p className="muted">The cafe is public to read. The shared code lets the two of us make changes from this browser.</p>
      <label>Code<input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="current-password" required /></label>
      {err && <ErrorNote error={err} />}
      <button className="btn btn-dark" disabled={busy}>{busy ? "Checking…" : "Step behind the bar"}</button>
    </form>
  );
}

function PersonCard({ person }) {
  const [name, setName] = useState(person.name);
  const [color, setColor] = useState(person.color);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const run = async (label, fn) => {
    setBusy(label); setErr(null); setMsg(null);
    try { const r = await fn(); invalidate(); return r; } catch (e) { setErr(e); invalidate(); } finally { setBusy(null); }
  };
  const saveProfile = (e) => {
    e.preventDefault();
    run("profile", () => barista("person.update", { id: person.id, name, color })).then((r) => r && setMsg("Saved."));
  };
  const saveKey = (e) => {
    e.preventDefault();
    run("key", () => barista("garmin.save", { person_id: person.id, api_key: key })).then((r) => {
      if (r) { setKey(""); setMsg(`Connected. Pulled ${r.synced} activities.`); }
    });
  };
  const sync = () => run("sync", () => barista("garmin.sync", { person_id: person.id })).then((r) => r && setMsg(`Synced ${r.synced} activities.`));
  const disconnect = () => run("disconnect", () => barista("garmin.disconnect", { person_id: person.id })).then((r) => r && setMsg("Garmin disconnected."));

  return (
    <div className="card person-card" style={{ "--bean": person.color }}>
      <form className="form" onSubmit={saveProfile}>
        <h3><span className="bean-dot" style={{ background: color, width: 14, height: 14 }} /> {person.name}</h3>
        <div className="form-row">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
          <label className="color-field">Color<input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        </div>
        <button className="btn btn-ghost btn-sm" disabled={busy === "profile"}>{busy === "profile" ? "Saving…" : "Save"}</button>
      </form>

      <div className="garmin">
        <h4>Garmin</h4>
        {person.garmin_connected ? (
          <>
            <p className="muted small">
              Connected{person.garmin_last_sync ? ` · last synced ${new Date(person.garmin_last_sync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
            <div className="btn-row">
              <button className="btn btn-dark btn-sm" onClick={sync} disabled={!!busy}>{busy === "sync" ? "Syncing…" : "Sync now"}</button>
              <button className="btn btn-ghost btn-sm" onClick={disconnect} disabled={!!busy}>Disconnect</button>
            </div>
          </>
        ) : (
          <p className="muted small">Not connected yet.</p>
        )}
        <form className="form" onSubmit={saveKey}>
          <label>
            {person.garmin_connected ? "Replace personal API key" : "Personal API key"}
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" placeholder="Paste your key" required />
          </label>
          <p className="muted small">
            Create one in Garmin Connect under <a href="https://connect.garmin.com/app/settings/personalApiToken" target="_blank" rel="noreferrer">Settings → Personal API Key</a>.
            It's stored on the server only and never shown here again.
          </p>
          <button className="btn btn-dark btn-sm" disabled={busy === "key"}>{busy === "key" ? "Connecting & syncing…" : "Connect Garmin"}</button>
        </form>
        {person.garmin_last_error && !msg && <ErrorNote error={`Last Garmin error: ${person.garmin_last_error}`} />}
      </div>
      {msg && <p className="ok-note">{msg}</p>}
      {err && <ErrorNote error={err} />}
    </div>
  );
}

function Calendars({ people }) {
  const [sources, setSources] = useState([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    barista("busy.list", { from: new Date().toISOString(), to: new Date(Date.now() + 864e5).toISOString() })
      .then((d) => alive && setSources(d.sources || []))
      .catch(() => {});
    return () => { alive = false; };
  }, [tick]);
  return (
    <div className="barista-calendars">
      <h2 className="col-title">Calendars</h2>
      <p className="muted small">Private: only visible behind the bar. See when you're both free on <a href="#/free-time">Free Time</a>.</p>
      <Upload people={people} sources={sources} onDone={() => setTick((t) => t + 1)} />
    </div>
  );
}

export function Barista() {
  const code = useBaristaCode();
  const people = useData(loadPeople);
  return (
    <section className="section section-first">
      <p className="eyebrow">Behind the bar</p>
      <BlurText as="h1" text="Barista settings." className="page-title" />
      {!code ? <CodeForm /> : (
        <>
          <div className="toolbar">
            <p className="ok-note">You're behind the bar on this browser.</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setCode("")}>Step out</button>
          </div>
          {people.loading ? <Loading /> : people.error ? <ErrorNote error={people.error} /> : (
            <div className="people-grid">
              {people.data.map((p) => <PersonCard key={p.id} person={p} />)}
            </div>
          )}
          {people.data && <Calendars people={people.data} />}
        </>
      )}
    </section>
  );
}
