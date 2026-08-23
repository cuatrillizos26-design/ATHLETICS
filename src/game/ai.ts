// @ts-nocheck
/* ============ AI: world athletes, simulation, rankings ============ */
import { EV, RANK_EVENTS, IND_EVENTS, FIRST, LAST, COUNTRIES, RELAYS, INJURIES, SKINS, HAIRS, JERSEYS } from "./data";
import { S, clamp, rnd, ri, pick, uid, notify, news, gauss } from "./store";
import { perfScore, predictTime, dayPlanTime, pointsFor, applyResult, attrGain, youthFactor, potMult, findAth } from "./model";

const LEGENDS = ["M. Kiptoo","J. Verdier","A. Sund","T. Okafor","R. Castell","D. Mbeki","S. Halloran","V. Petrov","K. Yamada","L. Fontaine","C. Dube","E. Sandoval","H. Bjorn","P. Nkemelu","G. Marchetti","B. Koehler"];

/* ---------- creation ---------- */
export function makeAttrsFor(evk: string, level: number, age: number) {
  const attrs: any = {};
  const ev = EV[evk];
  for (const k of ["spd","acc","aer","ana","str","pow","kck","tec","eco","stt","rec","cmp","con"]) {
    let v = level * rnd(0.82, 1.02) + gauss() * 5;
    if (ev.w[k]) v = level * rnd(0.96, 1.1) + gauss() * 3; // specialty attrs stronger
    if (age < 20) v *= 0.97;
    attrs[k] = clamp(Math.round(v * 10) / 10, 20, 99);
  }
  return attrs;
}
export function capsFor(attrs: any, evk: string, pot: string) {
  const caps: any = {};
  const room = pot === "prodigy" ? [14, 30] : pot === "high" ? [10, 22] : pot === "normal" ? [6, 16] : [2, 10];
  const ev = EV[evk];
  for (const k in attrs) {
    let r = rnd(room[0], room[1]);
    if (ev && ev.w[k]) r += 5;
    caps[k] = clamp(attrs[k] + r, 30, 99);
  }
  return caps;
}
export function rollPot(levelRoll: number): string {
  const r = Math.random();
  if (r < 0.05) return "prodigy";
  if (r < 0.22) return "high";
  if (r < 0.75) return "normal";
  return "low";
}
export function styleFor(evk: string): string {
  const g = EV[evk].g;
  if (g === "mid") return pick(["front", "kicker", "pacer", "tactician", "pacer", "kicker"]);
  if (g === "hur") return pick(["sprinter", "tactician", "pacer"]);
  return "sprinter";
}

export function makeAIAthlete(opts: any = {}): any {
  const country = opts.country || pick(COUNTRIES).c;
  const cs = COUNTRIES.find((c: any) => c.c === country)!.s;
  const age = opts.age || ri(17, 33);
  const spec = opts.spec || pick(IND_EVENTS);
  const levelBase = opts.level != null ? opts.level : clamp(cs + gauss() * 9 + (age < 20 ? -6 : 4), 38, 96);
  const pot = opts.pot || rollPot(levelBase);
  const attrs = makeAttrsFor(spec, levelBase, age);
  const a = {
    id: uid(), first: pick(FIRST), last: pick(LAST), country, age, spec,
    spec2: pick(IND_EVENTS), pot, style: styleFor(spec),
    attrs, caps: capsFor(attrs, spec, pot),
    form: clamp(50 + gauss() * 12, 30, 85), fatigue: rnd(5, 45), injury: null,
    pb: {}, sb: {}, rankPts: {}, isPlayer: false, retAge: ri(31, 37), wins: 0,
    skin: pick(SKINS), hair: pick(HAIRS), jersey: pick(JERSEYS),
  };
  // seed PBs for spec + spec2
  for (const evk of [spec, a.spec2]) {
    a.pb[evk] = predictTime(a, evk, 1) * rnd(1.0, 1.05);
  }
  return a;
}

