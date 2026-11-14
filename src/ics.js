// Minimal iCalendar (.ics) → busy blocks, entirely in the browser.
// Output is only { s, e, all_day } — titles, attendees, locations and notes are never kept.
// Handles: line folding, TZID (IANA + Outlook/Windows names), UTC/floating/all-day times,
// DURATION, RRULE (DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY, BYSETPOS),
// EXDATE, RECURRENCE-ID overrides, and skips cancelled / free / transparent events.

const WINDOWS_TZ = {
  "mountain standard time": "America/Denver",
  "us mountain standard time": "America/Phoenix",
  "pacific standard time": "America/Los_Angeles",
  "central standard time": "America/Chicago",
  "eastern standard time": "America/New_York",
  "us eastern standard time": "America/Indianapolis",
  "alaskan standard time": "America/Anchorage",
  "hawaiian standard time": "Pacific/Honolulu",
  "atlantic standard time": "America/Halifax",
  "gmt standard time": "Europe/London",
  "greenwich standard time": "Atlantic/Reykjavik",
  "utc": "UTC",
  "coordinated universal time": "UTC",
  "w. europe standard time": "Europe/Berlin",
  "romance standard time": "Europe/Paris",
  "central europe standard time": "Europe/Budapest",
  "central european standard time": "Europe/Warsaw",
  "e. europe standard time": "Europe/Bucharest",
  "india standard time": "Asia/Kolkata",
  "china standard time": "Asia/Shanghai",
  "tokyo standard time": "Asia/Tokyo",
  "aus eastern standard time": "Australia/Sydney",
};
const FRIENDLY_TZ = [
  [/mountain time.*arizona|arizona/i, "America/Phoenix"],
  [/mountain time/i, "America/Denver"],
  [/pacific time/i, "America/Los_Angeles"],
  [/central time/i, "America/Chicago"],
  [/eastern time/i, "America/New_York"],
  [/alaska/i, "America/Anchorage"],
  [/hawaii/i, "Pacific/Honolulu"],
];

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const DAY_MS = 864e5;
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function validTz(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}
export function resolveTz(tzid) {
  if (!tzid) return null;
  const t = tzid.replace(/^"|"$/g, "").trim();
  if (validTz(t)) return t;
  const w = WINDOWS_TZ[t.toLowerCase()];
  if (w) return w;
  for (const [re, iana] of FRIENDLY_TZ) if (re.test(t)) return iana;
  const m = t.match(/\(UTC([+-])(\d{2}):(\d{2})\)/);
  if (m && m[2] === "00" && m[3] === "00") return "UTC";
  return LOCAL_TZ;
}

const dtfCache = new Map();
function tzOffsetMs(utcMs, tz) {
  if (tz === "UTC") return 0;
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    dtfCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}
// Wall-clock time in a zone → UTC ms (handles DST transitions)
export function zonedToUtc(w, tz) {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  const off1 = tzOffsetMs(guess, tz);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, tz);
  if (off2 !== off1) utc = guess - off2;
  return utc;
}

function parseValue(value, params) {
  const v = value.trim();
  const isDate = params.VALUE === "DATE" || /^\d{8}$/.test(v);
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const wall = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  if (isDate) return { wall, allDay: true, tz: LOCAL_TZ };
  if (m[7]) return { wall, allDay: false, tz: "UTC" };
  return { wall, allDay: false, tz: params.TZID ? resolveTz(params.TZID) : LOCAL_TZ };
}
const toUtc = (dt) => zonedToUtc(dt.wall, dt.tz);

function parseDuration(v) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+m[2] || 0) * 7 * 86400 + (+m[3] || 0) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

function parseLine(line) {
  // NAME;PARAM=VAL;PARAM="V:AL":VALUE
  let i = 0, inQ = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ":" && !inQ) break;
  }
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const parts = head.split(";");
  const name = parts[0].toUpperCase();
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

function readEvents(text) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events = [];
  let cur = null, depth = 0;
  for (const raw of lines) {
    if (!raw) continue;
    const { name, params, value } = parseLine(raw);
    if (name === "BEGIN") {
      if (value.toUpperCase() === "VEVENT" && depth === 0) { cur = {}; continue; }
      if (cur) depth++;
      continue;
    }
    if (name === "END") {
      if (cur && depth > 0) { depth--; continue; }
      if (value.toUpperCase() === "VEVENT" && cur) { events.push(cur); cur = null; }
      continue;
    }
    if (cur && depth === 0) (cur[name] ||= []).push({ params, value });
  }
  return events;
}

const first = (ev, k) => (ev[k] ? ev[k][0] : null);

function isCancelled(ev) {
  if (first(ev, "STATUS")?.value.toUpperCase() === "CANCELLED") return true;
  return /^cancel+ed:/i.test(first(ev, "SUMMARY")?.value || "");
}

