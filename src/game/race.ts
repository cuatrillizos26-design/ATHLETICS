// @ts-nocheck
/* ============ RACES: canvas engine, tactics, relays ============ */
import { EV, RELAYS, JERSEYS, COUNTRIES } from "./data";
import { S, G, clamp, rnd, ri, pick, gauss } from "./store";
import { dayPlanTime, fmtTime, legEstimate, effScore } from "./model";
import { snd } from "./sound";

/* ---------------- tactic phases per event ---------------- */
const PHASES: any = {
  "60":   [ { f: 0, n: "SALIDA", opts: [{ id: "auto", n: "A FONDO", s: "automático", u: 1.0 }] },
             { f: 0.5, n: "FINAL", opts: [{ id: "m", n: "MANTENER", s: "sostén", u: 1.0 }, { id: "e", n: "EMPUJAR", s: "+ riesgo", u: 1.045 }] } ],
  "100":  [ { f: 0, n: "SALIDA", opts: [{ id: "auto", n: "A FONDO", s: "automático", u: 1.0 }] },
             { f: 0.55, n: "MANTENIMIENTO", opts: [{ id: "m", n: "MANTENER", s: "sostén", u: 1.0 }, { id: "e", n: "EMPUJAR", s: "+ riesgo", u: 1.05 }] } ],
  "200":  [ { f: 0, n: "SALIDA", opts: [{ id: "auto", n: "A FONDO", s: "automático", u: 1.0 }] },
             { f: 0.14, n: "CURVA", opts: [{ id: "r", n: "RELAJAR", s: "ahorra", u: 0.965 }, { id: "n", n: "NORMAL", s: "equilibrado", u: 1.0 }] },
             { f: 0.62, n: "RECTA FINAL", opts: [{ id: "m", n: "MANTENER", s: "sostén", u: 1.0 }, { id: "e", n: "EMPUJAR", s: "todo", u: 1.045 }] } ],
  "400":  [ { f: 0, n: "SALIDA", opts: [{ id: "f", n: "RÁPIDA", s: "+ ventaja", u: 1.03 }, { id: "n", n: "NORMAL", s: "equilibrado", u: 0.995 }, { id: "c", n: "CONSERVAR", s: "ahorra", u: 0.955 }] },
             { f: 0.28, n: "RITMO", opts: [{ id: "a", n: "APRETAR", s: "exige", u: 1.02 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.99 }, { id: "fl", n: "FLOTAR", s: "ahorra", u: 0.955 }] },
             { f: 0.6, n: "CURVA 2", opts: [{ id: "a", n: "ATACAR", s: "exige", u: 1.02 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.985 }, { id: "ag", n: "AGUANTAR", s: "ahorra", u: 0.95 }] },
             { f: 0.84, n: "RECTA FINAL", opts: [{ id: "s", n: "SPRINT", s: "vacíate", u: 1.05 }, { id: "r", n: "RESISTIR", s: "sobrevive", u: 0.97 }] } ],
  "800":  [ { f: 0, n: "SALIDA", opts: [{ id: "a", n: "AGRESIVO", s: "posición", u: 1.02 }, { id: "n", n: "NORMAL", s: "equilibrado", u: 0.985 }, { id: "c", n: "CONSERVAR", s: "ahorra", u: 0.945 }] },
             { f: 0.25, n: "200–400", opts: [{ id: "a", n: "ATACAR", s: "exige", u: 1.015 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.975 }] },
             { f: 0.5, n: "400–600", opts: [{ id: "a", n: "ATACAR", s: "exige", u: 1.015 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.975 }, { id: "e", n: "ESPERAR", s: "guarda", u: 0.94 }] },
             { f: 0.75, n: "ÚLTIMO 200", opts: [{ id: "s", n: "SPRINT", s: "vacíate", u: 1.06 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.99 }] } ],
  "1500": [ { f: 0, n: "SALIDA", opts: [{ id: "l", n: "LIDERAR", s: "delante", u: 1.01 }, { id: "s", n: "SEGUIR", s: "a rueda", u: 0.985 }, { id: "a", n: "ATRÁS", s: "guarda", u: 0.955 }] },
             { f: 0.28, n: "MEDIO", opts: [{ id: "a", n: "ATACAR", s: "exige", u: 1.02 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.98 }, { id: "e", n: "ESPERAR", s: "guarda", u: 0.95 }] },
             { f: 0.58, n: "DECISIÓN", opts: [{ id: "a", n: "ATACAR", s: "exige", u: 1.03 }, { id: "c", n: "CUBRIR", s: "responde", u: 1.0 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.985 }] },
             { f: 0.82, n: "FINAL", opts: [{ id: "s", n: "SPRINT", s: "todo", u: 1.07 }, { id: "m", n: "MANTENER", s: "sostén", u: 1.0 }] } ],
  "3000": [ { f: 0, n: "RITMO", opts: [{ id: "a", n: "ALTO", s: "exige", u: 1.005 }, { id: "n", n: "NORMAL", s: "sostén", u: 0.98 }, { id: "g", n: "GUARDAR", s: "ahorra", u: 0.955 }] },
             { f: 0.33, n: "MEDIO", opts: [{ id: "a", n: "ATACAR", s: "exige", u: 1.02 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.985 }] },
             { f: 0.66, n: "DECISIÓN", opts: [{ id: "a", n: "ATACAR", s: "exige", u: 1.025 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.99 }, { id: "e", n: "ESPERAR", s: "guarda", u: 0.96 }] },
             { f: 0.86, n: "FINAL", opts: [{ id: "s", n: "SPRINT", s: "todo", u: 1.06 }, { id: "m", n: "MANTENER", s: "sostén", u: 1.0 }] } ],
  "110H": [ { f: 0, n: "SALIDA", opts: [{ id: "auto", n: "A FONDO", s: "automático", u: 1.0 }] },
             { f: 0.3, n: "RITMO VALLAS", opts: [{ id: "f", n: "FORZAR", s: "exige", u: 1.03 }, { id: "r", n: "RITMO", s: "sostén", u: 1.0 }] },
             { f: 0.78, n: "FINAL", opts: [{ id: "e", n: "EMPUJAR", s: "todo", u: 1.03 }, { id: "m", n: "MANTENER", s: "sostén", u: 1.0 }] } ],
  "400H": [ { f: 0, n: "SALIDA", opts: [{ id: "f", n: "RÁPIDA", s: "+ ventaja", u: 1.02 }, { id: "n", n: "NORMAL", s: "equilibrado", u: 0.985 }, { id: "s", n: "SUAVE", s: "ahorra", u: 0.95 }] },
             { f: 0.3, n: "RITMO", opts: [{ id: "a", n: "APRETAR", s: "exige", u: 1.01 }, { id: "m", n: "MANTENER", s: "sostén", u: 0.98 }, { id: "fl", n: "FLOTAR", s: "ahorra", u: 0.95 }] },
             { f: 0.68, n: "FINAL", opts: [{ id: "s", n: "SPRINT", s: "vacíate", u: 1.04 }, { id: "a", n: "AGUANTAR", s: "sobrevive", u: 0.975 }] } ],
  "300":  [ { f: 0, n: "SALIDA", opts: [{ id: "auto", n: "A FONDO", s: "automático", u: 1.0 }] },
             { f: 0.45, n: "RITMO", opts: [{ id: "m", n: "MANTENER", s: "sostén", u: 0.99 }, { id: "c", n: "CONSERVAR", s: "ahorra", u: 0.955 }] },
             { f: 0.78, n: "FINAL", opts: [{ id: "s", n: "SPRINT", s: "todo", u: 1.05 }, { id: "r", n: "RESISTIR", s: "sostén", u: 0.97 }] } ],
};
const PHASE_ALIAS: any = { "60": "100" };
function phasesFor(evk: string) { return PHASES[evk] || PHASES[PHASE_ALIAS[evk]] || PHASES["800"]; }

