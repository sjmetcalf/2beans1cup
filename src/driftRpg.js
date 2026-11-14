// Doppio Drift RPG layer: banked beans, barista levels with perks, and the hut shop.
// Progress is saved on this device.

const KEY = "doppio.drift.rpg";

export const TITLES = ["Dishwasher", "Barback", "Barista", "Head barista", "Roaster", "Coffee master", "Drifter"];

// Total XP needed to reach a level: L2 150, L3 450, L4 900, L5 1,500, L6 2,250, ...
export const xpFor = (level) => 75 * level * (level - 1);
export const levelOf = (xp) => { let l = 1; while (xp >= xpFor(l + 1)) l++; return l; };
export const titleOf = (level) => TITLES[Math.min(level, TITLES.length) - 1];

export const PERKS = [
  { level: 2, name: "Steady hands", text: "Hits spill 10% less" },
  { level: 3, name: "Quick transitions", text: "One less tap to put skins on and rip them" },
  { level: 4, name: "In the groove", text: "Wider green on the stride ring" },
  { level: 5, name: "Double shot", text: "Beans refill 30% instead of 20%" },
  { level: 6, name: "Soft landings", text: "Landing mid-spin spills half as much" },
];

export const SHOP = [
  { id: "travel", name: "Travel mug", price: 40, text: "A lid. Hits spill 15% less." },
  { id: "tumbler", name: "Double-walled tumbler", price: 120, needs: "travel", text: "Hits spill 30% less (replaces the travel mug)." },
  { id: "clips", name: "Quick-rip clips", price: 45, text: "One less tap for skins on and off." },
  { id: "wax", name: "Park wax", price: 50, text: "Kicker airs and spins score 50% more." },
  { id: "magnet", name: "Bean magnet", price: 60, text: "Grab beans from farther away." },
  { id: "skins", name: "Race skins", price: 70, text: "Every good stride pushes 25% harder." },
  { id: "edges", name: "Sharp edges", price: 90, text: "Grip on ice: you can jump off it." },
];

const fresh = () => ({ beans: 0, xp: 0, owned: [], runs: 0 });
export function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return fresh(); }
}
export function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

export function buy(s, id) {
  const item = SHOP.find((i) => i.id === id);
  if (!item || s.owned.includes(id) || s.beans < item.price || (item.needs && !s.owned.includes(item.needs))) return s;
  const next = { ...s, beans: s.beans - item.price, owned: [...s.owned, id] };
  save(next);
  return next;
}

// Everything a run needs to know, from level perks and owned gear
export function statsFor(s) {
  const lv = levelOf(s.xp), has = (id) => s.owned.includes(id);
  const cup = has("tumbler") ? 0.7 : has("travel") ? 0.85 : 1;
  return {
    level: lv,
    dmgMul: cup * (lv >= 2 ? 0.9 : 1),
    tapCut: (lv >= 3 ? 1 : 0) + (has("clips") ? 1 : 0),
    strideWin: lv >= 4 ? 0.2 : 0.16, // half-width of the green on the 0..1 stride meter
    beanFill: lv >= 5 ? 0.3 : 0.2,
    spinLandDmg: lv >= 6 ? 0.125 : 0.25,
    trickMul: has("wax") ? 1.5 : 1,
    magnet: has("magnet") ? 22 : 0,
    strideBoost: has("skins") ? 1.25 : 1,
    iceJump: has("edges"),
  };
}

// Bank a finished run: beans picked up, plus a bean per 250 ft; XP from distance, beans and passes
export function settle(s, run) {
  const beans = run.beans + Math.floor(run.ft / 250);
  const xp = Math.floor(run.ft / 10) + run.beans * 10 + run.passes * 40 + run.tricks * 15;
  const before = levelOf(s.xp);
  const next = { ...s, beans: s.beans + beans, xp: s.xp + xp, runs: s.runs + 1 };
  save(next);
  const after = levelOf(next.xp);
  return { next, gained: { beans, xp }, levelUp: after > before ? after : 0 };
}
