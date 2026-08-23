// @ts-nocheck
/* ============ MODEL: performance math, growth, records ============ */
import { EV, RELAYS, INJURIES, ATTRS, CLUBS } from "./data";
import { S, clamp, rnd, gauss, ri, pick } from "./store";

/* ---------- scoring ---------- */
export function perfScore(a: any, evk: string): number {
  const ev = EV[evk]; let p = 0;
  for (const k in ev.w) {
    const cap = a.caps && a.caps[k] != null ? a.caps[k] : 99;
    p += Math.min(a.attrs[k] || 0, cap) * ev.w[k];
  }
  return p;
}

export function agePen(a: any): number {
  if (a.age <= 30) return 0;
  return (a.age - 30) * 0.65 * (1 - (a.attrs.rec || 50) / 300);
}
export function injuryPen(a: any): number {
  if (!a.injury) return 0;
  const inj = INJURIES.find((i: any) => i.id === a.injury.type);
  return inj ? inj.pen : 0;
}

export function effScore(a: any, evk: string, importance = 1): number {
  let p = perfScore(a, evk);
  p += (a.form - 50) * 0.10;
  p -= a.fatigue * 0.10;
  p -= injuryPen(a);
  p -= agePen(a);
  if (importance >= 3) p += ((a.attrs.cmp || 50) - 50) * 0.07;
  return p;
}

export function predictTime(a: any, evk: string, importance = 1): number {
  const ev = EV[evk];
  return ev.wr * Math.exp(ev.k * (96 - effScore(a, evk, importance)));
}

export function impliedPerf(evk: string, t: number): number {
  const ev = EV[evk];
  return 96 - Math.log(t / ev.wr) / ev.k;
}
export function pointsFor(evk: string, t: number): number {
  return Math.max(0, Math.round(impliedPerf(evk, t) * 13));
}

/* day-to-day variability controlled by consistency */
export function dayPlanTime(a: any, evk: string, importance = 1): number {
  const base = predictTime(a, evk, importance);
  const sig = 0.0018 + (100 - (a.attrs.con || 50)) * 0.00035;
  return base * (1 + gauss() * sig);
}

/* ---------- formatting ---------- */
export function fmtTime(t: number): string {
  if (t == null || !isFinite(t)) return "—";
  if (t >= 60) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return `${m}:${s < 10 ? "0" : ""}${s.toFixed(2)}`;
  }
  return t.toFixed(2);
}
export function fmtPts(p: number) { return p >= 1000 ? p.toLocaleString("es") : String(p); }

/* ---------- growth ---------- */
export function youthFactor(age: number): number {
  if (age <= 16) return 1.55; if (age === 17) return 1.45; if (age === 18) return 1.35;
  if (age === 19) return 1.25; if (age <= 21) return 1.15; if (age <= 24) return 1.05;
  if (age <= 28) return 0.92; if (age <= 30) return 0.72; if (age <= 32) return 0.5;
  if (age <= 34) return 0.3; return 0.12;
}
export function potMult(pot: string): number {
  return pot === "prodigy" ? 1.45 : pot === "high" ? 1.2 : pot === "normal" ? 1 : 0.72;
}
export function attrGain(a: any, attr: string, base: number): number {
  const cap = a.caps[attr] ?? 70;
  const cur = a.attrs[attr] || 0;
  const closeness = Math.pow(clamp((cap - cur) / (cap * 0.55), 0, 1), 0.85);
  const fatMult = a.fatigue > 75 ? 0.3 : a.fatigue > 50 ? 0.7 : 1;
  const injMult = a.injury ? 0.25 : 1;
  const clubBonus = a.isPlayer ? 1 + (CLUBS.find((c) => c.level === (S.career?.club?.level || 1))?.bonus || 0) : 1;
  const g = base * 0.17 * youthFactor(a.age) * potMult(a.pot) * closeness * fatMult * injMult * clubBonus;
  return Math.max(0, g * rnd(0.7, 1.2));
}

/* apply one training day to an athlete (player or AI-lite) */
export function doSession(a: any, sess: any): { gains: any[] } {
  const gains: any[] = [];
  for (const k in sess.fx || {}) {
    const g = attrGain(a, k, sess.fx[k]);
    if (g > 0.01) { a.attrs[k] = clamp((a.attrs[k] || 0) + g, 1, 99); gains.push({ k, g }); }
  }
  if (sess.fat < 0) a.fatigue = clamp(a.fatigue + sess.fat - a.attrs.rec * 0.12, 0, 100);
  else a.fatigue = clamp(a.fatigue + sess.fat * (a.injury ? 1.3 : 1), 0, 100);
  if (sess.form) a.form = clamp(a.form + sess.form, 20, 96);
  if (sess.heal && a.injury) a.injury.daysLeft = Math.max(1, a.injury.daysLeft - 1);
  return { gains };
}

