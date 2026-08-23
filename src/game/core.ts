// @ts-nocheck
/* ============ CORE: game flow, calendar, meets, seasons ============ */
import { S, G, save, load, hasSave, clearSave, newCareerState, notify, news, loadHOF, saveHOF, uid, clamp, rnd, ri, pick, fmtMoney } from "./store";
import { EV, RANK_EVENTS, IND_EVENTS, RELAYS, RELAY_EVENTS, SPECS, COUNTRIES, TRAINING, ACHIEVEMENTS, TIERS, PRIZES, SPONSORS, CLUBS, INJURIES, CITIES, SKINS } from "./data";
import { doSession, dailyTick, injuryRoll, applyResult, predictTime, dayPlanTime, effScore, perfScore, pointsFor, fmtTime, legendScore, youthFactor } from "./model";
import { genWorld, weeklyWorldTick, monthlyWorldCircuit, simulateField, pickEntrantsByRank, countryPool, refreshRankings, seasonRolloverAI, autoRelayTeam, bumpRankPts, genRookie } from "./ai";
import { installRaceEngine } from "./race";
import { initUI, go, refresh, toast, confirmOv, showPB, showRecord, showTutorial } from "./ui";
import { snd } from "./sound";

/* ================= INIT ================= */
export function initGame(root: HTMLElement) {
  initUI(root);
  installRaceEngine();
  wireActions();
  go(hasSave() ? "menu" : "menu");
}

G.hasSaveFn = () => hasSave();
G.saveSummary = () => {
  try {
    const d = JSON.parse(localStorage.getItem("athletics_rise_save_v1") || "null");
    return d?.player ? `${d.player.first} ${d.player.last} · ${EV[d.player.spec]?.label || ""} · ${d.year}` : "";
  } catch { return ""; }
};
G.getHOF = () => loadHOF().sort((a: any, b: any) => b.score - a.score);
G.onSaved = () => {
  const chip = document.getElementById("savechip");
  if (chip) { chip.textContent = "GUARDADO ✓"; chip.style.color = "var(--grn)"; setTimeout(() => { chip.textContent = "●"; chip.style.color = ""; }, 1200); }
};

/* ================= CAREER CREATION ================= */
G.createDraft = { spec: "mid", skin: SKINS[2], hair: "#1C1B1A", jersey: "#FF5A2B" };

function makePlayer(d: any): any {
  const spec = SPECS.find((s: any) => s.id === d.spec)!;
  const attrs: any = {};
  const base: any = { spd: 46, acc: 46, aer: 44, ana: 44, str: 42, pow: 44, kck: 44, tec: 44, eco: 42, stt: 44, rec: 46, cmp: 48, con: 46 };
  const boost: any = { "100": ["spd", "acc", "stt"], "200": ["spd", "ana"], "400": ["ana", "spd"], "800": ["ana", "aer"], "1500": ["aer", "eco"], "110H": ["tec", "spd"], "400H": ["tec", "ana"] };
  for (const k in base) attrs[k] = base[k] + rnd(-3, 4) + (d.age - 16) * 2.2;
  for (const k of boost[spec.ev] || []) attrs[k] += rnd(4, 8);
  for (const k of boost[d.spec2] || []) attrs[k] += rnd(1, 4);
  for (const k in attrs) attrs[k] = clamp(Math.round(attrs[k] * 10) / 10, 30, 70);
  const potRoll = Math.random();
  const pot = potRoll < 0.12 ? "prodigy" : potRoll < 0.42 ? "high" : potRoll < 0.85 ? "normal" : "low";
  const caps: any = {};
  const room: any = { prodigy: [16, 34], high: [12, 24], normal: [7, 17], low: [2, 10] };
  for (const k in attrs) {
    let r = rnd(room[pot][0], room[pot][1]);
    if ((boost[spec.ev] || []).includes(k)) r += 6;
    caps[k] = clamp(attrs[k] + r, 40, 99);
  }
  return {
    id: "player", first: d.first, last: d.last, country: d.country, age: d.age,
    spec: spec.ev, spec2: d.spec2, pot, style: "tactician",
    attrs, caps, form: 55, fatigue: 10, injury: null,
    pb: {}, sb: {}, rankPts: {}, isPlayer: true, wins: 0,
    skin: d.skin, hair: d.hair, jersey: d.jersey,
  };
}

function startCareer(p: any) {
  newCareerState();
  S.player = p;
  genWorld();
  genCalendar();
  S.career.history.push(seasonEntry());
  S.flags.seasonStartAttrs = { ...p.attrs };
  coachTip(true);
  save(true);
  go("dashboard");
  if (!S.flags.tutorial) { S.flags.tutorial = 1; showTutorial(0); }
  notify(`Bienvenido, ${p.first}. Tu primer objetivo: el meeting local de la semana 3.`, "b");
}

function seasonEntry(): any {
  return { year: S.year, age: S.player.age, races: [], wins: 0, medals: 0, bestRank: 0, money: 0, bestMeet: null, bestMeetScore: -1 };
}
const curSeason = () => S.career.history[S.career.history.length - 1];

/* ================= CALENDAR ================= */
function genCalendar() {
  const cal: any[] = [];
  let id = 0;
  const localWeeks = [3, 5, 8, 11, 14, 17, 21, 25, 30];
  for (const w of localWeeks) {
    const tier = w % 2 ? 1 : 2;
    cal.push(mkMeet(++id, w, tier === 1 ? pick(["Control Local", "Trofeo " + pick(CITIES), "Meeting de " + pick(CITIES)]) : pick(["GP Regional " + pick(CITIES), "Memorial " + pick(["Ayala", "Bermeo", "Kiptoo", "Nurmi", "Zátopek", "Ottey"])]), tier, allEventsFor(tier), false));
  }
  // international meets (tier 4)
  for (const w of [16, 19, 23]) cal.push(mkMeet(++id, w, "Golden Meeting " + pick(CITIES), 4, champEvents(), false));
  // national championship
  cal.push(mkMeet(++id, 20, "Campeonato Nacional", 3, champEvents(), true));
  // continental
  cal.push(mkMeet(++id, 24, "Campeonato Continental", 4, champEvents(), true));
  // major
  const y = S.year;
  if (y % 4 === 2 || y % 4 === 0) {
    if (y % 4 === 0) cal.push(mkMeet(++id, 28, "Juegos Olímpicos", 5, champEvents(), true, true));
    else cal.push(mkMeet(++id, 28, "Campeonato Mundial", 5, champEvents(), true));
  }
  cal.sort((a, b) => a.week - b.week);
  S.calendar = cal;
  function mkMeet(mid: number, week: number, name: string, tier: number, events: string[], relay: boolean, olympic = false) {
    return { id: mid, week, name, baseName: name, tier, events, relay, olympic, city: pick(CITIES), done: false, result: null };
  }
}
function allEventsFor(tier: number): string[] {
  return tier <= 2 ? [...IND_EVENTS] : champEvents();
}
function champEvents(): string[] {
  return ["100", "200", "400", "800", "1500", "3000", "110H", "400H"];
}

