import { useEffect, useRef, useState } from "react";
import { Eyebrow, BeanDot } from "../ui.jsx";
import { select, barista, loadPeople } from "../api.js";
import { useBaristaCode } from "../hooks.js";
import { fmtDay } from "../format.js";
import * as audio from "../driftAudio.js";
import * as rpg from "../driftRpg.js";

// Doppio Drift: a downhill runner. The latte-art cup skis the Elk Mountains. Endless mode chases
// distance, and every run banks beans and XP for barista levels and gear from the hut shop.
// Everything is drawn on one canvas, no images.

const C = { crema: "#f4ede3", paper: "#fbf8f3", roast: "#2b1d14", roast2: "#4a3628", muted: "#7a6a5c", clay: "#b4683f", sage: "#5b7a6a", coffee: "#b47c52", milk: "#fbf6ee", snow: "#fffdf9" };
const BEST_KEY = "doppio.drift.best";
const PLAYER_KEY = "doppio.drift.player";

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
const KICKERS = { s: { w: 70, h: 14, launch: 640 }, m: { w: 96, h: 24, launch: 830 }, l: { w: 128, h: 36, launch: 1040 }, xl: { w: 176, h: 54, launch: 1220 }, xxl: { w: 236, h: 76, launch: 1400 } };
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
const ENDLESS_PASSES = ["Star Pass", "Taylor Pass", "Pearl Pass", "Copper Pass", "East Maroon Pass", "Triangle Pass", "Conundrum Pass", "Electric Pass"];
const CLIMB_SLOPE = 0.18;
const STRIDE_PERIOD = 1.2; // seconds per sweep = two beats of the theme (quarter = 100 bpm)
const strideMeter = (t) => (Math.sin(t * ((2 * Math.PI) / STRIDE_PERIOD) - Math.PI / 2) + 1) / 2; // 0..1, sweet spot 0.36-0.64
const TIER_FT = 1000;
// speedT is time since the start or the last spill: a spill drops you back to the starting 360 and you build up again
const baseSpeed = (speedT, tier) => 360 + Math.min(500, 9 * speedT) + 45 * tier * Math.min(1, speedT / 5);
const TIERS = [
  "",
  "Tier 1 · Steeper. Ravens, ice and tree wells.",
  "Tier 2 · Moose country.",
  "Tier 3 · Tighter lines.",
  "Tier 4 · Full send.",
];
const DMG = { pine: 0.34, rock: 0.34, raven: 0.34, ball: 0.3, moose: 0.5, well: 0.5 };

function newGame(W) {
  return {
    rng: mulberry32((Math.random() * 2 ** 32) >>> 0), state: "ready", t: 0, runT: 0, speedT: 0, dist: 0, trav: 0, speed: 360, y: 0, vy: 0,
    ducking: false, obstacles: [], nextIn: W * 0.9, flakes: [], spill: [], spray: [], splash: [],
    aval: null, nextAval: 1200, tier: 0, tierT: 0, fill: 1, inv: 0, slowT: 0,
    spin: null, spins: 0, cam: 0, beansGot: 0, passes: 0, tricks: 0, summary: null,
    phase: "down", climb: { start: 1200, end: 1450, name: ENDLESS_PASSES[0] }, climbN: 0,
    climbV: 0, strideT: 0, taps: 0, need: 0, transT: 0, slopeCur: null,
  };
}

