import { useEffect, useRef, useState } from "react";
import { Eyebrow, BeanDot } from "../ui.jsx";
import { select, barista, loadPeople } from "../api.js";
import { useBaristaCode } from "../hooks.js";
import { fmtDay } from "../format.js";

// Doppio Drift: a downhill runner. The latte-art cup skis the Elk Mountains. Endless mode chases
// distance; Race day is one seeded course per day (Crested Butte to Aspen) against the clock.
// Everything is drawn on one canvas, no images.

const C = { crema: "#f4ede3", paper: "#fbf8f3", roast: "#2b1d14", roast2: "#4a3628", muted: "#7a6a5c", clay: "#b4683f", sage: "#5b7a6a", coffee: "#b47c52", milk: "#fbf6ee", snow: "#fffdf9" };
const BEST_KEY = "doppio.drift.best";
const PLAYER_KEY = "doppio.drift.player";
const MODE_KEY = "doppio.drift.mode";

// Cup geometry, in the same 120-unit space as the logo (brand/build_mark.py)
const CUP = {
  body: new Path2D("M21 46 C 21 74, 37 90, 55 90 C 73 90, 89 74, 89 46 Z"),
  handle: new Path2D("M89 52 C 106 50, 107 74, 85 72"),
  t1: new Path2D("M41.14 28.51 L42.82 29.18 L44.04 29.94 L44.76 30.81 L44.98 31.78 L44.74 32.86 L44.09 34.02 L43.14 35.25 L42.00 36.52 L40.80 37.80 L39.69 39.06 L38.78 40.28 L38.20 41.43 L38.04 42.48 L38.36 43.44 L39.17 44.29 L40.48 45.03 L42.24 45.67 L44.36 46.24 L46.74 46.75 L49.25 47.24 L51.77 47.72 L54.14 48.23 L56.26 48.80 L58.02 49.44 L59.33 50.19 L60.15 51.03 L60.46 51.99 L60.30 53.05 L59.72 54.19 L58.82 55.41 L57.70 56.67 L56.51 57.95 L55.37 59.22 L54.41 60.45 L53.77 61.61 L53.52 62.69 L53.74 63.67 L54.47 64.53 L55.69 65.29 L57.36 65.96 L57.36 65.96"),
  t2: new Path2D("M53.79 25.80 L55.46 26.46 L56.68 27.22 L57.41 28.09 L57.63 29.06 L57.38 30.14 L56.73 31.30 L55.78 32.53 L54.64 33.80 L53.45 35.08 L52.33 36.34 L51.43 37.56 L50.85 38.71 L50.69 39.76 L51.00 40.72 L51.82 41.57 L53.13 42.31 L54.89 42.95 L57.00 43.52 L59.38 44.03 L61.90 44.52 L64.41 45.00 L66.79 45.51 L68.91 46.08 L70.67 46.72 L71.97 47.47 L72.79 48.31 L73.11 49.27 L72.95 50.33 L72.37 51.47 L71.46 52.69 L70.35 53.96 L69.15 55.24 L68.01 56.50 L67.06 57.73 L66.41 58.89 L66.17 59.97 L66.39 60.95 L67.11 61.81 L68.33 62.57 L70.01 63.24 L70.01 63.24"),
};
const CUP_SCALE = 0.6;          // 120 units -> ~70px box
const CUP_W = (104 - 21) * CUP_SCALE;
const CUP_H = (90 - 27) * CUP_SCALE;