/* ================= DAILY FLOW ================= */
function endOfActionDay(trained: boolean, sess?: any) {
  const p = S.player;
  dailyTick(p, trained);
  if (trained && sess && sess.fat > 0) {
    const inj = injuryRoll(p, sess.fat);
    if (inj) {
      p.injury = inj;
      const n = INJURIES.find((i: any) => i.id === inj.type)!.n;
      notify(`Te has lesionado: ${n} (${inj.daysLeft} días).`, "r");
      snd("bad");
    }
  }
  advanceDayCore();
}

function advanceDayCore() {
  const p = S.player;
  S.day++;
  if (S.day > 6) {
    S.day = 0;
    S.flags.racedToday = false;
    S.week++;
    if (S.week <= S.seasonLen) onNewWeek();
  } else {
    // passed a meet day without competing?
    const m = S.calendar.find((x: any) => x.week === S.week && !x.done);
    if (m && S.day > 6) { /* handled above */ }
  }
  sponsorCheck();
  coachTip();
  save(true);
  refresh();
  if (S.week > S.seasonLen) {
    // season over
    go("dashboard");
    toast("Temporada completada. Ciérrala cuando quieras.", "g");
  }
}

function onNewWeek() {
  // simulate meets of the week that just passed if not done (meet day = day 6 of that week; when we cross, week already incremented → check previous week)
  const prev = S.week - 1;
  for (const m of S.calendar) if (m.week === prev && !m.done) simulateMeetWithoutPlayer(m);
  if (S.week % 4 === 0) monthlyWorldCircuit();
  weeklyWorldTick();
  refreshRankings();
  updateBestRanks();
  // sponsor weekly income
  const income = S.career.sponsors.reduce((s: number, sp: any) => s + sp.week, 0);
  if (income > 0) { S.career.money += income; curSeason() && (curSeason().money += income); }
  save(true);
}

function updateBestRanks() {
  for (const evk of [S.player.spec, S.player.spec2]) {
    const list = S.world.rankings[evk] || [];
    const i = list.findIndex((r: any) => r.id === S.player.id);
    if (i >= 0) {
      const rank = i + 1;
      const prevKey = "prevRank" + evk;
      const prev = S.flags[prevKey] || 999;
      if (evk === S.player.spec && prev > rank) {
        for (const th of [50, 20, 10, 3, 1]) if (prev > th && rank <= th) { notify(`Has subido al puesto #${rank} del ranking mundial de ${EV[evk].label}.`, "g"); break; }
      }
      S.flags[prevKey] = rank;
      S.career.bestRank[evk] = Math.min(S.career.bestRank[evk] || 999, rank);
      const se = curSeason();
      if (se) se.bestRank = se.bestRank === 0 ? rank : Math.min(se.bestRank, rank);
      const pts = list[i].pts;
      S.career.bestPts = Math.max(S.career.bestPts, pts);
      if (rank <= 100 && evk === S.player.spec) checkAch("top100");
      if (rank <= 10 && evk === S.player.spec) checkAch("top10");
    }
  }
}

/* ================= TRAINING ================= */
G.trainDo = (catId: string, sessId: string) => {
  const sess = TRAINING[catId].sessions.find((s: any) => s.id === sessId);
  if (!sess) return;
  const p = S.player;
  if (p.injury && catId !== "recuperacion") { toast("Estás lesionado: solo recuperación.", "r"); return; }
  if (sess.cost && S.career.money < sess.cost) { toast("No tienes dinero para la fisioterapia.", "r"); return; }
  if (sess.cost) S.career.money -= sess.cost;
  const { gains } = doSession(p, sess);
  const msg = gains.length ? gains.map((g: any) => `${g.k.toUpperCase()} +${g.g.toFixed(1)}`).join(" · ") : "Sesión completada.";
  toast(`${sess.n}: ${msg} (fatiga ${p.fatigue >= 0 ? Math.round(p.fatigue) : 0})`, "n");
  if (gains.some((g: any) => g.g > 0.8)) S.flags.hotGain = `${sess.n} está dando frutos: ${msg}`;
  endOfActionDay(sess.fat > 0, sess);
};

G.rest = () => endOfActionDay(false);
G.advanceDay = () => advanceDayCore();

G.skipToMeet = () => {
  const nm = S.calendar.find((m: any) => !m.done && m.week >= S.week);
  if (!nm) return;
  let guard = 0;
  while ((S.week < nm.week || S.day < 6) && guard < 400) {
    guard++;
    // auto routine: rest if tired, else spec session
    const p = S.player;
    if (S.day === 6) { advanceDayCore(); continue; } // skip meet days silently (they get simulated on week roll)
    if (p.fatigue > 55 || p.injury) dailyTick(p, false);
    else {
      const specSess: any = { spr: TRAINING.velocidad.sessions[1], mid: TRAINING.resistencia.sessions[1], hur: TRAINING.tecnica.sessions[1] };
      const sess = specSess[EV[p.spec].g] || TRAINING.resistencia.sessions[2];
      doSession(p, sess);
      dailyTick(p, true);
    }
    advanceDayCore();
    if (S.week > S.seasonLen) break;
  }
  go("dashboard");
};

/* ================= MEETS ================= */
G.canEnterMeet = (m: any) => {
  for (const e of m.events) if (G.canEnterEvent(m, e).ok) return { ok: true };
  if (m.relay) { const q = G.relayQualified(m); for (const r of RELAY_EVENTS) if (q[r].ok && q[r].playerIn) return { ok: true }; }
  return { ok: false };
};

G.canEnterEvent = (m: any, evk: string): any => {
  const p = S.player;
  const t = p.sb[evk] || p.pb[evk];
  const pts = t ? pointsFor(evk, t) : 0;
  const rounds = m.tier >= 4 ? "Series → Semifinal → Final" : m.tier === 3 ? "Series → Final" : "Final directa";
  if (m.tier <= 2) return { ok: true, rounds };
  if (m.tier === 3) {
    const pool = countryPool(p.country, evk);
    const idx = pool.findIndex((a: any) => predictTime(a, evk) < (t ? predictTime(p, evk) : Infinity));
    if (pts >= 640 || idx <= 11) return { ok: true, rounds };
    return { ok: false, reason: `Necesitas marca ≈ ${fmtTime(predictTime(p, evk) * 0.97)} o estar en el top 12 nacional.` };
  }
  const list = S.world.rankings[evk] || [];
  const rank = list.findIndex((r: any) => r.id === p.id) + 1;
  const need = m.tier === 5 ? 24 : 48;
  const needPts = m.tier === 5 ? 1020 : 950;
  if ((rank > 0 && rank <= need) || pts >= needPts) return { ok: true, rounds };
  return { ok: false, reason: `Clasificación: top ${need} mundial (${rank ? "eres #" + rank : "sin ranking"}) o ${needPts} pts (tienes ${pts}).` };
};