/* daily recovery tick (called each game day) */
export function dailyTick(a: any, trained = false) {
  if (!trained) a.fatigue = clamp(a.fatigue - 7 - a.attrs.rec * 0.14, 0, 100);
  else a.fatigue = clamp(a.fatigue - 2 - a.attrs.rec * 0.05, 0, 100);
  if (a.fatigue < 40 && trained) a.form = clamp(a.form + 0.5, 20, 96);
  else if (a.fatigue > 75) a.form = clamp(a.form - 1.1, 20, 96);
  else if (!trained) a.form = clamp(a.form + 0.25, 20, 96);
  if (a.injury) {
    a.injury.daysLeft--;
    a.form = clamp(a.form - 0.7, 20, 96);
    if (a.injury.daysLeft <= 0) a.injury = null;
  }
}

/* injury roll after hard load */
export function injuryRoll(a: any, loadFatigue: number): any | null {
  const risk = Math.max(0, a.fatigue - 55) * 0.0035 + (loadFatigue >= 20 ? 0.006 : 0.002);
  if (Math.random() < risk) {
    const r = Math.random();
    const inj = r < 0.45 ? INJURIES[0] : r < 0.75 ? INJURIES[1] : r < 0.93 ? INJURIES[2] : INJURIES[3];
    return { type: inj.id, daysLeft: inj.days + ri(0, 2) };
  }
  return null;
}

export function potArrows(a: any, attr: string): { txt: string; cls: string } {
  const cap = a.caps[attr] ?? 70, cur = a.attrs[attr] || 0, d = cap - cur;
  if (d > 18) return { txt: "▲▲", cls: "up2" };
  if (d > 8) return { txt: "▲", cls: "up" };
  if (d > -3) return { txt: "●", cls: "eq" };
  return { txt: "▼", cls: "dn" };
}

/* ---------- records ---------- */
export function getWR(evk: string) { return S.world?.records?.world?.[evk]; }
export function getNR(country: string, evk: string) { return S.world?.records?.national?.[country]?.[evk]; }
export function getCR(meetName: string, evk: string) { return S.world?.records?.champs?.[meetName]?.[evk]; }

/* applies a result: PB/SB + record detection. Returns flags */
export function applyResult(a: any, evk: string, t: number, place: number, meet: any | null): any {
  const out: any = { pb: false, prevPb: null, nr: false, wr: false, cr: false, sb: false };
  const prev = a.pb[evk];
  if (prev == null || t < prev) { out.pb = true; out.prevPb = prev; a.pb[evk] = t; }
  const prevSb = a.sb[evk];
  if (prevSb == null || t < prevSb) { out.sb = true; a.sb[evk] = t; }
  if (!S.world) return out;
  const wr = S.world.records.world[evk];
  if (wr && t < wr.t) { S.world.records.world[evk] = { t, holder: a.first + " " + a.last, y: S.year }; out.wr = true; }
  const nat = S.world.records.national[a.country];
  if (nat && nat[evk] && t < nat[evk].t) { nat[evk] = { t, holder: a.first + " " + a.last, y: S.year }; out.nr = true; }
  if (meet && meet.tier >= 3) {
    const key = meet.baseName || meet.name;
    if (!S.world.records.champs[key]) S.world.records.champs[key] = {};
    const cr = S.world.records.champs[key][evk];
    if (!cr || t < cr.t) { S.world.records.champs[key][evk] = { t, holder: a.first + " " + a.last, y: S.year }; out.cr = true; }
  }
  return out;
}

/* ---------- relays ---------- */
export function legEstimate(a: any, dist: number, first = false): number {
  const evk = dist === 100 ? "100" : dist === 200 ? "200" : dist === 300 ? "300" : "400";
  let t = predictTime(a, evk, 1);
  t *= first ? 1.0 : 0.935; // flying start
  t *= 1 + (50 - a.form) * 0.001 + a.fatigue * 0.0008;
  return t;
}
export function estimateRelay(ids: any[], relayKey: string): number | null {
  const legs = RELAYS[relayKey].legs;
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const a = ids[i] && findAth(ids[i]);
    if (!a) return null;
    total += legEstimate(a, legs[i], i === 0);
  }
  total += relayKey === "4x100" ? 0.85 : 0.55; // exchanges
  return total;
}
export function findAth(id: string): any {
  if (S.player && S.player.id === id) return S.player;
  return S.world?.athletes?.find((a: any) => a.id === id) || null;
}

/* ---------- legend score ---------- */
export function legendScore(c: any, player: any): number {
  let s = 0;
  s += c.intlMedals.g * 7 + c.intlMedals.s * 4 + c.intlMedals.b * 2.5;
  s += c.natMedals.g * 2 + c.natMedals.s * 1 + c.natMedals.b * 0.5;
  s += c.recordsBroken.filter((r: any) => r.scope === "world").length * 10;
  s += c.recordsBroken.filter((r: any) => r.scope !== "world").length * 2.5;
  const br = Math.min(...Object.values(c.bestRank || { 99: 99 })) as number;
  if (br <= 1) s += 10; else if (br <= 3) s += 7; else if (br <= 10) s += 4.5; else if (br <= 25) s += 2;
  s += Math.min(14, c.seasons.length * 1.3);
  s += Math.min(12, c.bestPts / 110);
  return Math.round(clamp(s, 0, 100));
}

export function specLabel(a: any): string {
  return `${EV[a.spec]?.label || a.spec} / ${EV[a.spec2]?.label || a.spec2}`;
}
