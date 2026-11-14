// 2beans1cup "barista" edge function.
// Every write to the cafe goes through here and requires the shared passcode
// stored in the BARISTA_CODE secret. Garmin keys are stored server-side only.
import { createClient } from "npm:@supabase/supabase-js@2";

const GARMIN = "https://personal.connectapi.garmin.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

const SPORTS = ["ski", "run", "bike", "other"];
const KINDS = ["race", "training", "rest", "logistics"];
const LISTS = ["ski", "run", "bike", "logistics"];

function sportFor(typeKey = ""): string {
  const k = typeKey.toLowerCase();
  if (/ski|snowboard|splitboard|snowshoe/.test(k)) return "ski";
  if (/run|trail/.test(k)) return "run";
  if (/cycl|bik|gravel|mtb/.test(k)) return "bike";
  return "other";
}

// ---------- Garmin ----------
async function garminToken(personId: string, apiKey?: string) {
  if (!apiKey) {
    const { data } = await db.from("garmin_keys").select("*").eq("person_id", personId).maybeSingle();
    if (!data) throw new Error("No Garmin key saved for this bean yet.");
    if (data.access_token && data.token_expires_at && new Date(data.token_expires_at).getTime() > Date.now() + 60_000) {
      return data.access_token as string;
    }
    apiKey = data.api_key as string;
  }
  const res = await fetch(`${GARMIN}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: "POST",
    // Garmin answers 406 if we demand JSON here; accept whatever it sends and parse below.
    headers: { Authorization: `ApiKey ${apiKey}`, Accept: "*/*" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Garmin rejected the key (${res.status}): ${text.slice(0, 200)}`);
  let token = text.trim();
  let expiresIn = 3600;
  try {
    const j = JSON.parse(text);
    token = j.access_token ?? j.accessToken ?? j.token ?? token;
    expiresIn = Number(j.expires_in ?? j.expiresIn ?? expiresIn);
  } catch { /* plain-text token */ }
  if (!token) throw new Error("Garmin returned no access token.");
  return { token, expiresIn, apiKey };
}

async function tokenFor(personId: string): Promise<string> {
  const t = await garminToken(personId);
  if (typeof t === "string") return t;
  await db.from("garmin_keys").update({
    access_token: t.token,
    token_expires_at: new Date(Date.now() + t.expiresIn * 1000).toISOString(),
  }).eq("person_id", personId);
  return t.token;
}

function mapActivity(personId: string, a: any) {
  const zones = [1, 2, 3, 4, 5].map((z) => a[`hrTimeInZone_${z}`] ?? null);
  const gmt = a.startTimeGMT ? new Date(a.startTimeGMT.replace(" ", "T") + "Z") : new Date(a.beginTimestamp);
  return {
    person_id: personId,
    source: "garmin",
    external_id: String(a.activityId),
    sport: sportFor(a.activityType?.typeKey),
    activity_type: a.activityType?.typeKey ?? null,
    name: a.activityName ?? null,
    start_time: gmt.toISOString(),
    start_time_local: a.startTimeLocal ? a.startTimeLocal.replace(" ", "T") : null,
    distance_m: a.distance ?? null,
    duration_s: a.movingDuration ?? a.duration ?? null,
    elapsed_s: a.elapsedDuration ?? null,
    elevation_gain_m: a.elevationGain ?? null,
    elevation_loss_m: a.elevationLoss ?? null,
    avg_hr: a.averageHR ?? null,
    max_hr: a.maxHR ?? null,
    avg_speed_mps: a.averageSpeed ?? null,
    calories: a.calories ?? null,
    training_load: a.activityTrainingLoad ?? null,
    aerobic_te: a.aerobicTrainingEffect ?? null,
    hr_zones_s: zones.some((z) => z != null) ? zones : null,
  };
}

