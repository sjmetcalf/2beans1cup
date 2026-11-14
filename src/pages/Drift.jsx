import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "../ui.jsx";

// Doppio Drift: a Chrome-dino-style endless runner. The latte-art cup skis the Elk Mountains;
// jump pines and rocks, duck the ravens. Everything is drawn on one canvas, no images.

const C = { crema: "#f4ede3", paper: "#fbf8f3", roast: "#2b1d14", roast2: "#4a3628", muted: "#7a6a5c", clay: "#b4683f", sage: "#5b7a6a", coffee: "#b47c52", milk: "#fbf6ee", snow: "#fffdf9" };
const BEST_KEY = "doppio.drift.best";

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

function drawCup(ctx, x, groundY, { tilt = 0, squash = 1, spilled = false }) {
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
  if (!spilled) {
    ctx.save();
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

function newGame(W) {
  return { state: "ready", t: 0, dist: 0, speed: 360, y: 0, vy: 0, ducking: false, obstacles: [], nextIn: W * 0.9, flakes: [], milestone: 0, flash: 0, spill: [] };
}

export function Drift() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } });
  const [score, setScore] = useState(0);
  const [state, setState] = useState("ready");
  const bestRef = useRef(best);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, ground = 0, raf = 0, last = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth; H = W < 560 ? 240 : 300; ground = H - 44;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    gameRef.current = newGame(W);
    const g = () => gameRef.current;
    const cupX = () => Math.max(56, W * 0.12);

    const start = () => { const s = g(); if (s.state !== "running") { gameRef.current = newGame(W); gameRef.current.state = "running"; setState("running"); } };
    const jump = () => {
      const s = g();
      if (s.state === "ready" || s.state === "over") { if (s.state === "over" && s.t < 0.45) return; start(); }
      const n = g();
      if (n.y === 0) { n.vy = -760; n.ducking = false; }
    };
    const releaseJump = () => { const s = g(); if (s.vy < -360) s.vy = -360; };
    const duck = (on) => { const s = g(); if (s.state !== "running") return; s.ducking = on; if (on && s.y < 0) s.vy = Math.max(s.vy, 900); };

    const onKey = (e) => {
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) { e.preventDefault(); if (!e.repeat) jump(); }
      if (["ArrowDown", "KeyS"].includes(e.code)) { e.preventDefault(); duck(true); }
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
    window.__driftDuck = duck; window.__driftJump = jump; window.__driftRelease = releaseJump;
    const ro = new ResizeObserver(() => size()); ro.observe(wrap);
    const onVis = () => { if (document.hidden) last = 0; };
    document.addEventListener("visibilitychange", onVis);

    const spawn = (s) => {
      const r = Math.random();
      const ravens = s.dist / 10 > 500;
      let o;
      if (ravens && r < 0.22) {
        const low = Math.random() < 0.5; // low raven: jump it; high raven: duck under it
        o = { kind: "raven", x: W + 20, w: 38, h: 16, y: low ? ground - 18 : ground - 54 };
      } else if (r < 0.45) o = { kind: "rock", x: W + 20, w: 34 + Math.random() * 14, h: 18 + Math.random() * 8 };
      else if (r < 0.78) o = { kind: "pine", x: W + 20, w: 26, h: 40 + Math.random() * 10 };
      else o = { kind: "pine", x: W + 20, w: 34, h: 58 + Math.random() * 6 };
      if (o.kind === "pine" && Math.random() < 0.25 && s.dist / 10 > 250) s.obstacles.push({ ...o, x: o.x + o.w + 2, h: o.h * 0.8 });
      s.obstacles.push(o);
      const gap = s.speed * (0.62 + Math.random() * 0.75);
      s.nextIn = Math.max(gap, 240);
    };

    const hit = (s) => {
      const x = cupX();
      const top = ground + s.y - (s.ducking ? CUP_H * 0.62 : CUP_H);
      const box = { l: x - CUP_W * 0.36, r: x + CUP_W * 0.42, t: top + 6, b: ground + s.y - 2 };
      return s.obstacles.some((o) => {
        const ob = o.kind === "raven"
          ? { l: o.x + 2, r: o.x + o.w - 2, t: o.y - 6, b: o.y + 6 }
          : { l: o.x + o.w * 0.2, r: o.x + o.w * 0.8, t: ground - o.h + 6, b: ground };
        return box.l < ob.r && box.r > ob.l && box.t < ob.b && box.b > ob.t;
      });
    };

    const step = (now) => {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0; last = now;
      const s = g();
      s.t += dt;
      if (s.state === "running") {
        s.speed = Math.min(900, s.speed + 9 * dt);
        s.dist += s.speed * dt;
        s.vy += (s.ducking && s.y < 0 ? 4200 : 2300) * dt;
        s.y = Math.min(0, s.y + s.vy * dt);
        if (s.y === 0) s.vy = 0;
        s.obstacles.forEach((o) => (o.x -= s.speed * dt));
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);
        s.nextIn -= s.speed * dt;
        if (s.nextIn <= 0) spawn(s);
        const ft = Math.floor(s.dist / 10);
        if (Math.floor(ft / 1000) > s.milestone) { s.milestone = Math.floor(ft / 1000); s.flash = 1; }
        s.flash = Math.max(0, s.flash - dt * 1.5);
        if (hit(s)) {
          s.state = "over"; s.t = 0;
          for (let i = 0; i < 14; i++) s.spill.push({ x: cupX() + 6, y: ground + s.y - CUP_H * 0.75, vx: 60 + Math.random() * 220, vy: -160 - Math.random() * 260, r: 2 + Math.random() * 3.5 });
          setState("over");
          if (ft > bestRef.current) { bestRef.current = ft; setBest(ft); try { localStorage.setItem(BEST_KEY, String(ft)); } catch { /* ignore */ } }
        }
        setScore(ft);
      }
      s.spill.forEach((p) => { p.vy += 900 * dt; p.x += p.vx * dt; p.y = Math.min(ground - 1, p.y + p.vy * dt); if (p.y >= ground - 1) p.vx *= 0.9; });
      // snow
      if (s.flakes.length < 40) s.flakes.push({ x: Math.random() * W, y: -5, v: 20 + Math.random() * 35, r: 0.8 + Math.random() * 1.6 });
      s.flakes.forEach((f) => { f.y += f.v * dt; f.x -= (s.state === "running" ? s.speed * 0.25 : 12) * dt; if (f.y > ground || f.x < -5) { f.y = -5; f.x = Math.random() * W * 1.2; } });
      draw(s);
    };

    const draw = (s) => {
      const off = s.dist;
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, C.paper); sky.addColorStop(1, C.crema);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      drawRidge(ctx, FAR, off * 0.08, W, H * 0.08, ground, "rgba(74,54,40,0.16)", true);
      drawRidge(ctx, NEAR, off * 0.22, W, H * 0.42, ground, "rgba(91,122,106,0.17)", false);
      // snowfield
      ctx.fillStyle = C.snow; ctx.fillRect(0, ground, W, H - ground);
      ctx.fillStyle = "rgba(122,106,92,0.18)";
      const n = Math.round(W / 40), band = H - ground - 14;
      for (let i = 0; i < n; i++) { const x = ((((i / n) * (W + 40) + ((i * 53) % 37) - off) % (W + 40)) + W + 40) % (W + 40) - 20; ctx.fillRect(x, ground + 8 + ((i * 7919) % 100) / 100 * band, 10 + (i % 3) * 6, 1.5); }
      ctx.fillStyle = "rgba(43,29,20,0.22)"; ctx.fillRect(0, ground, W, 1.5);
      // ski tracks behind the cup (gap while airborne)
      const x = cupX();
      ctx.strokeStyle = "rgba(180,104,63,0.55)"; ctx.lineWidth = 2;
      for (const dy of [5, 11]) { ctx.beginPath(); ctx.moveTo(0, ground + dy); ctx.lineTo(s.y < -2 ? x - 40 : x - 6, ground + dy); ctx.stroke(); }
      // obstacles
      s.obstacles.forEach((o) => {
        if (o.kind === "pine") drawPine(ctx, o.x, ground, o.w, o.h);
        else if (o.kind === "rock") drawRock(ctx, o.x, ground, o.w, o.h);
        else drawRaven(ctx, o.x, o.y, o.w, s.t);
      });
      // shadow + cup
      const air = Math.min(1, -s.y / 120);
      ctx.fillStyle = `rgba(43,29,20,${0.16 * (1 - air * 0.6)})`;
      ctx.beginPath(); ctx.ellipse(x, ground + 2, CUP_W * 0.42 * (1 - air * 0.3), 4, 0, 0, Math.PI * 2); ctx.fill();
      const tilt = s.state === "over" ? 0.5 : s.y < 0 ? Math.max(-0.35, Math.min(0.2, s.vy / 2600)) : Math.sin(s.t * 18) * 0.02;
      drawCup(ctx, x, ground + s.y, { tilt, squash: s.ducking ? 0.62 : 1, spilled: s.state === "over" });
      ctx.fillStyle = C.coffee;
      s.spill.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
      // falling snow
      ctx.fillStyle = "rgba(255,253,249,0.95)";
      s.flakes.forEach((f) => { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); });
      // HUD
      ctx.textBaseline = "top"; ctx.textAlign = "right";
      ctx.font = "600 13px Inter, system-ui, sans-serif"; ctx.fillStyle = C.muted;
      ctx.fillText(`BEST ${bestRef.current.toLocaleString()} FT`, W - 16, 16);
      ctx.font = "italic 800 26px 'Inter Display', Inter, system-ui, sans-serif";
      ctx.fillStyle = s.flash > 0 ? C.clay : C.roast;
      ctx.fillText(`${Math.floor(s.dist / 10).toLocaleString()} ft`, W - 16, 34);
      if (s.state !== "running") {
        ctx.textAlign = "center";
        const by = Math.max(H * 0.28, 78), bw = Math.min(340, W - 32);
        ctx.fillStyle = "rgba(251,248,243,0.86)";
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(W / 2 - bw / 2, by - 12, bw, 80, 14) : ctx.rect(W / 2 - bw / 2, by - 12, bw, 80); ctx.fill();
        ctx.fillStyle = C.roast; ctx.font = "italic 800 30px 'Inter Display', Inter, system-ui, sans-serif";
        ctx.fillText(s.state === "over" ? "Spilled!" : "Doppio Drift", W / 2, by);
        ctx.font = "500 14px Inter, system-ui, sans-serif"; ctx.fillStyle = C.roast2;
        ctx.fillText(s.state === "over" ? "Tap or press space to pour another" : "Tap or press space to drop in", W / 2, by + 40);
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
      <p className="lede">Ski the Elk Mountains in a latte. Jump the pines and rocks, duck the ravens, and don't spill.</p>
      <div className="drift-card" ref={wrapRef}>
        <canvas ref={canvasRef} className="drift-canvas" tabIndex={0} aria-label={`Doppio Drift game. ${state === "running" ? `${score} feet` : "Press space or tap to start."}`} />
      </div>
      <div className="drift-controls">
        <button type="button" className="btn btn-dark drift-btn" onPointerDown={(e) => { e.preventDefault(); window.__driftJump?.(); }} onPointerUp={() => window.__driftRelease?.()}>Jump</button>
        <button type="button" className="btn btn-ghost drift-btn" onPointerDown={hold(true)} onPointerUp={hold(false)} onPointerLeave={hold(false)} onPointerCancel={hold(false)}>Duck</button>
      </div>
      <p className="muted small drift-help">
        <span className="hide-narrow">Space or ↑ to jump (hold for a bigger air), ↓ to duck. </span>
        Your best: <b>{best.toLocaleString()} ft</b>
      </p>
    </section>
  );
}