G.relayQualified = (m: any) => {
  const out: any = {};
  for (const rk of RELAY_EVENTS) {
    const teams = countryTeamEstimates(rk);
    const myIdx = teams.findIndex((t: any) => t.country === S.player.country);
    const qualified = myIdx >= 0 && myIdx < 14;
    const lineup = resolveLineup(rk);
    const playerIn = lineup.some((a: any) => a && a.isPlayer);
    out[rk] = {
      ok: qualified, playerIn,
      reason: qualified ? "" : `Tu país no está entre los 14 mejores equipos de ${RELAYS[rk].label} (puesto #${myIdx + 1}).`,
    };
  }
  return out;
};

function countryTeamEstimates(rk: string): any[] {
  const codes = [...new Set(S.world.athletes.map((a: any) => a.country))];
  const ests = codes.map((c: string) => {
    const team = autoRelayTeam(c, rk);
    const legs = RELAYS[rk].legs;
    let t = 0;
    for (let i = 0; i < 4; i++) {
      const a = team[i];
      if (!a) return { country: c, t: Infinity };
      const evk = legs[i] === 100 ? "100" : legs[i] === 200 ? "200" : legs[i] === 300 ? "300" : "400";
      t += predictTime(a, evk) * (i === 0 ? 1 : 0.935);
    }
    return { country: c, t: t + 0.8 };
  });
  return ests.filter((e: any) => isFinite(e.t)).sort((a, b) => a.t - b.t);
}

function resolveLineup(rk: string): any[] {
  const saved = S.relay[rk].ids.map((id: string) => (id ? findAthById(id) : null));
  if (saved.every(Boolean) && new Set(saved.map((a: any) => a.id)).size === 4) return saved;
  const auto = autoRelayTeam(S.player.country, rk, S.relay[rk].ids.includes(S.player.id) ? S.player.id : undefined);
  return auto;
}
function findAthById(id: string): any {
  if (S.player.id === id) return S.player;
  return S.world.athletes.find((a: any) => a.id === id) || null;
}

G.openMeet = () => {
  const m = S.calendar.find((x: any) => x.week === S.week && !x.done);
  if (!m || S.day !== 6) return;
  go("meetEntry", { meet: m, picked: [], pickedR: [] });
};

G.meetPick = (evk: string) => {
  const p = S.params;
  p.picked = p.picked || [];
  if (p.picked.includes(evk)) p.picked = p.picked.filter((e: string) => e !== evk);
  else if (p.picked.length < 2) p.picked.push(evk);
  else toast("Máximo 2 pruebas individuales por meeting.", "r");
  refresh();
};
G.meetPickR = (rk: string) => {
  const p = S.params;
  p.pickedR = p.pickedR || [];
  if (p.pickedR.includes(rk)) p.pickedR = p.pickedR.filter((e: string) => e !== rk);
  else p.pickedR.push(rk);
  refresh();
};

G.meetSkip = () => {
  const m = S.params.meet;
  simulateMeetWithoutPlayer(m);
  go("dashboard");
  toast("Meeting simulado sin tu participación.", "");
};

/* ---------- meet orchestration ---------- */
G.startMeet = async () => {
  if (S.flags.meetRunning) return;
  S.flags.meetRunning = true;
  const m = S.params.meet;
  const picked = [...(S.params.picked || []), ...(S.params.pickedR || [])];
  if (!picked.length) { S.flags.meetRunning = false; return; }
  S.flags.racedToday = true;
  save(true);
  const resultsView: any[] = [];
  const p = S.player;
  const injuredBefore = p.injury ? { ...p.injury } : null;

  for (const evk of picked) {
    if (RELAY_EVENTS.includes(evk)) { await playRelay(m, evk, resultsView); continue; }
    await playEvent(m, evk, resultsView);
  }

  // competing injured worsens it
  if (injuredBefore && p.injury) {
    p.injury.daysLeft += 3;
    const inj = INJURIES.find((i: any) => i.id === p.injury.type);
    const idx = INJURIES.indexOf(inj);
    if (idx < INJURIES.length - 1 && Math.random() < 0.35) {
      p.injury = { type: INJURIES[idx + 1].id, daysLeft: INJURIES[idx + 1].days };
      notify(`Competir lesionado ha empeorado tu lesión: ${INJURIES[idx + 1].n}.`, "r");
    } else notify("Competir lesionado te ha pasado factura (+3 días).", "r");
  }

  m.done = true;
  m.result = resultsView.map((r: any) => ({ evk: r.evk, t: r.playerT, place: r.playerPlace }));
  refreshRankings();
  updateBestRanks();
  S.flags.meetRunning = false;
  S.params = { results: resultsView.map((r: any) => r.view), meetName: m.name };
  save();
  go("meetResults", S.params);
};