export function genWorld() {
  const athletes: any[] = [];
  for (let i = 0; i < 150; i++) athletes.push(makeAIAthlete());
  // guaranteed elite spread per event
  for (const evk of RANK_EVENTS) {
    for (let j = 0; j < 8; j++) athletes.push(makeAIAthlete({ spec: evk, level: rnd(86, 96), age: ri(21, 30) }));
  }
  // some prodigy kids
  for (let j = 0; j < 6; j++) athletes.push(makeAIAthlete({ age: ri(16, 18), pot: "prodigy", level: rnd(55, 72) }));
  const records: any = { world: {}, national: {}, champs: {} };
  for (const evk of RANK_EVENTS) {
    records.world[evk] = { t: EV[evk].wr * rnd(1.004, 1.012), holder: pick(LEGENDS), y: S.year - ri(1, 6) };
  }
  for (const c of COUNTRIES) {
    records.national[c.c] = {};
    for (const evk of RANK_EVENTS) {
      const lvl = clamp(c.s + rnd(-3, 5), 40, 95);
      records.national[c.c][evk] = { t: EV[evk].wr * Math.exp(EV[evk].k * (96 - lvl)) * rnd(0.995, 1.02), holder: pick(LEGENDS), y: S.year - ri(1, 9) };
    }
  }
  S.world = {
    athletes, records, rankings: {}, news: [], notifications: [],
    monthly: 0,
  };
  refreshRankings();
}

export function genRookie(prodigy = false): any {
  const a = makeAIAthlete({ age: ri(16, 17), pot: prodigy ? "prodigy" : rollPot(50), level: prodigy ? rnd(58, 70) : rnd(40, 60) });
  S.world.athletes.push(a);
  return a;
}

/* ---------- world ticking ---------- */
const AI_SESSIONS: any = {
  spr: { fx: { spd: 1.1, acc: 0.6, pow: 0.4 }, fat: 16 },
  mid: { fx: { aer: 1.1, ana: 0.8, kck: 0.35, eco: 0.3 }, fat: 18 },
  hur: { fx: { tec: 1.1, spd: 0.6, pow: 0.35 }, fat: 15 },
};
export function weeklyWorldTick() {
  const W = S.world;
  const toRemove: string[] = [];
  for (const a of W.athletes) {
    if (a.age >= a.retAge && Math.random() < (a.age - a.retAge + 1) * 0.12) {
      toRemove.push(a.id);
      if (bestRankOf(a) <= 25) news(`${a.first} ${a.last} (${a.country}) anuncia su retirada a los ${a.age} años.`);
      continue;
    }
    if (a.injury) { a.injury.daysLeft -= 7; if (a.injury.daysLeft <= 0) a.injury = null; a.fatigue = clamp(a.fatigue - 15, 0, 100); continue; }
    // train ~5 sessions
    const sess = AI_SESSIONS[EV[a.spec].g];
    for (let d = 0; d < 5; d++) {
      for (const k in sess.fx) {
        const g = attrGain(a, k, sess.fx[k]) * 0.9;
        if (g > 0.01) a.attrs[k] = clamp(a.attrs[k] + g, 1, 99);
      }
      a.fatigue = clamp(a.fatigue + sess.fat * 0.55, 0, 100);
    }
    // rest days
    a.fatigue = clamp(a.fatigue - (14 + a.attrs.rec * 0.5), 0, 100);
    a.form = clamp(a.form + (a.fatigue < 45 ? rnd(0, 3) : -rnd(0, 2.5)) + gauss(), 28, 92);
    if (Math.random() < 0.004 + Math.max(0, a.fatigue - 60) * 0.0004) {
      const inj = pick(INJURIES);
      a.injury = { type: inj.id, daysLeft: inj.days + ri(0, 4) };
    }
  }
  W.athletes = W.athletes.filter((a: any) => !toRemove.includes(a.id));
}

