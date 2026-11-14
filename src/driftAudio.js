// Doppio Drift audio: chiptune sound effects and a looping 8-bit theme, all synthesized
// with Web Audio (no files to download). Browsers only allow sound after a tap or key
// press, so unlock() is called from the game's input handlers.

const SOUND_KEY = "doppio.drift.sound";
const MUSIC_KEY = "doppio.drift.music";
const read = (k) => { try { return localStorage.getItem(k) !== "off"; } catch { return true; } };
const write = (k, on) => { try { localStorage.setItem(k, on ? "on" : "off"); } catch { /* ignore */ } };

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let soundOn = read(SOUND_KEY), musicOn = read(MUSIC_KEY);
let playing = false, timer = null, step = 0, nextT = 0, startT = 0;

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = soundOn ? 1 : 0; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.22; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.09 : 0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

const SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";
let primed = false;
// Must run inside a tap or key handler. iPhones only allow it on a finger lift or click,
// so the game calls this on touch end as well as touch start.
export function unlock() {
  // ask iOS to treat the game like media, so the ring/silent switch doesn't mute it
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* older browsers */ }
  if (!primed) {
    primed = true;
    try { const a = new Audio(SILENT); a.setAttribute("playsinline", ""); a.play().catch(() => { primed = false; }); } catch { primed = false; }
  }
  const c = init();
  if (c && c.state !== "running") c.resume().catch(() => {});
}