async function playEvent(m: any, evk: string, resultsView: any[]) {
  const p = S.player;
  const tier = m.tier;
  const rounds = planRounds(evk, tier);
  let entrants = meetEntrants(m, evk, rounds.total);
  let finalRes: any[] = [];
  let viewRows: any[] = [];
  let playerOut = false;

  for (let ri2 = 0; ri2 < rounds.list.length; ri2++) {
    const rd = rounds.list[ri2];
    if (playerOut) { // simulate remaining rounds without player
      const sim = simulateField(entrants.filter((a: any) => a.id !== p.id), evk, tier, rd.effort * 0.98, rd.effort);
      entrants = sim.slice(0, rd.qual).map((s: any) => findAthById(s.id)).filter(Boolean);
      continue;
    }
    if (rd.heats > 1) {
      // split into heats
      const heats = distributeHeats(entrants, rd.heats);
      const qualifiers: any[] = [];
      const timesAll: any[] = [];
      for (let h = 0; h < heats.length; h++) {
        if (heats[h].some((a: any) => a.id === p.id)) {
          const eff = await askEffort(rd.name);
          const res = await G.runRace({
            evk, racers: heats[h].map((a: any) => ({ a, isPlayer: a.id === p.id })),
            importance: tier, roundName: `${rd.name} · Serie ${h + 1}`, meetName: m.name,
            planMul: rd.effort, playerMul: eff,
          });
          for (const r of res) { applyResult(findAthById(r.id), evk, r.dq ? Infinity : r.t, r.place, null); if (!r.dq) timesAll.push(r); }
          const q = res.filter((r: any) => !r.dq);
          qualifiers.push(...q.slice(0, rd.topN));
          timesAll.push(...q.slice(rd.topN).map((r: any) => ({ ...r, heat: true })));
        } else {
          const sim = simulateField(heats[h], evk, tier, rd.effort * 0.97, Math.min(1, rd.effort + 0.01));
          for (const s of sim) { const a = findAthById(s.id); if (a && !s.dq) { applyResult(a, evk, s.t, 0, null); bumpRankPts(a, evk, s.t, 9, tier); } }
          qualifiers.push(...sim.filter((s: any) => !s.dq).slice(0, rd.topN).map((s: any) => ({ ...s })));
          timesAll.push(...sim.filter((s: any) => !s.dq).slice(rd.topN).map((s: any) => ({ ...s, heat: true })));
        }
      }
      // fastest losers
      const loserSlots = rd.qual - qualifiers.length;
      const losers = timesAll.filter((t: any) => t.heat).sort((a: any, b: any) => a.t - b.t).slice(0, Math.max(0, loserSlots));
      entrants = [...qualifiers, ...losers].sort((a: any, b: any) => a.t - b.t).map((r: any) => findAthById(r.id)).filter((a: any, i: number, arr: any[]) => a && arr.indexOf(a) === i);
      const pIn = entrants.some((a: any) => a.id === p.id);
      if (!pIn) {
        playerOut = true;
        const myRes = timesAll.find((t: any) => t.id === p.id);
        toast(myRes && myRes.dq ? "Descalificado en series." : "Eliminado en " + rd.name.toLowerCase() + ".", "r");
        snd("bad");
        viewRows = buildRows(timesAll.sort((a: any, b: any) => a.t - b.t), p, evk);
        finalRes = timesAll;
      } else {
        await showRoundSummary(`${rd.name} — Clasificados`, entrants.map((a: any) => `${a.first} ${a.last} (${a.country})`), p);
      }
    } else {
      // single race (semi or final or direct final)
      const isFinal = ri2 === rounds.list.length - 1;
      const eff = isFinal ? 1 : await askEffort(rd.name);
      const res = await G.runRace({
        evk, racers: entrants.slice(0, rd.size).map((a: any) => ({ a, isPlayer: a.id === p.id })),
        importance: tier, roundName: rd.name, meetName: m.name,
        planMul: isFinal ? 1 : rd.effort, playerMul: eff,
      });
      for (const r of res) { const a = findAthById(r.id); if (a && !r.dq && !a.isPlayer) { applyResult(a, evk, r.t, r.place, isFinal ? m : null); bumpRankPts(a, evk, r.t, r.place, tier); } }
      if (isFinal) { finalRes = res; viewRows = buildRows(res, p, evk); }
      else {
        const q = res.filter((r: any) => !r.dq).sort((a: any, b: any) => a.t - b.t).slice(0, rd.qual);
        entrants = q.map((r: any) => findAthById(r.id)).filter(Boolean);
        if (!entrants.some((a: any) => a.id === p.id)) {
          playerOut = true;
          toast("Eliminado en semifinales.", "r"); snd("bad");
          viewRows = buildRows(res, p, evk);
          finalRes = res;
        } else await showRoundSummary(`${rd.name} — Clasificados`, entrants.map((a: any) => `${a.first} ${a.last} (${a.country})`), p);
      }
    }
    // fatigue between rounds (racing costs energy)
    if (!playerOut) p.fatigue = clamp(p.fatigue + 9 + EV[evk].d / 150 - p.attrs.rec * 0.18, 0, 100);
  }

  // ---- apply player final outcome ----
  const my = finalRes.find((r: any) => r.id === p.id);
  const place = my && !my.dq ? finalRes.filter((r: any) => !r.dq && r.t <= my.t).length : finalRes.length;
  await applyPlayerOutcome(m, evk, my ? my.t : null, my ? my.dq : true, place, resultsView, viewRows, rounds.list[rounds.list.length - 1].name);
}

function buildRows(res: any[], p: any, evk: string): any[] {
  return res.filter((r: any) => !r.dq).sort((a: any, b: any) => a.t - b.t).map((r: any, i: number) => {
    const a = findAthById(r.id);
    return { place: i + 1, name: `${a.first} ${a.last}`, country: a.country, t: r.t, me: a.isPlayer, pb: a.pb[evk] === r.t, wr: false, nr: false, dq: r.dq };
  });
}

async function applyPlayerOutcome(m: any, evk: string, t: number | null, dq: boolean, place: number, resultsView: any[], viewRows: any[], roundName: string) {
  const p = S.player;
  const prevPb = p.pb[evk];
  let flags: any = {};
  if (t != null && !dq) {
    const before = { pb: prevPb };
    flags = applyResult(p, evk, t, place, m);
    bumpRankPts(p, evk, t, place, m.tier);
  }
  // medals / prizes / fame / titles
  const prize = (!dq && place <= 8) ? (PRIZES[m.tier][place - 1] || 0) : 0;
  S.career.money += prize;
  const se = curSeason();
  if (se) { se.money += prize; se.races.push({ evk, t: dq ? null : t, place: dq ? "DQ" : place, meet: m.name, pb: flags.pb }); if (!dq && place === 1) se.wins++; if (!dq && place <= 3 && m.tier >= 2) se.medals++; if (m.tier >= 3 && (!se.bestMeet || m.tier > se.bestMeetScore || (m.tier === se.bestMeetScore && place < se.bestPlace))) { se.bestMeet = m.name; se.bestMeetScore = m.tier; se.bestPlace = place; } }
  if (!dq && place === 1) { S.career.totalWins++; p.wins++; checkAch("first_win"); }
  if (!dq && place <= 3 && m.tier >= 2) {
    const k = place === 1 ? "g" : place === 2 ? "s" : "b";
    S.career.medals[k]++;
    (m.tier >= 4 ? S.career.intlMedals : S.career.natMedals)[k]++;
    checkAch("first_medal");
  }
  if (!dq && place === 1 && m.tier === 3) { S.career.titles.push(`Nacional ${EV[evk].label} ${S.year}`); checkAch("nat_champ"); news(`${p.first} ${p.last} se proclama CAMPEÓN NACIONAL de ${EV[evk].label}.`); }
  if (!dq && place === 1 && m.tier === 5) {
    if (m.olympic) { S.career.titles.push(`ORO Olímpico ${EV[evk].label} ${S.year}`); checkAch("olympic"); news(`¡${p.first} ${p.last}, CAMPEÓN OLÍMPICO de ${EV[evk].label}!`); }
    else { S.career.titles.push(`Campeón Mundial ${EV[evk].label} ${S.year}`); checkAch("world_champ"); news(`¡${p.first} ${p.last}, CAMPEÓN DEL MUNDO de ${EV[evk].label}!`); }
  }
  if (!dq && place === 1 && m.tier === 4 && m.baseName === "Campeonato Continental") S.career.titles.push(`Continental ${EV[evk].label} ${S.year}`);
  S.career.fame += m.tier * m.tier * Math.max(0, (9 - place)) * 0.6 + (flags.pb ? 2 : 0);

  if (flags.pb) { checkAch("first_pb"); checkBarriers(evk, t); }
  if (flags.wr) { S.career.recordsBroken.push({ scope: "world", evk, t, y: S.year }); checkAch("first_record"); news(`¡${p.first} ${p.last} bate el RÉCORD MUNDIAL de ${EV[evk].label}: ${fmtTime(t)}!`); }
  if (flags.nr) { S.career.recordsBroken.push({ scope: "national", evk, t, y: S.year }); checkAch("first_record"); news(`${p.first} ${p.last}, nuevo récord nacional de ${EV[evk].label} (${fmtTime(t)}).`); }
  if (flags.cr) { S.career.recordsBroken.push({ scope: "champs", evk, t, y: S.year }); checkAch("first_record"); }

  // mark rows for display
  for (const row of viewRows) {
    if (row.me) { row.pb = !!flags.pb; row.wr = !!flags.wr; row.nr = !!flags.nr; }
  }
  resultsView.push({ evk, label: EV[evk].label, roundName, playerT: t, playerPlace: dq ? "DQ" : place, view: { label: EV[evk].label, roundName, rows: viewRows } });

  // celebrations sequence
  if (flags.wr) await showRecord("world", evk, t, `${p.first} ${p.last}`);
  else if (flags.nr) await showRecord("national", evk, t, `${p.first} ${p.last}`);
  else if (flags.cr) await showRecord("champs", evk, t, `${p.first} ${p.last}`);
  if (flags.pb) await showPB(evk, t, flags.prevPb ?? null);
  if (!dq && place <= 3 && m.tier >= 2) toast(`Medalla de ${["ORO", "PLATA", "BRONCE"][place - 1]} · +${fmtMoney(prize)}`, place === 1 ? "g" : "b");
  else if (prize > 0) toast(`Premio: +${fmtMoney(prize)}`, "n");
  if (!dq) { p.form = clamp(p.form + (place <= 3 ? 4 : place <= 6 ? 1.5 : -1), 20, 96); }
  p.fatigue = clamp(p.fatigue + 12 + EV[evk].d / 120, 0, 100);
  // rivalries
  for (const r of (viewRows || [])) {
    if (r.me || r.place > 5) continue;
    const a = S.world.athletes.find((x: any) => x.first + " " + x.last === r.name);
    if (!a) continue;
    const rs = S.career.rivalStats[a.id] || (S.career.rivalStats[a.id] = { races: 0, w: 0, l: 0, pbP: Infinity, pbA: Infinity, name: r.name });
    rs.races++;
    if (!dq && place < r.place) rs.w++; else rs.l++;
    if (t != null) rs.pbP = Math.min(rs.pbP, t);
    rs.pbA = Math.min(rs.pbA, r.t);
    if (rs.races === 4) { news(`Nace una rivalidad: ${p.first} ${p.last} vs ${a.first} ${a.last}.`); notify(`Rivalidad con ${a.first} ${a.last}: ${rs.w}-${rs.l} en ${rs.races} carreras.`, "b"); }
  }
  save(true);
}

