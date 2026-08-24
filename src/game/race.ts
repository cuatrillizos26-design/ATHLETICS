// @ts-nocheck
/* ============ RACES: interactive canvas engine (Speed-Stars style control), relays ============ */
import { EV, RELAYS, JERSEYS } from "./data";
import { S, G, clamp, rnd, pick, gauss } from "./store";
import { dayPlanTime, fmtTime, legEstimate } from "./model";
import { snd } from "./sound";

/* ---------------- AI tactic phases (rivals only) ---------------- */
const PHASES: any = {
  "60":   [ { f: 0, opts: [{ u: 1.0 }] }, { f: 0.5, opts: [{ u: 1.0 }, { u: 1.045 }] } ],
  "100":  [ { f: 0, opts: [{ u: 1.0 }] }, { f: 0.55, opts: [{ u: 1.0 }, { u: 1.05 }] } ],
  "200":  [ { f: 0, opts: [{ u: 1.0 }] }, { f: 0.14, opts: [{ u: 0.965 }, { u: 1.0 }] }, { f: 0.62, opts: [{ u: 1.0 }, { u: 1.045 }] } ],
  "400":  [ { f: 0, opts: [{ u: 1.03 }, { u: 0.995 }, { u: 0.955 }] }, { f: 0.28, opts: [{ u: 1.02 }, { u: 0.99 }, { u: 0.955 }] },
             { f: 0.6, opts: [{ u: 1.02 }, { u: 0.985 }, { u: 0.95 }] }, { f: 0.84, opts: [{ u: 1.05 }, { u: 0.97 }] } ],
  "800":  [ { f: 0, opts: [{ u: 1.02 }, { u: 0.985 }, { u: 0.945 }] }, { f: 0.25, opts: [{ u: 1.015 }, { u: 0.975 }] },
             { f: 0.5, opts: [{ u: 1.015 }, { u: 0.975 }, { u: 0.94 }] }, { f: 0.75, opts: [{ u: 1.06 }, { u: 0.99 }] } ],
  "1500": [ { f: 0, opts: [{ u: 1.01 }, { u: 0.985 }, { u: 0.955 }] }, { f: 0.28, opts: [{ u: 1.02 }, { u: 0.98 }, { u: 0.95 }] },
             { f: 0.58, opts: [{ u: 1.03 }, { u: 1.0 }, { u: 0.985 }] }, { f: 0.82, opts: [{ u: 1.07 }, { u: 1.0 }] } ],
  "3000": [ { f: 0, opts: [{ u: 1.005 }, { u: 0.98 }, { u: 0.955 }] }, { f: 0.33, opts: [{ u: 1.02 }, { u: 0.985 }] },
             { f: 0.66, opts: [{ u: 1.025 }, { u: 0.99 }, { u: 0.96 }] }, { f: 0.86, opts: [{ u: 1.06 }, { u: 1.0 }] } ],
  "110H": [ { f: 0, opts: [{ u: 1.0 }] }, { f: 0.3, opts: [{ u: 1.03 }, { u: 1.0 }] }, { f: 0.78, opts: [{ u: 1.03 }, { u: 1.0 }] } ],
  "400H": [ { f: 0, opts: [{ u: 1.02 }, { u: 0.985 }, { u: 0.95 }] }, { f: 0.3, opts: [{ u: 1.01 }, { u: 0.98 }, { u: 0.95 }] },
             { f: 0.68, opts: [{ u: 1.04 }, { u: 0.975 }] } ],
  "300":  [ { f: 0, opts: [{ u: 1.0 }] }, { f: 0.45, opts: [{ u: 0.99 }, { u: 0.955 }] }, { f: 0.78, opts: [{ u: 1.05 }, { u: 0.97 }] } ],
};
const PHASE_ALIAS: any = { "60": "100" };
function phasesFor(evk: string) { return PHASES[evk] || PHASES[PHASE_ALIAS[evk]] || PHASES["800"]; }

/* sustainable utilization + drain (AI) */
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

