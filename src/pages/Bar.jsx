import { useState } from "react";
import { useData, useBaristaCode } from "../hooks.js";
import { loadChecklist, barista, invalidate } from "../api.js";
import { Loading, ErrorNote, NeedCode } from "../ui.jsx";
import { BlurText, SpotlightCard } from "../bits.jsx";

const LISTS = [
  { key: "logistics", title: "Logistics", note: "Registration, shuttles, lodging" },
  { key: "ski", title: "Ski", note: "Team gear and mandatory kit" },
  { key: "run", title: "Run", note: "Fuel, bags, layers" },
  { key: "bike", title: "Bike", note: "Bike, spares, transport" },
];

function List({ list, items, code }) {
  const [label, setLabel] = useState("");
  const [err, setErr] = useState(null);
  const done = items.filter((i) => i.done).length;

  const toggle = async (item) => {
    if (!code) return;
    try { await barista("check.toggle", { id: item.id, done: !item.done }); invalidate(); } catch (e) { setErr(e); }
  };
  const add = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    try { await barista("check.add", { list: list.key, label }); setLabel(""); invalidate(); } catch (e2) { setErr(e2); }
  };
  const remove = async (item) => {
    try { await barista("check.delete", { id: item.id }); invalidate(); } catch (e) { setErr(e); }
  };

  return (
    <SpotlightCard className="bar-card">
      <div className="bar-head">
        <h3>{list.title}</h3>
        <span className="muted">{done}/{items.length}</span>
      </div>
      <p className="muted small">{list.note}</p>
      <div className="bar-progress"><span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></div>
      <ul className="checklist">
        {items.map((i) => (
          <li key={i.id} className={i.done ? "is-done" : ""}>
            <label>
              <input type="checkbox" checked={i.done} disabled={!code} onChange={() => toggle(i)} />
              <span>{i.label}</span>
            </label>
            {code && <button className="icon-btn" onClick={() => remove(i)} aria-label={`Remove ${i.label}`}>×</button>}
          </li>
        ))}
      </ul>
      {code && (
        <form className="add-row" onSubmit={add}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an item…" maxLength={200} />
          <button className="btn btn-sm btn-dark">Add</button>
        </form>
      )}
      {err && <ErrorNote error={err} />}
    </SpotlightCard>
  );
}

export function Bar() {
  const items = useData(loadChecklist);
  const code = useBaristaCode();
  return (
    <section className="section section-first">
      <p className="eyebrow">The Bar Station</p>
      <BlurText as="h1" text="Mise en place for three races." className="page-title" />
      <p className="lede">Everything we need dialed in before each leg. Tick things off as you go.</p>
      {!code && <NeedCode />}
      {items.error && <ErrorNote error={items.error} />}
      {items.loading ? <Loading /> : (
        <div className="bar-grid">
          {LISTS.map((l) => (
            <List key={l.key} list={l} code={code} items={(items.data || []).filter((i) => i.list === l.key)} />
          ))}
        </div>
      )}
    </section>
  );
}