/* sustainable utilization + drain */
function susOf(a: any, evk: string): number {
  const at = a.attrs;
  switch (evk) {
    case "60": case "100": return 1.06;
    case "200": return 1.02 + at.ana * 0.0004;
    case "400": return 0.865 + at.ana * 0.0013;
    case "800": return 0.80 + at.ana * 0.0014 + at.aer * 0.0009;
    case "1500": return 0.815 + at.aer * 0.0013 + at.ana * 0.0006;
    case "3000": return 0.835 + at.aer * 0.0012;
    case "110H": return 1.03;
    case "400H": return 0.85 + at.ana * 0.0012 + at.tec * 0.0005;
    case "300": return 0.9 + at.ana * 0.001;
  }
  return 0.95;
}
function kdOf(evk: string): number {
  return ({ "60": 30, "100": 36, "200": 46, "300": 60, "400": 78, "800": 56, "1500": 38, "3000": 25, "110H": 42, "400H": 72 } as any)[evk] || 50;
}
function recovOf(evk: string, a: any): number { return EV[evk].g === "mid" ? 0.9 + a.attrs.aer * 0.012 : 0.25; }

/* AI style → option index per phase + adaptation */
function aiPickOpts(style: string, nPhases: number): number[] {
  const m: any = {
    sprinter: [0, 0, 0, 0], front: [0, 0, 1, 1], kicker: [2, 1, 1, 0],
    pacer: [1, 1, 1, 0], tactician: [1, 2, 0, 0], allround: [1, 1, 0, 0],
  };
  const base = m[style] || m.pacer;
  const out: number[] = [];
  for (let i = 0; i < nPhases; i++) out.push(clamp(base[i] ?? 1, 0, 2));
  return out;
}

const PROFILES: any = {
  spr60: [[0, 0.1, 0.8], [0.1, 0.35, 1.02], [0.35, 1, 1.05]],
  spr100: [[0, 0.1, 0.8], [0.1, 0.35, 1.02], [0.35, 1, 1.045]],
  spr200: [[0, 0.12, 0.82], [0.12, 0.5, 1.03], [0.5, 0.85, 1.02], [0.85, 1, 0.99]],
  spr400: [[0, 0.1, 0.86], [0.1, 0.5, 1.02], [0.5, 0.75, 1.0], [0.75, 1, 0.94]],
  mid800: [[0, 0.125, 1.05], [0.125, 0.75, 0.985], [0.75, 1, 1.0]],
  mid1500: [[0, 0.1, 1.03], [0.1, 0.85, 0.99], [0.85, 1, 1.02]],
  mid3000: [[0, 0.15, 1.01], [0.15, 0.9, 0.995], [0.9, 1, 1.02]],
};
function profileFor(evk: string): number[][] {
  const map: any = { "60": PROFILES.spr60, "100": PROFILES.spr100, "200": PROFILES.spr200, "300": PROFILES.spr400, "400": PROFILES.spr400, "800": PROFILES.mid800, "1500": PROFILES.mid1500, "3000": PROFILES.mid3000, "110H": PROFILES.spr100, "400H": PROFILES.spr400 };
  return map[evk] || PROFILES.mid800;
}
function profAt(prof: number[][], f: number): number {
  for (const [a, b, v] of prof) if (f >= a && f < b) return v;
  return 1;
}

/* ================= individual race ================= */
export function installRaceEngine() {
  G.runRace = (opts: any) => runRace(opts);
  G.runRelay = (opts: any) => runRelay(opts);
}