// ---------- building blocks ----------
function tone(t, { f0, f1 = f0, dur = 0.1, type = "square", vol = 1, bus = sfxBus, attack = 0.004 }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, { dur = 0.1, vol = 1, filter = 4000, type = "lowpass", bus = sfxBus, sweepTo }) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = type; f.frequency.setValueAtTime(filter, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
const arp = (t, notes, gap, opts = {}) => notes.forEach((m, i) => tone(t + i * gap, { f0: hz(m), dur: gap * 1.6, vol: 0.7, ...opts }));

// ---------- sound effects ----------
const SFX = {
  jump: (t) => tone(t, { f0: 280, f1: 720, dur: 0.13, vol: 0.55 }),
  kick: (t) => { tone(t, { f0: 180, f1: 1000, dur: 0.24, vol: 0.6 }); tone(t, { f0: 90, f1: 260, dur: 0.2, type: "triangle", vol: 0.8 }); },
  land: (t) => { tone(t, { f0: 150, f1: 55, dur: 0.08, type: "triangle", vol: 0.9 }); noise(t, { dur: 0.06, vol: 0.25, filter: 1200 }); },
  trick: (t) => arp(t, [84, 88, 91, 96], 0.055, { vol: 0.5 }),
  bean: (t) => { tone(t, { f0: hz(83), dur: 0.07, vol: 0.5 }); tone(t + 0.07, { f0: hz(88), dur: 0.22, vol: 0.5 }); },
  hit: (t) => { noise(t, { dur: 0.22, vol: 0.7, filter: 2500, sweepTo: 300 }); tone(t, { f0: 220, f1: 70, dur: 0.22, type: "sawtooth", vol: 0.35 }); },
  over: (t) => { arp(t, [76, 72, 69, 64], 0.13, { type: "square", vol: 0.5 }); tone(t + 0.52, { f0: hz(57), f1: hz(45), dur: 0.6, type: "triangle", vol: 0.8 }); },
  checkpoint: (t) => arp(t, [72, 76, 79, 84], 0.07, { vol: 0.5 }),
  tier: (t) => { arp(t, [67, 72], 0.1, { vol: 0.5 }); tone(t + 0.2, { f0: hz(79), dur: 0.35, vol: 0.5 }); },
  avalanche: (t) => { noise(t, { dur: 1.4, vol: 0.9, filter: 500, sweepTo: 120 }); tone(t, { f0: 60, f1: 35, dur: 1.2, type: "triangle", vol: 0.7 }); },
  stride: (t) => tone(t, { f0: hz(81), f1: hz(86), dur: 0.08, vol: 0.4 }),
  slip: (t) => tone(t, { f0: 130, f1: 80, dur: 0.16, type: "sawtooth", vol: 0.35 }),
  tap: (t) => tone(t, { f0: 1400, dur: 0.035, vol: 0.3 }),
  skins: (t) => arp(t, [69, 76, 81], 0.06, { vol: 0.45 }),
  finish: (t) => { arp(t, [72, 76, 79, 84, 79, 84], 0.09, { vol: 0.5 }); tone(t + 0.54, { f0: hz(88), dur: 0.7, vol: 0.5 }); },
  start: (t) => arp(t, [69, 72, 76, 81], 0.05, { vol: 0.4 }),
};

export function sfx(name) {
  if (!soundOn || !ctx || ctx.state !== "running") return;
  const f = SFX[name];
  if (f) try { f(ctx.currentTime + 0.005); } catch { /* ignore */ }
}

// ---------- theme: J. S. Bach, Goldberg Variations BWV 988, Variatio 1 (G major, 1741) ----------
// Public domain. Notes from the Mutopia Project edition (Bach-Gesellschaft source).
// Tokens: MIDI note in base 36, then "." + length in 32nd notes (default 2 = a 16th); "rN" = rest.
const UPPER = "1v 1u 1v.6 1q 1s 1u 1v 1x 1z 21 22 21 22.6 1x 1z 21 22 24 26 22 27 26 27.6 26 24 22 21 24 1x 1v 1u 1s 1q 1p 1q 1u r16 22 20 22.4 1v.4 1n.4 22.4 r4 24 22 24.4 1x.4 1o.4 24.4 r4 26 24 26.4 22.4 29.4 20.8 1z.4 r2 1v 1z 22 27 22 27 29 2b 27 22 1z 1v 1z 22 27 2b 27 26 24 29 24 21 1x 1u 1x 21 24 29 26 24 22 27 22 1z 1v 1s 1v 1z 22 27 26 24 22 21 1v 1s 1p 1l 1p 1s 1v 21 24 22 21 22.4 1i.4 1i.4 1x.4 22.4 26.4 1z.4 1j.4 1j.4 1z.4 24.4 27.4 21 24 1x 1v 1u 1x 22 26 27 24 22 21 26 22 21 1z 1x 1v 1u 1s r8 26 27 29.6 2b 29 27 26 24 22 20 1z 20 22.6 24 22 20 1z 1x 1v 1u 1s 1w 1x 1z 1x 1s 1x 1z 20 1x 23 24 26 24 23 21 1z.18 23 24.6 1r 1s.6 r8 28 29.6 1w 1x.6 r8 1n 1o 1u 1n 1r 1s 1v 1u 1s 1r 1x 1v 1u 1s 1r 1s 1v r16 24.4 20.4 24.4 29.4 1x.4 r4 22.4 1z.4 22.4 27.4 1v.4 20 1x 1s 1o 1l 1o 1s 1x 20 1x 20 24 26 20 1x 1u 1q 1u 1x 20 26 20 26 29 2b 27 22 1z 1v 1z 22 27 2b 25 2b 2e 24 2e 2c 24 22 2c 2b 22 20 24 26 27 29 20 1z 1x 1z 22 1z 1v 20 1x 1v 1u 1z 1v 1u 1s 1q 1o 1n 1l 1j.8";
const LOWER = "17.4 1n 1l 1n.4 1j.4 17.4 1j.4 16.4 1i 1g 1i.4 1e.4 16.4 1e.4 14.4 1g 1e 1g.4 1j.4 19.4 1p.4 1e.4 1i 1g 1i.4 1e.4 12.4 1e.4 1b 19 1b.6 1e 1g 1i 1j 1l 1n 1j 1c 1b 1c.6 1g 1i 1j 1l 1n 1o 1l 1e 1d 1e.6 1l 1n 1o 1q 1s 1u 1q 1v 1u 1v 1q 1n 1q 1j 1n 1e 1j 1b 1e 17.4 1j.4 1n.4 1j.4 17.4 1j.4 16.4 1i.4 1l.4 1i.4 16.4 1i.4 14.4 1g.4 1j.4 1g.4 14.4 1j.4 19.4 1g.4 1j.4 1g.4 19.4 1j.4 1i 1l 1q 1u 1x 1u 1q 1l 1i 1l 1e 1i 1j 1n 1q 1v 1z 1v 1q 1n 1j 1n 1g 1j 1l.4 1p.4 1q 1l 1i 1e 1l.4 19.4 12 1e 1g 1i 1j 1l 1n 1p 1q.8 12.4 1i 1g 1i.4 1e.4 12.4 1i.4 17.4 1n 1l 1n.4 1j.4 17.4 1n.4 1c.4 1o 1n 1o.4 1i.4 1l.4 1o.4 1l.4 1i.4 1f 1b 1f 1i 1n r20 1i 1j.6 1b 1c.6 r8 1n 1o.6 1g 1f.4 1l.4 1j.4 1a.4 1b.4 1i.4 1g.4 1j 1i 1j.4 1g.4 14.4 1g.4 1c 1g 1l 1o 1s 1o 1l 1g 1c 1g 1e 1c 1b 1e 1j 1n 1q 1n 1j 1e 1b 1e 1c 1b 19.4 1c.4 1g.4 1j.4 1i.4 1g.4 1e.4 1i.4 1l.4 1o.4 1n.4 1l.4 1j.4 1n.4 1q.4 1t.4 1s.4 1q.4 1o.4 1s.4 1u.4 1w.4 1x.4 1v.4 1u.4 1q.4 1v.4 1j.4 1q.4 1e.4 1j 17 19 1b 1c 1e 1g 1i 1j.8";
const HALF = 384; // 16 bars of 3/4 in 32nds
const STEP = 60 / 100 / 8; // quarter = 100 bpm, one step per 32nd
function parseVoice(str, voice, into) {
  let t = 0;
  for (const tok of str.split(" ")) {
    if (tok[0] === "r") { t += +tok.slice(1); continue; }
    const [n, d] = tok.split(".");
    const len = d ? +d : 2;
    (into[t] ||= []).push([voice, parseInt(n, 36), len]);
    t += len;
  }
}
const EVENTS = [];
parseVoice(UPPER, 0, EVENTS); parseVoice(LOWER, 1, EVENTS);
// play it as written: first half twice, second half twice, then back to the top
const STEPS = HALF * 4;
const srcStep = (i) => (i < HALF * 2 ? i % HALF : HALF + (i % HALF));

function scheduleStep(i, t) {
  const src = srcStep(i);
  for (const [voice, m, len] of EVENTS[src] || []) {
    const dur = STEP * len;
    if (voice === 0) {
      tone(t, { f0: hz(m + 12), dur: dur * 0.9, vol: 0.42, bus: musicBus, attack: 0.003 });
      tone(t, { f0: hz(m + 12) * 1.004, dur: Math.min(dur, 0.12) * 0.8, vol: 0.1, bus: musicBus }); // chiptune shimmer
    } else {
      tone(t, { f0: hz(m), dur: dur * 0.92, type: "triangle", vol: 0.95, bus: musicBus });
    }
  }
  const beat = src % 8 === 0, bar = src % 24 === 0;
  if (bar) tone(t, { f0: 150, f1: 45, dur: 0.12, type: "sine", vol: 0.8, bus: musicBus }); // kick on the downbeat
  else if (beat) noise(t, { dur: 0.03, vol: 0.14, filter: 7000, type: "highpass", bus: musicBus }); // hat on beats 2 and 3
}

function tick() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.15) {
    scheduleStep(step, nextT);
    step = (step + 1) % STEPS;
    nextT += STEP;
  }
}

// Call every frame with whether the theme should be playing; cheap when nothing changes.
export function music(on) {
  const want = on && soundOn && musicOn && ctx && ctx.state === "running";
  if (want === playing) return;
  playing = !!want;
  if (playing) {
    step = 0; nextT = ctx.currentTime + 0.06; startT = nextT;
    tick(); timer = setInterval(tick, 40);
  } else {
    clearInterval(timer); timer = null;
  }
}

export const BEAT = STEP * 8; // one quarter note
// Seconds since the theme's first downbeat, as heard (output latency taken off), or null when it isn't playing.
export function musicTime() {
  if (!playing || !ctx) return null;
  return ctx.currentTime - startT - (ctx.outputLatency || ctx.baseLatency || 0);
}

export const isSoundOn = () => soundOn;
export const isMusicOn = () => musicOn;
export function setSound(on) {
  soundOn = on; write(SOUND_KEY, on);
  if (master) master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
  if (!on) music(false);
}
export function setMusic(on) {
  musicOn = on; write(MUSIC_KEY, on);
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.09 : 0, ctx.currentTime, 0.02);
  if (!on) music(false);
}