G.mainRival = () => {
  const entries = Object.entries(S.career.rivalStats).filter(([_, v]: any) => v.races >= 3);
  if (!entries.length) return null;
  entries.sort((a: any, b: any) => b[1].races - a[1].races);
  const [id, v]: any = entries[0];
  const a = findAthById(id);
  return a ? { a, ...v, pbP: isFinite(v.pbP) ? v.pbP : null, pbA: isFinite(v.pbA) ? v.pbA : null } : null;
};

/* ---------- relays ---------- */
async function playRelay(m: any, rk: string, resultsView: any[]) {
  const p = S.player;
  const lineup = resolveLineup(rk);
  const playerLeg = lineup.findIndex((a: any) => a && a.isPlayer);
  const teamEsts = countryTeamEstimates(rk).slice(0, 9);
  if (!teamEsts.some((t: any) => t.country === p.country)) {
    const legs = RELAYS[rk].legs;
    let t = 0;
    for (let i = 0; i < 4; i++) { const evk = String(legs[i]) === "300" ? "300" : String(legs[i]); t += predictTime(lineup[i], evk) * (i === 0 ? 1 : 0.935); }
    teamEsts.push({ country: p.country, t: t + 0.8 });
    teamEsts.sort((a, b) => a.t - b.t);
  }
  let finalists = teamEsts.slice(0, 8);
  if (!finalists.some((t: any) => t.country === p.country) && teamEsts.length >= 8) {
    const my = teamEsts.find((t: any) => t.country === p.country);
    if (my) finalists = [...teamEsts.slice(0, 7), my];
  }
  const teams = finalists.map((te: any) => {
    const isMe = te.country === p.country;
    return {
      country: te.country, name: COUNTRIES.find((c: any) => c.c === te.country)?.n || te.country,
      runners: isMe ? lineup : autoRelayTeam(te.country, rk),
      style: isMe ? S.relay[rk].style : pick(["conservador", "normal", "normal", "agresivo"]),
      isPlayer: isMe, playerLeg: isMe ? playerLeg : -1,
    };
  });
  const res = await G.runRelay({ relayKey: rk, teams, meetName: m.name, importance: m.tier });
  const my = res.find((r: any) => r.isPlayer);
  const place = my ? my.place : res.length;
  const prize = place <= 8 ? Math.round((PRIZES[m.tier][place - 1] || 0) / 2) : 0;
  S.career.money += prize;
  const se = curSeason();
  if (se) { se.money += prize; se.races.push({ evk: rk, t: my && !my.dq ? my.t : null, place: my?.dq ? "DQ" : place, meet: m.name + " (relevos)", pb: false }); if (place === 1) se.wins++; if (place <= 3) se.medals++; }
  if (place === 1) { S.career.totalWins++; checkAch("first_win"); }
  if (place <= 3) {
    const k = place === 1 ? "g" : place === 2 ? "s" : "b";
    S.career.medals[k]++;
    (m.tier >= 4 ? S.career.intlMedals : S.career.natMedals)[k]++;
    checkAch("first_medal");
  }
  if (place === 1 && m.tier >= 4) { checkAch("relay_gold"); S.career.titles.push(`${RELAYS[rk].label} ${m.olympic ? "Olímpico" : m.tier === 5 ? "Mundial" : "Continental"} ${S.year}`); news(`${COUNTRIES.find((c: any) => c.c === p.country)?.n} gana el ${RELAYS[rk].label} en ${m.name}.`); }
  if (place === 1 && m.tier === 5) checkAch(m.olympic ? "olympic" : "world_champ");
  S.career.fame += m.tier * (9 - Math.min(place, 8)) * 0.5;
  if (my) p.fatigue = clamp(p.fatigue + 14, 0, 100);
  resultsView.push({
    evk: rk, label: RELAYS[rk].label, roundName: "Final", playerT: my?.t, playerPlace: my?.dq ? "DQ" : place,
    view: {
      label: RELAYS[rk].label, roundName: "Final por equipos",
      rows: res.map((r: any) => ({ place: r.place, name: r.name, country: r.country, t: r.t, me: r.isPlayer, pb: false, wr: false, nr: false, dq: r.dq })),
    },
  });
  if (place <= 3) toast(`Relevos: ${["ORO", "PLATA", "BRONCE"][place - 1]} · +${fmtMoney(prize)}`, "g");
  save(true);
}

