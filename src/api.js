// Tiny Supabase client: public reads via PostgREST, writes via the barista edge function.
export const SUPABASE_URL = "https://xtzbgwnxfkdzhysnpwyq.supabase.co";
// Publishable key: safe to ship in the browser. Row level security only allows reads.
export const SUPABASE_KEY = "sb_publishable_Vb6dY0CKAo0nvcZvyWBiXg_dFav-0dM";

const CODE_KEY = "2b1c.barista";

export function getCode() {
  try { return localStorage.getItem(CODE_KEY) || ""; } catch { return ""; }
}
export function setCode(code) {
  try { code ? localStorage.setItem(CODE_KEY, code) : localStorage.removeItem(CODE_KEY); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event("barista-change"));
}

export async function select(table, query = "select=*") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Couldn't load ${table} (${res.status})`);
  return res.json();
}

export async function barista(action, payload = {}, code = getCode()) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/barista`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, action, code }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Simple in-memory cache + change notifications so pages refresh after edits
const cache = new Map();
const listeners = new Set();

export function invalidate() {
  cache.clear();
  listeners.forEach((fn) => fn());
}
export function onInvalidate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function cached(key, loader) {
  if (!cache.has(key)) {
    const p = loader().catch((e) => { cache.delete(key); throw e; });
    cache.set(key, p);
  }
  return cache.get(key);
}

export const loadPeople = () => cached("people", () => select("people", "select=id,slug,name,color,sort,garmin_connected,garmin_last_sync,garmin_last_error&order=sort"));
export const loadEvents = () => cached("events", () => select("events", "select=*&order=starts_on"));
export const loadChecklist = () => cached("checklist", () => select("checklist_items", "select=*&order=list,sort,created_at"));
export const loadActivities = (sinceIso) =>
  cached(`acts:${sinceIso || "all"}`, () =>
    select(
      "activities",
      `select=id,person_id,sport,activity_type,name,start_time,start_time_local,distance_m,duration_s,elevation_gain_m,avg_hr,max_hr,training_load,aerobic_te,hr_zones_s&order=start_time.desc&limit=1000${sinceIso ? `&start_time=gte.${encodeURIComponent(sinceIso)}` : ""}`,
    ),
  );

// Automatic Garmin sync: if anyone's last sync is over an hour old, ask the server to refresh
// (it skips anyone synced in the last 30 minutes), then reload the pages' data.
let autoBusy = false, autoLast = 0;
export async function autoSyncGarmin() {
  if (autoBusy || Date.now() - autoLast < 5 * 60e3) return;
  autoBusy = true; autoLast = Date.now();
  try {
    const people = await loadPeople();
    const stale = people.some((p) => p.garmin_connected && (!p.garmin_last_sync || Date.now() - new Date(p.garmin_last_sync).getTime() > 60 * 60e3));
    if (!stale) return;
    const res = await barista("garmin.auto", {}, "");
    if (Object.values(res.synced || {}).length) invalidate();
  } catch { /* quiet: the hourly server job will catch up */ }
  finally { autoBusy = false; }
}
