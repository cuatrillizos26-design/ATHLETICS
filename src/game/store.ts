// @ts-nocheck
/* ============ STORE / STATE + SAVE SYSTEM ============ */

export const G: any = {};          // bus: functions wired across modules
export const S: any = {            // global mutable state
  v: 1,
  screen: "menu",
  params: {},
  settings: { sound: true, speed: 1 },
  careerActive: false,
  player: null,
  year: 2026, week: 1, day: 0,     // day 0..6 inside week (6 = meet day)
  seasonLen: 32,
  calendar: [],
  world: null,
  career: null,
  relay: null,
  flags: {},
};

const SAVE_KEY = "athletics_rise_save_v1";
const HOF_KEY = "athletics_rise_hof_v1";

export const uid = () => "a" + Math.random().toString(36).slice(2, 9);
export const fmtMoney = (n: number) => Math.round(n).toLocaleString("es-ES") + " €";
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rnd = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const ri = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
export const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~[-1,1]

export function newCareerState() {
  S.careerActive = true;
  S.year = 2026; S.week = 1; S.day = 0;
  S.calendar = [];
  S.flags = { racedToday: false, tutorial: 0, seasonBest: null, meetEntered: null, achievementsShown: {} };
  S.career = {
    seasons: [], medals: { g: 0, s: 0, b: 0 }, natMedals: { g: 0, s: 0, b: 0 },
    intlMedals: { g: 0, s: 0, b: 0 }, titles: [], recordsBroken: [], achievements: [],
    rivalStats: {}, bestRank: {}, bestPts: 0, totalWins: 0, fame: 0, money: 500,
    sponsors: [], sponsorOffers: [], club: { name: "Club Atletismo Local", level: 1 }, clubOffers: [],
    history: [], legend: 0,
  };
  S.relay = {
    "4x100": { ids: [null, null, null, null], style: "normal" },
    "4x400": { ids: [null, null, null, null], style: "normal" },
    "SMR":   { ids: [null, null, null, null], style: "normal" },
  };
}

/* ---------- hall of fame (persists across careers) ---------- */
export function loadHOF(): any[] {
  try { return JSON.parse(localStorage.getItem(HOF_KEY) || "[]"); } catch { return []; }
}
export function saveHOF(hof: any[]) {
  try { localStorage.setItem(HOF_KEY, JSON.stringify(hof.slice(0, 30))); } catch {}
}

/* ---------- save / load ---------- */
export function save(silent = false) {
  if (!S.careerActive) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: S.v, settings: S.settings, player: S.player, year: S.year, week: S.week, day: S.day,
      calendar: S.calendar, world: S.world, career: S.career, relay: S.relay, flags: S.flags,
    }));
    if (!silent && G.onSaved) G.onSaved();
  } catch (e) { console.warn("save failed", e); }
}
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
export function load(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    Object.assign(S, {
      settings: d.settings || S.settings, player: d.player, year: d.year, week: d.week, day: d.day,
      calendar: d.calendar, world: d.world, career: d.career, relay: d.relay, flags: d.flags || {},
    });
    S.careerActive = true;
    S.screen = "dashboard";
    return true;
  } catch (e) { console.warn("load failed", e); return false; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }

/* ---------- notifications / news ---------- */
export function notify(msg: string, cls = "") {
  if (!S.world) return;
  S.world.notifications.unshift({ msg, cls, w: S.week, y: S.year });
  S.world.notifications = S.world.notifications.slice(0, 60);
  if (G.toast) G.toast(msg, cls);
}
export function news(msg: string) {
  if (!S.world) return;
  S.world.news.unshift({ msg, w: S.week, y: S.year });
  S.world.news = S.world.news.slice(0, 50);
}