/* ---------- rounds planning ---------- */
function planRounds(evk: string, tier: number): any {
  const g = EV[evk].g;
  if (tier <= 2) return { total: 8, list: [{ name: "Final", heats: 1, size: 8, qual: 8, topN: 8, effort: 1 }] };
  if (tier === 3) {
    if (g === "mid" && evk !== "800") return { total: 10, list: [{ name: "Final", heats: 1, size: 10, qual: 10, topN: 10, effort: 1 }] };
    return { total: 16, list: [
      { name: "Series", heats: 2, qual: 8, topN: 3, effort: 0.955 },
      { name: "Final", heats: 1, size: 8, qual: 8, topN: 8, effort: 1 },
    ]};
  }
  // tier 4-5
  if (g === "mid" && evk !== "800") return { total: 20, list: [
    { name: "Series", heats: 2, qual: 10, topN: 4, effort: 0.955 },
    { name: "Final", heats: 1, size: 10, qual: 10, topN: 10, effort: 1 },
  ]};
  return { total: 24, list: [
    { name: "Series", heats: 3, qual: 12, topN: 2, effort: 0.95 },
    { name: "Semifinal", heats: 2, qual: 8, topN: 3, effort: 0.98 },
    { name: "Final", heats: 1, size: 8, qual: 8, topN: 8, effort: 1 },
  ]};
}

function distributeHeats(athletes: any[], n: number): any[][] {
  const seeded = [...athletes];
  // snake draft for balanced heats
  const heats: any[][] = Array.from({ length: n }, () => []);
  let dir = 1, idx = 0;
  for (const a of seeded) {
    heats[idx].push(a);
    idx += dir;
    if (idx === n) { idx = n - 1; dir = -1; }
    else if (idx < 0) { idx = 0; dir = 1; }
  }
  return heats;
}

function meetEntrants(m: any, evk: string, count: number): any[] {
  const p = S.player;
  let pool: any[];
  if (m.tier === 3) pool = countryPool(p.country, evk).slice(0, count - 1);
  else if (m.tier >= 4) pool = pickEntrantsByRank(evk, count - 1, 3);
  else {
    const pt = predictTime(p, evk);
    pool = S.world.athletes
      .filter((a: any) => !a.injury && perfScore(a, evk) > 25)
      .map((a: any) => ({ a, d: Math.abs(predictTime(a, evk) - pt) }))
      .sort((x, y) => x.d - y.d)
      .slice(ri(0, 6), count + 6)
      .map((x: any) => x.a);
  }
  const out = [p, ...pool.filter((a: any) => a.id !== p.id)].slice(0, count);
  while (out.length < Math.min(8, count)) out.push(genRookie(false));
  return out;
}

/* ---------- simulate meet without player ---------- */
function simulateMeetWithoutPlayer(m: any) {
  m.done = true;
  m.result = [];
  for (const evk of m.events) {
    let entrants: any[];
    if (m.tier === 3) entrants = countryPool(S.player.country, evk).slice(0, 10);
    else if (m.tier >= 4) entrants = pickEntrantsByRank(evk, m.tier === 5 ? 12 : 10, 3);
    else entrants = pickEntrantsByRank(evk, 8, 5);
    const res = simulateField(entrants, evk, m.tier, 0.985, 1);
    for (let i = 0; i < res.length; i++) {
      const a = findAthById(res[i].id);
      if (!a || res[i].dq) continue;
      const flags = applyResult(a, evk, res[i].t, i + 1, m);
      bumpRankPts(a, evk, res[i].t, i + 1, m.tier);
      if (flags.wr) news(`¡${a.first} ${a.last} bate el RÉCORD MUNDIAL de ${EV[evk].label} con ${fmtTime(res[i].t)} en ${m.name}!`);
      else if (flags.nr && a.country === S.player.country) news(`${a.first} ${a.last} bate tu récord nacional de ${EV[evk].label}.`);
    }
    const w = res.find((r: any) => !r.dq);
    if (w && m.tier >= 3) {
      const a = findAthById(w.id);
      if (a) news(`${a.first} ${a.last} (${a.country}) gana ${EV[evk].label} en ${m.name} — ${fmtTime(w.t)}.`);
    }
  }
  refreshRankings();
  save(true);
}

/* ---------- overlays ---------- */
function askEffort(roundName: string): Promise<number> {
  return new Promise((res) => {
    const ov = document.getElementById("ovroot")!;
    ov.innerHTML = `<div class="ov"><div class="ov-box panel">
      <div class="panel-title b">${roundName}</div>
      <p class="mb14">¿Cuánto quieres gastar en esta ronda? Guarda energía para la final: la fatiga se acumula.</p>
      <div class="btnrow">
        <button class="btn primary" id="ef1">A TOPE<small style="display:block;font-size:10px;letter-spacing:1px">100%</small></button>
        <button class="btn" id="ef2">NORMAL<small style="display:block;font-size:10px;letter-spacing:1px">controlado</small></button>
        <button class="btn ghost" id="ef3">DOSIFICAR<small style="display:block;font-size:10px;letter-spacing:1px">pasar por puesto</small></button>
      </div></div></div>`;
    const done = (v: number) => { ov.innerHTML = ""; snd("click"); res(v); };
    (ov.querySelector("#ef1") as HTMLElement).onclick = () => done(1);
    (ov.querySelector("#ef2") as HTMLElement).onclick = () => done(0.975);
    (ov.querySelector("#ef3") as HTMLElement).onclick = () => done(0.95);
  });
}
function showRoundSummary(title: string, names: string[], p: any): Promise<void> {
  return new Promise((res) => {
    const ov = document.getElementById("ovroot")!;
    ov.innerHTML = `<div class="ov"><div class="ov-box panel">
      <div class="panel-title g">${title}</div>
      <div class="mb14">${names.map((n: string, i: number) => `<div class="kv"><span class="num">${i + 1}. ${n}</span>${n.includes(p.last) ? '<span class="chip me">TÚ</span>' : ""}</div>`).join("")}</div>
      <div class="dim small mb14">La fatiga se acumula entre rondas. Tu recuperación ayuda a llegar vivo a la final.</div>
      <button class="btn primary wide" id="rs-ok">SIGUIENTE RONDA ▸</button></div></div>`;
    (ov.querySelector("#rs-ok") as HTMLElement).onclick = () => { ov.innerHTML = ""; snd("click"); res(); };
  });
}

/* ================= SEASONS ================= */
G.seasonFinish = () => {
  // simulate any remaining meets
  for (const m of S.calendar) if (!m.done) simulateMeetWithoutPlayer(m);
  const p = S.player;
  const se = curSeason();
  const diffs: any = {};
  const start = S.flags.seasonStartAttrs || {};
  for (const k in p.attrs) {
    const d = p.attrs[k] - (start[k] || p.attrs[k]);
    if (Math.abs(d) >= 0.05) diffs[k] = d;
  }
  // sponsor income for remaining weeks
  const inc = S.career.sponsors.reduce((s: number, sp: any) => s + sp.week, 0) * Math.max(0, S.seasonLen - S.week + 1);
  S.career.money += inc; se.money += inc;
  S.params.summary = {
    year: S.year, age: p.age, wins: se.wins, medals: se.medals, bestRank: se.bestRank,
    bestMeet: se.bestMeet, money: se.money, diffs,
  };
  go("seasonEnd", S.params);
};