export function Drift() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [prog, setProg] = useState(rpg.load);
  const progRef = useRef(prog);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } });
  const [state, setState] = useState("ready");
  const bestRef = useRef(best);
  const onOverRef = useRef(null);
  const resetRef = useRef(null);
  const stageRef = useRef(null);
  const [fs, setFs] = useState(false);
  const fsRef = useRef(false);
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  const enterFs = () => {
    audio.unlock();
    fsRef.current = true; setFs(true);
    document.documentElement.classList.add("drift-lock");
    const el = wrapRef.current;
    try {
      const req = el?.requestFullscreen?.({ navigationUI: "hide" });
      req?.then?.(() => screen.orientation?.lock?.("portrait").catch(() => {})).catch?.(() => {});
    } catch { /* iPhone Safari: fixed overlay instead */ }
    setTimeout(() => canvasRef.current?.focus(), 50);
  };
  const exitFs = () => {
    fsRef.current = false; setFs(false);
    document.documentElement.classList.remove("drift-lock");
    const s = gameRef.current; if (s && s.state === "running") s.paused = true;
    if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});
  };
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement && fsRef.current) exitFs(); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => { document.removeEventListener("fullscreenchange", onFsChange); document.documentElement.classList.remove("drift-lock"); };
  }, []);

  const [soundOn, setSoundOn] = useState(audio.isSoundOn);
  const [musicOn, setMusicOn] = useState(audio.isMusicOn);
  const toggleSound = () => { audio.unlock(); const on = !soundOn; audio.setSound(on); setSoundOn(on); if (on && !musicOn) { audio.setMusic(true); setMusicOn(true); } canvasRef.current?.focus(); };
  const toggleMusic = () => { audio.unlock(); const on = !(musicOn && soundOn); if (on && !soundOn) { audio.setSound(true); setSoundOn(true); } audio.setMusic(on); setMusicOn(on); canvasRef.current?.focus(); };

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, ground = 0, slope0 = 0.35, slopeMax = 0.45, raf = 0, last = 0;
    let dprCap = 2;
    const stage = stageRef.current;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      if (fsRef.current) { W = stage.clientWidth; H = Math.max(240, stage.clientHeight); }
      else { W = wrap.clientWidth; H = W < 560 ? 400 : 480; }
      const cx = Math.max(64, W * 0.16);
      const tall = H > W * 1.05; // portrait phones: start lower and run the slope corner to corner
      ground = Math.round(tall ? H * 0.42 : W < 560 ? H * 0.3 : H * 0.24);
      // steepest slope that still keeps the far (right-hand) end of the run on screen
      slopeMax = tall ? Math.min(0.85, (H * 0.92 - ground) / (W - cx)) : Math.min(0.62, (H + 18 - ground) / (W - cx));
      slope0 = tall ? slopeMax * 0.84 : Math.min(0.46, slopeMax * 0.84);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const fresh = () => { const n = newGame(W); n.st = rpg.statsFor(progRef.current); return n; };
    gameRef.current = fresh();
    resetRef.current = () => { gameRef.current = fresh(); };
    const g = () => gameRef.current;
    const cupX = () => Math.max(64, W * 0.16);
    const slopeNow = (s) => Math.min(slope0 + 0.03 * s.tier, slopeMax);

    const start = () => { gameRef.current = fresh(); gameRef.current.state = "running"; setState("running"); audio.sfx("start"); };
    // with the music on, the stride ring rides the theme's clock: every green window is centred on a beat
    // The stride ring always runs on the game clock; with the music playing it is pulled onto the beat
    // so each green window lands on a quarter note. If the audio clock stalls, the ring just keeps going.
    const syncStride = (s, pull = 1) => {
      const mt = audio.musicTime();
      if (mt == null || !Number.isFinite(mt)) return;
      let off = (mt + STRIDE_PERIOD / 4 - s.strideT) % STRIDE_PERIOD;
      if (off > STRIDE_PERIOD / 2) off -= STRIDE_PERIOD; else if (off < -STRIDE_PERIOD / 2) off += STRIDE_PERIOD;
      s.strideT += off * pull;
    };
    const tapAction = (s) => {
      if (s.phase === "on" || s.phase === "off") { s.taps++; s.tapFx = 0.15; audio.sfx("tap"); return; }
      if (s.phase === "climb") {
        if (s.t - (s.lastTap || 0) < 0.12) return; s.lastTap = s.t;
        syncStride(s);
        const m = strideMeter(s.strideT);
        if (Math.abs(m - 0.5) < s.st.strideWin) { s.climbV = Math.min(280, s.climbV + 95 * s.st.strideBoost); s.strideFx = 0.35; audio.sfx("stride"); }
        else { s.climbV = Math.max(40, s.climbV - 35); s.slipFx = 0.45; audio.sfx("slip"); }
      }
    };
    const jump = () => {
      audio.unlock();
      const s = g();
      if (s.state !== "running") { if (s.state !== "ready" && s.t < 0.5) return; start(); return; }
      if (s.phase !== "down") { tapAction(s); return; }
      if (s.vy === 0 && (!s.onIce || s.st.iceJump)) { s.vy = -760; s.ducking = false; s.riding = false; audio.sfx("jump"); }
    };
    const releaseJump = () => { const s = g(); if (s.vy < -360) s.vy = -360; };
    const duck = (on) => {
      const s = g(); if (s.state !== "running" || s.phase !== "down") return;
      s.ducking = on;
      if (on && s.y < -4 && !s.spin) s.spin = { t: 0 }; // in the air: spin (points only off kickers)
    };

    const onKey = (e) => {
      audio.unlock();
      if (e.code === "Escape" && fsRef.current) { exitFs(); return; }
      if (g().paused && ["Space", "ArrowUp", "KeyW"].includes(e.code)) { e.preventDefault(); g().paused = false; last = 0; return; }
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) { e.preventDefault(); if (!e.repeat) jump(); }
      if (["ArrowDown", "KeyS"].includes(e.code)) { e.preventDefault(); if (!e.repeat) duck(true); }
    };
    const onKeyUp = (e) => {
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) releaseJump();
      if (["ArrowDown", "KeyS"].includes(e.code)) duck(false);
    };
    const zones = new Map(); // pointerId -> "jump" | "duck"
    const onDown = (e) => {
      e.preventDefault(); canvas.focus(); audio.unlock();
      const s = g();
      if (s.paused) { s.paused = false; last = 0; return; }
      const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      if (isTouch && s.state === "running" && s.phase === "down") {
        const r = canvas.getBoundingClientRect();
        if (e.clientX - r.left < r.width / 2) { zones.set(e.pointerId, "duck"); duck(true); return; }
        zones.set(e.pointerId, "jump");
      }
      jump();
    };
    const onUp = (e) => {
      audio.unlock(); // iPhone Safari only allows sound to start on a finger lift
      const z = zones.get(e.pointerId); zones.delete(e.pointerId);
      if (z === "duck") duck(false); else releaseJump();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    const lift = () => audio.unlock();
    canvas.addEventListener("touchend", lift);
    document.addEventListener("click", lift);
    canvas.addEventListener("pointercancel", onUp);
    const noMenu = (e) => e.preventDefault();
    canvas.addEventListener("contextmenu", noMenu);
    try { if (localStorage.getItem("doppio.drift.debug")) window.__driftState = g; } catch { /* ignore */ }
    window.__driftDuck = duck; window.__driftJump = jump; window.__driftRelease = releaseJump;
    const ro = new ResizeObserver(() => size()); ro.observe(wrap); ro.observe(stage);
    const onVis = () => { if (document.hidden) { last = 0; const s = g(); if (s.state === "running") s.paused = true; } };
    document.addEventListener("visibilitychange", onVis);

    const say = (s, msg, t = 1.4) => { s.bonusMsg = msg; s.bonusT = t; };
    const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* not supported */ } };
    const reward = (s, ft, secs, label) => {
      s.dist += ft * 10; say(s, `${label} · +${ft} ft`);
    };

    const beanY = (lift) => ground - Math.min(lift, ground - 44); // never above the visible sky
    const spawn = (s) => {
      const R = s.rng, X = W + 30, T = s.tier, r = R();
      const gapK = T >= 3 ? 0.85 : 1;
      const done = (k) => { s.nextIn = Math.max(s.speed * k * gapK, 230); };
      if (r < 0.15) {
        const q = R(); // bigger booters show up once the run gets going
        const size = q < 0.3 ? "s" : q < 0.52 ? "m" : q < 0.72 ? "l" : q < 0.88 || T < 1 ? "xl" : "xxl";
        const k = KICKERS[size];
        s.obstacles.push({ kind: "kicker", size, x: X, w: k.w, h: k.h, launch: k.launch });
        const big = size === "xl" || size === "xxl";
        if (R() < (big ? 0.85 : 0.6)) s.obstacles.push({ kind: "bean", x: X + k.w + (big ? 180 : 90) + R() * 80, w: 16, h: 16, by: beanY((big ? 160 : 70) + R() * 60) }); // reward for the air
        s.nextIn = s.speed * (1.25 + ({ s: 0.1, m: 0.35, l: 0.6, xl: 1.0, xxl: 1.4 })[size]) + k.w;
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
      if (o.kind === "bean") { const m = g().st?.magnet || 0; return { l: o.x - 12 - m, r: o.x + 12 + m, t: o.by - 14 - m, b: o.by + 14 + m }; }
      if (o.kind === "moose") return { l: o.x + 6, r: o.x + o.w - 6, t: ground - o.h * 0.72, b: ground };
      return { l: o.x + o.w * 0.2, r: o.x + o.w * 0.8, t: ground - o.h + 6, b: ground };
    };
    const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

    const spillOut = (s, n) => { for (let i = 0; i < n; i++) s.splash.push({ x: cupX() + 6, y: ground + s.y - CUP_H * 0.75, vx: 40 + Math.random() * 200, vy: -140 - Math.random() * 240, r: 1.5 + Math.random() * 3, life: 1.2 }); };
    const end = (s, how, msg) => {
      s.state = how; s.t = 0; s.endMsg = msg;
      audio.music(false); audio.sfx("over");
      for (let i = 0; i < 14; i++) s.spill.push({ x: cupX() + 6, y: ground + s.y - CUP_H * 0.75, vx: 60 + Math.random() * 220, vy: -160 - Math.random() * 260, r: 2 + Math.random() * 3.5 });
      setState(how);
      const ft = Math.floor(s.dist / 10);
      onOverRef.current?.({ mode: "endless", ft });
      if (ft > bestRef.current) { bestRef.current = ft; setBest(ft); try { localStorage.setItem(BEST_KEY, String(ft)); } catch { /* ignore */ } }
      // bank the run: beans and XP
      const res = rpg.settle(progRef.current, { ft, beans: s.beansGot, passes: s.passes, tricks: s.tricks });
      progRef.current = res.next; setProg(res.next);
      s.summary = res;
      if (res.levelUp) setTimeout(() => audio.sfx("tier"), 700);
    };
    const damage = (s, amt, msg) => {
      if (s.inv > 0) return;
      amt *= s.st.dmgMul;
      s.fill = Math.max(0, s.fill - amt); s.inv = 1.2; s.speedT = 0; spillOut(s, 8); // back to starting speed
      buzz(s.fill <= 0.001 ? [40, 60, 80] : 35);
      if (s.fill <= 0.001) end(s, "over", "Spilled!");
      else { audio.sfx("hit"); say(s, `${msg} · −${Math.round(amt * 100)}% coffee`, 1.2); }
    };

    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0; last = now;
      const s = g();
      // drop to 1x pixels if the phone can't keep up
      if (dt > 0 && dprCap > 1) { s.slowFrames = (s.slowFrames || 0) * 0.97 + (dt > 0.024 ? 1 : 0); if (s.slowFrames > 20) { dprCap = 1; size(); } }
      const sideways = touch && window.innerWidth > window.innerHeight && window.innerHeight < 520;
      if (sideways && s.state === "running") s.paused = true;
      audio.music(s.state === "running" && !s.paused && !document.hidden);
      if (s.paused) { draw(s); return; }
      s.t += dt;
      if (s.state === "running") {
        s.runT += dt; if (s.phase === "down") s.speedT += dt;
        const ftPhys = s.trav / 10;
        const tier = Math.min(4, Math.floor(ftPhys / TIER_FT));
        if (tier > s.tier) { s.tier = tier; s.tierT = 2.6; audio.sfx("tier"); }
        s.tierT = Math.max(0, s.tierT - dt);
        s.speed = baseSpeed(s.speedT, s.tier);
        // skin climbs: clear the run-out, then skins on / stride up / skins off
        const cl = s.climb;
        const nearClimb = !!cl && s.trav + W * 1.3 >= cl.start * 10;
        if (s.phase === "down" && cl && ftPhys >= cl.start && s.vy === 0 && s.y > -2) {
          s.phase = "on"; s.taps = 0; s.need = Math.max(2, 6 - s.st.tapCut); s.transT = 0; s.obstacles = s.obstacles.filter((o) => o.kind === "gate" || o.kind === "finish"); s.aval = null; s.ducking = false;
        }
        if (s.phase === "on" || s.phase === "off") {
          s.transT += dt;
          if (s.taps >= s.need) {
            const secs = s.transT;
            if (s.phase === "on") { s.phase = "climb"; s.climbV = 120; s.strideT = 0; audio.sfx("skins"); say(s, `Skins on · ${secs.toFixed(1)}s`, 1.4); }
            else {
              s.phase = "down"; s.nextIn = W * 0.5; s.climbN++; audio.sfx("skins");
              if (secs < 1.6) reward(s, 30, 0, `Quick transition ${secs.toFixed(1)}s`); else say(s, `Skins off · ${secs.toFixed(1)}s`, 1.4);
              s.climb = { start: cl.end + 1500, end: cl.end + 1500 + 250 + 25 * Math.min(4, s.tier), name: ENDLESS_PASSES[s.climbN % ENDLESS_PASSES.length] };
              if (s.nextAval < ftPhys + 300) s.nextAval = ftPhys + 300;
            }
          }
        }
        if (s.phase === "climb") {
          s.strideT += dt; syncStride(s, Math.min(1, dt * 10));
          s.climbV = Math.max(55, s.climbV - 110 * dt);
          if (ftPhys >= cl.end) { s.phase = "off"; s.taps = 0; s.need = Math.max(2, 5 - s.st.tapCut); s.passes++; s.transT = 0; s.summitT = 2.4; s.summit = cl.name; audio.sfx("checkpoint"); }
        }
        s.summitT = Math.max(0, (s.summitT || 0) - dt);
        s.strideFx = Math.max(0, (s.strideFx || 0) - dt); s.slipFx = Math.max(0, (s.slipFx || 0) - dt); s.tapFx = Math.max(0, (s.tapFx || 0) - dt);

        // avalanches (from tier 1 on), never on or near a climb
        let mul = 1;
        if (!s.aval && s.phase === "down" && !nearClimb && ftPhys > s.nextAval) { s.aval = { t: 0, dur: 8.5, ballIn: 1.6, balls: 0 }; audio.sfx("avalanche"); }
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
        if (s.spin) { s.spin.t += dt; if (s.spin.t >= 0.42) { s.spins++; s.spin = s.ducking && s.y < -30 ? { t: 0 } : null; } }
        if (s.y >= floor) {
          if (s.airStart != null) {
            const secs = s.t - s.airStart;
            if (secs > 0.3) audio.sfx("land");
            if (s.spin) { s.spin = null; s.spins = 0; damage(s, s.st.spinLandDmg / s.st.dmgMul, "Sketchy landing"); }
            else if (s.fromKicker) { // points only for kicker air
              if (s.spins) { const names = ["", "360", "720", "1080", "1440"]; reward(s, Math.round(40 * s.spins * s.st.trickMul), 0, `${names[Math.min(4, s.spins)]}!`); s.tricks++; audio.sfx("trick"); }
              else if (secs > 0.55) { reward(s, Math.round(secs * 60 * s.st.trickMul), 0, `${secs > 1.9 ? "Massive air" : secs > 1.1 ? "Huge air" : "Big air"} ${secs.toFixed(1)}s`); s.tricks++; audio.sfx("trick"); }
            }
            s.spins = 0; s.fromKicker = false;
          }
          s.airStart = null;
          s.y = floor; s.vy = 0; s.riding = !!kick; s.lastKick = kick || s.lastKick;
        } else if (s.airStart == null) s.airStart = s.t;
        if (wasRiding && !kick && s.lastKick && s.y >= -s.lastKick.h - 2) { s.vy = -s.lastKick.launch - (s.speed - 360) * 0.25; s.y = -s.lastKick.h; s.riding = false; s.airStart = s.t; s.fromKicker = true; audio.sfx("kick"); }
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
          if (o.kind === "bean") { o.taken = true; s.beansGot++; s.fill = Math.min(1, s.fill + s.st.beanFill); audio.sfx("bean"); reward(s, 25, 0, `Espresso bean · +${Math.round(s.st.beanFill * 100)}% coffee`); continue; }
          if (s.inv > 0 || o.hit) continue;
          o.hit = true; damage(s, DMG[o.kind] || 0.34, { pine: "Clipped a pine", rock: "Rock!", raven: "Raven!", ball: "Snowball!", moose: "Moose!" }[o.kind]);
          if (s.state !== "running") break;
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
      ctx.fillText(`COFFEE · LV ${s.st.level}${s.tier > 0 ? ` · TIER ${s.tier}` : ""}`, 16, 16);
      const mw = Math.min(120, W * 0.28), low = s.fill < 0.35;
      ctx.fillStyle = "rgba(43,29,20,0.1)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(16, 32, mw, 10, 5) : ctx.rect(16, 32, mw, 10); ctx.fill();
      ctx.fillStyle = low && Math.floor(s.t * 4) % 2 ? "#b0463a" : C.coffee;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(16, 32, Math.max(0, mw * s.fill), 10, 5) : ctx.rect(16, 32, mw * s.fill, 10); ctx.fill();

      ctx.textAlign = "right";
      ctx.font = "600 13px Inter, system-ui, sans-serif"; ctx.fillStyle = C.muted;
      ctx.fillText(`BEST ${bestRef.current.toLocaleString()} FT`, W - 16, 16);
      ctx.font = "italic 800 26px 'Inter Display', Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast;
      ctx.fillText(`${Math.floor(s.dist / 10).toLocaleString()} ft`, W - 16, 34);
      const msgY = 66 + (s.phase === "climb" ? 22 : 0); // drop below the climb line
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
          // stride ring: a hand sweeps round once per stride; tap as it crosses a green arc (3 and 9 o'clock)
          const r = Math.round(Math.min(64, W * 0.17)), ccx = W / 2, ccy = Math.round(H * 0.5);
          const ang = (s.strideT / STRIDE_PERIOD) * Math.PI * 2 - Math.PI / 2, half = 0.284; // ±16° ≈ the old 0.36–0.64 window
          const hitCol = s.strideFx > 0 ? "rgba(91,122,106,0.95)" : "rgba(91,122,106,0.55)", bad = s.slipFx > 0;
          ctx.fillStyle = "rgba(251,248,243,0.78)"; ctx.beginPath(); ctx.arc(ccx, ccy, r + 14, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 12; ctx.lineCap = "butt";
          ctx.strokeStyle = bad ? "rgba(176,70,58,0.25)" : "rgba(43,29,20,0.1)"; ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = hitCol;
          for (const c of [0, Math.PI]) { ctx.beginPath(); ctx.arc(ccx, ccy, r, c - half, c + half); ctx.stroke(); }
          ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.strokeStyle = bad ? "#b0463a" : C.roast;
          ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(ccx + Math.cos(ang) * (r + 8), ccy + Math.sin(ang) * (r + 8)); ctx.stroke();
          ctx.fillStyle = bad ? "#b0463a" : C.roast; ctx.beginPath(); ctx.arc(ccx, ccy, 5, 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 1; ctx.lineCap = "butt";
          ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = "600 13px Inter, system-ui, sans-serif"; ctx.fillStyle = bad ? "#b0463a" : C.roast2;
          ctx.fillText(bad ? "Slipped! Tap in the green" : s.strideFx > 0 ? "Good stride" : "Skin up: tap in the green", ccx, ccy + r + 22);
          ctx.textAlign = "right"; ctx.font = "500 12px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2;
          ctx.fillText(`${s.climb.name} · ${Math.max(0, Math.ceil(s.climb.end - s.trav / 10))} ft to the top`, W - 16, 66);
        }
      }
      if (s.state === "running" && s.phase === "down") {
        if (av && av.t < 2.4) banner("AVALANCHE!", "Outrun it. Jump the snowballs.", "#b0463a", 0.65 + 0.35 * Math.sin(av.t * 14));
        else if (s.cpT > 0) banner(s.cpMsg.split(" · ")[0], s.cpMsg.split(" · ")[1], C.sage, Math.min(1, s.cpT * 2));
        else if (s.tierT > 0) banner(TIERS[s.tier].split(" · ")[0], TIERS[s.tier].split(" · ")[1], C.clay, Math.min(1, s.tierT * 2));
        else if (s.onIce) banner("Ice!", s.st.iceJump ? "Sharp edges: you can still jump" : "No grip: you can't jump on ice", "#4f7f99", 0.9);
        else if (s.climb && s.trav / 10 > s.climb.start - 90) banner(`Skin track ahead`, `Climb to ${s.climb.name}`, C.sage, 0.9);
      }
      // first seconds of a touch run: show the two tap zones
      if (touch && s.state === "running" && s.phase === "down" && s.runT < 4) {
        const a = Math.min(1, (4 - s.runT) / 1.2) * 0.9;
        ctx.globalAlpha = a; ctx.strokeStyle = "rgba(43,29,20,0.18)"; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(W / 2, H * 0.62); ctx.lineTo(W / 2, H - 20); ctx.stroke(); ctx.setLineDash([]);
        ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.font = "700 13px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2;
        ctx.fillText("◀ DUCK / SPIN", W * 0.25, H - 22); ctx.fillText("JUMP ▶", W * 0.75, H - 22);
        ctx.font = "500 11px Inter, system-ui, sans-serif"; ctx.fillStyle = C.muted;
        ctx.fillText("tap left half", W * 0.25, H - 8); ctx.fillText("tap right half", W * 0.75, H - 8);
        ctx.globalAlpha = 1; ctx.textBaseline = "top";
      }
      if (s.paused && s.state === "running") {
        ctx.fillStyle = "rgba(251,248,243,0.72)"; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center"; ctx.fillStyle = C.roast; ctx.font = "italic 800 30px 'Inter Display', Inter, system-ui, sans-serif";
        ctx.fillText("Paused", W / 2, H * 0.42);
        ctx.font = "500 14px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2; ctx.fillText("Tap or press space to keep going", W / 2, H * 0.42 + 42);
      }
      if (s.state !== "running") {
        ctx.textAlign = "center";
        const sum = s.state !== "ready" && s.summary;
        const by = H * (sum ? 0.5 : 0.58), bw = Math.min(360, W - 32), bh = sum ? (sum.levelUp ? 150 : 124) : 84;
        ctx.fillStyle = "rgba(251,248,243,0.92)";
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - bw / 2, by - 12, bw, bh, 14) : ctx.rect(W / 2 - bw / 2, by - 12, bw, bh); ctx.fill();
        ctx.fillStyle = C.roast; ctx.font = "italic 800 28px 'Inter Display', Inter, system-ui, sans-serif";
        ctx.fillText(s.state === "ready" ? "Doppio Drift" : s.endMsg || "Spilled!", W / 2, by);
        let y = by + 42;
        if (sum) {
          ctx.font = "700 15px Inter, system-ui, sans-serif"; ctx.fillStyle = C.clay;
          ctx.fillText(`${Math.floor(s.dist / 10).toLocaleString()} ft · +${sum.gained.beans} beans · +${sum.gained.xp} XP`, W / 2, y); y += 26;
          if (sum.levelUp) { ctx.fillStyle = C.sage; ctx.fillText(`Level up! Level ${sum.levelUp}, ${rpg.titleOf(sum.levelUp)}`, W / 2, y); y += 26; }
        }
        ctx.font = "500 14px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2;
        ctx.fillText(s.state === "ready" ? "Tap or press space to drop in" : "Tap or press space to pour another", W / 2, y);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp); canvas.removeEventListener("contextmenu", noMenu); canvas.removeEventListener("touchend", lift); document.removeEventListener("click", lift);
      document.removeEventListener("visibilitychange", onVis);
      audio.music(false);
    };
  }, []);

  return (
    <section className="section section-first drift-page">
      <Eyebrow>Between intervals</Eyebrow>
      <h1 className="page-title">Doppio Drift</h1>
      <p className="lede">Bomb the Elk Mountains in a latte. Hit kickers and spin for bonus, grab espresso beans to top up, and keep enough coffee in the cup to make it down.</p>
      <div className="drift-play-row">
        <button type="button" className={`btn btn-dark drift-play ${touch ? "drift-play-big" : ""}`} onClick={enterFs}>
          {touch
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>}
          {touch ? (state === "running" ? "Resume" : "Play Doppio Drift") : "Play full screen"}
        </button>
      </div>
      <div className={`drift-card ${fs ? "drift-fs" : ""} ${touch ? "is-touch" : ""}`} ref={wrapRef}>
        <div className="drift-stage" ref={stageRef}>
          <canvas ref={canvasRef} className="drift-canvas" tabIndex={0} aria-label={`Doppio Drift. ${state === "running" ? "Running." : "Press space or tap to start."}`} />
        </div>
        <div className="drift-top">
          <button type="button" className={`drift-btn ${musicOn && soundOn ? "" : "is-off"}`} onClick={toggleMusic} aria-pressed={musicOn && soundOn} aria-label="Music" title="Music">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />{!(musicOn && soundOn) && <path d="M3 3l18 18" />}</svg>
          </button>
          {fs && <button type="button" className="drift-btn" onClick={exitFs} aria-label="Exit full screen">✕</button>}
          <button type="button" className={`drift-btn ${soundOn ? "" : "is-off"}`} onClick={toggleSound} aria-pressed={soundOn} aria-label="Sound" title="Sound">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" />{soundOn ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="M22 9l-6 6M16 9l6 6" />}</svg>
          </button>
        </div>
        <div className="drift-rotate" role="status">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></svg>
          <p>Turn your phone upright to keep playing</p>
        </div>
      </div>
      <ul className="drift-rules muted small">
        <li><b>Controls:</b> <span className="hide-narrow">space or ↑ to jump (hold for more air), ↓ to duck on the ground or spin in the air.</span><span className="show-narrow">tap the right half to jump (hold for more air), the left half to duck, or to spin in the air.</span></li>
        <li><b>Coffee is your health:</b> hits slosh it out, beans top it up, an empty cup ends the run.</li>
        <li><b>Spin</b> with ↓ (or the left half on a phone) in the air. Big air and spins only score off kickers, and landing mid-spin costs coffee.</li>
        <li><b>Skin tracks:</b> tap fast to put skins on, stride up by tapping when the marker is in the green, then tap fast again to rip skins at the pass.</li>
        <li><b>Sound:</b> the theme is Bach's Goldberg Variation 1, chiptune style. Music and sound effects toggle at the top of the game. If you can't hear anything on a phone, check the volume and tap the game once more.</li>
        <li><b>Every 1,000 ft</b> it gets steeper and faster: ravens, ice and tree wells, then moose.</li>
        <li><b>Every run pays:</b> bank the beans you grab (plus one per 250 ft), earn XP to level up your barista, and spend beans on gear at the hut.</li>
      </ul>
      <p className="muted small drift-help">
        Your best on this device: <b>{best.toLocaleString()} ft</b>
      </p>
      <Hut prog={prog} onBuy={(id) => { const n = rpg.buy(progRef.current, id); progRef.current = n; setProg(n); if (gameRef.current && gameRef.current.state !== "running") gameRef.current.st = rpg.statsFor(n); }} />
      <Leaderboard onOverRef={onOverRef} />
    </section>
  );
}