function runRace(opts: any): Promise<any[]> {
  return new Promise((resolve) => {
    const evk = opts.evk, ev = EV[evk], D = ev.d;
    const phases = phasesFor(evk);
    const prof = profileFor(evk);
    const racers: any[] = opts.racers.map((r: any, i: number) => {
      const T = dayPlanTime(r.a, evk, opts.importance) / (opts.planMul || 1) / (r.isPlayer ? (opts.playerMul || 1) : rnd(0.985, 1.005));
      return {
        a: r.a, isPlayer: !!r.isPlayer, lane: i, x: 0, v: 0, E: 100, fin: false, t: Infinity,
        reaction: 0, t0: 0, planX: 0, uSel: phases.map((p: any) => p.opts[Math.min(1, p.opts.length - 1)].u),
        phaseIdx: -1, clipT: 0, clipBig: false, dq: false,
        vAvg: D / T, T, sus: susOf(r.a, evk), kd: kdOf(evk), rec: recovOf(evk, r.a),
        acc: 5.5 + r.a.attrs.acc * 0.055, aiOpts: aiPickOpts(r.a.style || "pacer", phases.length),
        color: r.isPlayer ? r.a.jersey : pick(JERSEYS), finishedAnim: 0, celebrate: 0,
      };
    });
    const player = racers.find((r) => r.isPlayer) || racers[0];

    /* ---------- DOM ---------- */
    const root = document.createElement("div");
    root.className = "racewrap";
    root.innerHTML = `
      <div class="racetop">
        <div class="rt-name">${opts.meetName || "Carrera"}</div>
        <div class="rt-round">${EV[evk].label} · ${opts.roundName || "Final"}</div>
        <div class="spacer"></div>
        <div class="speedctl">
          <span class="dim num small" style="letter-spacing:1.5px">VELOCIDAD</span>
          ${[1, 2, 4, 8].map((s) => `<button class="spdb" data-spd="${s}">${s}×</button>`).join("")}
          <button class="spdb" data-cam="1">CÁMARA</button>
        </div>
      </div>
      <div class="racecanvas"><canvas></canvas>
        <div class="minimap"></div>
        <div class="startov" id="startov"></div>
        <div id="banner"></div>
      </div>
      <div class="racehud">
        <div>
          <div class="hud-clock" id="clock">0.00</div>
          <div class="hud-sub" id="distline">0 m · POS —</div>
          <div class="statrow" style="margin-top:8px"><span class="lbl" style="width:64px">Energía</span>
            <div class="bar nrg" style="height:10px"><i id="ebar" style="width:100%"></i></div>
            <span class="val" id="eval" style="width:36px">100</span></div>
          <div class="hud-sub" id="draftline" style="color:var(--blu); display:none">◈ REBUFO — ahorrando</div>
        </div>
        <div class="tactics" id="tactics"></div>
        <div class="hud-side" id="poslist"></div>
      </div>`;
    document.body.appendChild(root);
    const cv = root.querySelector("canvas") as HTMLCanvasElement;
    const ctx = cv.getContext("2d")!;
    const $ = (s: string) => root.querySelector(s) as HTMLElement;

    let speed = (opts.defaultSpeed || (D >= 1500 ? 4 : D >= 800 ? 2 : 1)) * (S.settings.speed || 1);
    speed = clamp(speed, 1, 12);
    let camMode = 0; // 0 player, 1 leader
    const updateSpdBtns = () => root.querySelectorAll(".spdb[data-spd]").forEach((b: any) => b.classList.toggle("on", Math.round(speed) === +b.dataset.spd));
    updateSpdBtns();
    root.querySelectorAll(".spdb[data-spd]").forEach((b: any) => (b.onclick = () => { speed = +b.dataset.spd; snd("tab"); updateSpdBtns(); }));
    root.querySelector(".spdb[data-cam]")!.onclick = () => { camMode = 1 - camMode; snd("tab"); };

    /* tactics UI */
    const tacticsEl = $("#tactics");
    let shownPhase = -1;
    function renderTactics(pi: number) {
      shownPhase = pi;
      const ph = phases[pi];
      tacticsEl.innerHTML = `<div style="width:100%;text-align:center;font-family:var(--num);font-size:11px;letter-spacing:2.5px;color:var(--gold);text-transform:uppercase;margin-bottom:2px">${ph.n} <span class="dim">· elige táctica</span></div>` +
        ph.opts.map((o: any, oi: number) => `<button class="tbtn ${player.uSel[pi] === o.u ? "on" : ""}" data-oi="${oi}">${o.n}<small>${o.s}</small></button>`).join("");
      tacticsEl.querySelectorAll(".tbtn").forEach((b: any) => {
        b.onclick = () => {
          player.uSel[pi] = phases[pi].opts[+b.dataset.oi].u;
          snd("tick");
          tacticsEl.querySelectorAll(".tbtn").forEach((x: any, xi: number) => x.classList.toggle("on", +x.dataset.oi === +b.dataset.oi));
        };
      });
    }
    renderTactics(0);
    player.phaseIdx = 0;

    const bannerEl = $("#banner");
    let bannerTO: any;
    function banner(txt: string, color = "var(--gold)") {
      bannerEl.innerHTML = `<div class="race-banner" style="color:${color}">${txt}</div>`;
      clearTimeout(bannerTO);
      bannerTO = setTimeout(() => (bannerEl.innerHTML = ""), 1400);
    }

    /* splits */
    const splits: number[] = D === 800 ? [200, 400, 600] : D === 1500 ? [500, 1000] : D === 3000 ? [1000, 2000] : D === 400 || evk === "400H" ? [200] : [];
    const splitsHit = new Set();

    /* ---------- start sequence ---------- */
    const startov = $("#startov");
    let gunT = -1, raceT = 0, running = false, raceOver = false, attempts = 2, falseStartLock = false;
    let raf = 0, destroyed = false, keyHandler: any;

    function startSequence() {
      falseStartLock = true;
      startov.style.display = "flex";
      startov.innerHTML = `<div class="st-word" style="color:var(--blu)">LISTOS…</div><div class="st-hint">La carrera comienza en breve</div>`;
      snd("ready");
      setTimeout(() => {
        if (destroyed) return;
        startov.innerHTML = `<div class="st-word" style="color:var(--gold)">¿LISTOS?</div>
          <button class="btn primary gobtn" id="gobtn">¡SALIDA! <small style="font-size:11px;letter-spacing:2px;display:block">o pulsa ESPACIO</small></button>
          <div class="st-hint">Pulsa justo cuando suene el disparo · Intentos: ${attempts}</div>`;
        snd("set");
        const delay = rnd(900, 2200);
        let fired = false;
        const gunTO = setTimeout(() => { fired = true; fireGun(); }, delay);
        const press = () => {
          if (destroyed) return;
          if (fired) return; // handled by reaction measurement after gun
          // pressed before gun → false start
          clearTimeout(gunTO);
          snd("false");
          attempts--;
          unbind();
          if (attempts <= 0) {
            startov.innerHTML = `<div class="st-word" style="color:var(--red)">SALIDA NULA</div><div class="st-hint">Segunda salida nula — DESCALIFICADO</div>`;
            player.dq = true;
            setTimeout(finishAll, 1600);
          } else {
            startov.innerHTML = `<div class="st-word" style="color:var(--red)">¡SALIDA NULA!</div><div class="st-hint">Te has adelantado. Queda ${attempts} intento.</div>`;
            setTimeout(startSequence, 1500);
          }
        };
        const gobtn = startov.querySelector("#gobtn") as HTMLElement;
        const key = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); press(); } };
        const unbind = () => { gobtn && (gobtn.onclick = null); window.removeEventListener("keydown", key); };
        gobtn.onclick = press;
        window.addEventListener("keydown", key);
        keyHandler = unbind;
        fireGunMeasure = (dt: number) => { unbind(); player.reaction = clamp(0.115 + Math.abs(dt) * 1.0, 0.1, 0.5); };
      }, 1200);
    }
    let fireGunMeasure: ((dt: number) => void) | null = null;
    let gunRealT = 0;
    function fireGun() {
      gunRealT = performance.now();
      startov.innerHTML = `<div class="st-word" style="color:var(--grn)">¡YA!</div>`;
      (root.querySelector(".racecanvas") as HTMLElement).classList.add("flash");
      snd("gun");
      // AI reactions
      for (const r of racers) if (!r.isPlayer) r.reaction = clamp(0.13 + Math.random() * 0.11 - r.a.attrs.stt * 0.0006 + gauss() * 0.02, 0.105, 0.3);
      // if player already pressed (between gun and frame), measure via listener kept ~ we instead rely on press-after-gun:
      const after = (e: MouseEvent | KeyboardEvent) => {
        window.removeEventListener("keydown", after as any);
        window.removeEventListener("mousedown", after as any);
        const dt = (performance.now() - gunRealT) / 1000 - 0.05;
        if (fireGunMeasure) fireGunMeasure(dt);
        fireGunMeasure = null;
      };
      window.addEventListener("keydown", after as any);
      window.addEventListener("mousedown", after as any);
      // fallback: if no press within 0.9s → slow reaction
      setTimeout(() => { if (fireGunMeasure) { fireGunMeasure(0.5); fireGunMeasure = null; } }, 900);
      running = true;
      setTimeout(() => { if (!destroyed) startov.style.display = "none"; }, 650);
    }

    /* ---------- simulation ---------- */
    const STEP = 1 / 60;
    let accSim = 0, lastFrame = performance.now();
    const crowd: any[] = [];
    for (let i = 0; i < 160; i++) crowd.push({ x: Math.random(), y: Math.random(), c: pick(JERSEYS), ph: rnd(0, 6.28) });

    function phaseAt(f: number): number {
      let idx = 0;
      for (let i = 0; i < phases.length; i++) if (f >= phases[i].f) idx = i;
      return idx;
    }

    function step(dt: number) {
      raceT += dt;
      const leader = racers.reduce((m, r) => (r.x > m.x ? r : m), racers[0]);
      for (const r of racers) {
        if (r.fin || r.dq) continue;
        if (raceT < r.reaction) continue;
        const f = clamp(r.x / D, 0, 1);
        const pi = phaseAt(f);
        if (pi !== r.phaseIdx) {
          r.phaseIdx = pi;
          if (r.isPlayer && pi !== shownPhase) { renderTactics(pi); snd("tick"); banner(phases[pi].n, "var(--blu)"); }
        }
        let u = r.uSel[pi];
        if (!r.isPlayer) {
          const oi = clamp(r.aiOpts[pi] + (r.a.attrs.cmp > 70 && pi === phases.length - 1 ? -0 : 0), 0, phases[pi].opts.length - 1);
          u = phases[pi].opts[Math.min(oi, phases[pi].opts.length - 1)].u;
          // adaptation: tired → ease; fresh late → kick
          if (r.E < 22) u -= 0.035;
          if (r.E > 55 && f > 0.72 && (r.a.style === "kicker" || r.a.style === "tactician")) u += 0.02;
        } else {
          // drafting detection for player display
        }
        // drafting: within 3.5m behind someone
        let draft = false;
        if (EV[evk].g !== "spr") {
          for (const o of racers) if (o !== r && !o.fin && o.x > r.x && o.x - r.x < 3.5) { draft = true; break; }
        }
        // energy
        const drain = Math.pow(Math.max(0, u - r.sus), 1.7) * r.kd * dt * (draft ? 0.86 : 1);
        const recov = u < r.sus ? (0.3 + r.a.attrs.aer * 0.011) * r.rec * dt : 0.12 * r.rec * dt;
        r.E = clamp(r.E - drain + recov, 0, 100);
        if (r.isPlayer) r.drafting = draft;
        // target speed
        let vCap = r.vAvg * profAt(prof, f) * u;
        const err = r.planX - r.x;
        vCap *= clamp(1 + err * 0.004, 0.955, 1.05);
        if (r.E < 20) vCap *= 0.8 + 0.2 * (r.E / 20);
        if (r.E <= 0.5) vCap *= 0.86;
        if (r.clipT > 0) { vCap *= r.clipBig ? 0.45 : 0.62; r.clipT -= dt; }
        r.v += clamp(vCap - r.v, -9 * dt, r.acc * dt);
        r.x += r.v * dt;
        r.planX += r.vAvg * profAt(prof, f) * u * dt;
        // hurdles
        if (ev.hurdles) {
          for (let h = 0; h < ev.hurdles; h++) {
            const hx = ev.h1 + h * ev.hs;
            if (!r.hurDone) r.hurDone = new Set();
            if (r.x >= hx && !r.hurDone.has(h)) {
              r.hurDone.add(h);
              const pClip = ((100 - r.a.attrs.tec) / 100) * 0.22;
              if (Math.random() < pClip) {
                r.clipBig = Math.random() < 0.18;
                r.clipT = r.clipBig ? 0.55 : 0.3;
                if (r.isPlayer) banner(r.clipBig ? "¡GOLPE FUERTE CON LA VALLA!" : "¡TOCAS LA VALLA!", "var(--red)");
              }
            }
          }
        }
        // splits for player
        if (r.isPlayer) {
          for (const sp of splits) if (r.x >= sp && !splitsHit.has(sp)) { splitsHit.add(sp); banner(`${sp} m — ${fmtTime(raceT - r.reaction)}`, "#fff"); }
          if (!r.finalBanner && f >= 0.75 && D >= 400) { r.finalBanner = true; banner("¡RECTA FINAL!", "var(--acc)"); }
        }
        if (r.x >= D) {
          r.fin = true;
          r.t = r.reaction + (raceT - r.reaction) * (D / Math.max(r.x, 0.001)); // slight interpolation correction
          r.t = raceT; // clock-based
          r.celebrate = 1;
        }
      }
      // all finished?
      if (racers.every((r) => r.fin || r.dq) && !raceOver) { raceOver = true; setTimeout(finishAll, 900); }
      else if (!raceOver && player.fin && raceT > player.t + 5) {
        for (const r of racers) if (!r.fin && !r.dq) { r.fin = true; r.t = raceT + (D - r.x) / Math.max(r.v, 3); }
        raceOver = true; setTimeout(finishAll, 700);
      }
    }

    /* ---------- drawing ---------- */
    let dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = (root.querySelector(".racecanvas") as HTMLElement).getBoundingClientRect();
      cv.width = rect.width * dpr; cv.height = rect.height * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw(now: number) {
      const W = cv.width / dpr, H = cv.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // sky + stands
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101827"); g.addColorStop(0.22, "#1A2438"); g.addColorStop(0.3, "#241812"); g.addColorStop(1, "#3A1E12");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const leader = racers.reduce((m, r) => (r.x > m.x ? r : m), racers[0]);
      const focus = camMode === 1 ? leader : (player || leader);
      const ppm = W / 115; // px per meter
      const camX = clamp(focus.x - 42, -20, D - 60);
      const trackTop = H * 0.3, laneH = Math.min(34, (H * 0.62) / racers.length);
      // crowd
      const excite = clamp(1.6 - Math.abs(leader.x - (D - 15)) / 60, 0.3, 1.6) * (leader.x > D * 0.7 ? 1.4 : 0.8);
      for (const c of crowd) {
        const cx = c.x * W, cy = trackTop * 0.18 + c.y * trackTop * 0.72;
        const bounce = Math.abs(Math.sin(now / 260 + c.ph)) * 3 * excite;
        ctx.fillStyle = c.c; ctx.globalAlpha = 0.5;
        ctx.fillRect(cx, cy - bounce, 3, 5);
      }
      ctx.globalAlpha = 1;
      // stands wall
      ctx.fillStyle = "#223048"; ctx.fillRect(0, trackTop - 14, W, 8);
      // track
      const tg = ctx.createLinearGradient(0, trackTop, 0, H);
      tg.addColorStop(0, "#B34327"); tg.addColorStop(1, "#8E3320");
      ctx.fillStyle = tg; ctx.fillRect(0, trackTop, W, H - trackTop);
      // lanes
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5;
      for (let i = 0; i <= racers.length; i++) {
        const y = trackTop + i * laneH + 6;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // distance markers
      ctx.font = `600 ${11}px Oswald, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,.55)";
      const startM = Math.floor(camX / 10) * 10;
      for (let m = startM; m < camX + 120; m += 10) {
        if (m < 0 || m > D) continue;
        const x = (m - camX) * ppm;
        ctx.strokeStyle = m % 50 === 0 ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.1)";
        ctx.beginPath(); ctx.moveTo(x, trackTop + 4); ctx.lineTo(x, H - 4); ctx.stroke();
        if (m % 50 === 0) ctx.fillText(`${m}`, x + 3, trackTop + 16);
      }
      // start & finish
      const sx = (0 - camX) * ppm;
      if (sx > -20 && sx < W + 20) { ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(sx - 1.5, trackTop, 3, H - trackTop); }
      const fx = (D - camX) * ppm;
      if (fx > -40 && fx < W + 40) {
        for (let yy = trackTop; yy < H; yy += 8) {
          ctx.fillStyle = (Math.floor(yy / 8) % 2 === 0) ? "#fff" : "#111";
          ctx.fillRect(fx - 3, yy, 6, 8);
        }
        ctx.fillStyle = "var(--gold)"; ctx.font = `700 13px Oswald, sans-serif`; ctx.fillStyle = "#FFC531";
        ctx.fillText("META", fx - 14, trackTop - 4);
      }
      // hurdles
      if (ev.hurdles) {
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = (ev.h1 + h * ev.hs - camX) * ppm;
          if (hx < -10 || hx > W + 10) continue;
          ctx.fillStyle = "#FFC531";
          ctx.fillRect(hx - 1, trackTop + 2, 2.5, H - trackTop - 6);
        }
      }
      // racers (draw by lane)
      const sorted = [...racers].sort((a, b) => a.lane - b.lane);
      for (const r of sorted) {
        const x = (r.x - camX) * ppm, y = trackTop + r.lane * laneH + 6 + laneH * 0.78;
        if (x < -40 || x > W + 40) continue;
        drawRunner(ctx, x, y, r, now, laneH);
        if (r.isPlayer || r === leader || r.x > D) {
          ctx.font = `600 10px Oswald, sans-serif`;
          const label = r.isPlayer ? `${r.a.first} (TÚ)` : `${r.a.last}`;
          ctx.fillStyle = r.isPlayer ? "#FFC531" : "rgba(255,255,255,.75)";
          ctx.fillText(label, x - 14, y - laneH * 0.62);
        }
      }
      // confetti if player won
      if (player.fin && player.place === 1) drawConfetti(ctx, W, H, now);
      // minimap
      const mm = root.querySelector(".minimap") as HTMLElement;
      const mmW = mm.clientWidth || W;
      let mmHtml = `<svg width="100%" height="26" viewBox="0 0 ${mmW} 26" preserveAspectRatio="none">
        <rect x="0" y="11" width="${mmW}" height="4" fill="rgba(255,255,255,.12)"/>`;
      for (const r of racers) {
        const px = clamp((r.x / D) * (mmW - 10) + 5, 3, mmW - 3);
        mmHtml += `<circle cx="${px}" cy="13" r="${r.isPlayer ? 5 : 3.4}" fill="${r.isPlayer ? "#FFC531" : r.color}" ${r.dq ? 'opacity=".25"' : ""}/>`;
      }
      mmHtml += `</svg>`;
      if (mm.innerHTML !== mmHtml) mm.innerHTML = mmHtml;
      // HUD
      $("#clock").textContent = fmtTime(Math.max(0, raceT));
      const alive = racers.filter((r) => !r.dq);
      const place = 1 + alive.filter((r) => r.x > player.x).length;
      if (player.fin) player.place = player.place || 1 + alive.filter((r) => r.t < player.t).length;
      $("#distline").textContent = `${Math.min(D, Math.floor(player.x))} m / ${D} m · POS ${player.dq ? "DQ" : player.fin ? player.place : place}/${alive.length}`;
      $("#ebar").style.width = player.E + "%";
      $("#ebar").style.background = player.E < 20 ? "repeating-linear-gradient(115deg,#FF4D5E 0 8px,#C22836 8px 16px)" : "";
      $("#eval").textContent = Math.round(player.E);
      $("#draftline").style.display = player.drafting && !player.fin ? "block" : "none";
      const list = [...alive].sort((a, b) => (a.fin ? -a.t : -a.x) - (b.fin ? -b.t : -b.x)).reverse();
      let sortedByProg = [...alive].sort((a, b) => b.x - a.x);
      const shown = sortedByProg.slice(0, 6);
      if (!shown.some((r) => r.isPlayer) && player && alive.includes(player)) shown.push(player);
      $("#poslist").innerHTML = shown.map((r, i) => {
        const gap = i === 0 ? (r.fin ? fmtTime(r.t) : "LÍDER") : `+${((sortedByProg[0].x - r.x) / Math.max(r.vAvg, 1)).toFixed(2)}s`;
        return `<div class="posline ${r.isPlayer ? "mepos" : ""}"><span class="dotc" style="background:${r.isPlayer ? "#FFC531" : r.color}"></span>
          <span>${i + 1}. ${r.a.last}</span><span class="gapv">${r.dq ? "DQ" : gap}</span></div>`;
      }).join("");
    }

    const confetti: any[] = [];
    function drawConfetti(c2: any, W: number, H: number, now: number) {
      if (confetti.length < 90) confetti.push({ x: rnd(0, W), y: -10, vy: rnd(60, 160), c: pick(JERSEYS), ph: rnd(0, 6) });
      for (const p of confetti) {
        p.y += p.vy / 60; p.x += Math.sin(now / 300 + p.ph) * 0.8;
        c2.fillStyle = p.c; c2.fillRect(p.x, p.y, 4, 6);
        if (p.y > H) { p.y = -10; p.x = rnd(0, W); }
      }
    }

    function drawRunner(c2: any, x: number, y: number, r: any, now: number, laneH: number) {
      const sc = clamp(laneH / 30, 0.7, 1.15);
      const phase = r.x * 1.15;
      const moving = r.v > 0.5 && !r.dq;
      const swing = moving ? Math.sin(phase) : 0;
      const swing2 = moving ? Math.sin(phase + Math.PI) : 0;
      c2.save();
      c2.translate(x, y);
      c2.scale(sc, sc);
      // shadow
      c2.fillStyle = "rgba(0,0,0,.35)";
      c2.beginPath(); c2.ellipse(0, 2, 9, 2.6, 0, 0, 6.29); c2.fill();
      const lean = clamp(r.v / 11, 0, 1) * 0.28 + (r.clipT > 0 ? 0.2 : 0);
      // celebrate hop
      const hop = r.fin && r.place === 1 && r.isPlayer ? Math.abs(Math.sin(now / 140)) * 5 : 0;
      c2.translate(0, -hop);
      c2.rotate(lean * 0.4);
      // legs
      c2.strokeStyle = r.a.skin || "#C6885C"; c2.lineWidth = 2.6; c2.lineCap = "round";
      c2.beginPath(); c2.moveTo(0, -12); c2.lineTo(swing * 6, -1); c2.moveTo(0, -12); c2.lineTo(swing2 * 6, -1); c2.stroke();
      // torso (jersey)
      c2.strokeStyle = r.color; c2.lineWidth = 4.4;
      c2.beginPath(); c2.moveTo(0, -12); c2.lineTo(1.5, -22); c2.stroke();
      // arms
      c2.strokeStyle = r.a.skin || "#C6885C"; c2.lineWidth = 2;
      c2.beginPath(); c2.moveTo(1, -20); c2.lineTo(1 + swing2 * 4, -13); c2.moveTo(1, -20); c2.lineTo(1 + swing * 4, -13); c2.stroke();
      // head
      c2.fillStyle = r.a.skin || "#C6885C";
      c2.beginPath(); c2.arc(2.5, -26, 3.1, 0, 6.29); c2.fill();
      c2.fillStyle = r.a.hair || "#1C1B1A";
      c2.beginPath(); c2.arc(2, -27.4, 2.6, Math.PI * 0.9, Math.PI * 2.05); c2.fill();
      // fatigue smoke
      if (r.E < 15 && !r.fin) { c2.fillStyle = "rgba(255,77,94,.7)"; c2.font = "700 9px Oswald"; c2.fillText("×", -2, -32); }
      c2.restore();
    }

    /* ---------- loop ---------- */
    function frame(now: number) {
      if (destroyed) return;
      const dtReal = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      if (running) {
        accSim += dtReal * speed;
        let guard = 0;
        while (accSim >= STEP && guard < 60) { step(STEP); accSim -= STEP; guard++; }
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    /* ---------- finish ---------- */
    function finishAll() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(raf);
      if (keyHandler) keyHandler();
      window.removeEventListener("resize", resize);
      snd(player.dq ? "bad" : player.place === 1 ? "win" : "finish");
      const results = racers.map((r) => ({ id: r.a.id, t: r.dq ? Infinity : r.t, dq: r.dq, place: 0, lane: r.lane }))
        .sort((a, b) => a.t - b.t);
      let pl = 0;
      for (const r of results) if (!r.dq) r.place = ++pl; else r.place = results.length;
      root.remove();
      resolve(results);
    }

    startSequence();
    raf = requestAnimationFrame(frame);
  });
}