G.nextSeason = () => {
  const p = S.player;
  S.year++;
  S.week = 1; S.day = 0;
  p.age++;
  p.sb = {}; p.rankPts = {};
  p.fatigue = 12; p.form = clamp(55 + rnd(-5, 5), 30, 80);
  p.injury = null;
  if (p.age >= 31) {
    const dec = 1 - Math.min(0.07, (p.age - 30) * 0.014) * (1.2 - p.attrs.rec / 130);
    for (const k of ["spd", "acc", "pow", "ana", "str"]) p.attrs[k] = clamp(p.attrs[k] * dec, 20, 99);
    notify("El paso de los años empieza a notarse: cuida tu recuperación.", "");
  } else if (p.age <= 20) notify("Sigues en pleno desarrollo: cada temporada cuenta.", "n");
  S.career.history.push(seasonEntry());
  S.flags.seasonStartAttrs = { ...p.attrs };
  S.flags.racedToday = false;
  genCalendar();
  seasonRolloverAI();
  refreshRankings();
  // club offers
  const bestR = Math.min(...Object.values(S.career.bestRank).map(Number).concat([999]));
  S.career.clubOffers = [];
  if (bestR <= 50 && S.career.club.level < 2) S.career.clubOffers.push(CLUBS[1]);
  if (bestR <= 12 && S.career.club.level < 3) S.career.clubOffers = [CLUBS[2]];
  if (S.career.clubOffers.length) notify(`${S.career.clubOffers[0].name} te ofrece unirte a su club.`, "g");
  sponsorCheck(true);
  save();
  go("dashboard");
  toast(`Temporada ${S.year}: ${p.age} años. Nuevos rivales, nuevos objetivos.`, "b");
  coachTip(true);
};

/* ================= SPONSORS / CLUB ================= */
function sponsorCheck(force = false) {
  const c = S.career;
  for (const sp of SPONSORS) {
    if (c.fame >= sp.fame && !c.sponsors.some((s: any) => s.name === sp.name) && !c.sponsorOffers.some((s: any) => s.name === sp.name)) {
      if (force || Math.random() < 0.35) {
        c.sponsorOffers.push({ ...sp });
        notify(`Oferta de patrocinio: ${sp.name} (${fmtMoney(sp.week)}/semana).`, "g");
        snd("coin");
      }
    }
  }
}
G.sponsorAccept = (i: number) => {
  const sp = S.career.sponsorOffers.splice(i, 1)[0];
  if (!sp) return;
  if (S.career.sponsors.length >= 2) { toast("Máximo 2 patrocinadores activos.", "r"); S.career.sponsorOffers.splice(i, 0, sp); return; }
  S.career.sponsors.push(sp);
  toast(`Contrato firmado con ${sp.name}: +${fmtMoney(sp.week)}/sem`, "g");
  snd("coin");
  save(); refresh();
};
G.clubAccept = (i: number) => {
  const c = S.career.clubOffers.splice(i, 1)[0];
  if (!c) return;
  S.career.club = { name: c.name, level: c.level };
  toast(`Bienvenido a ${c.name} (bono +${Math.round(c.bonus * 100)}% entreno)`, "g");
  save(); refresh();
};

/* ================= RETIRE ================= */
G.retireAsk = async () => {
  const ok = await confirmOv("¿RETIRADA?", "Tu carrera terminará y entrarás en el Salón de la Fama con tu Legend Score. ¿Seguro?", true);
  if (ok) go("retire");
};
G.retireConfirm = () => {
  const p = S.player;
  const score = legendScore(S.career, p);
  if (score >= 90) checkAch("legend");
  const hof = loadHOF();
  hof.push({ name: `${p.first} ${p.last}`, country: COUNTRIES.find((c: any) => c.c === p.country)?.n || p.country, spec: EV[p.spec].label, years: S.career.history.length, score });
  saveHOF(hof);
  news(`Se retira ${p.first} ${p.last}: Legend Score ${score}/100.`);
  clearSave();
  S.careerActive = false;
  S.player = null; S.world = null; S.calendar = [];
  go("menu");
  toast(`Legend Score: ${score}/100. Tu nombre ya está en la historia.`, "g");
};

/* ================= ACHIEVEMENTS ================= */
function checkAch(id: string) {
  if (S.career.achievements.includes(id)) return;
  const a = ACHIEVEMENTS.find((x: any) => x.id === id);
  if (!a) return;
  S.career.achievements.push(id);
  notify(`LOGRO DESBLOQUEADO: ${a.n}`, "g");
  snd("ach");
}
function checkBarriers(evk: string, t: number) {
  const ok = (evk === "100" && t < 10) || (evk === "400" && t < 44.5) || (evk === "800" && t < 104) || (evk === "1500" && t < 210) || (evk === "200" && t < 20);
  if (ok) { checkAch("barrier"); news(`${S.player.first} ${S.player.last} rompe una barrera mítica: ${EV[evk].label} en ${fmtTime(t)}.`); }
}

/* ================= COACH ================= */
function coachTip(force = false) {
  const p = S.player;
  const nm = S.calendar.find((m: any) => !m.done && m.week >= S.week);
  const d = nm ? (nm.week - S.week) * 7 + (6 - S.day) : 99;
  let tip = "Equilibra carga y descanso. La constancia gana al talento sin disciplina.";
  if (p.injury) tip = `Lesión: ${INJURIES.find((i: any) => i.id === p.injury.type)?.n}. Recuperación ligera y paciencia — competir ahora la empeoraría.`;
  else if (p.fatigue > 72) tip = "Estás acumulando demasiada fatiga. Descansa o la lesión llegará sola.";
  else if (d <= 3 && p.fatigue > 45) tip = "Conviene descansar antes del campeonato: llegas justo de fuerzas.";
  else if (d <= 3) tip = `Competición en ${d} día${d === 1 ? "" : "s"}. Mantén la activación sin cargar: técnica o recuperación.`;
  else if (S.flags.hotGain) { tip = S.flags.hotGain + " Tu cuerpo responde: sigue esta línea."; S.flags.hotGain = null; }
  else if (p.form > 75) tip = "Estás en un gran momento de forma. Aprovecha para competir o subir la carga.";
  else if (p.form < 40) tip = "Tu forma es baja: encadena días suaves y sueño para reconstruirla.";
  else if (S.career.fame > 100 && S.career.sponsors.length === 0) tip = "Tu fama crece. Revisa las ofertas de patrocinio en el panel.";
  else if (nm && nm.tier >= 4 && d < 21) tip = `${nm.name} se acerca (nivel ${TIERS[nm.tier].n}). Planifica el pico de forma: llegar al 100% de energía lo cambia todo.`;
  S.flags.coachTip = tip;
}