/* ---------------- player cadence model ---------------- */
function susCadFor(a: any, evk: string): number {
  const base: any = { "60": 97, "100": 95, "200": 86, "300": 77, "400": 70, "800": 60, "1500": 50, "3000": 42, "110H": 90, "400H": 68 };
  let s = base[evk] ?? 70;
  s += (a.attrs.ana - 50) * 0.10 + (a.attrs.aer - 50) * 0.10;
  if (a.fatigue > 50) s -= (a.fatigue - 50) * 0.06;
  return clamp(s, 30, 100);
}

/* ================= engine install ================= */
export function installRaceEngine() {
  G.runRace = (opts: any) => runRace(opts);
  G.runRelay = (opts: any) => runRelay(opts);
}

/* ================= individual race ================= */
function runRace(opts: any): Promise<any[]> {
  return new Promise((resolve) => {
    const evk = opts.evk, ev = EV[evk], D = ev.d;
    const phases = phasesFor(evk);
    const prof = profileFor(evk);
    const racers: any[] = opts.racers.map((r: any, i: number) => {
      const T = r.isPlayer
        ? dayPlanTime(r.a, evk, opts.importance)
        : dayPlanTime(r.a, evk, opts.importance) / (opts.planMul || 1) / rnd(0.985, 1.005);
      return {
        a: r.a, isPlayer: !!r.isPlayer, lane: i, x: 0, v: 0, E: 100, fin: false, t: Infinity,
        reaction: null as number | null, planX: 0,
        uSel: phases.map((p: any) => p.opts[Math.min(1, p.opts.length - 1)].u),
        phaseIdx: -1, clipT: 0, clipBig: false, dq: false,
        vAvg: D / T, T, sus: susOf(r.a, evk), kd: kdOf(evk), rec: recovOf(evk, r.a),
        acc: 5.5 + r.a.attrs.acc * 0.055, aiOpts: aiPickOpts(r.a.style || "pacer", phases.length),
        color: r.isPlayer ? r.a.jersey : pick(JERSEYS), celebrate: 0, drafting: false,
        // player interactive model (cadence relative to sustainable threshold)
        kEx: ({ "60": .30, "100": .30, "200": .28, "300": .26, "400": .25, "800": .32, "1500": .33, "3000": .31, "110H": .30, "400H": .27 } as any)[evk] || .3,
        vCapMul: ({ "60": 1.07, "100": 1.07, "200": 1.10, "300": 1.12, "400": 1.15, "800": 1.32, "1500": 1.40, "3000": 1.45, "110H": 1.08, "400H": 1.16 } as any)[evk] || 1.2,
        cad: 0, fatR: 0, susCad: susCadFor(r.a, evk),
        dipped: false, dipOK: false, hurJumped: new Set(), hurPrompt: -1, tapCount: 0,
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
        <div id="actionprompt"></div>
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
        <div class="hud-ctrl">
          <div class="cadwrap">
            <div class="cadlabel"><span>CADENCIA</span><span class="num" id="cadval">0</span><span id="spdval" class="num" style="color:var(--blu)">0 km/h</span></div>
            <div class="cadbar" id="cadbar"><i id="cadfill"></i><b id="cadthr" title="umbral sostenible"></b></div>
            <div class="keyhint">Alterna <b>◀ ▶</b> (o A·D / Z·X / botones) para correr · por encima del umbral gastas energía · <b>ESPACIO</b> salta vallas e inclínate en meta</div>
          </div>
          <div class="pads">
            <button class="pad" id="padL">◀</button>
            <button class="pad" id="padR">▶</button>
          </div>
        </div>
        <div class="hud-side" id="poslist"></div>
      </div>`;
    document.body.appendChild(root);
    const cv = root.querySelector("canvas") as HTMLCanvasElement;
    const ctx = cv.getContext("2d")!;
    const $ = (s: string) => root.querySelector(s) as HTMLElement;

    let speed = (opts.defaultSpeed || (D >= 3000 ? 4 : D >= 1500 ? 2 : 1)) * (S.settings.speed || 1);
    speed = clamp(speed, 1, 12);
    let camMode = 0;
    const updateSpdBtns = () => root.querySelectorAll(".spdb[data-spd]").forEach((b: any) => b.classList.toggle("on", Math.round(speed) === +b.dataset.spd));
    updateSpdBtns();
    root.querySelectorAll(".spdb[data-spd]").forEach((b: any) => (b.onclick = () => { speed = +b.dataset.spd; snd("tab"); updateSpdBtns(); }));
    root.querySelector(".spdb[data-cam]")!.onclick = () => { camMode = 1 - camMode; snd("tab"); };

    const bannerEl = $("#banner");
    let bannerTO: any;
    function banner(txt: string, color = "var(--gold)") {
      bannerEl.innerHTML = `<div class="race-banner" style="color:${color}">${txt}</div>`;
      clearTimeout(bannerTO);
      bannerTO = setTimeout(() => (bannerEl.innerHTML = ""), 1400);
    }
    const promptEl = $("#actionprompt");
    function prompt(txt: string, cls = "") { promptEl.innerHTML = txt ? `<div class="actprompt ${cls}">${txt}</div>` : ""; }

    /* splits */
    const splits: number[] = D === 800 ? [200, 400, 600] : D === 1500 ? [500, 1000] : D === 3000 ? [1000, 2000] : D === 400 || evk === "400H" ? [200] : [];
    const splitsHit = new Set();

    /* ---------- start sequence ---------- */
    const startov = $("#startov");
    let raceT = 0, running = false, raceOver = false, attempts = 2, armed = false;
    let raf = 0, destroyed = false, keyHandler: any;
    let gunRealT = 0, gunFired = false;
    let fireGunMeasure: ((dt: number) => void) | null = null;

    function startSequence() {
      armed = true;
      startov.style.display = "flex";
      startov.innerHTML = `<div class="st-word" style="color:var(--blu)">LISTOS…</div>
        <div class="ctrl-guide">
          <div><b>◀ ▶</b> alterna teclas (A·D / Z·X) o los botones — cuanta más frecuencia, más velocidad</div>
          <div><b>ESPACIO</b> salta las vallas e inclínate al llegar a meta</div>
          <div>Mantente bajo el <b style="color:var(--grn)">umbral</b> de cadencia para no vaciar la energía</div>
        </div>
        <div class="st-hint">No toques nada hasta el disparo…</div>`;
      snd("ready");
      setTimeout(() => {
        if (destroyed) return;
        startov.innerHTML = `<div class="st-word" style="color:var(--gold)">¿LISTOS?</div>
          <div class="st-hint big">Espera el disparo…<br><small>Salir antes de tiempo = salida nula · Intentos: ${attempts}</small></div>`;
        snd("set");
        const delay = rnd(900, 2400);
        let fired = false;
        const gunTO = setTimeout(() => { fired = true; fireGun(); }, delay);
        earlyPress = () => {
          if (destroyed || fired) return;
          clearTimeout(gunTO);
          snd("false");
          attempts--;
          armed = false;
          if (attempts <= 0) {
            startov.innerHTML = `<div class="st-word" style="color:var(--red)">SALIDA NULA</div><div class="st-hint">Segunda salida nula — DESCALIFICADO</div>`;
            player.dq = true;
            setTimeout(finishAll, 1600);
          } else {
            startov.innerHTML = `<div class="st-word" style="color:var(--red)">¡SALIDA NULA!</div><div class="st-hint">Te has adelantado. Queda ${attempts} intento.</div>`;
            setTimeout(startSequence, 1500);
          }
        };
        fireGunMeasure = (dt: number) => {
          player.reaction = clamp(0.115 + Math.abs(dt) * 1.0, 0.1, 0.5);
          banner(`Reacción: ${Math.round(player.reaction * 1000)} ms`, player.reaction < 0.16 ? "var(--grn)" : "#fff");
        };
      }, 1400);
    }
    let earlyPress: (() => void) | null = null;

    function fireGun() {
      gunRealT = performance.now();
      gunFired = true;
      armed = false;
      startov.innerHTML = `<div class="st-word" style="color:var(--grn)">¡YA!</div>`;
      (root.querySelector(".racecanvas") as HTMLElement).classList.add("flash");
      snd("gun");
      for (const r of racers) if (!r.isPlayer) r.reaction = clamp(0.13 + Math.random() * 0.11 - r.a.attrs.stt * 0.0006 + gauss() * 0.02, 0.105, 0.3);
      // fallback: no press within 0.9s → slow reaction
      setTimeout(() => { if (player.reaction == null) player.reaction = 0.55; }, 900);
      running = true;
      setTimeout(() => { if (!destroyed) startov.style.display = "none"; }, 650);
    }

    /* ---------- player input (Speed-Stars style) ---------- */
    let lastSide: string | null = null, lastTapT = 0;
    function registerTap(side: string, fromTouch = false) {
      if (destroyed) return;
      if (!running) { if (armed && earlyPress) earlyPress(); return; }
      if (player.dq || player.fin) return;
      if (player.reaction == null) {
        player.reaction = clamp((performance.now() - gunRealT) / 1000 - 0.03, 0.105, 0.6);
        banner(`Reacción: ${Math.round(player.reaction * 1000)} ms`, player.reaction < 0.16 ? "var(--grn)" : "#fff");
      }
      if (raceT < player.reaction - 0.03) return;
      const now = performance.now();
      const alternate = lastSide !== side;
      const fast = now - lastTapT < 300;
      lastSide = side; lastTapT = now;
      const at = player.a.attrs;
      let imp = (2.3 + at.acc * 0.016) * speed;          // scales with sim speed → same taps/s needed
      if (!alternate) imp *= 0.28;                        // same key = weak shuffle
      else if (fast) imp *= 1.1;
      if (player.E < 15) imp *= 0.85;                     // stiffness when empty
      if (player.fatR > 30) imp *= 0.92;
      player.cad = clamp(player.cad + imp, 0, 112);
      player.tapCount++;
      if (player.tapCount % 4 === 0) snd("tick");
      const pad = side === "L" ? $("#padL") : $("#padR");
      pad.classList.add("hit"); setTimeout(() => pad.classList.remove("hit"), 90);
    }
    function actionPress() {
      if (destroyed || !running || player.dq || player.fin) return;
      if (player.reaction == null) {
        player.reaction = clamp((performance.now() - gunRealT) / 1000 - 0.03, 0.105, 0.6);
      }
      // hurdle jump?
      if (player.hurPrompt >= 0) {
        const hx = ev.h1 + player.hurPrompt * ev.hs;
        const d = hx - player.x;
        player.hurJumped.add(player.hurPrompt);
        player.hurDone?.add(player.hurPrompt);
        prompt("");
        if (d >= -1.5 && d <= 3.5) {
          banner("¡VALLA PERFECTA!", "var(--grn)");
          if (player.a.attrs.tec > 82) player.v += 0.35;
        } else if (d > 3.5 && d <= 9) {
          player.clipT = 0.14; banner("Valla justa", "#fff");
        } else {
          player.clipT = 0.32; banner("¡Salto descolocado!", "var(--red)"); snd("bad");
        }
        return;
      }
      // finish dip
      if (!player.dipped && player.x > D - 9) {
        player.dipped = true;
        if (player.x > D - 3.5) { player.dipOK = true; banner("¡GRAN INCLINACIÓN! −0.08 s", "var(--grn)"); snd("swap"); }
        else banner("Te has inclinado demasiado pronto", "var(--red)");
        prompt("");
      }
    }
    const kd = (e: KeyboardEvent) => {
      const c = e.code;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyZ", "KeyX"].includes(c)) e.preventDefault();
      if (e.repeat) return; // mantener pulsada una tecla no da cadencia gratis
      if (c === "ArrowLeft" || c === "KeyA" || c === "KeyZ") registerTap("L");
      else if (c === "ArrowRight" || c === "KeyD" || c === "KeyX") registerTap("R");
      else if (c === "Space" || c === "ArrowUp") { if (armed && earlyPress) { earlyPress(); return; } actionPress(); }
    };
    window.addEventListener("keydown", kd);
    const padL = $("#padL"), padR = $("#padR");
    const tapL = (e: Event) => { e.preventDefault(); registerTap("L", true); };
    const tapR = (e: Event) => { e.preventDefault(); registerTap("R", true); };
    padL.addEventListener("pointerdown", tapL);
    padR.addEventListener("pointerdown", tapR);
    keyHandler = () => { window.removeEventListener("keydown", kd); padL.removeEventListener("pointerdown", tapL); padR.removeEventListener("pointerdown", tapR); };

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

    function playerStep(r: any, dt: number) {
      const at = r.a.attrs;
      // cadence decay
      const pressure = opts.importance >= 4 ? 1 + Math.max(0, 70 - at.cmp) * 0.0035 : 1;
      const decayMul = (1.26 - at.con * 0.0038) * pressure * (r.fatR > 40 ? 1.12 : 1);
      r.cad = Math.max(0, r.cad - (3.0 + r.cad * 0.105) * decayMul * dt);
      // drafting
      let draft = false;
      if (EV[evk].g !== "spr") for (const o of racers) if (o !== r && !o.fin && !o.dq && o.x > r.x && o.x - r.x < 3.5) { draft = true; break; }
      r.drafting = draft;
      // live sustainable threshold
      r.susCad = clamp(susCadFor(r.a, evk) - r.fatR * 0.08, 28, 100);
      // energy
      const over = Math.max(0, r.cad - r.susCad);
      const drain = Math.pow(over, 1.35) * 0.10 * dt * (draft ? 0.85 : 1);
      const recov = r.cad < r.susCad * 0.85 ? (EV[evk].g === "mid" ? 1.0 + at.aer * 0.012 : 0.3) * (1 + at.rec * 0.004) * dt : 0;
      r.E = clamp(r.E - drain + recov, 0, 100);
      // race fatigue builds when running on empty
      r.fatR = clamp(r.fatR + Math.max(0, 25 - r.E) * 0.02 * dt, 0, 60);
      // speed: cadence relative to sustainable threshold → race pace at threshold, more = faster but costly
      const wE = clamp(D / 900, 0.22, 1); // la energía pesa poco en sprints, mucho en fondo
      const eFac = 1 - 0.45 * (1 - r.E / 100) * wE;
      const q = clamp(r.cad / r.susCad, 0, 112 / r.susCad);
      const vPhys = r.vAvg * r.vCapMul;
      let vT = Math.min(r.vAvg * Math.pow(q, r.kEx) * eFac, vPhys);
      const tRun = Math.max(0, raceT - (r.reaction || 0));
      const tau = 1.5 - at.acc * 0.007;
      vT = Math.min(vT, vPhys * (1 - Math.exp(-tRun / tau)) * 1.02 + 0.3);
      if (r.clipT > 0) { vT *= r.clipBig ? 0.45 : 0.62; r.clipT -= dt; }
      r.v += clamp(vT - r.v, -9 * dt, r.acc * dt);
      if (r.v < 2.5 && r.E > 0 && tRun > 0.5) r.v = 2.5;
      r.x += r.v * dt;
      // hurdle prompt + auto resolution
      if (ev.hurdles) {
        if (!r.hurDone) r.hurDone = new Set();
        let nextH = -1;
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = ev.h1 + h * ev.hs;
          if (!r.hurDone.has(h) && hx >= r.x) { nextH = h; break; }
        }
        if (nextH >= 0 && (ev.h1 + nextH * ev.hs) - r.x <= 15 && r.v > 3) {
          r.hurPrompt = nextH;
          prompt(`¡VALLA! <b>[ESPACIO]</b>`, "jump");
        } else {
          r.hurPrompt = -1;
          prompt(r.x > D - 9 && !r.dipped ? `¡INCLÍNATE! <b>[ESPACIO]</b>` : "", "dip");
        }
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = ev.h1 + h * ev.hs;
          if (r.x >= hx && !r.hurDone.has(h)) {
            r.hurDone.add(h);
            if (r.hurJumped.has(h)) continue; // resolved by jump input
            const pClip = ((100 - at.tec) / 100) * 0.22;
            if (Math.random() < pClip) {
              r.clipBig = Math.random() < 0.18;
              r.clipT = r.clipBig ? 0.55 : 0.3;
              banner(r.clipBig ? "¡GOLPE FUERTE CON LA VALLA!" : "¡TOCAS LA VALLA!", "var(--red)");
              snd("bad");
            }
          }
        }
      } else if (player.x > D - 9 && !player.dipped && !player.fin) {
        prompt(`¡INCLÍNATE! <b>[ESPACIO]</b>`, "dip");
      } else if (!ev.hurdles) prompt("");
      // splits & banners
      for (const sp of splits) if (r.x >= sp && !splitsHit.has(sp)) { splitsHit.add(sp); banner(`${sp} m — ${fmtTime(raceT - (r.reaction || 0))}`, "#fff"); }
      if (!r.finalBanner && r.x / D >= 0.75 && D >= 400) { r.finalBanner = true; banner("¡RECTA FINAL!", "var(--acc)"); }
      if (r.x >= D) {
        r.fin = true;
        r.t = raceT - (r.dipOK ? 0.08 : 0);
        r.celebrate = 1;
        prompt("");
      }
    }

    function step(dt: number) {
      raceT += dt;
      for (const r of racers) {
        if (r.fin || r.dq) continue;
        if (r.reaction == null) continue; // esperando reacción (jugador)
        if (raceT < r.reaction) continue;
        if (r.isPlayer) { playerStep(r, dt); continue; }
        /* ---- AI ---- */
        const f = clamp(r.x / D, 0, 1);
        const pi = phaseAt(f);
        if (pi !== r.phaseIdx) r.phaseIdx = pi;
        let u = r.uSel[pi];
        const oi = clamp(r.aiOpts[pi], 0, phases[pi].opts.length - 1);
        u = phases[pi].opts[Math.min(oi, phases[pi].opts.length - 1)].u;
        if (r.E < 22) u -= 0.035;
        if (r.E > 55 && f > 0.72 && (r.a.style === "kicker" || r.a.style === "tactician")) u += 0.02;
        let draft = false;
        if (EV[evk].g !== "spr") for (const o of racers) if (o !== r && !o.fin && o.x > r.x && o.x - r.x < 3.5) { draft = true; break; }
        const drain = Math.pow(Math.max(0, u - r.sus), 1.7) * r.kd * dt * (draft ? 0.86 : 1);
        const recov = u < r.sus ? (0.3 + r.a.attrs.aer * 0.011) * r.rec * dt : 0.12 * r.rec * dt;
        r.E = clamp(r.E - drain + recov, 0, 100);
        let vCap = r.vAvg * profAt(prof, f) * u;
        const err = r.planX - r.x;
        vCap *= clamp(1 + err * 0.004, 0.955, 1.05);
        if (r.E < 20) vCap *= 0.8 + 0.2 * (r.E / 20);
        if (r.E <= 0.5) vCap *= 0.86;
        if (r.clipT > 0) { vCap *= r.clipBig ? 0.45 : 0.62; r.clipT -= dt; }
        r.v += clamp(vCap - r.v, -9 * dt, r.acc * dt);
        r.x += r.v * dt;
        r.planX += r.vAvg * profAt(prof, f) * u * dt;
        if (ev.hurdles) {
          for (let h = 0; h < ev.hurdles; h++) {
            const hx = ev.h1 + h * ev.hs;
            if (!r.hurDone) r.hurDone = new Set();
            if (r.x >= hx && !r.hurDone.has(h)) {
              r.hurDone.add(h);
              const pClip = ((100 - r.a.attrs.tec) / 100) * 0.22;
              if (Math.random() < pClip) { r.clipBig = Math.random() < 0.18; r.clipT = r.clipBig ? 0.55 : 0.3; }
            }
          }
        }
        if (r.x >= D) { r.fin = true; r.t = raceT; r.celebrate = 1; }
      }
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
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101827"); g.addColorStop(0.22, "#1A2438"); g.addColorStop(0.3, "#241812"); g.addColorStop(1, "#3A1E12");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const leader = racers.reduce((m, r) => (r.x > m.x ? r : m), racers[0]);
      const focus = camMode === 1 ? leader : (player || leader);
      const ppm = W / 115;
      const camX = clamp(focus.x - 42, -20, D - 60);
      const trackTop = H * 0.3, laneH = Math.min(34, (H * 0.62) / racers.length);
      const excite = clamp(1.6 - Math.abs(leader.x - (D - 15)) / 60, 0.3, 1.6) * (leader.x > D * 0.7 ? 1.4 : 0.8);
      for (const c of crowd) {
        const cx = c.x * W, cy = trackTop * 0.18 + c.y * trackTop * 0.72;
        const bounce = Math.abs(Math.sin(now / 260 + c.ph)) * 3 * excite;
        ctx.fillStyle = c.c; ctx.globalAlpha = 0.5;
        ctx.fillRect(cx, cy - bounce, 3, 5);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#223048"; ctx.fillRect(0, trackTop - 14, W, 8);
      const tg = ctx.createLinearGradient(0, trackTop, 0, H);
      tg.addColorStop(0, "#B34327"); tg.addColorStop(1, "#8E3320");
      ctx.fillStyle = tg; ctx.fillRect(0, trackTop, W, H - trackTop);
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5;
      for (let i = 0; i <= racers.length; i++) {
        const y = trackTop + i * laneH + 6;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.font = `600 11px Oswald, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,.55)";
      const startM = Math.floor(camX / 10) * 10;
      for (let m = startM; m < camX + 120; m += 10) {
        if (m < 0 || m > D) continue;
        const x = (m - camX) * ppm;
        ctx.strokeStyle = m % 50 === 0 ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.1)";
        ctx.beginPath(); ctx.moveTo(x, trackTop + 4); ctx.lineTo(x, H - 4); ctx.stroke();
        if (m % 50 === 0) ctx.fillText(`${m}`, x + 3, trackTop + 16);
      }
      const sx = (0 - camX) * ppm;
      if (sx > -20 && sx < W + 20) { ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(sx - 1.5, trackTop, 3, H - trackTop); }
      const fx = (D - camX) * ppm;
      if (fx > -40 && fx < W + 40) {
        for (let yy = trackTop; yy < H; yy += 8) {
          ctx.fillStyle = (Math.floor(yy / 8) % 2 === 0) ? "#fff" : "#111";
          ctx.fillRect(fx - 3, yy, 6, 8);
        }
        ctx.font = `700 13px Oswald, sans-serif`; ctx.fillStyle = "#FFC531";
        ctx.fillText("META", fx - 14, trackTop - 4);
      }
      if (ev.hurdles) {
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = (ev.h1 + h * ev.hs - camX) * ppm;
          if (hx < -10 || hx > W + 10) continue;
          ctx.fillStyle = "#FFC531";
          ctx.fillRect(hx - 1, trackTop + 2, 2.5, H - trackTop - 6);
        }
      }
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
      // cadence bar
      const cadPct = clamp((player.cad / 112) * 100, 0, 100);
      const cf = $("#cadfill");
      cf.style.width = cadPct + "%";
      const overThr = player.cad > player.susCad;
      cf.style.background = overThr ? "linear-gradient(90deg,var(--grn),var(--gold) 60%,#FF5A2B)" : "linear-gradient(90deg,#1E8F62,var(--grn))";
      $("#cadthr").style.left = clamp((player.susCad / 112) * 100, 0, 100) + "%";
      $("#cadval").textContent = Math.round(player.cad);
      $("#cadval").style.color = overThr ? "#FF8A5C" : "var(--grn)";
      $("#spdval").textContent = (player.v * 3.6).toFixed(1) + " km/h";
      // positions
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
      c2.fillStyle = "rgba(0,0,0,.35)";
      c2.beginPath(); c2.ellipse(0, 2, 9, 2.6, 0, 0, 6.29); c2.fill();
      const lean = clamp(r.v / 11, 0, 1) * 0.28 + (r.clipT > 0 ? 0.2 : 0) + (r.dipped && r.isPlayer ? 0.35 : 0);
      const hop = r.fin && r.place === 1 && r.isPlayer ? Math.abs(Math.sin(now / 140)) * 5 : 0;
      c2.translate(0, -hop);
      c2.rotate(lean * 0.4);
      c2.strokeStyle = r.a.skin || "#C6885C"; c2.lineWidth = 2.6; c2.lineCap = "round";
      c2.beginPath(); c2.moveTo(0, -12); c2.lineTo(swing * 6, -1); c2.moveTo(0, -12); c2.lineTo(swing2 * 6, -1); c2.stroke();
      c2.strokeStyle = r.color; c2.lineWidth = 4.4;
      c2.beginPath(); c2.moveTo(0, -12); c2.lineTo(1.5, -22); c2.stroke();
      c2.strokeStyle = r.a.skin || "#C6885C"; c2.lineWidth = 2;
      c2.beginPath(); c2.moveTo(1, -20); c2.lineTo(1 + swing2 * 4, -13); c2.moveTo(1, -20); c2.lineTo(1 + swing * 4, -13); c2.stroke();
      c2.fillStyle = r.a.skin || "#C6885C";
      c2.beginPath(); c2.arc(2.5, -26, 3.1, 0, 6.29); c2.fill();
      c2.fillStyle = r.a.hair || "#1C1B1A";
      c2.beginPath(); c2.arc(2, -27.4, 2.6, Math.PI * 0.9, Math.PI * 2.05); c2.fill();
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
      const fx = W * 0.86;
      for (let yy = trackTop; yy < H; yy += 8) { ctx.fillStyle = Math.floor(yy / 8) % 2 === 0 ? "#fff" : "#111"; ctx.fillRect(fx, yy, 5, 8); }
      ctx.font = "700 13px Oswald"; ctx.fillStyle = "#FFC531"; ctx.fillText("META", fx - 12, trackTop - 4);
      ctx.fillStyle = "rgba(76,195,255,.15)"; ctx.fillRect(W * 0.74, trackTop, W * 0.12, H - trackTop);
      ctx.font = "600 10px Oswald"; ctx.fillStyle = "rgba(76,195,255,.9)"; ctx.fillText("ZONA DE CAMBIO", W * 0.745, trackTop + 14);
      totals.forEach((t: any, i: number) => {
        const y = trackTop + i * laneH + 6 + laneH * 0.75;
        const x = W * 0.08 + clamp(t.progFrac || 0, 0, 1) * (fx - W * 0.08);
        if (t.dq) { ctx.fillStyle = "rgba(255,77,94,.8)"; ctx.font = "700 12px Oswald"; ctx.fillText("DQ", 20, y); return; }
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

    for (let leg = 0; leg < 4; leg++) {
      $("#legind").textContent = `POSTA ${leg + 1}/4 · ${rel.legs[leg]} m`;
      banner(`POSTA ${leg + 1} — ${rel.legs[leg]} m`, "var(--blu)");
      const playerRunsThis = playerTeam && !playerTeam.dq && playerTeam.team.playerLeg === leg;
      if (playerRunsThis) {
        $("#rsub").textContent = "¡Te toca! Alterna ◀ ▶ para esprintar tu posta.";
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
        for (const t of totals) if (t !== playerTeam && !t.dq) t.total += legEstimate(t.team.runners[leg], rel.legs[leg], leg === 0) * rnd(0.985, 1.02);
        await wait(600);
      } else {
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