function Hut({ prog, onBuy }) {
  const lv = rpg.levelOf(prog.xp), lo = rpg.xpFor(lv), hi = rpg.xpFor(lv + 1);
  const pct = Math.min(100, ((prog.xp - lo) / (hi - lo)) * 100);
  return (
    <div className="drift-hut">
      <div className="drift-hut-head">
        <div>
          <h2 className="col-title">The hut</h2>
          <p className="muted small">Level {lv} · {rpg.titleOf(lv)} · {prog.runs} {prog.runs === 1 ? "run" : "runs"}</p>
        </div>
        <p className="drift-beans" aria-label={`${prog.beans} beans banked`}><span className="drift-bean-ico" aria-hidden="true" />{prog.beans.toLocaleString()}<span className="muted small"> beans</span></p>
      </div>
      <div className="drift-xp" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={hi - lo} aria-valuenow={prog.xp - lo}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="muted small">{(prog.xp - lo).toLocaleString()} / {(hi - lo).toLocaleString()} XP to level {lv + 1}</p>
      <h3 className="drift-sub">Barista perks</h3>
      <ul className="drift-perks">
        {rpg.PERKS.map((p) => (
          <li key={p.level} className={lv >= p.level ? "is-on" : ""}><b>Lv {p.level} · {p.name}</b><span>{p.text}</span></li>
        ))}
      </ul>
      <h3 className="drift-sub">Gear shop</h3>
      <div className="drift-shop">
        {rpg.SHOP.map((it) => {
          const owned = prog.owned.includes(it.id), locked = it.needs && !prog.owned.includes(it.needs), short = prog.beans < it.price;
          return (
            <div key={it.id} className={`tile drift-item ${owned ? "is-owned" : ""}`}>
              <p className="tile-title"><span>{it.name}</span></p>
              <p className="muted small">{it.text}</p>
              {owned ? <span className="chip is-on">Owned</span> : (
                <button type="button" className="chip" disabled={locked || short} onClick={() => onBuy(it.id)}>
                  {locked ? `Needs ${rpg.SHOP.find((x) => x.id === it.needs).name}` : `Buy · ${it.price} beans`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small">Progress is saved on this device. New gear kicks in on your next run.</p>
    </div>
  );
}

function timeAgo(iso) {
  const d = new Date(iso), mins = (Date.now() - d) / 60000;
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return fmtDay(iso.slice(0, 10));
}

function Leaderboard({ onOverRef }) {
  const code = useBaristaCode();
  const [people, setPeople] = useState([]);
  const [runs, setRuns] = useState(null);
  const [player, setPlayer] = useState(() => { try { return localStorage.getItem(PLAYER_KEY) || ""; } catch { return ""; } });
  const [note, setNote] = useState("");
  const load = () => select("drift_scores", "select=id,person_id,score,created_at&mode=eq.endless&order=score.desc,created_at.asc&limit=200").then(setRuns).catch(() => setRuns([]));
  useEffect(() => { loadPeople().then(setPeople).catch(() => {}); }, []);
  useEffect(() => { load(); }, []);
  const pick = (id) => { setPlayer(id); try { localStorage.setItem(PLAYER_KEY, id); } catch { /* ignore */ } };
  const fmt = (r) => `${r.score.toLocaleString()} ft`;

  useEffect(() => {
    onOverRef.current = async (res) => {
      if (!code || !player) return;
      try {
        if (res.ft < 1) return;
        await barista("drift.score", { person_id: player, mode: "endless", score: res.ft });
        const prev = (runs || []).filter((r) => r.person_id === player)[0]?.score || 0;
        setNote(res.ft > prev ? `New personal best: ${res.ft.toLocaleString()} ft!` : `Run saved: ${res.ft.toLocaleString()} ft`);
        load();
      } catch (e) { setNote(`Couldn't save that run: ${e.message}`); }
    };
  });

  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const bests = people.map((p) => ({ p, best: (runs || []).find((r) => r.person_id === p.id) }));
  const better = (a, b) => a.score > b.score;
  const leader = bests.reduce((a, b) => (b.best && (!a?.best || better(b.best, a.best)) ? b : a), null);
  const top = (runs || []).slice(0, 10);

  return (
    <div className="drift-board">
      <div className="drift-board-head">
        <h2 className="col-title">Leaderboard</h2>
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
            <p className="act-big">{best ? best.score.toLocaleString() : "—"}<span>ft</span></p>
            <p className="muted small">{best ? `Best run, ${timeAgo(best.created_at)}` : "No runs yet"}</p>
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