function isFree(ev) {
  const status = first(ev, "STATUS")?.value.toUpperCase();
  if (status === "CANCELLED") return true;
  const transp = first(ev, "TRANSP")?.value.toUpperCase();
  if (transp === "TRANSPARENT") return true;
  const busy = (first(ev, "X-MICROSOFT-CDO-BUSYSTATUS") || first(ev, "X-MICROSOFT-CDO-INTENDEDSTATUS"))?.value.toUpperCase();
  if (busy === "FREE") return true;
  const summary = first(ev, "SUMMARY")?.value || "";
  if (/^cancel+ed:/i.test(summary)) return true; // Outlook keeps cancelled meetings with this prefix
  return false;
}

// ---- recurrence ----
function parseRRule(v) {
  const r = {};
  for (const part of v.split(";")) {
    const [k, val] = part.split("=");
    if (k && val != null) r[k.toUpperCase()] = val;
  }
  return r;
}
const wallAddDays = (w, n) => {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d + n));
  return { ...w, y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const wallDow = (w) => new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay();
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const wallKey = (w) => w.y * 10000 + w.m * 100 + w.d;

function nthWeekdaysInMonth(y, m, byday) {
  // byday like ["2TU", "-1FR", "MO"]
  const out = [];
  const dim = daysInMonth(y, m);
  for (const spec of byday) {
    const mm = spec.match(/^([+-]?\d+)?([A-Z]{2})$/);
    if (!mm) continue;
    const wd = WEEKDAYS.indexOf(mm[2]);
    const days = [];
    for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === wd) days.push(d);
    if (mm[1]) {
      const n = +mm[1];
      const pick = n > 0 ? days[n - 1] : days[days.length + n];
      if (pick) out.push(pick);
    } else out.push(...days);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function applySetPos(list, setpos) {
  if (!setpos) return list;
  const out = [];
  for (const p of setpos.split(",").map(Number)) {
    const v = p > 0 ? list[p - 1] : list[list.length + p];
    if (v != null) out.push(v);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

// Yields wall-clock start dates (same time of day as DTSTART) for each occurrence
function* expand(start, rule, windowEndUtc, tz) {
  const freq = (rule.FREQ || "").toUpperCase();
  const interval = Math.max(1, +rule.INTERVAL || 1);
  const count = rule.COUNT ? +rule.COUNT : Infinity;
  let untilUtc = Infinity;
  if (rule.UNTIL) {
    const u = parseValue(rule.UNTIL, {});
    if (u) untilUtc = u.allDay ? zonedToUtc({ ...u.wall, h: 23, mi: 59, s: 59 }, tz) : u.tz === "UTC" ? toUtc(u) : zonedToUtc(u.wall, tz);
  }
  const byday = rule.BYDAY ? rule.BYDAY.split(",") : null;
  const bymonthday = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(",").map(Number) : null;
  const time = { h: start.h, mi: start.mi, s: start.s };
  let emitted = 0;
  const limitUtc = Math.min(untilUtc, windowEndUtc);
  const startKey = wallKey(start);

  const emit = function* (w) {
    if (wallKey(w) < startKey) return false;
    const utc = zonedToUtc({ ...w, ...time }, tz);
    if (utc > limitUtc) return "stop";
    emitted++;
    yield { ...w, ...time };
    return emitted >= count ? "stop" : false;
  };

  if (freq === "DAILY") {
    for (let i = 0; i < 5000; i++) {
      const w = wallAddDays(start, i * interval);
      if (byday && !byday.some((b) => b.slice(-2) === WEEKDAYS[wallDow(w)])) { if (zonedToUtc({ ...w, ...time }, tz) > limitUtc) return; continue; }
      const r = yield* emit(w);
      if (r === "stop") return;
    }
  } else if (freq === "WEEKLY") {
    const wkst = WEEKDAYS.indexOf((rule.WKST || "MO").toUpperCase());
    const days = (byday || [WEEKDAYS[wallDow(start)]]).map((b) => WEEKDAYS.indexOf(b.slice(-2))).filter((d) => d >= 0);
    const back = (wallDow(start) - wkst + 7) % 7;
    const weekStart = wallAddDays(start, -back);
    for (let wk = 0; wk < 2000; wk++) {
      const base = wallAddDays(weekStart, wk * 7 * interval);
      const offsets = days.map((d) => (d - wkst + 7) % 7).sort((a, b) => a - b);
      for (const o of offsets) {
        const r = yield* emit(wallAddDays(base, o));
        if (r === "stop") return;
      }
      if (zonedToUtc({ ...base, ...time }, tz) > limitUtc) return;
    }
  } else if (freq === "MONTHLY") {
    for (let i = 0; i < 600; i++) {
      const total = start.m - 1 + i * interval;
      const y = start.y + Math.floor(total / 12);
      const m = (total % 12) + 1;
      let days;
      if (byday) days = applySetPos(nthWeekdaysInMonth(y, m, byday), rule.BYSETPOS);
      else if (bymonthday) days = bymonthday.map((d) => (d < 0 ? daysInMonth(y, m) + d + 1 : d)).filter((d) => d >= 1 && d <= daysInMonth(y, m)).sort((a, b) => a - b);
      else days = start.d <= daysInMonth(y, m) ? [start.d] : [];
      for (const d of days) {
        const r = yield* emit({ y, m, d });
        if (r === "stop") return;
      }
      if (zonedToUtc({ y, m, d: 1, ...time }, tz) > limitUtc) return;
    }
  } else if (freq === "YEARLY") {
    for (let i = 0; i < 200; i++) {
      const y = start.y + i * interval;
      if (start.d <= daysInMonth(y, start.m)) {
        const r = yield* emit({ y, m: start.m, d: start.d });
        if (r === "stop") return;
      }
      if (y > start.y + 50) return;
    }
  } else {
    yield { ...start };
  }
}

/**
 * Parse ICS text into busy blocks within [fromMs, toMs].
 * Returns { blocks: [{ s, e, all_day }], stats }
 */
export function icsToBusy(text, { fromMs = Date.now() - 14 * DAY_MS, toMs = Date.now() + 120 * DAY_MS, keepFree = false } = {}) {
  const events = readEvents(text);
  const stats = { events: events.length, skippedFree: 0, recurring: 0 };

  // RECURRENCE-ID overrides: remove those instances from their series (the override is its own VEVENT)
  const overridden = new Map(); // uid → Set(utc ms of original start)
  for (const ev of events) {
    const rid = first(ev, "RECURRENCE-ID");
    const uid = first(ev, "UID")?.value;
    if (rid && uid) {
      const dt = parseValue(rid.value, rid.params);
      if (dt) (overridden.get(uid) || overridden.set(uid, new Set()).get(uid)).add(toUtc(dt));
    }
  }

  const out = [];
  for (const ev of events) {
    const ds = first(ev, "DTSTART");
    if (!ds) continue;
    const start = parseValue(ds.value, ds.params);
    if (!start) continue;
    // Time-off/holiday calendars often mark days as "free"; keep those, but still drop cancellations
    const free = keepFree ? isCancelled(ev) : isFree(ev);

    let durMs;
    const de = first(ev, "DTEND");
    const du = first(ev, "DURATION");
    if (de) {
      const end = parseValue(de.value, de.params);
      durMs = end ? toUtc(end) - toUtc(start) : 0;
    } else if (du) durMs = parseDuration(du.value);
    else durMs = start.allDay ? DAY_MS : 0;
    if (durMs <= 0) durMs = start.allDay ? DAY_MS : 0;
    if (!durMs) continue;

    const rr = first(ev, "RRULE");
    const uid = first(ev, "UID")?.value;
    const isOverride = !!first(ev, "RECURRENCE-ID");
    const exdates = new Set();
    for (const ex of ev.EXDATE || []) {
      for (const v of ex.value.split(",")) {
        const dt = parseValue(v, ex.params);
        if (dt) exdates.add(dt.allDay ? wallKey(dt.wall) : toUtc(dt));
      }
    }
    const skip = overridden.get(uid);

    const occurrences = [];
    if (rr && !isOverride) {
      stats.recurring++;
      for (const w of expand(start.wall, parseRRule(rr.value), toMs + DAY_MS, start.tz)) {
        const s = zonedToUtc(w, start.tz);
        if (exdates.has(start.allDay ? wallKey(w) : s)) continue;
        if (skip && skip.has(s)) continue;
        occurrences.push({ s, wall: w });
      }
    } else {
      occurrences.push({ s: toUtc(start), wall: start.wall });
    }

    for (const o of occurrences) {
      let s = o.s;
      let e = s + durMs;
      if (start.allDay) {
        const days = Math.max(1, Math.round(durMs / DAY_MS));
        e = zonedToUtc({ ...wallAddDays(o.wall, days), h: 0, mi: 0, s: 0 }, start.tz);
      }
      if (e <= fromMs || s >= toMs) continue;
      if (free) { stats.skippedFree++; continue; }
      out.push({ s, e, all_day: start.allDay });
    }
  }

  // Merge overlapping timed blocks so we store as little as possible
  const timed = out.filter((b) => !b.all_day).sort((a, b) => a.s - b.s);
  const merged = [];
  for (const b of timed) {
    const last = merged[merged.length - 1];
    if (last && b.s <= last.e) last.e = Math.max(last.e, b.e);
    else merged.push({ ...b });
  }
  const allDay = out.filter((b) => b.all_day);
  const blocks = [...merged, ...allDay]
    .sort((a, b) => a.s - b.s)
    .map((b) => ({ s: new Date(b.s).toISOString(), e: new Date(b.e).toISOString(), all_day: b.all_day }));
  return { blocks, stats: { ...stats, blocks: blocks.length, from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() } };
}