async function syncGarmin(personId: string) {
  const token = await tokenFor(personId);
  const { data: person } = await db.from("people").select("garmin_last_sync").eq("id", personId).single();
  const since = person?.garmin_last_sync
    ? new Date(new Date(person.garmin_last_sync).getTime() - 7 * 864e5)
    : new Date(Date.now() - 365 * 864e5);
  const startDate = since.toISOString().slice(0, 10);
  let start = 0;
  let total = 0;
  for (let page = 0; page < 20; page++) {
    const url = `${GARMIN}/activitylist-service/activities/search/activities?start=${start}&limit=99&startDate=${startDate}&sortOrder=desc`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`Garmin activity list failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) break;
    const rows = list.map((a: any) => mapActivity(personId, a));
    const { error } = await db.from("activities").upsert(rows, { onConflict: "person_id,source,external_id" });
    if (error) throw new Error(`Saving activities failed: ${error.message}`);
    total += rows.length;
    if (list.length < 99) break;
    start += 99;
  }
  await db.from("people").update({ garmin_last_sync: new Date().toISOString(), garmin_last_error: null, garmin_connected: true }).eq("id", personId);
  return total;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = Deno.env.get("BARISTA_CODE");
  if (!secret) return json({ error: "The barista code hasn't been set up yet (BARISTA_CODE secret)." }, 503);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const { code, action } = body ?? {};
  if (typeof code !== "string" || !safeEqual(code, secret)) return json({ error: "Wrong barista code." }, 401);

  try {
    switch (action) {
      case "verify":
        return json({ ok: true });

      case "person.update": {
        const patch: Record<string, unknown> = {};
        if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 40);
        if (typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)) patch.color = body.color;
        const { error } = await db.from("people").update(patch).eq("id", body.id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "event.upsert": {
        const e = body.event ?? {};
        const row = {
          title: String(e.title ?? "").slice(0, 120),
          kind: KINDS.includes(e.kind) ? e.kind : "training",
          sport: SPORTS.includes(e.sport) ? e.sport : null,
          who: typeof e.who === "string" ? e.who.slice(0, 40) : "both",
          starts_on: e.starts_on,
          ends_on: e.ends_on || null,
          notes: e.notes ? String(e.notes).slice(0, 1000) : null,
        };
        if (!row.title || !row.starts_on) return json({ error: "Title and date are required." }, 400);
        const q = e.id ? db.from("events").update(row).eq("id", e.id) : db.from("events").insert(row);
        const { error } = await q;
        if (error) throw error;
        return json({ ok: true });
      }

      case "event.delete": {
        const { error } = await db.from("events").delete().eq("id", body.id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "check.add": {
        const list = LISTS.includes(body.list) ? body.list : "logistics";
        const label = String(body.label ?? "").trim().slice(0, 200);
        if (!label) return json({ error: "Label required." }, 400);
        const { error } = await db.from("checklist_items").insert({ list, label, who: body.who ?? "both", sort: Date.now() % 1e9 });
        if (error) throw error;
        return json({ ok: true });
      }

      case "check.toggle": {
        const { error } = await db.from("checklist_items").update({ done: !!body.done }).eq("id", body.id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "check.delete": {
        const { error } = await db.from("checklist_items").delete().eq("id", body.id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "garmin.save": {
        const apiKey = String(body.api_key ?? "").trim();
        if (!apiKey) return json({ error: "Paste your Garmin personal API key." }, 400);
        const t = await garminToken(body.person_id, apiKey); // validates the key
        if (typeof t === "string") throw new Error("unexpected");
        const { error } = await db.from("garmin_keys").upsert({
          person_id: body.person_id,
          api_key: apiKey,
          access_token: t.token,
          token_expires_at: new Date(Date.now() + t.expiresIn * 1000).toISOString(),
          saved_at: new Date().toISOString(),
        });
        if (error) throw error;
        await db.from("people").update({ garmin_connected: true, garmin_last_error: null, garmin_last_sync: null }).eq("id", body.person_id);
        const count = await syncGarmin(body.person_id);
        return json({ ok: true, synced: count });
      }

      case "garmin.sync": {
        const count = await syncGarmin(body.person_id);
        return json({ ok: true, synced: count });
      }

      case "garmin.disconnect": {
        await db.from("garmin_keys").delete().eq("person_id", body.person_id);
        await db.from("people").update({ garmin_connected: false }).eq("id", body.person_id);
        return json({ ok: true });
      }

      // ---------- Private free/busy (never readable without the barista code) ----------
      case "busy.replace": {
        const blocks = Array.isArray(body.blocks) ? body.blocks : [];
        if (blocks.length > 10000) return json({ error: "Too many busy blocks in one upload." }, 400);
        const rows = [];
        for (const b of blocks) {
          const s = new Date(b?.s), e = new Date(b?.e);
          if (isNaN(+s) || isNaN(+e) || e <= s) continue;
          rows.push({ person_id: body.person_id, starts_at: s.toISOString(), ends_at: e.toISOString(), all_day: !!b.all_day });
        }
        const { error: delErr } = await db.from("busy_blocks").delete().eq("person_id", body.person_id);
        if (delErr) throw delErr;
        for (let i = 0; i < rows.length; i += 1000) {
          const { error } = await db.from("busy_blocks").insert(rows.slice(i, i + 1000));
          if (error) throw error;
        }
        const { error: upErr } = await db.from("busy_uploads").upsert({
          person_id: body.person_id,
          uploaded_at: new Date().toISOString(),
          range_start: body.range_start ?? null,
          range_end: body.range_end ?? null,
          block_count: rows.length,
        });
        if (upErr) throw upErr;
        return json({ ok: true, saved: rows.length });
      }

      case "busy.list": {
        const from = new Date(body.from ?? Date.now() - 7 * 864e5).toISOString();
        const to = new Date(body.to ?? Date.now() + 60 * 864e5).toISOString();
        const { data: blocks, error } = await db.from("busy_blocks")
          .select("person_id, starts_at, ends_at, all_day")
          .lt("starts_at", to).gt("ends_at", from).order("starts_at").limit(10000);
        if (error) throw error;
        const { data: uploads, error: e2 } = await db.from("busy_uploads").select("*");
        if (e2) throw e2;
        return json({ ok: true, blocks, uploads });
      }

      case "busy.clear": {
        await db.from("busy_blocks").delete().eq("person_id", body.person_id);
        await db.from("busy_uploads").delete().eq("person_id", body.person_id);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String((err as any)?.message ?? err);
    if (String(action).startsWith("garmin.") && body?.person_id) {
      await db.from("people").update({ garmin_last_error: message.slice(0, 500) }).eq("id", body.person_id);
    }
    return json({ error: message }, 500);
  }
});