/* ================= ACTIONS DISPATCH ================= */
function wireActions() {
  G.act = (act: string, el: HTMLElement) => {
    const d = el.dataset;
    switch (act) {
      case "menu-new": { const ok = !hasSave(); (ok ? Promise.resolve(true) : confirmOv("NUEVA CARRERA", "Ya existe una partida guardada. Empezar de nuevo la borrará. ¿Continuar?", true)).then((v: boolean) => { if (v) { clearSave(); go("create"); } }); break; }
      case "menu-continue": if (load()) { go("dashboard"); toast(`Bienvenido de nuevo, ${S.player.first}.`, "b"); } break;
      case "menu-records": if (!S.world) { bootTempWorld(); } go("records"); break;
      case "menu-hof": go("hof"); break;
      case "menu-settings": go("settings"); break;
      case "back-dash": go(S.careerActive ? "dashboard" : "menu"); break;

      case "create-spec": {
        document.querySelectorAll('[data-act="create-spec"]').forEach((b: any) => b.classList.toggle("on", b === el));
        G.createDraft.spec = d.id;
        const sp = SPECS.find((s: any) => s.id === d.id);
        const sel2 = document.querySelector("#cr-spec2") as HTMLSelectElement;
        if (sel2 && sp) sel2.value = sp.ev2;
        const el2 = document.querySelector("#prev-spec");
        if (el2 && sp) el2.textContent = `${sp.n} · ${sp.desc}`;
        break;
      }
      case "create-skin": case "create-hair": case "create-jersey": {
        const key = act.split("-")[1];
        el.parentElement!.querySelectorAll(".sw").forEach((s: any) => s.classList.toggle("on", s === el));
        G.createDraft[key] = d.c;
        const prev = document.querySelector("#preview");
        if (prev) prev.innerHTML = require_avatar(G.createDraft) + document.querySelector("#prev-name")!.outerHTML + document.querySelector("#prev-spec")!.outerHTML;
        break;
      }
      case "create-start": {
        const first = (document.querySelector("#cr-first") as HTMLInputElement).value.trim() || "David";
        const last = (document.querySelector("#cr-last") as HTMLInputElement).value.trim() || "Ríos";
        const country = (document.querySelector("#cr-country") as HTMLSelectElement).value;
        const age = +(document.querySelector("#cr-age") as HTMLSelectElement).value;
        const spec2 = (document.querySelector("#cr-spec2") as HTMLSelectElement).value;
        startCareer(makePlayer({ ...G.createDraft, first, last, country, age, spec2 }));
        break;
      }

      case "nav-dash": go("dashboard"); break;
      case "nav-train": go("training"); break;
      case "nav-cal": go("calendar"); break;
      case "nav-athlete": go("athlete"); break;
      case "nav-rank": go("rankings", { evk: S.player?.spec }); break;
      case "nav-hist": go("history"); break;
      case "nav-relay": go("relays"); break;
      case "nav-ach": go("achievements"); break;
      case "nav-set": go("settings"); break;
      case "nav-records": go("records"); break;

      case "advance-day": G.advanceDay(); break;
      case "rest-day": G.rest(); toast("Día de descanso: la fatiga baja y la forma sube.", "n"); break;
      case "skip-meet": G.skipToMeet(); break;
      case "season-finish": G.seasonFinish(); break;
      case "season-next": G.nextSeason(); break;

      case "train-cat": go("training", { cat: d.cat }); break;
      case "train-do": G.trainDo(d.cat, d.id); break;

      case "open-meet": G.openMeet(); break;
      case "meet-pick": G.meetPick(d.ev); break;
      case "meet-pickr": G.meetPickR(d.ev); break;
      case "meet-start": G.startMeet(); break;
      case "meet-skip": G.meetSkip(); break;
      case "results-close": go("dashboard"); coachTip(); refresh(); break;

      case "rank-ev": go("rankings", { evk: d.ev, top: S.params.top || 10 }); break;
      case "rank-top": go("rankings", { evk: S.params.evk || S.player?.spec, top: +d.n }); break;

      case "relay-tab": go("relays", { team: d.team }); break;
      case "relay-auto": {
        const auto = autoRelayTeam(S.player.country, d.team);
        S.relay[d.team].ids = auto.map((a: any) => a.id);
        toast("Alineación automática seleccionada.", "n"); save(); refresh(); break;
      }
      case "relay-include": {
        const ids = S.relay[d.team].ids;
        if (!ids.includes(S.player.id)) {
          // replace weakest non-country slot
          const legs = RELAYS[d.team].legs;
          let worst = -1, worstV = -1;
          ids.forEach((id: string, i: number) => {
            const a = id ? findAthById(id) : null;
            if (!a) { worst = i; worstV = Infinity; return; }
            const evk = String(legs[i]);
            const v = predictTime(a, evk === "300" ? "300" : evk);
            if (v > worstV || worst === -1) { worstV = v; worst = i; }
          });
          if (worst === -1) worst = 3;
          ids[worst] = S.player.id;
          toast("Te has incluido en el equipo.", "n");
        } else toast("Ya estás en el equipo.", "");
        save(); refresh(); break;
      }
      case "relay-style": S.relay[d.team].style = d.style; save(); refresh(); break;

      case "sponsor-accept": G.sponsorAccept(+d.i); break;
      case "club-accept": G.clubAccept(+d.i); break;

      case "set-sound": S.settings.sound = !S.settings.sound; save(); refresh(); snd("click"); break;
      case "set-erase": confirmOv("BORRAR PARTIDA", "Se eliminará todo el progreso de esta carrera. ¿Seguro?", true).then((v: boolean) => { if (v) { clearSave(); S.careerActive = false; go("menu"); toast("Partida borrada.", "r"); } }); break;
      case "set-quit": save(); S.careerActive = S.careerActive; go("menu"); break;

      case "retire-ask": G.retireAsk(); break;
      case "retire-confirm": G.retireConfirm(); break;

      case "tut-next": showTutorial(+d.step); break;
      case "tut-skip": case "tut-done": { document.getElementById("ovroot")!.innerHTML = ""; S.flags.tutorial = 1; save(true); break; }
    }
  };

  G.chg = (act: string, el: HTMLElement) => {
    const d = el.dataset;
    if (act === "relay-slot") {
      S.relay[d.team].ids[+d.slot] = (el as HTMLSelectElement).value || null;
      save(true); refresh();
    }
    if (act === "set-speed") { S.settings.speed = +(el as HTMLSelectElement).value; save(); toast(`Velocidad base: ${S.settings.speed}×`, "n"); }
  };
}

/* avatar re-render helper (avoid importing ui → circular) */
import { avatar } from "./ui";
function require_avatar(d: any): string {
  return avatar({ skin: d.skin, hair: d.hair, jersey: d.jersey }, 130);
}

/* temp world so Records screen works from menu without a career */
function bootTempWorld() {
  if (S.world) return;
  const saved = S.player;
  genWorld();
  S.player = saved;
}