function drawCup(ctx, x, groundY, { tilt = 0, squash = 1, spilled = false, fill = 1 }) {
  ctx.save();
  // anchor: bottom-centre of the cup body (55, 90)
  ctx.translate(x, groundY);
  ctx.rotate(tilt);
  ctx.scale(CUP_SCALE, CUP_SCALE * squash);
  ctx.translate(-55, -90);
  ctx.lineCap = "round";
  ctx.strokeStyle = C.sage; ctx.lineWidth = 6; ctx.stroke(CUP.handle);
  ctx.fillStyle = C.sage; ctx.fill(CUP.body);
  ctx.fillStyle = "#f6efe4"; ctx.beginPath(); ctx.ellipse(55, 46, 34, 19.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.coffee; ctx.beginPath(); ctx.ellipse(55, 46, 31, 16.5, 0, 0, Math.PI * 2); ctx.fill();
  if (!spilled && fill > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.75 * fill;
    ctx.beginPath(); ctx.ellipse(55, 46, 29.5, 15.7, 0, 0, Math.PI * 2); ctx.clip();
    ctx.lineJoin = "round";
    for (const t of [CUP.t1, CUP.t2]) {
      ctx.strokeStyle = C.milk; ctx.lineWidth = 5.2; ctx.stroke(t);
      ctx.strokeStyle = C.coffee; ctx.lineWidth = 1.9; ctx.stroke(t);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawPine(ctx, x, groundY, w, h) {
  ctx.fillStyle = C.roast2; ctx.fillRect(x + w / 2 - 3, groundY - 8, 6, 8);
  const tiers = h > 50 ? 3 : 2;
  for (let i = 0; i < tiers; i++) {
    const top = groundY - h + (i * (h - 8)) / (tiers + 0.4);
    const base = groundY - 6 - ((tiers - 1 - i) * (h - 8)) / (tiers * 1.6);
    const half = (w / 2) * (0.62 + (0.38 * (i + 1)) / tiers);
    ctx.fillStyle = C.sage;
    ctx.beginPath(); ctx.moveTo(x + w / 2, top); ctx.lineTo(x + w / 2 + half, base); ctx.lineTo(x + w / 2 - half, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.snow; // snow on each tier tip
    ctx.beginPath(); ctx.moveTo(x + w / 2, top); ctx.lineTo(x + w / 2 + half * 0.32, top + (base - top) * 0.3); ctx.lineTo(x + w / 2 - half * 0.32, top + (base - top) * 0.3); ctx.closePath(); ctx.fill();
  }
}

function drawRock(ctx, x, groundY, w, h) {
  ctx.fillStyle = C.roast2;
  ctx.beginPath();
  ctx.moveTo(x, groundY); ctx.lineTo(x + w * 0.12, groundY - h * 0.7); ctx.lineTo(x + w * 0.42, groundY - h);
  ctx.lineTo(x + w * 0.78, groundY - h * 0.82); ctx.lineTo(x + w, groundY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.snow;
  ctx.beginPath(); ctx.moveTo(x + w * 0.18, groundY - h * 0.74); ctx.lineTo(x + w * 0.42, groundY - h); ctx.lineTo(x + w * 0.74, groundY - h * 0.84); ctx.lineTo(x + w * 0.5, groundY - h * 0.72); ctx.closePath(); ctx.fill();
}

// Terrain-park kicker: a snow wedge rising to a lip on its downhill (right) end
const KICKERS = { s: { w: 70, h: 14, launch: 640 }, m: { w: 96, h: 24, launch: 830 }, l: { w: 128, h: 36, launch: 1040 } };
function drawKicker(ctx, x, groundY, w, h) {
  ctx.fillStyle = "#efe6da";
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.quadraticCurveTo(x + w * 0.62, groundY - h * 0.18, x + w, groundY - h); ctx.lineTo(x + w + h * 0.35, groundY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(43,29,20,0.18)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, groundY); ctx.quadraticCurveTo(x + w * 0.62, groundY - h * 0.18, x + w, groundY - h); ctx.stroke();
  ctx.strokeStyle = C.clay; ctx.lineWidth = 3; ctx.lineCap = "round"; // painted lip line
  ctx.beginPath(); ctx.moveTo(x + w - 1, groundY - h + 1); ctx.lineTo(x + w + h * 0.12, groundY - h * 0.55); ctx.stroke();
  // marker flags on the lip
  ctx.strokeStyle = C.roast2; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + w + 4, groundY - h); ctx.lineTo(x + w + 4, groundY - h - 18); ctx.stroke();
  ctx.fillStyle = C.clay; ctx.beginPath(); ctx.moveTo(x + w + 4, groundY - h - 18); ctx.lineTo(x + w + 14, groundY - h - 14); ctx.lineTo(x + w + 4, groundY - h - 10); ctx.fill();
}
const kickerSurface = (o, x) => (x < o.x || x > o.x + o.w ? null : (() => { const t = (x - o.x) / o.w; return o.h * (2 * (1 - t) * t * 0.18 + t * t); })());

function drawSnowball(ctx, x, y, r, spin) {
  ctx.fillStyle = C.snow; ctx.strokeStyle = "rgba(122,106,92,0.45)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(122,106,92,0.35)";
  ctx.beginPath(); ctx.arc(x, y, r * 0.55, spin, spin + 1.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.3, spin + 3, spin + 4.2); ctx.stroke();
}

function drawRaven(ctx, x, y, w, t) {
  const up = Math.sin(t * 14) > 0;
  ctx.fillStyle = C.roast;
  ctx.beginPath(); ctx.ellipse(x + w * 0.5, y, w * 0.32, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.16, y - 2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.04, y - 3); ctx.lineTo(x - 4, y - 1); ctx.lineTo(x + w * 0.06, y); ctx.fill(); // beak
  ctx.beginPath(); ctx.moveTo(x + w * 0.35, y); ctx.lineTo(x + w * 0.55, y + (up ? -16 : 14)); ctx.lineTo(x + w * 0.7, y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.82, y); ctx.lineTo(x + w * 1.05, y - 4); ctx.lineTo(x + w * 1.0, y + 3); ctx.fill(); // tail
}

// Ridge silhouettes, tiled horizontally
function ridge(seed, n, amp) {
  const pts = [];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i <= n; i++) pts.push(0.25 + rnd() * amp);
  return pts;
}
const FAR = ridge(7, 14, 0.55);
const NEAR = ridge(23, 18, 0.35);

function drawRidge(ctx, pts, offset, W, top, bottom, color, peaks) {
  const span = W * 1.6;
  ctx.fillStyle = color;
  for (let k = -1; k <= 1; k++) {
    const x0 = -((offset % span) + span) % span + k * span;
    ctx.beginPath(); ctx.moveTo(x0, bottom);
    pts.forEach((p, i) => ctx.lineTo(x0 + (i / (pts.length - 1)) * span, top + (bottom - top) * p));
    ctx.lineTo(x0 + span, bottom); ctx.closePath(); ctx.fill();
    if (peaks) { // snowcaps
      ctx.fillStyle = "rgba(255,253,249,0.9)";
      pts.forEach((p, i) => {
        if (i === 0 || i === pts.length - 1 || p > pts[i - 1] || p > pts[i + 1]) return;
        const px = x0 + (i / (pts.length - 1)) * span, py = top + (bottom - top) * p, dx = span / (pts.length - 1);
        const ly = top + (bottom - top) * pts[i - 1], ry = top + (bottom - top) * pts[i + 1];
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(px + dx * 0.28, py + (ry - py) * 0.28); ctx.lineTo(px - dx * 0.28, py + (ly - py) * 0.28); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = color;
    }
  }
}


function drawMoose(ctx, x, g, w, h, t, walking) {
  const sw = walking ? Math.sin(t * 10) * 5 : 0;
  ctx.fillStyle = C.roast2;
  const legTop = g - h * 0.46;
  [[0.2, sw], [0.32, -sw], [0.7, -sw], [0.82, sw]].forEach(([f, d]) => ctx.fillRect(x + w * f + d * 0.4, legTop, 5, g - legTop));
  ctx.beginPath(); ctx.ellipse(x + w * 0.55, g - h * 0.58, w * 0.4, h * 0.17, 0, 0, Math.PI * 2); ctx.fill(); // body
  ctx.beginPath(); ctx.ellipse(x + w * 0.36, g - h * 0.7, w * 0.16, h * 0.13, 0, 0, Math.PI * 2); ctx.fill(); // hump
  ctx.beginPath(); ctx.moveTo(x + w * 0.24, g - h * 0.68); ctx.lineTo(x + w * 0.06, g - h * 0.66); ctx.lineTo(x - w * 0.04, g - h * 0.5); ctx.lineTo(x + w * 0.06, g - h * 0.46); ctx.lineTo(x + w * 0.22, g - h * 0.54); ctx.fill(); // head
  ctx.beginPath(); ctx.moveTo(x + w * 0.08, g - h * 0.5); ctx.lineTo(x + w * 0.1, g - h * 0.38); ctx.lineTo(x + w * 0.14, g - h * 0.49); ctx.fill(); // bell
  ctx.fillStyle = "#9b7b58"; // palmate antlers
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, g - h * 0.68); ctx.quadraticCurveTo(x - w * 0.12, g - h * 0.86, x - w * 0.02, g - h * 0.98); ctx.lineTo(x + w * 0.06, g - h * 0.86); ctx.lineTo(x + w * 0.12, g - h * 0.96); ctx.lineTo(x + w * 0.16, g - h * 0.7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.16, g - h * 0.7); ctx.quadraticCurveTo(x + w * 0.34, g - h * 0.9, x + w * 0.3, g - h * 1.0); ctx.lineTo(x + w * 0.24, g - h * 0.86); ctx.lineTo(x + w * 0.2, g - h * 0.95); ctx.lineTo(x + w * 0.12, g - h * 0.7); ctx.fill();
  ctx.fillStyle = C.snow; ctx.beginPath(); ctx.arc(x + w * 0.05, g - h * 0.6, 1.6, 0, Math.PI * 2); ctx.fill(); // eye glint
}

function drawWell(ctx, x, g, w) {
  ctx.fillStyle = "rgba(74,54,40,0.12)"; ctx.beginPath(); ctx.ellipse(x + w / 2, g + 1, w / 2 + 6, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(43,29,20,0.72)"; ctx.beginPath(); ctx.ellipse(x + w / 2, g + 2, w / 2, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.sage; ctx.beginPath(); ctx.moveTo(x + w / 2, g - 16); ctx.lineTo(x + w / 2 + 8, g + 1); ctx.lineTo(x + w / 2 - 8, g + 1); ctx.fill(); // buried treetop
  ctx.fillStyle = C.snow; ctx.beginPath(); ctx.moveTo(x + w / 2, g - 16); ctx.lineTo(x + w / 2 + 3, g - 10); ctx.lineTo(x + w / 2 - 3, g - 10); ctx.fill();
}

function drawIce(ctx, x, g, w, t) {
  ctx.fillStyle = "rgba(126,170,196,0.5)"; ctx.fillRect(x, g - 1, w, 6);
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.2;
  for (let i = 8; i < w - 8; i += 26) { const k = (Math.sin(t * 3 + i) + 1) / 2; ctx.globalAlpha = 0.4 + 0.6 * k; ctx.beginPath(); ctx.moveTo(x + i, g + 2); ctx.lineTo(x + i + 9, g + 1); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

function drawBean(ctx, x, y, t) {
  const pulse = 1 + Math.sin(t * 5) * 0.08;
  ctx.fillStyle = "rgba(180,104,63,0.16)"; ctx.beginPath(); ctx.arc(x, y, 15 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.5 + Math.sin(t * 2) * 0.2);
  ctx.fillStyle = "#5a3a24"; ctx.beginPath(); ctx.ellipse(0, 0, 7, 9.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d9a273"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -7.5); ctx.bezierCurveTo(-3, -2.5, 3, 2.5, 0, 7.5); ctx.stroke();
  ctx.restore();
}

function drawGate(ctx, x, g, name, finish) {
  const h = finish ? 92 : 78, w = finish ? 120 : 96;
  ctx.fillStyle = C.roast2; ctx.fillRect(x, g - h, 3, h); ctx.fillRect(x + w, g - h, 3, h);
  ctx.fillStyle = finish ? C.clay : C.sage; ctx.fillRect(x, g - h, w + 3, 20);
  ctx.fillStyle = C.snow; ctx.font = `700 ${finish ? 12 : 11}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name.toUpperCase(), x + (w + 3) / 2, g - h + 10.5);
  if (finish) { // checkered strip on the snow
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? C.roast : C.snow; ctx.fillRect(x + 3 + (i * w) / 8, g - 2, w / 8, 4); }
  }
}

// ---------- seeded randomness, daily course ----------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashStr = (str) => [...str].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
export const todayDenver = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());

// Race day: Crested Butte to Aspen, checkpoints with cutoffs (seconds from the start)
const RACE_FT = 4000;
const CHECKPOINTS = [
  { ft: 700, name: "Brush Creek" },
  { ft: 1400, name: "Friends Hut" },
  { ft: 2100, name: "Star Pass" },
  { ft: 2900, name: "Taylor Pass" },
  { ft: 3400, name: "Barnard Hut" },
];
// Skin climbs: skins on at the bottom, stride up, skins off at the pass
const RACE_CLIMBS = [{ start: 1800, end: 2100, name: "Star Pass" }, { start: 2600, end: 2900, name: "Taylor Pass" }];
const ENDLESS_PASSES = ["Star Pass", "Taylor Pass", "Pearl Pass", "Copper Pass", "East Maroon Pass", "Triangle Pass", "Conundrum Pass", "Electric Pass"];
const CLIMB_REF_V = 190, TRANSITION_REF = 1.4; // a decent pace on the skin track, used for cutoffs
const CLIMB_SLOPE = 0.18;
const STRIDE_PERIOD = 1.2; // seconds per swing
const strideMeter = (t) => (Math.sin(t * ((2 * Math.PI) / STRIDE_PERIOD) - Math.PI / 2) + 1) / 2; // 0..1, sweet spot 0.36-0.64
const TIER_FT = 1000;
const baseSpeed = (runT, tier) => Math.min(860, 360 + 9 * runT) + 45 * tier;
// Cutoffs come from a clean, hit-free run plus a small margin
(() => {
  let t = 0, trav = 0; const dt = 1 / 120; const marks = [...CHECKPOINTS.map((c) => c.ft), RACE_FT];
  const times = [], climbs = RACE_CLIMBS.map((c) => ({ ...c }));
  while (trav / 10 < RACE_FT) {
    const ft = trav / 10, c = climbs[0];
    if (c && ft >= c.start && !c.on) { c.on = true; t += TRANSITION_REF; }
    const climbing = c && c.on && ft < c.end;
    if (c && c.on && ft >= c.end) { climbs.shift(); t += TRANSITION_REF; }
    const tier = Math.min(4, Math.floor(ft / TIER_FT));
    trav += (climbing ? CLIMB_REF_V : baseSpeed(t, tier)) * dt; t += dt;
    while (marks.length && trav / 10 >= marks[0]) { marks.shift(); times.push(t); }
  }
  CHECKPOINTS.forEach((c, i) => (c.cutoff = Math.ceil(times[i] * 1.08 + 2)));
})();

const TIERS = [
  "",
  "Tier 1 · Steeper. Ravens, ice and tree wells.",
  "Tier 2 · Moose country.",
  "Tier 3 · Tighter lines.",
  "Tier 4 · Full send.",
];
const DMG = { pine: 0.34, rock: 0.34, raven: 0.34, ball: 0.3, moose: 0.5, well: 0.5 };

function newGame(W, mode, course) {
  const seed = mode === "race" ? hashStr(`doppio-${course}`) : (Math.random() * 2 ** 32) >>> 0;
  return {
    mode, course, rng: mulberry32(seed), state: "ready", t: 0, runT: 0, dist: 0, trav: 0, speed: 360, y: 0, vy: 0,
    ducking: false, obstacles: [], nextIn: W * 0.9, flakes: [], spill: [], spray: [], splash: [],
    aval: null, nextAval: 1200 + (mode === "race" ? 300 : 0), tier: 0, tierT: 0, fill: 1, inv: 0, slowT: 0,
    spin: null, spins: 0, cam: 0, raceT: 0, raceBonus: 0, cpNext: 0, cpMsg: null, cpT: 0, finishSpawned: false,
    phase: "down", climb: mode === "race" ? { ...RACE_CLIMBS[0] } : { start: 1200, end: 1450, name: ENDLESS_PASSES[0] }, climbN: 0,
    climbV: 0, strideT: 0, taps: 0, need: 0, transT: 0, slopeCur: null,
  };
}

export function Drift() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const course = todayDenver();
  const [mode, setMode] = useState(() => { try { return localStorage.getItem(MODE_KEY) === "race" ? "race" : "endless"; } catch { return "endless"; } });
  const modeRef = useRef(mode);
  const raceKey = `doppio.drift.race.${course}`;
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } });
  const [bestRace, setBestRace] = useState(() => { try { return Number(localStorage.getItem(raceKey)) || 0; } catch { return 0; } });
  const [state, setState] = useState("ready");
  const bestRef = useRef(best);
  const bestRaceRef = useRef(bestRace);
  const onOverRef = useRef(null);
  const resetRef = useRef(null);

  const pickMode = (m) => {
    setMode(m); modeRef.current = m; setState("ready");
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
    resetRef.current?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, ground = 0, slope0 = 0.35, slopeMax = 0.45, raf = 0, last = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth; H = W < 560 ? 400 : 480; ground = Math.round(H * (W < 560 ? 0.3 : 0.24));
      // steepest slope that still keeps the far (right-hand) end of the run on screen
      const cx = Math.max(64, W * 0.16);
      slopeMax = Math.min(0.62, (H + 18 - ground) / (W - cx));
      slope0 = Math.min(0.46, slopeMax * 0.84);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const fresh = () => newGame(W, modeRef.current, course);
    gameRef.current = fresh();
    resetRef.current = () => { gameRef.current = fresh(); };
    const g = () => gameRef.current;
    const cupX = () => Math.max(64, W * 0.16);
    const slopeNow = (s) => Math.min(slope0 + 0.03 * s.tier, slopeMax);

    const start = () => { gameRef.current = fresh(); gameRef.current.state = "running"; setState("running"); };
    const tapAction = (s) => {
      if (s.phase === "on" || s.phase === "off") { s.taps++; s.tapFx = 0.15; return; }
      if (s.phase === "climb") {
        if (s.t - (s.lastTap || 0) < 0.12) return; s.lastTap = s.t;
        const m = strideMeter(s.strideT);
        if (m > 0.36 && m < 0.64) { s.climbV = Math.min(280, s.climbV + 95); s.strideFx = 0.35; }
        else { s.climbV = Math.max(40, s.climbV - 35); s.slipFx = 0.45; }
      }
    };
    const jump = () => {
      const s = g();
      if (s.state !== "running") { if (s.state !== "ready" && s.t < 0.5) return; start(); return; }
      if (s.phase !== "down") { tapAction(s); return; }
      if (s.vy === 0 && !s.onIce) { s.vy = -760; s.ducking = false; s.riding = false; }
    };
    const releaseJump = () => { const s = g(); if (s.vy < -360) s.vy = -360; };
    const duck = (on) => {
      const s = g(); if (s.state !== "running" || s.phase !== "down") return;
      s.ducking = on;
      if (on && s.y < -4) {
        if (s.fromKicker) { if (!s.spin) s.spin = { t: 0 }; } // tricks: spin off a kicker
        else s.vy = Math.max(s.vy, 900); // normal jump: drop back down fast
      }
    };

    const onKey = (e) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) { e.preventDefault(); if (!e.repeat) jump(); }
      if (["ArrowDown", "KeyS"].includes(e.code)) { e.preventDefault(); if (!e.repeat) duck(true); }
    };
    const onKeyUp = (e) => {
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) releaseJump();
      if (["ArrowDown", "KeyS"].includes(e.code)) duck(false);
    };
    const onDown = (e) => { e.preventDefault(); canvas.focus(); jump(); };
    const onUp = () => releaseJump();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    try { if (localStorage.getItem("doppio.drift.debug")) window.__driftState = g; } catch { /* ignore */ }
    window.__driftDuck = duck; window.__driftJump = jump; window.__driftRelease = releaseJump;
    const ro = new ResizeObserver(() => size()); ro.observe(wrap);
    const onVis = () => { if (document.hidden) last = 0; };
    document.addEventListener("visibilitychange", onVis);

    const say = (s, msg, t = 1.4) => { s.bonusMsg = msg; s.bonusT = t; };
    const reward = (s, ft, secs, label) => {
      if (s.mode === "race") { s.raceBonus += secs; say(s, `${label} · −${secs.toFixed(1)}s`); }
      else { s.dist += ft * 10; say(s, `${label} · +${ft} ft`); }
    };

    const beanY = (lift) => ground - Math.min(lift, ground - 44); // never above the visible sky
    const spawn = (s) => {
      const R = s.rng, X = W + 30, T = s.tier, r = R();
      const gapK = T >= 3 ? 0.85 : 1;
      const done = (k) => { s.nextIn = Math.max(s.speed * k * gapK, 230); };
      if (r < 0.15) {
        const size = R() < 0.4 ? "s" : R() < 0.6 ? "m" : "l";
        const k = KICKERS[size];
        s.obstacles.push({ kind: "kicker", size, x: X, w: k.w, h: k.h, launch: k.launch });
        if (R() < 0.6) s.obstacles.push({ kind: "bean", x: X + k.w + 90 + R() * 80, w: 16, h: 16, by: beanY(70 + R() * 60) }); // reward for the air
        s.nextIn = s.speed * (1.25 + (size === "l" ? 0.6 : size === "m" ? 0.35 : 0.1)) + k.w;
        return;
      }
      if (r < 0.25) { s.obstacles.push({ kind: "bean", x: X, w: 16, h: 16, by: beanY(26 + R() * 70) }); s.nextIn = s.speed * 0.3; return; }
      if (T >= 1 && r < 0.32) { // ice sheet ending at a rock: jump before you hit the ice
        const w = s.speed * (0.32 + R() * 0.12);
        s.obstacles.push({ kind: "ice", x: X, w, h: 4 });
        s.obstacles.push({ kind: "rock", x: X + w + 2, w: 36, h: 20 });
        return done(1.2);
      }
      if (T >= 1 && r < 0.39) { s.obstacles.push({ kind: "well", x: X, w: 40 + R() * 16, h: 6 }); return done(0.9); }
      if (T >= 2 && r < 0.48) {
        const walks = R() < 0.65;
        s.obstacles.push({ kind: "moose", x: X, w: 74, h: 72, vx: walks ? 50 + R() * 40 + T * 10 : 0, stopAt: W * (0.4 + R() * 0.45) });
        return done(1.15);
      }
      if (T >= 1 && r < 0.6) {
        const low = R() < 0.5;
        s.obstacles.push({ kind: "raven", x: X, w: 38, h: 16, y: low ? ground - 18 : ground - 54 });
        return done(0.7 + R() * 0.6);
      }
      let o;
      if (r < 0.78) o = { kind: "rock", x: X, w: 34 + R() * 14, h: 18 + R() * 8 };
      else if (r < 0.9) o = { kind: "pine", x: X, w: 26, h: 40 + R() * 10 };
      else o = { kind: "pine", x: X, w: 34, h: 58 + R() * 6 };
      s.obstacles.push(o);
      if (o.kind === "pine" && R() < 0.25 + 0.1 * T) s.obstacles.push({ ...o, x: o.x + o.w + 2, h: o.h * 0.8 });
      done(0.62 + R() * 0.75);
    };

    const cupBox = (s) => {
      const x = cupX();
      const top = ground + s.y - (s.ducking && s.vy === 0 ? CUP_H * 0.62 : CUP_H);
      return { l: x - CUP_W * 0.36, r: x + CUP_W * 0.42, t: top + 6, b: ground + s.y - 2 };
    };
    const boxOf = (o) => {
      if (o.kind === "raven") return { l: o.x + 2, r: o.x + o.w - 2, t: o.y - 6, b: o.y + 6 };
      if (o.kind === "ball") return { l: o.x - o.r * 0.75, r: o.x + o.r * 0.75, t: o.by - o.r * 0.75, b: o.by + o.r * 0.75 };
      if (o.kind === "bean") return { l: o.x - 12, r: o.x + 12, t: o.by - 14, b: o.by + 14 };
      if (o.kind === "moose") return { l: o.x + 6, r: o.x + o.w - 6, t: ground - o.h * 0.72, b: ground };
      return { l: o.x + o.w * 0.2, r: o.x + o.w * 0.8, t: ground - o.h + 6, b: ground };
    };
    const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

    const spillOut = (s, n) => { for (let i = 0; i < n; i++) s.splash.push({ x: cupX() + 6, y: ground + s.y - CUP_H * 0.75, vx: 40 + Math.random() * 200, vy: -140 - Math.random() * 240, r: 1.5 + Math.random() * 3, life: 1.2 }); };
    const end = (s, how, msg) => {
      s.state = how; s.t = 0; s.endMsg = msg;
      if (how === "over") for (let i = 0; i < 14; i++) s.spill.push({ x: cupX() + 6, y: ground + s.y - CUP_H * 0.75, vx: 60 + Math.random() * 220, vy: -160 - Math.random() * 260, r: 2 + Math.random() * 3.5 });
      setState(how);
      const ft = Math.floor(s.dist / 10);
      if (s.mode === "endless") {
        onOverRef.current?.({ mode: "endless", ft });
        if (ft > bestRef.current) { bestRef.current = ft; setBest(ft); try { localStorage.setItem(BEST_KEY, String(ft)); } catch { /* ignore */ } }
      } else if (how === "finished") {
        const ms = Math.round((s.raceT - s.raceBonus) * 1000);
        s.finalMs = ms;
        onOverRef.current?.({ mode: "race", ms, course: s.course });
        if (!bestRaceRef.current || ms < bestRaceRef.current) { bestRaceRef.current = ms; setBestRace(ms); try { localStorage.setItem(raceKey, String(ms)); } catch { /* ignore */ } }
      }
    };
    const damage = (s, amt, msg) => {
      if (s.inv > 0) return;
      s.fill = Math.max(0, s.fill - amt); s.inv = 1.2; s.slowT = 1.6; spillOut(s, 8);
      if (s.fill <= 0.001) end(s, "over", "Spilled!");
      else say(s, `${msg} · −${Math.round(amt * 100)}% coffee`, 1.2);
    };

    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0; last = now;
      const s = g();
      s.t += dt;
      if (s.state === "running") {
        s.runT += dt; if (s.mode === "race") s.raceT += dt;
        const ftPhys = s.trav / 10;
        const tier = Math.min(4, Math.floor(ftPhys / TIER_FT));
        if (tier > s.tier) { s.tier = tier; s.tierT = 2.6; }
        s.tierT = Math.max(0, s.tierT - dt);
        s.speed = baseSpeed(s.runT, s.tier);
        // skin climbs: clear the run-out, then skins on / stride up / skins off
        const cl = s.climb;
        const nearClimb = !!cl && s.trav + W * 1.3 >= cl.start * 10;
        if (s.phase === "down" && cl && ftPhys >= cl.start && s.vy === 0 && s.y > -2) {
          s.phase = "on"; s.taps = 0; s.need = 6; s.transT = 0; s.obstacles = s.obstacles.filter((o) => o.kind === "gate" || o.kind === "finish"); s.aval = null; s.ducking = false;
        }
        if (s.phase === "on" || s.phase === "off") {
          s.transT += dt;
          if (s.taps >= s.need) {
            const secs = s.transT;
            if (s.phase === "on") { s.phase = "climb"; s.climbV = 120; s.strideT = 0; say(s, `Skins on · ${secs.toFixed(1)}s`, 1.4); }
            else {
              s.phase = "down"; s.nextIn = W * 0.5; s.climbN++;
              if (s.mode === "endless" && secs < 1.6) reward(s, 30, 0, `Quick transition ${secs.toFixed(1)}s`); else say(s, `Skins off · ${secs.toFixed(1)}s`, 1.4);
              s.climb = s.mode === "race" ? (RACE_CLIMBS[s.climbN] ? { ...RACE_CLIMBS[s.climbN] } : null) : { start: cl.end + 1500, end: cl.end + 1500 + 250 + 25 * Math.min(4, s.tier), name: ENDLESS_PASSES[s.climbN % ENDLESS_PASSES.length] };
              if (s.nextAval < ftPhys + 300) s.nextAval = ftPhys + 300;
            }
          }
        }
        if (s.phase === "climb") {
          s.strideT += dt;
          s.climbV = Math.max(55, s.climbV - 110 * dt);
          if (ftPhys >= cl.end) { s.phase = "off"; s.taps = 0; s.need = 5; s.transT = 0; s.summitT = 2.4; s.summit = cl.name; }
        }
        s.summitT = Math.max(0, (s.summitT || 0) - dt);
        s.strideFx = Math.max(0, (s.strideFx || 0) - dt); s.slipFx = Math.max(0, (s.slipFx || 0) - dt); s.tapFx = Math.max(0, (s.tapFx || 0) - dt);

        // avalanches (from tier 1 on), never on or near a climb
        let mul = 1;
        if (!s.aval && s.phase === "down" && !nearClimb && ftPhys > s.nextAval) s.aval = { t: 0, dur: 8.5, ballIn: 1.6, balls: 0 };
        if (s.aval) {
          const a = s.aval; a.t += dt;
          mul = a.t < 1.2 ? 1 : 1 + 0.3 * Math.min(1, (a.t - 1.2) / 1.2);
          a.ballIn -= dt;
          // a few snowballs, well spaced, one on screen at a time
          const maxBalls = s.tier >= 3 ? 3 : 2 + (s.rng() < 0.5 ? 1 : 0);
          if (a.t > 1.6 && a.t < a.dur - 1.6 && a.ballIn <= 0 && a.balls < maxBalls && !s.obstacles.some((o) => o.kind === "ball")) {
            const r = 9 + s.rng() * 7;
            s.obstacles.push({ kind: "ball", x: W + 30, w: r * 2, h: r * 2, r, by: ground - r, phase: s.rng() * 6, vx: 25 + s.rng() * 40 });
            a.balls++;
            a.ballIn = 1.7 + s.rng() * 0.8;
          }
          if (a.t >= a.dur) { s.aval = null; s.nextAval = ftPhys + (s.tier >= 4 ? 700 : 900) + s.rng() * 600; reward(s, 150, 1.5, "Outran the avalanche"); }
        }
        s.inv = Math.max(0, s.inv - dt);
        s.slowT = Math.max(0, s.slowT - dt);
        const v = s.phase === "climb" ? s.climbV : s.phase !== "down" ? 0 : s.speed * mul * (1 - 0.4 * (s.slowT / 1.6)) * (s.onIce ? 1.12 : 1);
        s.mul = mul;
        s.dist += v * dt; s.trav += v * dt;

        // vertical motion, kickers, landings, tricks
        s.vy += 2300 * dt;
        const cx = cupX();
        const kick = s.obstacles.find((o) => o.kind === "kicker" && cx >= o.x && cx <= o.x + o.w);
        const floor = kick ? -kickerSurface(kick, cx) : 0;
        const wasRiding = s.riding;
        s.y = s.y + s.vy * dt;
        if (s.spin) { s.spin.t += dt; if (s.spin.t >= 0.42) { s.spins++; s.spin = s.ducking && s.y < -30 && s.fromKicker ? { t: 0 } : null; } }
        if (s.y >= floor) {
          if (s.airStart != null) {
            const secs = s.t - s.airStart;
            if (s.spin) { s.spin = null; s.spins = 0; damage(s, 0.25, "Sketchy landing"); }
            else if (s.fromKicker) { // points only for kicker air
              if (s.spins) { const names = ["", "360", "720", "1080", "1440"]; reward(s, 40 * s.spins, 0.3 * s.spins, `${names[Math.min(4, s.spins)]}!`); }
              else if (secs > 0.55) reward(s, Math.round(secs * 60), secs * 0.4, `${secs > 1.1 ? "Huge air" : "Big air"} ${secs.toFixed(1)}s`);
            }
            s.spins = 0; s.fromKicker = false;
          }
          s.airStart = null;
          s.y = floor; s.vy = 0; s.riding = !!kick; s.lastKick = kick || s.lastKick;
        } else if (s.airStart == null) s.airStart = s.t;
        if (wasRiding && !kick && s.lastKick && s.y >= -s.lastKick.h - 2) { s.vy = -s.lastKick.launch - (s.speed - 360) * 0.25; s.y = -s.lastKick.h; s.riding = false; s.airStart = s.t; s.fromKicker = true; }
        s.bonusT = Math.max(0, (s.bonusT || 0) - dt);

        // world scroll
        s.obstacles.forEach((o) => {
          if (o.kind === "moose" && o.vx && o.x < o.stopAt) o.vx = 0; // wanders in, then stops in your line
          o.x -= (v + (o.vx || 0)) * dt;
          if (o.kind === "ball") { o.phase += dt * 7; o.by = ground - o.r - Math.abs(Math.sin(o.phase)) * 14; }
        });
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -60 && !o.taken);
        s.nextIn -= v * dt;
        if (s.nextIn <= 0 && !s.aval && s.phase === "down" && !nearClimb) spawn(s);

        // surfaces: ice, tree wells
        const onGround = s.vy === 0 && s.y > -4;
        s.onIce = onGround && s.obstacles.some((o) => o.kind === "ice" && cx > o.x && cx < o.x + o.w);
        const well = onGround && s.obstacles.find((o) => o.kind === "well" && cx > o.x + 8 && cx < o.x + o.w - 8);
        if (well && !well.hit) { well.hit = true; damage(s, DMG.well, "Tree well!"); }

        // collisions
        const box = cupBox(s);
        for (const o of s.obstacles) {
          if (["kicker", "ice", "well", "gate", "finish"].includes(o.kind)) continue;
          if (!overlap(box, boxOf(o))) continue;
          if (o.kind === "bean") { o.taken = true; s.fill = Math.min(1, s.fill + 0.2); reward(s, 25, 0.2, "Espresso bean · +20% coffee"); continue; }
          if (s.inv > 0 || o.hit) continue;
          o.hit = true; damage(s, DMG[o.kind] || 0.34, { pine: "Clipped a pine", rock: "Rock!", raven: "Raven!", ball: "Snowball!", moose: "Moose!" }[o.kind]);
          if (s.state !== "running") break;
        }

        // race day: checkpoints, cutoffs, finish
        if (s.mode === "race" && s.state === "running") {
          const lead = (W - cx) + 40;
          CHECKPOINTS.forEach((c, i) => {
            if (!s[`cp${i}`] && s.trav + lead >= c.ft * 10) { s[`cp${i}`] = true; s.obstacles.push({ kind: "gate", name: c.name, x: cx + (c.ft * 10 - s.trav), w: 99, h: 0, cp: i }); }
          });
          if (!s.finishSpawned && s.trav + lead >= RACE_FT * 10) { s.finishSpawned = true; s.obstacles.push({ kind: "finish", name: "Aspen · Finish", x: cx + (RACE_FT * 10 - s.trav), w: 123, h: 0 }); }
          const raceTime = s.raceT - s.raceBonus;
          while (s.cpNext < CHECKPOINTS.length && s.trav / 10 >= CHECKPOINTS[s.cpNext].ft) {
            const c = CHECKPOINTS[s.cpNext];
            if (raceTime > c.cutoff) { end(s, "over", `Missed the ${c.name} cutoff`); break; }
            s.cpMsg = `${c.name} · ${raceTime.toFixed(1)}s (cutoff ${c.cutoff}s)`; s.cpT = 2.2; s.cpNext++;
          }
          if (s.state === "running" && s.trav / 10 >= RACE_FT) end(s, "finished", "Aspen!");
          s.cpT = Math.max(0, s.cpT - dt);
        }
      }
      s.spill.forEach((p) => { p.vy += 900 * dt; p.x += p.vx * dt; p.y = Math.min(ground - 1, p.y + p.vy * dt); if (p.y >= ground - 1) p.vx *= 0.9; });
      s.splash.forEach((p) => { p.life -= dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y = Math.min(ground - 1, p.y + p.vy * dt); });
      s.splash = s.splash.filter((p) => p.life > 0);
      if (s.state === "running" && s.vy === 0 && s.phase === "down") for (let i = 0; i < 2; i++) s.spray.push({ x: cupX() - CUP_W * 0.3, y: ground - 2, vx: -s.speed * (0.15 + Math.random() * 0.25), vy: -60 - Math.random() * 140, life: 0.45 + Math.random() * 0.25, r: 1 + Math.random() * 2 });
      s.spray.forEach((p) => { p.life -= dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
      s.spray = s.spray.filter((p) => p.life > 0);
      if (s.flakes.length < 40) s.flakes.push({ x: Math.random() * W, y: -5, v: 20 + Math.random() * 35, r: 0.8 + Math.random() * 1.6 });
      s.flakes.forEach((f) => { f.y += f.v * dt; f.x -= (s.state === "running" ? s.speed * 0.25 : 12) * dt; if (f.y > H || f.x < -5) { f.y = -5; f.x = Math.random() * W * 1.2; } });
      draw(s);
    };

    const draw = (s) => {
      const off = s.trav;
      const slopeTarget = s.phase === "on" || s.phase === "climb" ? -CLIMB_SLOPE : slopeNow(s);
      s.slopeCur = s.slopeCur == null ? slopeTarget : s.slopeCur + (slopeTarget - s.slopeCur) * 0.06;
      const slope = s.slopeCur;
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, C.paper); sky.addColorStop(1, C.crema);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      drawRidge(ctx, FAR, off * 0.06, W, H * 0.04, H * 1.05, "rgba(74,54,40,0.16)", true);
      drawRidge(ctx, NEAR, off * 0.16, W, H * 0.3, H * 1.05, "rgba(91,122,106,0.17)", false);
      const x = cupX();
      const av = s.aval;
      // follow the cup only when kicker air would carry it off the top of the screen
      const camTarget = s.phase === "off" ? Math.max(s.cam || 0, 70) : slope < 0 ? Math.max(0, (W - x) * -slope - ground + 70) : Math.max(0, -s.y - ground + CUP_H + 60); // hold the view at the pass until skins are off
      s.cam = (s.cam || 0) + (camTarget - (s.cam || 0)) * (camTarget > (s.cam || 0) ? 0.35 : 0.1); // catch up fast on the way up, ease back down
      if (Math.abs(s.cam) < 0.3) s.cam = 0;
      ctx.save(); ctx.translate(0, s.cam);
      if (av && av.t > 1.2) { ctx.save(); ctx.translate((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4); }
      // the hill is drawn sheared: ground tilts downhill, verticals stay vertical
      ctx.save();
      ctx.transform(1, slope, 0, 1, 0, -x * slope);
      ctx.fillStyle = C.snow; ctx.fillRect(-W, ground, W * 3, H * 4);
      ctx.fillStyle = "rgba(122,106,92,0.16)";
      const n = Math.round(W / 34), band = H * 0.9;
      for (let i = 0; i < n; i++) { const tx = ((((i / n) * (W + 60) + ((i * 53) % 37) - off) % (W + 60)) + W + 60) % (W + 60) - 30; ctx.fillRect(tx, ground + 10 + ((i * 7919) % 100) / 100 * band, 12 + (i % 3) * 7, 1.5); }
      ctx.fillStyle = "rgba(43,29,20,0.2)"; ctx.fillRect(-W, ground, W * 3, 1.5);
      s.obstacles.forEach((o) => { if (o.kind === "ice") drawIce(ctx, o.x, ground, o.w, s.t); else if (o.kind === "well") drawWell(ctx, o.x, ground, o.w); });
      ctx.strokeStyle = "rgba(180,104,63,0.55)"; ctx.lineWidth = 2;
      for (const dy of [5, 11]) { ctx.beginPath(); ctx.moveTo(-40, ground + dy); ctx.lineTo(s.y < -2 ? x - 40 : x - 6, ground + dy); ctx.stroke(); }
      s.obstacles.forEach((o) => {
        if (o.kind === "pine") drawPine(ctx, o.x, ground, o.w, o.h);
        else if (o.kind === "kicker") drawKicker(ctx, o.x, ground, o.w, o.h);
        else if (o.kind === "rock") drawRock(ctx, o.x, ground, o.w, o.h);
        else if (o.kind === "ball") drawSnowball(ctx, o.x, o.by, o.r, o.phase);
        else if (o.kind === "raven") drawRaven(ctx, o.x, o.y, o.w, s.t);
        else if (o.kind === "moose") drawMoose(ctx, o.x, ground, o.w, o.h, s.t, !!o.vx);
        else if (o.kind === "bean") drawBean(ctx, o.x, o.by, s.t);
        else if (o.kind === "gate") drawGate(ctx, o.x, ground, o.name, false);
        else if (o.kind === "finish") drawGate(ctx, o.x, ground, o.name, true);
      });
      if (s.phase !== "down") {
        const prog = s.phase === "on" ? Math.min(1, s.taps / s.need) : s.phase === "off" ? 1 - Math.min(1, s.taps / s.need) : 1;
        ctx.strokeStyle = C.roast2; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - 30, ground - 1); ctx.lineTo(x + 28, ground - 1); ctx.quadraticCurveTo(x + 36, ground - 1, x + 37, ground - 7); ctx.stroke();
        if (prog > 0) { ctx.strokeStyle = C.clay; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 28, ground + 1.5); ctx.lineTo(x - 28 + 56 * prog, ground + 1.5); ctx.stroke(); }
      }
      const air = Math.min(1, -s.y / 120);
      ctx.fillStyle = `rgba(43,29,20,${0.16 * (1 - air * 0.6)})`;
      ctx.beginPath(); ctx.ellipse(x, ground + 2, CUP_W * 0.42 * (1 - air * 0.3), 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.onIce ? "rgba(170,205,225,0.9)" : "rgba(196,186,174,0.85)";
      s.spray.forEach((p) => { ctx.globalAlpha = Math.min(1, p.life * 2.5); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = C.coffee;
      [...s.spill, ...s.splash].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
      if (av && av.t > 0.4) {
        const k = Math.sin(Math.PI * Math.min(1, (av.t - 0.4) / (av.dur - 0.4)));
        const front = -60 + (x - 46) * k;
        ctx.fillStyle = "rgba(214,204,192,0.9)";
        ctx.fillRect(-W, ground - 170, front + W - 10, 172);
        for (let i = 0; i < 14; i++) {
          const py = ground - 175 + i * 16 + Math.sin(s.t * 6 + i) * 6;
          const r = 26 + ((i * 17) % 18) + Math.sin(s.t * 9 + i * 2) * 5;
          const px = front - 14 + Math.sin(s.t * 7 + i * 1.7) * 8 - (i % 3) * 10;
          ctx.fillStyle = "rgba(196,186,174,0.95)"; ctx.beginPath(); ctx.arc(px + 4, py + 5, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 18; i++) { const px = front + 20 + ((i * 37 + s.t * 260) % 90), py = ground - 150 + ((i * 53) % 150); ctx.beginPath(); ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
      if (av && av.t > 1.2) ctx.restore();
      // the cup (unsheared), leaning into the fall line; spins in the air; blinks while recovering
      const lean = Math.atan(slope) * (slope < 0 ? 0.6 : 0.85) + (s.phase === "climb" ? Math.sin(s.strideT * ((2 * Math.PI) / STRIDE_PERIOD)) * 0.05 : 0);
      const spinA = s.spin ? (s.spin.t / 0.42) * Math.PI * 2 : 0;
      const wobble = s.onIce ? Math.sin(s.t * 30) * 0.06 : Math.sin(s.t * 18) * 0.02;
      const tilt = s.state === "over" ? 0.9 : lean + spinA + (s.y < 0 ? Math.max(-0.35, Math.min(0.2, s.vy / 2600)) : wobble);
      if (s.inv > 0 && Math.floor(s.inv * 12) % 2 === 0) ctx.globalAlpha = 0.35;
      drawCup(ctx, x, ground + s.y, { tilt, squash: s.ducking && s.vy === 0 ? 0.62 : 1, spilled: s.state === "over", fill: s.fill });
      ctx.globalAlpha = 1;
      ctx.restore(); // camera
      ctx.fillStyle = "rgba(255,253,249,0.95)";
      s.flakes.forEach((f) => { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); });

      // ---- HUD ----
      // coffee meter, top left
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.font = "600 11px Inter, system-ui, sans-serif"; ctx.fillStyle = C.muted;
      ctx.fillText(s.tier > 0 ? `COFFEE · TIER ${s.tier}` : "COFFEE", 16, 16);
      const mw = Math.min(120, W * 0.28), low = s.fill < 0.35;
      ctx.fillStyle = "rgba(43,29,20,0.1)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(16, 32, mw, 10, 5) : ctx.rect(16, 32, mw, 10); ctx.fill();
      ctx.fillStyle = low && Math.floor(s.t * 4) % 2 ? "#b0463a" : C.coffee;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(16, 32, Math.max(0, mw * s.fill), 10, 5) : ctx.rect(16, 32, mw * s.fill, 10); ctx.fill();

      ctx.textAlign = "right";
      if (s.mode === "race") {
        const raceTime = s.state === "finished" ? s.finalMs / 1000 : Math.max(0, s.raceT - s.raceBonus);
        ctx.font = "600 13px Inter, system-ui, sans-serif"; ctx.fillStyle = C.muted;
        ctx.fillText(bestRaceRef.current ? `TODAY'S BEST ${(bestRaceRef.current / 1000).toFixed(1)}S` : "RACE DAY", W - 16, 16);
        ctx.font = "italic 800 26px 'Inter Display', Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast;
        ctx.fillText(`${raceTime.toFixed(1)}s`, W - 16, 34);
        const next = CHECKPOINTS[s.cpNext];
        ctx.font = "500 12px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2;
        const toGo = Math.max(0, Math.ceil(RACE_FT - s.trav / 10));
        ctx.fillText(next ? `${next.name} by ${next.cutoff}s · ${toGo.toLocaleString()} ft to Aspen` : `${toGo.toLocaleString()} ft to Aspen`, W - 16, 66);
      } else {
        ctx.font = "600 13px Inter, system-ui, sans-serif"; ctx.fillStyle = C.muted;
        ctx.fillText(`BEST ${bestRef.current.toLocaleString()} FT`, W - 16, 16);
        ctx.font = "italic 800 26px 'Inter Display', Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast;
        ctx.fillText(`${Math.floor(s.dist / 10).toLocaleString()} ft`, W - 16, 34);
      }
      const msgY = s.mode === "race" ? 84 : 66;
      if (s.bonusT > 0 && s.state === "running") {
        ctx.globalAlpha = Math.min(1, s.bonusT * 2);
        ctx.font = "italic 800 17px 'Inter Display', Inter, system-ui, sans-serif"; ctx.fillStyle = C.clay;
        ctx.fillText(s.bonusMsg || "", W - 16, msgY);
        ctx.globalAlpha = 1;
      }
      // centre banners on the snow: tier ups, checkpoints, avalanche
      const banner = (big, small, color, alpha = 1) => {
        ctx.globalAlpha = alpha; ctx.textAlign = "center";
        const wy = H * 0.55, wx = W * 0.55;
        ctx.font = `italic 800 ${Math.min(34, Math.round(W / 11))}px 'Inter Display', Inter, system-ui, sans-serif`; ctx.fillStyle = color;
        ctx.fillText(big, wx, wy);
        if (small) { ctx.font = "600 14px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2; ctx.fillText(small, wx, wy + Math.min(42, W / 9)); }
        ctx.globalAlpha = 1;
      };
      if (s.state === "running" && s.phase !== "down") {
        if (s.phase === "on" || s.phase === "off") {
          const label = s.phase === "on" ? "Skins on!" : `${s.summit} · Skins off!`;
          banner(s.phase === "off" && s.summitT > 1.2 ? `Summit: ${s.summit}` : label, `Tap fast  ${"●".repeat(s.taps)}${"○".repeat(Math.max(0, s.need - s.taps))}`, s.phase === "on" ? C.sage : C.clay, 1);
        } else {
          // stride meter: tap while the marker is in the green
          const bw = Math.min(260, W - 60), bx = W / 2 - bw / 2, by = H - 58, m = strideMeter(s.strideT);
          ctx.fillStyle = "rgba(43,29,20,0.1)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, 12, 6) : ctx.rect(bx, by, bw, 12); ctx.fill();
          ctx.fillStyle = s.strideFx > 0 ? "rgba(91,122,106,0.85)" : "rgba(91,122,106,0.45)"; ctx.fillRect(bx + bw * 0.36, by, bw * 0.28, 12);
          ctx.fillStyle = s.slipFx > 0 ? "#b0463a" : C.roast; ctx.fillRect(bx + bw * m - 2, by - 5, 4, 22);
          ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = "600 13px Inter, system-ui, sans-serif"; ctx.fillStyle = s.slipFx > 0 ? "#b0463a" : C.roast2;
          ctx.fillText(s.slipFx > 0 ? "Slipped! Tap in the green" : s.strideFx > 0 ? "Good stride" : "Skin up: tap in the green", W / 2, by + 20);
          ctx.textAlign = "right"; ctx.font = "500 12px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2;
          ctx.fillText(`${s.climb.name} · ${Math.max(0, Math.ceil(s.climb.end - s.trav / 10))} ft to the top`, W - 16, s.mode === "race" ? 84 : 66);
        }
      }
      if (s.state === "running" && s.phase === "down") {
        if (av && av.t < 2.4) banner("AVALANCHE!", "Outrun it. Jump the snowballs.", "#b0463a", 0.65 + 0.35 * Math.sin(av.t * 14));
        else if (s.cpT > 0) banner(s.cpMsg.split(" · ")[0], s.cpMsg.split(" · ")[1], C.sage, Math.min(1, s.cpT * 2));
        else if (s.tierT > 0) banner(TIERS[s.tier].split(" · ")[0], TIERS[s.tier].split(" · ")[1], C.clay, Math.min(1, s.tierT * 2));
        else if (s.onIce) banner("Ice!", "No grip: you can't jump on ice", "#4f7f99", 0.9);
        else if (s.climb && s.trav / 10 > s.climb.start - 90) banner(`Skin track ahead`, `Climb to ${s.climb.name}`, C.sage, 0.9);
      }
      if (s.state !== "running") {
        ctx.textAlign = "center";
        const by = H * 0.58, bw = Math.min(360, W - 32);
        ctx.fillStyle = "rgba(251,248,243,0.9)";
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - bw / 2, by - 12, bw, 84, 14) : ctx.rect(W / 2 - bw / 2, by - 12, bw, 84); ctx.fill();
        ctx.fillStyle = s.state === "finished" ? C.sage : C.roast; ctx.font = "italic 800 28px 'Inter Display', Inter, system-ui, sans-serif";
        const title = s.state === "ready" ? (s.mode === "race" ? "Race day" : "Doppio Drift") : s.state === "finished" ? `Aspen in ${(s.finalMs / 1000).toFixed(1)}s` : s.endMsg || "Spilled!";
        ctx.fillText(title, W / 2, by);
        ctx.font = "500 14px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2;
        const sub = s.state === "ready"
          ? (s.mode === "race" ? "Crested Butte to Aspen. Tap or press space to start" : "Tap or press space to drop in")
          : s.mode === "race" ? "Tap or press space to race again" : "Tap or press space to pour another";
        ctx.fillText(sub, W / 2, by + 42);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const hold = (on) => (e) => { e.preventDefault(); window.__driftDuck?.(on); };
  return (
    <section className="section section-first drift-page">
      <Eyebrow>Between intervals</Eyebrow>
      <h1 className="page-title">Doppio Drift</h1>
      <p className="lede">Bomb the Elk Mountains in a latte. Hit kickers and spin for bonus, grab espresso beans to top up, and keep enough coffee in the cup to make it down.</p>
      <div className="drift-modes" role="group" aria-label="Game mode">
        <button type="button" className={`chip ${mode === "endless" ? "is-on" : ""}`} aria-pressed={mode === "endless"} onClick={() => pickMode("endless")}>Endless</button>
        <button type="button" className={`chip ${mode === "race" ? "is-on" : ""}`} aria-pressed={mode === "race"} onClick={() => pickMode("race")}>Race day · {fmtDay(course)}</button>
      </div>
      <div className="drift-card" ref={wrapRef}>
        <canvas ref={canvasRef} className="drift-canvas" tabIndex={0} aria-label={`Doppio Drift, ${mode === "race" ? "race day" : "endless"} mode. ${state === "running" ? "Running." : "Press space or tap to start."}`} />
      </div>
      <div className="drift-controls">
        <button type="button" className="btn btn-dark drift-btn" onPointerDown={(e) => { e.preventDefault(); window.__driftJump?.(); }} onPointerUp={() => window.__driftRelease?.()}>Jump</button>
        <button type="button" className="btn btn-ghost drift-btn" onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerLeave={hold(false)} onPointerCancel={hold(false)}>Duck / Spin</button>
      </div>
      <ul className="drift-rules muted small">
        <li><b>Controls:</b> <span className="hide-narrow">space or ↑ to jump (hold for more air), ↓ to duck on the ground or spin in the air.</span><span className="show-narrow">Jump, and Duck / Spin (spins when you're in the air).</span></li>
        <li><b>Coffee is your health:</b> hits slosh it out, beans top it up, an empty cup ends the run.</li>
        <li><b>Kickers</b> are where the points are: big air and spins (↓ in the air off a kicker) score, but land mid-spin and you lose coffee.</li>
        <li><b>Skin tracks:</b> tap fast to put skins on, stride up by tapping when the marker is in the green, then tap fast again to rip skins at the pass.</li>
        <li><b>Every 1,000 ft</b> it gets steeper and faster: ravens, ice and tree wells, then moose.</li>
        <li><b>Race day</b> is the same course for everyone today: reach each checkpoint before its cutoff, fastest time to Aspen wins.</li>
      </ul>
      <p className="muted small drift-help">
        {mode === "race" ? <>Your best today: <b>{bestRace ? `${(bestRace / 1000).toFixed(1)}s` : "no finish yet"}</b></> : <>Your best on this device: <b>{best.toLocaleString()} ft</b></>}
      </p>
      <Leaderboard onOverRef={onOverRef} mode={mode} course={course} />
    </section>
  );
}

function timeAgo(iso) {
  const d = new Date(iso), mins = (Date.now() - d) / 60000;
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return fmtDay(iso.slice(0, 10));
}

function Leaderboard({ onOverRef, mode, course }) {
  const code = useBaristaCode();
  const [people, setPeople] = useState([]);
  const [runs, setRuns] = useState(null);
  const [player, setPlayer] = useState(() => { try { return localStorage.getItem(PLAYER_KEY) || ""; } catch { return ""; } });
  const [note, setNote] = useState("");
  const race = mode === "race";
  const load = () => select("drift_scores", race
    ? `select=id,person_id,score,time_ms,created_at&mode=eq.race&course=eq.${course}&order=time_ms.asc,created_at.asc&limit=200`
    : "select=id,person_id,score,created_at&mode=eq.endless&order=score.desc,created_at.asc&limit=200").then(setRuns).catch(() => setRuns([]));
  useEffect(() => { loadPeople().then(setPeople).catch(() => {}); }, []);
  useEffect(() => { setRuns(null); setNote(""); load(); }, [mode]);
  const pick = (id) => { setPlayer(id); try { localStorage.setItem(PLAYER_KEY, id); } catch { /* ignore */ } };
  const fmt = (r) => (race ? `${(r.time_ms / 1000).toFixed(1)}s` : `${r.score.toLocaleString()} ft`);

  useEffect(() => {
    onOverRef.current = async (res) => {
      if (!code || !player) return;
      try {
        if (res.mode === "race") {
          await barista("drift.score", { person_id: player, mode: "race", course: res.course, time_ms: res.ms });
          const prev = (runs || []).filter((r) => r.person_id === player)[0]?.time_ms;
          setNote(!prev || res.ms < prev ? `New best today: ${(res.ms / 1000).toFixed(1)}s to Aspen!` : `Finish saved: ${(res.ms / 1000).toFixed(1)}s`);
        } else {
          if (res.ft < 1) return;
          await barista("drift.score", { person_id: player, mode: "endless", score: res.ft });
          const prev = (runs || []).filter((r) => r.person_id === player)[0]?.score || 0;
          setNote(res.ft > prev ? `New personal best: ${res.ft.toLocaleString()} ft!` : `Run saved: ${res.ft.toLocaleString()} ft`);
        }
        if (res.mode === mode) load();
      } catch (e) { setNote(`Couldn't save that run: ${e.message}`); }
    };
  });

  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const bests = people.map((p) => ({ p, best: (runs || []).find((r) => r.person_id === p.id) }));
  const better = (a, b) => (race ? a.time_ms < b.time_ms : a.score > b.score);
  const leader = bests.reduce((a, b) => (b.best && (!a?.best || better(b.best, a.best)) ? b : a), null);
  const top = (runs || []).slice(0, 10);

  return (
    <div className="drift-board">
      <div className="drift-board-head">
        <h2 className="col-title">{race ? `Race day leaderboard · ${fmtDay(course)}` : "Leaderboard"}</h2>
        {code ? (
          <div className="drift-player" role="group" aria-label="Who's playing?">
            <span className="muted small">Playing as</span>
            {people.map((p) => (
              <button key={p.id} type="button" className={`chip ${player === p.id ? "is-on" : ""}`} onClick={() => pick(p.id)} aria-pressed={player === p.id}>
                <BeanDot person={p} size={8} /> {p.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted small">Enter the barista code to put your runs on the board.</p>
        )}
      </div>
      {code && !player && <p className="drift-note">Pick who's playing so your runs count.</p>}
      {note && <p className="drift-note" role="status">{note}</p>}
      <div className="drift-bests">
        {bests.map(({ p, best }) => (
          <div key={p.id} className={`tile drift-best ${leader && leader.p.id === p.id && best ? "is-leader" : ""}`} style={{ "--bean": p.color }}>
            <p className="tile-title"><BeanDot person={p} size={9} /><span>{p.name}</span>{leader && leader.p.id === p.id && best && <span className="chip-crown">Leader</span>}</p>
            <p className="act-big">{best ? (race ? (best.time_ms / 1000).toFixed(1) : best.score.toLocaleString()) : "—"}<span>{race ? "s" : "ft"}</span></p>
            <p className="muted small">{best ? `${race ? "Fastest today" : "Best run"}, ${timeAgo(best.created_at)}` : race ? "No finish today" : "No runs yet"}</p>
          </div>
        ))}
      </div>
      {top.length > 0 && (
        <ol className="drift-runs">
          {top.map((r, i) => (
            <li key={r.id}>
              <span className="drift-rank">{i + 1}</span>
              {byId[r.person_id] && <BeanDot person={byId[r.person_id]} size={8} />}
              <span className="drift-who">{byId[r.person_id]?.name || "?"}</span>
              <b>{fmt(r)}</b>
              <span className="muted small">{timeAgo(r.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
