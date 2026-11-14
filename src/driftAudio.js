// Doppio Drift audio: chiptune sound effects and a looping 8-bit theme, all synthesized
// with Web Audio (no files to download). Browsers only allow sound after a tap or key
// press, so unlock() is called from the game's input handlers.

const SOUND_KEY = "doppio.drift.sound";
const MUSIC_KEY = "doppio.drift.music";
const read = (k) => { try { return localStorage.getItem(k) !== "off"; } catch { return true; } };
const write = (k, on) => { try { localStorage.setItem(k, on ? "on" : "off"); } catch { /* ignore */ } };

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let soundOn = read(SOUND_KEY), musicOn = read(MUSIC_KEY);
let playing = false, timer = null, step = 0, nextT = 0;

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

export function unlock() {
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

// ---------- theme: "Doppio Drift" (original), A minor, 152 bpm, 8 bars ----------
// melody tokens per 16th: number = MIDI note, "-" = hold, "." = rest
const MEL = `
69 - 72 - 76 - 72 - 74 - 76 - 79 - 76 -
77 - 76 - 72 - 69 - 72 - - - 74 - 72 -
72 - 76 - 79 - 84 - 83 - 79 - 76 - 79 -
74 - 79 - 83 - 79 - 81 - 79 - 77 - 74 -
81 - - 79 81 - 84 - 81 - 79 - 76 - 72 -
77 - 81 - 84 - 81 - 79 - 77 - 76 - 74 -
76 - 79 - 84 - 79 - 76 - 72 - 74 - 76 -
74 - 71 - 74 - 79 - 76 - - - . . 68 -
`.trim().split(/\s+/);
const ROOTS = [45, 41, 48, 43, 45, 41, 48, 40]; // Am F C G Am F C E
const STEPS = MEL.length; // 128
const STEP = 60 / 152 / 4;

function scheduleStep(i, t) {
  const tok = MEL[i];
  if (tok !== "-" && tok !== ".") {
    let len = 1;
    while (MEL[(i + len) % STEPS] === "-") len++;
    tone(t, { f0: hz(+tok), dur: STEP * len * 0.92, vol: 0.55, bus: musicBus, attack: 0.003 });
    tone(t, { f0: hz(+tok) * 1.004, dur: STEP * len * 0.6, vol: 0.12, bus: musicBus, type: "square" }); // slight chorus
  }
  const bar = Math.floor(i / 16), s = i % 16;
  if (s % 2 === 0) { // bass on 8ths, octave bounce
    const r = ROOTS[bar] + (s % 4 === 2 ? 12 : 0);
    tone(t, { f0: hz(r), dur: STEP * 1.8, type: "triangle", vol: 0.9, bus: musicBus });
  }
  if (s === 0 || s === 8 || s === 10) tone(t, { f0: 150, f1: 45, dur: 0.12, type: "sine", vol: 1, bus: musicBus }); // kick
  if (s === 4 || s === 12) noise(t, { dur: 0.1, vol: 0.45, filter: 1800, type: "bandpass", bus: musicBus }); // snare
  if (s % 4 === 2) noise(t, { dur: 0.03, vol: 0.18, filter: 7000, type: "highpass", bus: musicBus }); // hat
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
    step = 0; nextT = ctx.currentTime + 0.06;
    tick(); timer = setInterval(tick, 40);
  } else {
    clearInterval(timer); timer = null;
  }
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