/* ================= relays ================= */
function exchangeRoll(style: string, zone: boolean): { add: number; fail: boolean; dq: boolean; word: string } {
  const tbl: any = zone
    ? { conservador: { add: 0.45, p: 0.004 }, normal: { add: 0.2, p: 0.025 }, agresivo: { add: 0.02, p: 0.075 } }
    : { conservador: { add: 0.3, p: 0.003 }, normal: { add: 0.15, p: 0.015 }, agresivo: { add: 0.05, p: 0.04 } };
  const s = tbl[style] || tbl.normal;
  if (Math.random() < s.p) {
    const dq = zone && Math.random() < 0.3;
    return { add: dq ? 0 : 2.4, fail: true, dq, word: dq ? "¡TESTIGO AL SUELO! DESCALIFICADOS" : "¡CASI SE CAE EL TESTIGO!" };
  }
  const q = Math.random();
  const word = q < 0.2 ? "¡CAMBIO PERFECTO!" : q < 0.75 ? "Cambio correcto" : "Cambio justo…";
  return { add: s.add * rnd(0.7, 1.3), fail: false, dq: false, word };
}

function runRelay(opts: any): Promise<any> {
  // opts: { relayKey, teams: [{country, name, runners:[athletes], style, isPlayer, playerLeg}], meetName, importance }
  return new Promise(async (resolve) => {
    const rk = opts.relayKey, rel = RELAYS[rk];
    const root = document.createElement("div");
    root.className = "racewrap";
    root.innerHTML = `
      <div class="racetop">
        <div class="rt-name">${opts.meetName || "Relevos"}</div>
        <div class="rt-round">${rel.label} · Final</div>
        <div class="spacer"></div>
        <div class="rt-round" id="legind" style="color:var(--blu)">POSTA 1/4</div>
      </div>
      <div class="racecanvas"><canvas></canvas><div id="banner"></div></div>
      <div class="racehud">
        <div><div class="hud-clock" id="rclock">0.00</div><div class="hud-sub" id="rsub">Preparando relevos…</div></div>
        <div class="tactics" id="rteam" style="flex-direction:column;align-items:stretch"></div>
        <div class="hud-side" id="rboard"></div>
      </div>`;
    document.body.appendChild(root);
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    const cv = root.querySelector("canvas") as HTMLCanvasElement;
    const ctx = cv.getContext("2d")!;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => { const r2 = (root.querySelector(".racecanvas") as HTMLElement).getBoundingClientRect(); cv.width = r2.width * dpr; cv.height = r2.height * dpr; };
    resize(); window.addEventListener("resize", resize);

    const totals: any[] = opts.teams.map((t: any, i: number) => ({ team: t, total: 0, leg: 0, dq: false, color: t.isPlayer ? "#FFC531" : pick(JERSEYS), prog: 0 }));
    const playerTeam = totals.find((t: any) => t.team.isPlayer);

    const renderBoard = () => {
      $("#rboard").innerHTML = [...totals].sort((a, b) => (a.dq ? 1e9 : a.total + a.prog) - (b.dq ? 1e9 : b.total + b.prog)).map((t, i) =>
        `<div class="posline ${t.team.isPlayer ? "mepos" : ""}"><span class="dotc" style="background:${t.color}"></span>
        <span>${i + 1}. ${t.team.name}</span><span class="gapv">${t.dq ? "DQ" : fmtTime(t.total + t.prog)}</span></div>`).join("");
      $("#rteam").innerHTML = (playerTeam ? playerTeam.team.runners.map((r: any, i: number) =>
        `<div class="posline ${r.isPlayer ? "mepos" : ""}"><span class="dim num">${rel.legs[i]} m</span><span>${r.isPlayer ? r.first + " (TÚ)" : r.first + " " + r.last}</span></div>`).join("") : "");
    };
    renderBoard();

    const bannerEl = $("#banner");
    const banner = (txt: string, color = "var(--gold)", ms = 1500) => {
      bannerEl.innerHTML = `<div class="race-banner" style="color:${color}">${txt}</div>`;
      setTimeout(() => (bannerEl.innerHTML = ""), ms);
    };

    // simple track draw with abstract runners
    let animState: any = null;
    function drawRelay(now: number) {
      const W = cv.width / dpr, H = cv.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101827"); g.addColorStop(0.3, "#241812"); g.addColorStop(1, "#3A1E12");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const trackTop = H * 0.2, laneH = Math.min(40, (H * 0.7) / totals.length);
      const tg = ctx.createLinearGradient(0, trackTop, 0, H);
      tg.addColorStop(0, "#B34327"); tg.addColorStop(1, "#8E3320");
      ctx.fillStyle = tg; ctx.fillRect(0, trackTop, W, H - trackTop);
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      for (let i = 0; i <= totals.length; i++) { ctx.beginPath(); ctx.moveTo(0, trackTop + i * laneH + 6); ctx.lineTo(W, trackTop + i * laneH + 6); ctx.stroke(); }
      // finish
      const fx = W * 0.86;
      for (let yy = trackTop; yy < H; yy += 8) { ctx.fillStyle = Math.floor(yy / 8) % 2 === 0 ? "#fff" : "#111"; ctx.fillRect(fx, yy, 5, 8); }
      ctx.font = "700 13px Oswald"; ctx.fillStyle = "#FFC531"; ctx.fillText("META", fx - 12, trackTop - 4);
      // exchange zone marker
      ctx.fillStyle = "rgba(76,195,255,.15)"; ctx.fillRect(W * 0.74, trackTop, W * 0.12, H - trackTop);
      ctx.font = "600 10px Oswald"; ctx.fillStyle = "rgba(76,195,255,.9)"; ctx.fillText("ZONA DE CAMBIO", W * 0.745, trackTop + 14);
      totals.forEach((t: any, i: number) => {
        const y = trackTop + i * laneH + 6 + laneH * 0.75;
        const x = W * 0.08 + clamp(t.progFrac || 0, 0, 1) * (fx - W * 0.08);
        if (t.dq) { ctx.fillStyle = "rgba(255,77,94,.8)"; ctx.font = "700 12px Oswald"; ctx.fillText("DQ", 20, y); return; }
        // runner dot figure
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x, y + 2, 8, 2.4, 0, 0, 6.29); ctx.fill();
        const ph = now / 90 + i;
        ctx.strokeStyle = "#C6885C"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + Math.sin(ph) * 5, y); ctx.moveTo(x, y - 10); ctx.lineTo(x - Math.sin(ph) * 5, y); ctx.stroke();
        ctx.strokeStyle = t.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 1, y - 19); ctx.stroke();
        ctx.fillStyle = "#C6885C"; ctx.beginPath(); ctx.arc(x + 2, y - 23, 2.8, 0, 6.29); ctx.fill();
        ctx.font = "600 10px Oswald"; ctx.fillStyle = t.team.isPlayer ? "#FFC531" : "rgba(255,255,255,.7)";
        ctx.fillText(t.team.name, x - 10, y - 30);
      });
    }
    let raf = 0;
    const loop = (now: number) => { drawRelay(now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const wait = (ms: number) => new Promise((r2) => setTimeout(r2, ms / (S.settings.speed || 1)));

    /* ---- run legs ---- */
    for (let leg = 0; leg < 4; leg++) {
      $("#legind").textContent = `POSTA ${leg + 1}/4 · ${rel.legs[leg]} m`;
      banner(`POSTA ${leg + 1} — ${rel.legs[leg]} m`, "var(--blu)");
      const playerRunsThis = playerTeam && !playerTeam.dq && playerTeam.team.playerLeg === leg;
      if (playerRunsThis) {
        // interactive leg
        $("#rsub").textContent = "¡Te toca! Corre tu posta.";
        const raceRes = await runRace({
          evk: rel.legs[leg] === 300 ? "300" : String(rel.legs[leg]),
          racers: [{ a: S.player, isPlayer: true }],
          importance: opts.importance, roundName: `Relevos · Posta ${leg + 1}`, meetName: opts.meetName,
          defaultSpeed: 1,
        });
        const myT = raceRes[0].dq ? null : raceRes[0].t;
        if (myT == null) { playerTeam.dq = true; banner("¡DESCALIFICADOS EN TU POSTA!", "var(--red)", 2200); }
        else {
          playerTeam.total += myT;
          banner(`Posta: ${fmtTime(myT)}`, "#fff");
        }
        // simulate other teams' leg quietly with live progress
        for (const t of totals) if (t !== playerTeam && !t.dq) t.total += legEstimate(t.team.runners[leg], rel.legs[leg], leg === 0) * rnd(0.985, 1.02);
        await wait(600);
      } else {
        // all auto leg with quick animated progress
        const legTimes = totals.map((t: any) => t.dq ? 0 : legEstimate(t.team.runners[leg], rel.legs[leg], leg === 0) * rnd(0.985, 1.02));
        const maxT = Math.max(...legTimes.filter((x: number) => x > 0), 1);
        const dur = clamp(maxT * 55, 900, 2600) / (S.settings.speed || 1);
        const t0 = performance.now();
        await new Promise((r2) => {
          const tick = () => {
            const k = clamp((performance.now() - t0) / dur, 0, 1);
            totals.forEach((t: any, i: number) => { if (!t.dq) t.progFrac = k * (legTimes[i] > 0 ? maxT / legTimes[i] : 1); t.prog = 0; });
            $("#rclock").textContent = fmtTime((playerTeam && !playerTeam.dq ? playerTeam.total : totals[0].total) + k * (playerRunsThis ? 0 : legTimes[playerTeam ? totals.indexOf(playerTeam) : 0]));
            if (k < 1) requestAnimationFrame(tick); else r2(null);
          };
          tick();
        });
        totals.forEach((t: any, i: number) => { if (!t.dq) { t.total += legTimes[i]; t.progFrac = 0; } });
      }
      // exchanges (after legs 1-3)
      if (leg < 3) {
        for (const t of totals) {
          if (t.dq) continue;
          const ex = exchangeRoll(t.team.style || "normal", rel.zone);
          if (ex.dq) { t.dq = true; if (t.team.isPlayer) { banner(ex.word, "var(--red)", 2600); snd("bad"); } }
          else { t.total += ex.add; if (t.team.isPlayer) { banner(ex.word + ` (+${ex.add.toFixed(2)}s)`, ex.fail ? "var(--red)" : ex.add < 0.15 ? "var(--grn)" : "#fff", 1400); snd("swap"); } }
        }
        renderBoard();
        await wait(1400);
      }
      renderBoard();
    }

    await wait(900);
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    root.remove();
    const results = totals.map((t: any) => ({ country: t.team.country, name: t.team.name, t: t.dq ? Infinity : t.total, dq: t.dq, isPlayer: t.team.isPlayer, runners: t.team.runners }))
      .sort((a, b) => a.t - b.t);
    let pl = 0; for (const r of results) r.place = r.dq ? results.length : ++pl;
    snd(playerTeam && !playerTeam.dq && results[0].isPlayer ? "win" : "finish");
    resolve(results);
  });
}