function bestRankOf(a: any): number {
  let best = 999;
  for (const evk of RANK_EVENTS) {
    const list = S.world.rankings[evk] || [];
    const idx = list.findIndex((r: any) => r.id === a.id);
    if (idx >= 0) best = Math.min(best, idx + 1);
  }
  return best;
}

/* simulated world-class meet each month so the world moves & records can fall */
export function monthlyWorldCircuit() {
  const W = S.world;
  const evs = [pick(RANK_EVENTS), pick(RANK_EVENTS)];
  for (const evk of [...new Set(evs)]) {
    const entrants = pickEntrantsByRank(evk, 12, 3);
    const res = simulateField(entrants, evk, 3);
    for (let i = 0; i < res.length; i++) {
      const a = findAth(res[i].id); if (!a || res[i].dq) continue;
      const flags = applyResult(a, evk, res[i].t, i + 1, null);
      bumpRankPts(a, evk, res[i].t, i + 1, 3);
      if (flags.wr) { news(`¡${a.first} ${a.last} bate el RÉCORD MUNDIAL de ${EV[evk].label} con ${fmtT(res[i].t)}!`); }
      else if (flags.nr) { news(`${a.first} ${a.last} bate el récord nacional de ${EV[evk].label} (${fmtT(res[i].t)}).`); }
    }
    const w = res[0];
    if (w && !w.dq) {
      const a = findAth(w.id);
      if (a) news(`${a.first} ${a.last} (${a.country}) gana el meeting internacional de ${EV[evk].label} con ${fmtT(w.t)}.`);
    }
  }
}
const fmtT = (t: number) => (t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}` : t.toFixed(2));

export function bumpRankPts(a: any, evk: string, t: number, place: number, tier: number) {
  const bonus = [0, 5, 10, 20, 35, 60][tier] || 0;
  const mult = place === 1 ? 1 : place === 2 ? 0.6 : place === 3 ? 0.4 : place <= 8 ? 0.2 : 0.05;
  const pts = pointsFor(evk, t) + Math.round(bonus * mult);
  if (!a.rankPts) a.rankPts = {};
  a.rankPts[evk] = Math.max(a.rankPts[evk] || 0, pts);
}

/* simulate a field of athletes in an event; returns sorted [{id,t,dq}] */
export function simulateField(athletes: any[], evk: string, importance = 1, effortMin = 0.97, effortMax = 1.0): any[] {
  const out = athletes.map((a) => {
    if (Math.random() < 0.004) return { id: a.id, t: Infinity, dq: true };
    const effort = rnd(effortMin, effortMax);
    const t = dayPlanTime(a, evk, importance) / effort;
    return { id: a.id, t, dq: false };
  });
  return out.sort((x, y) => x.t - y.t);
}

/* pick entrants by ranking with country cap */
export function pickEntrantsByRank(evk: string, count: number, countryCap = 3): any[] {
  const list = S.world.rankings[evk] || [];
  const seen: any = {}; const out: any[] = [];
  for (const r of list) {
    const a = findAth(r.id); if (!a || a.isPlayer) continue;
    if (a.injury && Math.random() < 0.6) continue;
    seen[a.country] = (seen[a.country] || 0) + 1;
    if (seen[a.country] > countryCap) continue;
    out.push(a);
    if (out.length >= count) break;
  }
  // pad with predicted-time athletes if ranking list short
  if (out.length < count) {
    const rest = S.world.athletes
      .filter((a: any) => !out.includes(a) && !a.isPlayer && (perfScore(a, evk) > 30))
      .sort((x: any, y: any) => predictTime(y, evk) - predictTime(x, evk))
      .reverse();
    for (const a of rest) { out.push(a); if (out.length >= count) break; }
  }
  return out;
}
export function countryPool(country: string, evk: string): any[] {
  return S.world.athletes
    .filter((a: any) => a.country === country)
    .sort((x: any, y: any) => predictTime(x, evk) - predictTime(y, evk));
}

export function refreshRankings() {
  const W = S.world; if (!W) return;
  // include player rankPts too
  for (const evk of RANK_EVENTS) {
    const all: any[] = [];
    const cands = [...W.athletes, ...(S.player ? [S.player] : [])];
    for (const a of cands) {
      const pts = a.rankPts?.[evk] || 0;
      if (pts > 0) all.push({ id: a.id, pts });
    }
    all.sort((x, y) => y.pts - x.pts);
    W.rankings[evk] = all.slice(0, 100);
  }
}

export function rankOfPlayer(evk: string): number {
  const list = S.world?.rankings?.[evk] || [];
  const i = list.findIndex((r: any) => r.id === S.player?.id);
  return i < 0 ? 0 : i + 1;
}

/* ---------- relays: national teams ---------- */
export function autoRelayTeam(country: string, relayKey: string, mustInclude?: string): any[] {
  const legs = RELAYS[relayKey].legs;
  const pool = S.world.athletes.filter((a: any) => a.country === country && !a.injury);
  const chosen: any[] = [];
  const used = new Set();
  if (mustInclude) {
    const p = S.player;
    chosen.push(p); used.add(p.id);
  }
  for (const dist of legs) {
    if (chosen.length >= 4 && chosen.every(Boolean)) break;
    const evk = dist === 100 ? "100" : dist === 200 ? "200" : dist === 300 ? "300" : "400";
    const sorted = [...pool].filter((a) => !used.has(a.id))
      .sort((x, y) => predictTime(x, evk) - predictTime(y, evk));
    const best = sorted[0];
    if (best) { chosen.push(best); used.add(best.id); }
  }
  while (chosen.length < 4) {
    const rest = pool.filter((a) => !used.has(a.id)).sort((x, y) => perfScore(y, "100") - perfScore(x, "100"))[0];
    if (!rest) {
      const rookie = makeAIAthlete({ country, age: ri(18, 24), level: 55 });
      S.world.athletes.push(rookie);
      chosen.push(rookie); used.add(rookie.id);
      continue;
    }
    chosen.push(rest); used.add(rest.id);
  }
  return chosen;
}

/* ---------- season rollover ---------- */
export function seasonRolloverAI() {
  const W = S.world;
  const retired: any[] = [];
  for (const a of W.athletes) {
    a.age++;
    if (a.age >= a.retAge && Math.random() < 0.45) { retired.push(a); continue; }
    if (a.age >= 31) {
      const dec = 1 - Math.min(0.09, (a.age - 30) * 0.016) * (1.2 - a.attrs.rec / 120);
      for (const k of ["spd", "acc", "pow", "ana", "str"]) a.attrs[k] = clamp(a.attrs[k] * dec, 20, 99);
    }
    a.sb = {}; a.rankPts = {}; a.fatigue = rnd(5, 20); a.form = clamp(55 + gauss() * 10, 35, 80); a.injury = null;
  }
  W.athletes = W.athletes.filter((a: any) => !retired.includes(a));
  for (const r of retired) if (bestRankOf(r) <= 20) news(`${r.first} ${r.last} (${r.country}) se retira. Fin de una era.`);
  // some athletes switch focus (emergent stories)
  const switchers = S.world.athletes.filter(() => Math.random() < 0.03).slice(0, 3);
  for (const a of switchers) {
    const old = a.spec;
    a.spec = a.spec2; a.spec2 = old;
    if (bestRankOf(a) <= 40) news(`${a.first} ${a.last} cambia su enfoque: ahora competirá en ${EV[a.spec].label}.`);
  }
  // new generation
  const nNew = ri(12, 18);
  for (let i = 0; i < nNew; i++) genRookie(false);
  if (Math.random() < 0.75) {
    const p = genRookie(true);
    const evLabel = EV[p.spec].label;
    news(`Ha aparecido un nuevo prodigio de ${evLabel}: ${p.first} ${p.last} (${p.country}), ${p.age} años.`);
    notify(`Ha aparecido un nuevo prodigio de ${evLabel}: ${p.first} ${p.last}.`, "b");
  }
}
