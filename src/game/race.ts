// @ts-nocheck
/* ============ RACES: stride-control engine + pseudo-3D stadium renderer ============ */
import { EV, RELAYS, JERSEYS, SKINS, HAIRS } from "./data";
import { S, G, clamp, rnd, ri, pick, gauss } from "./store";
import { dayPlanTime, fmtTime, legEstimate } from "./model";
import { snd } from "./sound";

/* ---------------- event play-parameters ---------------- */
const EVP: any = {
  "60":   { cad: 4.55, cost: 2.20, fat: 1.15, spr: 0.55 },
  "100":  { cad: 4.45, cost: 1.90, fat: 1.00, spr: 0.55 },
  "200":  { cad: 4.25, cost: 1.25, fat: 0.90, spr: 0.60, curve: true },
  "300":  { cad: 4.05, cost: 1.00, fat: 1.00, spr: 0.62 },
  "400":  { cad: 3.95, cost: 0.88, fat: 1.05, spr: 0.62, curve: true },
  "800":  { cad: 3.50, cost: 0.55, fat: 0.75, spr: 0.70 },
  "1500": { cad: 3.18, cost: 0.27, fat: 0.50, spr: 0.80 },
  "3000": { cad: 2.92, cost: 0.12, fat: 0.34, spr: 0.86 },
  "110H": { cad: 4.15, cost: 1.35, fat: 0.95, spr: 0.55 },
  "400H": { cad: 3.85, cost: 0.90, fat: 0.95, spr: 0.62, curve: true },
};
/* effort levels: cadence ceiling, speed ceiling, energy cost, fatigue rate */
const EFFORTS = [
  { n: "RECUPERACIÓN", pct: "60–70%", ceil: 0.78, cadCeil: 0.80, cost: -0.5, fat: -0.30 },
  { n: "CONTROLADO",   pct: "75–85%", ceil: 0.94, cadCeil: 0.97, cost: 1.0,  fat: 0.35 },
  { n: "ALTO",         pct: "85–95%", ceil: 1.02, cadCeil: 1.04, cost: 1.75, fat: 0.70 },
  { n: "MÁXIMO",       pct: "95–100%", ceil: 1.09, cadCeil: 1.12, cost: 2.9,  fat: 1.20 },
];
function defaultEffort(evk: string): number {
  return ({ "60": 3, "100": 3, "200": 3, "110H": 3, "300": 2, "400": 2, "400H": 2, "800": 1, "1500": 1, "3000": 1 } as any)[evk] ?? 2;
}

function cadOptFor(a: any, evk: string): number {
  const at = a.attrs;
  const g = EV[evk].g;
  let c = EVP[evk]?.cad ?? 3.5;
  if (g === "spr") c += (at.acc - 50) * 0.006 + (at.pow - 50) * 0.003;
  else c += (at.aer - 50) * 0.004 + (at.ana - 50) * 0.002;
  c += (at.tec - 50) * 0.002;
  return clamp(c, 2.4, 5.2);
}

/* ---------------- color helpers ---------------- */
function shade(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}
const SHORTS = ["#141821", "#1B2333", "#232A3A", "#101418", "#2A1E1E", "#1E2A24"];
const SHOES = ["#F2F2F2", "#FFC531", "#FF5A2B", "#4CC3FF", "#3DDC97", "#FF4D5E", "#B07CFF"];
function buildViz(a: any, isPlayer: boolean): any {
  return {
    skin: a.skin || pick(SKINS),
    hair: a.hair || pick(HAIRS),
    hairStyle: isPlayer ? (a.hairStyle ?? ri(0, 3)) : ri(0, 4),
    shirt: isPlayer ? (a.jersey || "#FF5A2B") : pick(JERSEYS),
    shorts: pick(SHORTS),
    shoes: pick(SHOES),
    hScale: rnd(0.95, 1.07),
    build: rnd(0.92, 1.12),
    bib: isPlayer ? 1 : ri(2, 99),
  };
}

/* ---------------- stadium scene helpers ---------------- */
const CROWDC = ["#C8452C", "#2C61C8", "#C8A22C", "#3FA861", "#8A5CC8", "#C85C8A", "#5CC8B8", "#B8B8C0", "#786050", "#C8783C", "#4C78C8", "#A0A8B8"];
function stadiumCfg(tier: number): any {
  if (tier <= 2) return { upper: false, den: 0.5, roof: false, screen: false, night: false, flags: false, pal: "day", boards: ["CLUB ATLETISMO", "SPORT", "AGUA FRESCA", "RADIO CITY", "FITNES"], flood: 0 };
  if (tier === 3) return { upper: true, den: 0.75, roof: false, screen: true, night: false, flags: false, pal: "day", boards: ["ATHLETICS RISE", "VOLT", "AERO SPIKES", "RUNFAST", "NACIONAL FM"], flood: 0 };
  if (tier === 4) return { upper: true, den: 0.95, roof: true, screen: true, night: true, flags: true, pal: "dusk", boards: ["ATHLETICS RISE", "VOLT ENERGY", "AERO SPIKES", "GLOBAL SPORTS", "RISE FM"], flood: 1 };
  return { upper: true, den: 1.1, roof: true, screen: true, night: true, flags: true, pal: "night", boards: ["★ MUNDIAL ★", "ATHLETICS RISE", "VOLT ENERGY", "AERO SPIKES", "GLOBAL SPORTS"], flood: 1 };
}
function makeCrowdStrip(den: number): any {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 64;
  const x = c.getContext("2d")!;
  for (let row = 0; row < 4; row++) {
    const y = 8 + row * 15;
    x.fillStyle = row % 2 ? "#232D42" : "#1B2438";
    x.fillRect(0, y - 4, 640, 14);
    x.fillStyle = "rgba(0,0,0,.25)";
    x.fillRect(0, y + 9, 640, 1.5);
    const step = Math.max(3, Math.round(7 - den * 2));
    for (let px = 0; px < 640; px += step) {
      if (Math.random() > 0.68 + den * 0.25) continue;
      const col = CROWDC[Math.floor(Math.random() * CROWDC.length)];
      x.fillStyle = col;
      x.fillRect(px + Math.random() * 2, y - 2 + Math.random() * 2, 2.6, 4.6);
      x.fillStyle = "#E8C8A0";
      x.fillRect(px + 0.4 + Math.random() * 2, y - 4 + Math.random() * 2, 1.8, 1.8);
    }
  }
  return c;
}
function genProps(D: number, zFar: number): any[] {
  const props: any[] = [];
  props.push({ x: 4, z: -1.6, t: "cam" }, { x: -2.5, z: -1.15, t: "judge" }, { x: D + 5, z: -1.7, t: "cam" }, { x: D + 2, z: -1.15, t: "judge" });
  for (let x = 30; x < D - 10; x += 60) props.push({ x, z: -1.4, t: Math.random() < 0.5 ? "cone" : "bag" });
  props.push({ x: D * 0.28 + 8, z: zFar + 6, t: "bench" });
  props.push({ x: D * 0.55 + 5, z: zFar + 9, t: "table" });
  props.push({ x: D * 0.8 + 4, z: zFar + 5, t: "cone" });
  return props;
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
    const P = EVP[evk] || EVP["800"];
    const isMid = ev.g === "mid";

    const racers: any[] = opts.racers.map((r: any, i: number) => {
      const T = r.isPlayer
        ? dayPlanTime(r.a, evk, opts.importance)
        : dayPlanTime(r.a, evk, opts.importance) / (opts.planMul || 1) / rnd(0.985, 1.005);
      const at = r.a.attrs;
      const vPace = D / T;
      const cadOpt = cadOptFor(r.a, evk);
      return {
        a: r.a, isPlayer: !!r.isPlayer, lane: i, x: 0, v: 0, E: 100, fat: 0,
        fin: false, t: Infinity, reaction: null as number | null, dq: false,
        vPace, T, cadOpt, stride: vPace / (cadOpt * (r.isPlayer ? 1 : 0.84)),
        accRate: 3.1 + at.acc * 0.05 + at.pow * 0.025,
        effortIdx: defaultEffort(evk), sprint: false, sprintT: 0, sprintCd: 0,
        cad: 0, combo: 0, rhythmQ: 0.8, lastTapT: 0, lastSide: null,
        legPhase: rnd(0, 6.28), stepAnim: 0,
        color: r.isPlayer ? r.a.jersey : pick(JERSEYS),
        viz: buildViz(r.a, !!r.isPlayer),
        startBlend: 0, drafting: false, dipped: false, dipOK: false,
        hurDone: new Set(), hurJumped: new Set(), hurPrompt: -1,
        celebrate: 0, place: 0, overFlash: 0,
        // AI
        aiSeed: rnd(0, 100), aiRhythm: clamp(0.97 + at.tec * 0.0008 + gauss() * 0.015, 0.95, 1.08),
        aiStyle: r.a.style || "pacer", aiSprinted: false,
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
          <div class="statrow"><span class="lbl" style="width:64px">Fatiga</span>
            <div class="bar fat" style="height:10px"><i id="fbar" style="width:0%"></i></div>
            <span class="val" id="fval" style="width:36px">0</span></div>
          <div class="hud-sub" id="draftline" style="color:var(--blu); display:none">◈ REBUFO — ahorrando</div>
        </div>
        <div class="hud-ctrl">
          <div class="cadmodule">
            <div class="cadmain">
              <span class="cadbig num" id="cadbig">0.0</span>
              <span class="cadunit">zancadas/s</span>
            </div>
            <div class="cadside">
              <div class="cadobj num" id="cadobj">OBJ ${P.cad.toFixed(1)}</div>
              <div class="perfectlamp" id="plamp">RITMO</div>
              <div class="combo num" id="combo"></div>
            </div>
          </div>
          <div class="effchips" id="effchips">
            ${EFFORTS.map((e, i) => `<button class="effchip" data-eff="${i}"><b>${i + 1}</b> ${e.n}<small>${e.pct}</small></button>`).join("")}
          </div>
          <button class="sprintbtn" id="sprintbtn" disabled>SPRINT FINAL <b>[S]</b></button>
          <div class="keyhint"><b>← →</b> zancada alterna · <b>1–4</b> esfuerzo · <b>S</b> sprint · <b>ESPACIO</b> vallas / meta</div>
        </div>
        <div class="hud-side" id="poslist"></div>
      </div>
      <div class="touchpads">
        <button class="tpad" id="padL"><span>◀</span><small>PIERNA IZQ</small></button>
        <button class="tpad" id="padR"><span>▶</span><small>PIERNA DER</small></button>
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
      bannerTO = setTimeout(() => (bannerEl.innerHTML = ""), 1500);
    }
    const promptEl = $("#actionprompt");
    function prompt(txt: string, cls = "") { promptEl.innerHTML = txt ? `<div class="actprompt ${cls}">${txt}</div>` : ""; }

    /* effort UI */
    function setEffort(i: number) {
      player.effortIdx = clamp(i, 0, 3);
      root.querySelectorAll(".effchip").forEach((c: any) => c.classList.toggle("on", +c.dataset.eff === player.effortIdx));
      snd("tick");
    }
    setEffort(player.effortIdx);
    root.querySelectorAll(".effchip").forEach((c: any) => (c.onclick = () => { if (running && !player.fin && !player.dq) setEffort(+c.dataset.eff); }));

    /* splits */
    const splits: number[] = D === 800 ? [200, 400, 600] : D === 1500 ? [500, 1000] : D === 3000 ? [1000, 2000] : D === 400 || evk === "400H" ? [200] : [];
    const splitsHit = new Set();

    /* ---------- start sequence ---------- */
    const startov = $("#startov");
    let raceT = 0, running = false, raceOver = false, attempts = 2, armed = false;
    let raf = 0, destroyed = false, keyHandler: any;
    let gunRealT = 0, gunFired = false, shake = 0;
    let earlyPress: (() => void) | null = null;

    function startSequence() {
      armed = true;
      startov.style.display = "flex";
      startov.innerHTML = `<div class="st-word" style="color:var(--blu)">LISTOS…</div>
        <div class="ctrl-guide">
          <div><b>← →</b> alterna las piernas: cada pulsación es una zancada. Busca tu <b style="color:var(--grn)">cadencia óptima</b>, no machaques.</div>
          <div><b>1–4</b> cambia el esfuerzo · <b>S</b> sprint final · <b>ESPACIO</b> salta vallas e inclínate en meta</div>
          <div>Mantén el <b>RITMO</b> perfecto: alterna bien y ahorra energía.</div>
        </div>
        <div class="st-hint">Espera el disparo en los tacos…</div>`;
      snd("ready");
      setTimeout(() => {
        if (destroyed) return;
        startov.innerHTML = `<div class="st-word" style="color:var(--gold)">¿LISTOS?</div>
          <div class="st-hint big">Espera el disparo…<br><small>Salir antes = nula · Intentos: ${attempts}</small></div>`;
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
            startov.innerHTML = `<div class="st-word" style="color:var(--red)">SALIDA NULA</div><div class="st-hint">Segunda nula — DESCALIFICADO</div>`;
            player.dq = true;
            setTimeout(finishAll, 1600);
          } else {
            startov.innerHTML = `<div class="st-word" style="color:var(--red)">¡SALIDA NULA!</div><div class="st-hint">Te has adelantado. Queda ${attempts} intento.</div>`;
            setTimeout(startSequence, 1500);
          }
        };
      }, 1500);
    }

    function fireGun() {
      gunRealT = performance.now();
      gunFired = true;
      armed = false;
      startov.innerHTML = `<div class="st-word" style="color:var(--grn)">¡YA!</div>`;
      (root.querySelector(".racecanvas") as HTMLElement).classList.add("flash");
      shake = 1;
      snd("gun");
      for (const r of racers) if (!r.isPlayer) r.reaction = clamp(0.13 + Math.random() * 0.11 - r.a.attrs.stt * 0.0006 + gauss() * 0.02, 0.105, 0.3);
      setTimeout(() => { if (player.reaction == null) player.reaction = 0.55; }, 900);
      running = true;
      setTimeout(() => { if (!destroyed) startov.style.display = "none"; }, 650);
    }

    /* ---------- player input: strides ---------- */
    function registerTap(side: string) {
      if (destroyed) return;
      if (!running) { if (armed && earlyPress) earlyPress(); return; }
      if (player.dq || player.fin) return;
      if (player.reaction == null) {
        player.reaction = clamp((performance.now() - gunRealT) / 1000 - 0.03, 0.105, 0.6);
        banner(`Reacción: ${Math.round(player.reaction * 1000)} ms`, player.reaction < 0.16 ? "var(--grn)" : player.reaction > 0.3 ? "var(--red)" : "#fff");
      }
      if (raceT < player.reaction - 0.03) return;
      const now = performance.now();
      player.tapTimes.push(now);
      while (player.tapTimes.length && now - player.tapTimes[0] > 1600) player.tapTimes.shift();
      const alternating = player.lastSide !== side;
      player.lastSide = side;
      player.lastTapT = now;
      if (alternating) {
        player.combo++;
        const at = player.a.attrs;
        const q = player.rhythmQ;
        const imp = (0.10 + at.pow * 0.0012) * q * speed;
        player.v = Math.min(player.v + imp, player.vPace * 1.16);
        player.stepAnim = 1;
        spawnDust(player);
        if (q >= 1.0 && player.combo % 3 === 0) floats.push({ x: player.x, y: 2.2, txt: "PERFECT", color: "#FFC531", life: 0.7, big: true });
        if (player.combo % 2 === 0) snd("tick");
      } else {
        player.combo = 0;
        player.stepAnim = 0.5;
        floats.push({ x: player.x, y: 2.0, txt: "×", color: "#FF4D5E", life: 0.5, big: false });
        player.v *= 0.985;
      }
      const pad = side === "L" ? $("#padL") : $("#padR");
      pad.classList.add("hit"); setTimeout(() => pad.classList.remove("hit"), 90);
    }
    player.tapTimes = [];

    function actionPress() {
      if (destroyed || !running || player.dq || player.fin) return;
      if (player.reaction == null) player.reaction = clamp((performance.now() - gunRealT) / 1000 - 0.03, 0.105, 0.6);
      if (player.hurPrompt >= 0) {
        const hx = ev.h1 + player.hurPrompt * ev.hs;
        const d = hx - player.x;
        player.hurJumped.add(player.hurPrompt);
        player.hurDone.add(player.hurPrompt);
        prompt("");
        if (d >= -1.5 && d <= 3.5) { banner("¡VALLA PERFECTA!", "var(--grn)"); if (player.a.attrs.tec > 82) player.v += 0.3; }
        else if (d > 3.5 && d <= 9) { banner("Valla justa", "#fff"); player.v *= 0.97; }
        else { banner("¡Salto descolocado!", "var(--red)"); player.v *= 0.9; snd("bad"); }
        return;
      }
      if (!player.dipped && player.x > D - 9) {
        player.dipped = true;
        if (player.x > D - 3.5) { player.dipOK = true; banner("¡GRAN INCLINACIÓN! −0.08 s", "var(--grn)"); snd("swap"); }
        else banner("Te has inclinado demasiado pronto", "var(--red)");
        prompt("");
      }
    }

    function toggleSprint() {
      if (destroyed || !running || player.dq || player.fin || player.sprint) return;
      const f = player.x / D;
      if (f < P.spr || player.sprintCd > 0 || player.E < 15) return;
      player.sprint = true;
      player.sprintT = 0;
      banner("¡SPRINT FINAL!", "var(--acc)");
      snd("win");
    }

    const kd = (e: KeyboardEvent) => {
      const c = e.code;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "Digit1", "Digit2", "Digit3", "Digit4", "KeyS"].includes(c)) e.preventDefault();
      if (e.repeat) return;
      if (c === "ArrowLeft") registerTap("L");
      else if (c === "ArrowRight") registerTap("R");
      else if (c === "Space" || c === "ArrowUp") { if (armed && earlyPress) { earlyPress(); return; } actionPress(); }
      else if (c === "Digit1") { if (running) setEffort(0); }
      else if (c === "Digit2") { if (running) setEffort(1); }
      else if (c === "Digit3") { if (running) setEffort(2); }
      else if (c === "Digit4") { if (running) setEffort(3); }
      else if (c === "KeyS") toggleSprint();
    };
    window.addEventListener("keydown", kd);
    const padL = $("#padL"), padR = $("#padR");
    const tapL = (e: Event) => { e.preventDefault(); registerTap("L"); };
    const tapR = (e: Event) => { e.preventDefault(); registerTap("R"); };
    padL.addEventListener("pointerdown", tapL);
    padR.addEventListener("pointerdown", tapR);
    $("#sprintbtn").onclick = () => toggleSprint();
    keyHandler = () => { window.removeEventListener("keydown", kd); padL.removeEventListener("pointerdown", tapL); padR.removeEventListener("pointerdown", tapR); };

    /* ---------- particles / floats ---------- */
    const dust: any[] = [];
    const floats: any[] = [];
    const confetti: any[] = [];
    function spawnDust(r: any) {
      if (r.v < 2 || dust.length > 70) return;
      dust.push({ x: r.x - 0.5, y: 0.2, vx: -rnd(0.5, 1.6), vy: rnd(0.4, 1.1), life: rnd(0.3, 0.55), r: rnd(1, 2.4), lane: r.lane });
    }

    /* ---------- physics ---------- */
    const STEP = 1 / 60;
    let accSim = 0, lastFrame = performance.now();

    function effortOf(r: any): any { return EFFORTS[r.effortIdx]; }

    function physics(r: any, dt: number) {
      const at = r.a.attrs;
      const ef = effortOf(r);
      const cadRaw = r.cad;
      // usable cadence ceiling (mashing beyond it wastes energy, adds no speed)
      const cadCeil = r.cadOpt * ef.cadCeil * (r.sprint ? 1.16 : 1) * (1 - r.fat * 0.0012);
      const cadUse = Math.min(cadRaw, cadCeil);
      const overRatio = cadCeil > 0 ? cadRaw / cadCeil : 1;
      // band quality: how close usable cadence is to optimal
      const ratio = cadUse / r.cadOpt;
      let bandQ = ratio >= 1 ? (ratio > 1.03 ? 0.965 : 1.0) : clamp(0.52 + 0.52 * (ratio / 0.96), 0.5, 1.0);
      if (ratio >= 0.94 && ratio <= 1.04) bandQ = Math.max(bandQ, 1.0);
      const energyQ = 0.82 + 0.18 * (r.E / 100);
      const fatSpeedF = 1 - r.fat * 0.0013;
      // drafting
      let draft = false;
      if (isMid) for (const o of racers) if (o !== r && !o.fin && !o.dq && o.x > r.x && o.x - r.x < 3.5) { draft = true; break; }
      r.drafting = draft;
      // curve
      const f = clamp(r.x / D, 0, 1);
      let curveF = 1;
      if (P.curve && (f < 0.25 || (f > 0.5 && f < 0.75))) curveF = 0.962 + at.tec * 0.0004;
      // target speed = cadence × stride × quality
      const q = r.rhythmQ * bandQ * energyQ * fatSpeedF * curveF;
      let vT = cadUse * r.stride * q * ef.ceil * (r.sprint ? 1.07 : 1);
      vT = Math.min(vT, r.vPace * 1.14);
      const tRun = Math.max(0, raceT - (r.reaction || 0.2));
      const driveCap = r.accRate * tRun * 1.02 + 0.4;
      vT = Math.min(vT, driveCap);
      if (r.clipT > 0) { vT *= r.clipBig ? 0.45 : 0.62; r.clipT -= dt; }
      r.v += clamp(vT - r.v, -10 * dt, r.accRate * dt);
      if (r.v < 0) r.v = 0;
      r.x += r.v * dt;
      // animation phase follows cadence
      r.legPhase += Math.PI * Math.max(cadUse, r.v / Math.max(r.stride, 0.5)) * dt;
      r.stepAnim = Math.max(0, r.stepAnim - 3 * dt);
      /* ----- energy ----- */
      const attrMod = clamp(isMid ? 1 - (at.aer - 50) * 0.003 : 1 - (at.ana - 50) * 0.003, 0.78, 1.2);
      const formMod = 1 + (55 - r.a.form) * 0.005 + r.fat * 0.002;
      let cadCostMul = 1 + Math.max(0, cadRaw / r.cadOpt - 1) * 1.5 + (overRatio > 1 ? (overRatio - 1) * 3.2 : 0);
      let cost: number;
      if (r.sprint) cost = P.cost * 4.1;
      else if (ef.cost < 0) cost = ef.cost;
      else cost = P.cost * ef.cost * cadCostMul * attrMod * formMod * (draft ? 0.85 : 1);
      if (cost < 0) r.E = clamp(r.E - cost * (0.5 + at.aer * 0.006) * dt, 0, 100);
      else r.E = clamp(r.E - cost * dt, 0, 100);
      if (isMid && !r.sprint && cadRaw < r.cadOpt * 0.8 && ef.cost > 0) r.E = clamp(r.E + 0.22 * dt, 0, 100);
      /* ----- fatigue ----- */
      let fr = 0;
      if (r.sprint) fr += 1.5;
      else fr += P.fat * (ef.fat < 0 ? ef.fat : ef.fat);
      fr += Math.max(0, cadRaw / r.cadOpt - 1.08) * 9;
      if (r.E < 25) fr += (25 - r.E) * 0.022;
      r.fat = clamp(r.fat + fr * dt, 0, 100);
      /* ----- sprint bookkeeping ----- */
      if (r.sprint) {
        r.sprintT += dt;
        if (r.sprintT > 12 || r.E < 8) { r.sprint = false; r.sprintCd = 5; if (r.isPlayer) banner("Fin del sprint", "#fff"); }
      } else if (r.sprintCd > 0) r.sprintCd -= dt;
    }

    function playerStep(r: any, dt: number) {
      // measured cadence from taps (per second)
      const now = performance.now();
      while (r.tapTimes.length && now - r.tapTimes[0] > 1600) r.tapTimes.shift();
      const instCad = r.tapTimes.length >= 2 ? (r.tapTimes.length - 1) / ((now - r.tapTimes[0]) / 1000) : 0;
      const recent = now - r.lastTapT < 700;
      const targetCad = recent ? instCad : 0;
      const tau = targetCad > r.cad ? 0.22 : 0.5;
      r.cad += (targetCad - r.cad) * clamp(dt / tau, 0, 1);
      // rhythm quality from alternation combo + cadence band
      const ratio = Math.min(r.cad, r.cadOpt * 1.2) / r.cadOpt;
      const inBand = ratio >= 0.9 && ratio <= 1.08;
      const comboQ = 0.78 + Math.min(0.27, r.combo * 0.042);
      let qTarget = comboQ * (inBand ? 1.03 : 0.94) * (ratio > 1.15 ? 0.82 : 1);
      r.rhythmQ += (qTarget - r.rhythmQ) * clamp(dt * 3, 0, 1);
      r.overFlash = ratio > 1.18 ? 1 : Math.max(0, r.overFlash - dt * 2);
      physics(r, dt);
      /* ----- prompts: hurdles & dip ----- */
      if (ev.hurdles) {
        let nextH = -1;
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = ev.h1 + h * ev.hs;
          if (!r.hurDone.has(h) && hx >= r.x) { nextH = h; break; }
        }
        if (nextH >= 0 && (ev.h1 + nextH * ev.hs) - r.x <= 15 && r.v > 3) { r.hurPrompt = nextH; prompt(`¡VALLA! <b>[ESPACIO]</b>`, "jump"); }
        else { r.hurPrompt = -1; prompt(r.x > D - 9 && !r.dipped ? `¡INCLÍNATE! <b>[ESPACIO]</b>` : "", "dip"); }
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = ev.h1 + h * ev.hs;
          if (r.x >= hx && !r.hurDone.has(h)) {
            r.hurDone.add(h);
            if (r.hurJumped.has(h)) continue;
            const pClip = ((100 - r.a.attrs.tec) / 100) * 0.22;
            if (Math.random() < pClip) {
              r.clipBig = Math.random() < 0.18;
              r.clipT = r.clipBig ? 0.55 : 0.3;
              banner(r.clipBig ? "¡GOLPE FUERTE CON LA VALLA!" : "¡TOCAS LA VALLA!", "var(--red)");
              snd("bad");
            }
          }
        }
      } else if (r.x > D - 9 && !r.dipped && !r.fin) prompt(`¡INCLÍNATE! <b>[ESPACIO]</b>`, "dip");
      else if (!ev.hurdles) prompt("");
      /* ----- splits / banners ----- */
      for (const sp of splits) if (r.x >= sp && !splitsHit.has(sp)) { splitsHit.add(sp); banner(`${sp} m — ${fmtTime(raceT - (r.reaction || 0))}`, "#fff"); }
      if (!r.finalBanner && f0(r) >= 0.75 && D >= 400) { r.finalBanner = true; banner("¡RECTA FINAL!", "var(--acc)"); }
      if (!r.sprHint && f0(r) >= P.spr && r.E > 25) { r.sprHint = true; banner("SPRINT FINAL DISPONIBLE [S]", "var(--acc)"); }
      if (r.x >= D) {
        r.fin = true;
        r.t = raceT - (r.dipOK ? 0.08 : 0);
        r.celebrate = 1;
        prompt("");
      }
    }
    function f0(r: any) { return clamp(r.x / D, 0, 1); }

    /* ---------- AI ---------- */
    const AI_PLAN: any = {
      sprinter: [[0, 3], [0.6, 2], [0.85, 3]],
      front:    [[0, 3], [0.25, 2], [0.7, 2], [0.86, 3]],
      kicker:   [[0, 1], [0.5, 1], [0.75, 2], [0.87, 3]],
      pacer:    [[0, 2], [0.8, 2], [0.9, 3]],
      tactician:[[0, 1], [0.4, 2], [0.7, 2], [0.86, 3]],
      allround: [[0, 2], [0.75, 2], [0.88, 3]],
    };
    function aiStep(r: any, dt: number) {
      const f = clamp(r.x / D, 0, 1);
      const plan = AI_PLAN[r.aiStyle] || AI_PLAN.pacer;
      let eff = 2;
      for (const [fr, e] of plan) if (f >= fr) eff = e;
      r.effortIdx = eff;
      // sprint decision
      if (!r.sprint && !r.aiSprinted && f >= P.spr + rnd(-0.02, 0.06) && r.E > 28) { r.sprint = true; r.aiSprinted = true; }
      // cadence target with noise + surges
      const surge = Math.sin(raceT * 0.4 + r.aiSeed) * 0.02 + Math.sin(raceT * 1.7 + r.aiSeed * 2) * 0.012;
      const cadTarget = r.cadOpt * (0.9 + 0.045 * eff) * (1 + surge) * (r.sprint ? 1.1 : 1);
      r.cad += (cadTarget - r.cad) * clamp(dt * 2.2, 0, 1);
      r.rhythmQ = r.aiRhythm;
      physics(r, dt);
      if (ev.hurdles) {
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = ev.h1 + h * ev.hs;
          if (r.x >= hx && !r.hurDone.has(h)) {
            r.hurDone.add(h);
            const pClip = ((100 - r.a.attrs.tec) / 100) * 0.22;
            if (Math.random() < pClip) { r.clipBig = Math.random() < 0.18; r.clipT = r.clipBig ? 0.55 : 0.3; }
          }
        }
      }
      if (r.x >= D) { r.fin = true; r.t = raceT; r.celebrate = 1; }
    }

    function step(dt: number) {
      raceT += dt;
      shake = Math.max(0, shake - dt * 2.5);
      for (const r of racers) {
        if (r.fin || r.dq) continue;
        if (raceT < (r.reaction ?? 0.2)) { r.startBlend = 0; continue; }
        r.startBlend = clamp(r.startBlend + dt / 0.55, 0, 1);
        if (r.isPlayer) playerStep(r, dt); else aiStep(r, dt);
      }
      // particles
      for (let i = dust.length - 1; i >= 0; i--) { const p = dust[i]; p.life -= dt; p.x += p.vx * dt * 0.3; p.y += p.vy * dt; if (p.life <= 0) dust.splice(i, 1); }
      for (let i = floats.length - 1; i >= 0; i--) { const p = floats[i]; p.life -= dt; p.y += dt * 1.4; if (p.life <= 0) floats.splice(i, 1); }
      // overtake banners
      if (!raceOver && !player.fin && !player.dq) {
        const ahead = racers.filter((r) => !r.dq && r.x > player.x).length;
        if (player.lastAhead === undefined) player.lastAhead = ahead;
        if (ahead > player.lastAhead) {
          const who = racers.filter((r) => !r.dq && r.x > player.x).sort((a, b) => b.x - a.x)[0];
          if (who && raceT > 3) banner(`¡${who.a.last.toUpperCase()} TE ADELANTA!`, "var(--red)");
        } else if (ahead < player.lastAhead && player.lastAhead > 0) {
          banner("¡ADELANTAS!", "var(--grn)");
        }
        player.lastAhead = ahead;
      }
      if (racers.every((r) => r.fin || r.dq) && !raceOver) { raceOver = true; setTimeout(finishAll, 1000); }
      else if (!raceOver && player.fin && raceT > player.t + 6) {
        for (const r of racers) if (!r.fin && !r.dq) { r.fin = true; r.t = raceT + (D - r.x) / Math.max(r.v, 3); }
        raceOver = true; setTimeout(finishAll, 800);
      }
    }

    /* ============================================================
       PSEUDO-3D STADIUM RENDERER
       Camera at athlete height, angled across+along the track.
       Ground-plane projection toward a vanishing point.
       ============================================================ */
    const tier = clamp(opts.importance || 1, 1, 5);
    const CFG = stadiumCfg(tier);
    const crowdStrip = makeCrowdStrip(CFG.den);
    const f = 22, zCam = -2.6, laneWm = 1.22;
    const nL = racers.length;
    const zFar = nL * laneWm;
    const zStand = zFar + 26;
    const Pof = (z: number) => f / (f + z - zCam);
    const props = genProps(D, zFar);
    const dynCrowd: any[] = [];
    for (let wx = -260; wx < D + 280; wx += 4.2) dynCrowd.push({ wx, row: ri(0, 7), ph: rnd(0, 6.28), c: CROWDC[ri(0, CROWDC.length - 1)] });
    const clouds: any[] = [];
    for (let i = 0; i < 7; i++) clouds.push({ x: rnd(0, 1.4), y: rnd(0.02, 0.16), s: rnd(0.6, 1.3), v: rnd(0.004, 0.012) });
    const stars: any[] = [];
    for (let i = 0; i < 60; i++) stars.push({ x: Math.random(), y: Math.random() * 0.2, tw: rnd(0, 6.28) });
    const drawState: any = { camX: -10, zoom: 1, flashes: [] };

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
      if (shake > 0) ctx.translate(rnd(-3, 3) * shake, rnd(-2, 2) * shake);

      /* ---- camera ---- */
      const leader = racers.reduce((m, r) => (r.x > m.x ? r : m), racers[0]);
      const focus = camMode === 1 ? leader : (player || leader);
      const camTarget = clamp(focus.x + 26, 14, D + 2);
      drawState.camX += (camTarget - drawState.camX) * 0.09;
      const camX = drawState.camX;
      const zoomT = (player.fin || player.x > D - 28) ? 1.16 : 1;
      drawState.zoom += (zoomT - drawState.zoom) * 0.025;
      const zoom = drawState.zoom;
      const vpX = W * 0.64;
      const M = (W / 82) * zoom;

      /* ---- vertical layout ---- */
      const nearY = H * 0.905;
      const spacingNorm = (l: number) => Math.pow(Math.min(1, ((l + 1) * laneWm) / zFar), 0.82) - Math.pow(Math.min(1, (l * laneWm) / zFar), 0.82);
      const boost = clamp(40 / (spacingNorm(player.lane) * H), 1, 1.22);
      const bandH = clamp(H * 0.47 * boost, H * 0.455, H * 0.545);
      const farY = nearY - bandH;
      const skyH = H * 0.05;
      const standsZone = Math.max(40, farY - skyH);
      const infieldH = standsZone * 0.24, boardH = standsZone * 0.08, lowerH = standsZone * 0.36, upperH = standsZone * 0.22, roofH = standsZone * 0.10;
      const boardsTop = farY - infieldH - boardH;
      const lowerTop = boardsTop - lowerH;
      const upperTop = lowerTop - (CFG.upper ? upperH : 0);
      const risePx = H * 0.0006;

      const projX = (xw: number, z: number) => vpX + (xw - camX) * M * Pof(z);
      const groundY = (z: number, xf: number) => {
        let y: number;
        if (z <= zFar) {
          const yv = z < 0 ? (z / zFar) * 0.82 : Math.pow(z / zFar, 0.82);
          y = nearY - bandH * yv;
        } else {
          const u = clamp((z - zFar) / (zStand - zFar), 0, 1);
          y = farY - infieldH * Math.pow(u, 0.9);
        }
        return y + xf * risePx * Pof(z);
      };

      const excite = clamp(1.6 - Math.abs(leader.x - (D - 15)) / 60, 0.3, 1.6) * (leader.x > D * 0.7 ? 1.5 : 0.85) + (player.fin && player.place === 1 ? 0.9 : 0);

      /* ================= SKY ================= */
      let sky: any;
      if (CFG.pal === "night") {
        sky = ctx.createLinearGradient(0, 0, 0, farY);
        sky.addColorStop(0, "#060B1C"); sky.addColorStop(0.6, "#122041"); sky.addColorStop(1, "#243B63");
      } else if (CFG.pal === "dusk") {
        sky = ctx.createLinearGradient(0, 0, 0, farY);
        sky.addColorStop(0, "#2A3B66"); sky.addColorStop(0.55, "#8A5A78"); sky.addColorStop(1, "#E88A4A");
      } else {
        sky = ctx.createLinearGradient(0, 0, 0, farY);
        sky.addColorStop(0, "#5FB4E8"); sky.addColorStop(0.7, "#A8D8F2"); sky.addColorStop(1, "#D8ECF8");
      }
      ctx.fillStyle = sky; ctx.fillRect(-8, -8, W + 16, farY + 8);
      // stars / sun / moon
      if (CFG.pal === "night") {
        for (const st of stars) {
          ctx.globalAlpha = 0.4 + 0.4 * Math.sin(now / 700 + st.tw);
          ctx.fillStyle = "#DCE8FF";
          ctx.fillRect(st.x * W, st.y * H, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#E8EEF8";
        ctx.beginPath(); ctx.arc(W * 0.85, H * 0.08, 14, 0, 6.29); ctx.fill();
        ctx.fillStyle = CFG.pal === "night" ? "#122041" : "#A8D8F2";
        ctx.beginPath(); ctx.arc(W * 0.85 + 5, H * 0.08 - 3, 11, 0, 6.29); ctx.fill();
      } else if (CFG.pal === "dusk") {
        const sg = ctx.createRadialGradient(W * 0.2, farY * 0.75, 4, W * 0.2, farY * 0.75, 90);
        sg.addColorStop(0, "rgba(255,190,110,.95)"); sg.addColorStop(0.25, "rgba(255,160,80,.5)"); sg.addColorStop(1, "rgba(255,160,80,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W * 0.2, farY * 0.75, 90, 0, 6.29); ctx.fill();
        ctx.fillStyle = "#FFD89A"; ctx.beginPath(); ctx.arc(W * 0.2, farY * 0.75, 15, 0, 6.29); ctx.fill();
      } else {
        const sg = ctx.createRadialGradient(W * 0.16, H * 0.07, 4, W * 0.16, H * 0.07, 110);
        sg.addColorStop(0, "rgba(255,250,220,.95)"); sg.addColorStop(0.2, "rgba(255,244,190,.55)"); sg.addColorStop(1, "rgba(255,244,190,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W * 0.16, H * 0.07, 110, 0, 6.29); ctx.fill();
        ctx.fillStyle = "#FFF6CE"; ctx.beginPath(); ctx.arc(W * 0.16, H * 0.07, 16, 0, 6.29); ctx.fill();
      }
      // clouds
      const cloudCol = CFG.pal === "night" ? "rgba(38,52,88,.8)" : CFG.pal === "dusk" ? "rgba(255,214,170,.75)" : "rgba(255,255,255,.85)";
      for (const cl of clouds) {
        const cx = ((cl.x * W * 1.6 + now * cl.v * 8 - camX * M * 0.02) % (W + 260) + W + 260) % (W + 260) - 130;
        const cy = cl.y * H;
        ctx.fillStyle = cloudCol;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 46 * cl.s, 13 * cl.s, 0, 0, 6.29);
        ctx.ellipse(cx + 30 * cl.s, cy + 4, 30 * cl.s, 10 * cl.s, 0, 0, 6.29);
        ctx.ellipse(cx - 32 * cl.s, cy + 5, 26 * cl.s, 9 * cl.s, 0, 0, 6.29);
        ctx.fill();
      }

      /* ================= FAR STANDS ================= */
      const parF = M * Pof(zStand);
      const stripOff = (camX * parF) % 640;
      const tileStrip = (y: number, h: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        for (let x = -stripOff - 640; x < W + 640; x += 640) ctx.drawImage(crowdStrip, x, y, 640, h);
        ctx.globalAlpha = 1;
      };
      // upper tier
      if (CFG.upper) {
        ctx.fillStyle = CFG.pal === "night" ? "#141D33" : "#2C3A58";
        ctx.fillRect(0, upperTop, W, upperH);
        tileStrip(upperTop + upperH * 0.08, upperH * 0.92, 0.9);
        ctx.fillStyle = "rgba(0,0,0,.22)";
        for (let i = 1; i < 4; i++) ctx.fillRect(0, upperTop + (upperH / 4) * i, W, 2);
        // roof
        ctx.fillStyle = CFG.pal === "night" ? "#0E1526" : "#3D4C6E";
        ctx.beginPath();
        ctx.moveTo(-8, upperTop);
        ctx.lineTo(W + 8, upperTop);
        ctx.lineTo(W + 8, upperTop - roofH * 0.55);
        ctx.quadraticCurveTo(W * 0.5, upperTop - roofH * 1.5, -8, upperTop - roofH * 0.55);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = CFG.pal === "night" ? "#22314F" : "#55688E";
        ctx.fillRect(0, upperTop - 3, W, 3);
        // flags on parapet
        if (CFG.flags) {
          for (let wx = Math.floor((camX - 170) / 6) * 6; wx < camX + (W / parF) + 40; wx += 6) {
            const fx = projX(wx, zStand);
            if (fx < -20 || fx > W + 20) continue;
            const wave = Math.sin(now / 180 + wx) * 2.4;
            ctx.strokeStyle = "#C8CCD6"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(fx, upperTop - 2); ctx.lineTo(fx, upperTop - 13); ctx.stroke();
            ctx.fillStyle = CROWDC[Math.abs(Math.floor(wx / 6)) % CROWDC.length];
            ctx.beginPath();
            ctx.moveTo(fx, upperTop - 13);
            ctx.quadraticCurveTo(fx + 6, upperTop - 12 + wave * 0.4, fx + 11, upperTop - 10 + wave);
            ctx.lineTo(fx, upperTop - 7);
            ctx.closePath(); ctx.fill();
          }
        }
      } else {
        // small meet: low back wall + simple roofline instead of upper tier
        ctx.fillStyle = CFG.pal === "night" ? "#101828" : "#3A4A68";
        ctx.fillRect(0, lowerTop - standsZone * 0.34, W, standsZone * 0.34);
        ctx.fillStyle = CFG.pal === "night" ? "#1C2740" : "#4E5F82";
        ctx.fillRect(0, lowerTop - standsZone * 0.34, W, 4);
        ctx.fillStyle = "rgba(0,0,0,.18)";
        for (let i = 1; i < 4; i++) ctx.fillRect(0, lowerTop - standsZone * 0.34 + (standsZone * 0.34 / 4) * i, W, 1.5);
      }
      // lower tier
      ctx.fillStyle = CFG.pal === "night" ? "#182238" : "#33425F";
      ctx.fillRect(0, lowerTop, W, lowerH);
      tileStrip(lowerTop + lowerH * 0.06, lowerH * 0.94, 1);
      ctx.fillStyle = "rgba(0,0,0,.25)";
      for (let i = 1; i < 5; i++) ctx.fillRect(0, lowerTop + (lowerH / 5) * i, W, 2);
      // animated crowd dots (world-anchored, proper parallax)
      const rowH = lowerH / 8;
      for (const d of dynCrowd) {
        const dx = projX(d.wx, zStand);
        if (dx < -6 || dx > W + 6) continue;
        const bounce = Math.abs(Math.sin(now / 220 + d.ph)) * 3.2 * excite;
        const dy = lowerTop + 4 + (d.row % 5) * rowH - bounce;
        ctx.fillStyle = d.c;
        ctx.fillRect(dx, dy, 2.6, 4.4);
      }
      // security barrier at stands base
      ctx.fillStyle = CFG.pal === "night" ? "#223048" : "#4A5A78";
      ctx.fillRect(0, boardsTop - 4, W, 4);

      /* ---- jumbotron (world-anchored screens) ---- */
      if (CFG.screen) {
        for (const jx of [D * 0.33, D * 0.82]) {
          const sx = projX(jx, zStand);
          if (sx < -160 || sx > W + 160) continue;
          const sw = 150 * (parF / M) * 2.6 * zoom, sh = sw * 0.42;
          const sy = lowerTop + lowerH * 0.14;
          ctx.fillStyle = "#0A0F1C";
          ctx.fillRect(sx - sw / 2 - 4, sy - 4, sw + 8, sh + 8);
          ctx.fillStyle = "#050810";
          ctx.fillRect(sx - sw / 2, sy, sw, sh);
          const lead = leader.fin ? `${leader.a.last.toUpperCase()} ${fmtTime(leader.t)}` : `${leader.a.last.toUpperCase()} · EN PISTA`;
          ctx.textAlign = "center";
          ctx.fillStyle = "#FFC531";
          ctx.font = `700 ${Math.max(9, sh * 0.3)}px Oswald, sans-serif`;
          ctx.fillText(EV[evk].label.toUpperCase() + (tier >= 4 ? " · " + (opts.meetName || "").toUpperCase().slice(0, 16) : ""), sx, sy + sh * 0.38);
          ctx.fillStyle = "#4CC3FF";
          ctx.font = `700 ${Math.max(10, sh * 0.4)}px Oswald, sans-serif`;
          ctx.fillText(lead, sx, sy + sh * 0.8);
          ctx.textAlign = "left";
          // screen glow
          const gg = ctx.createRadialGradient(sx, sy + sh / 2, 4, sx, sy + sh / 2, sw);
          gg.addColorStop(0, "rgba(80,160,255,.10)"); gg.addColorStop(1, "rgba(80,160,255,0)");
          ctx.fillStyle = gg; ctx.fillRect(sx - sw, sy - sh, sw * 2, sh * 3);
        }
      }
      // camera flashes on victory
      if (player.fin && player.place === 1 && drawState.flashes.length < 40 && Math.random() < 0.5) {
        drawState.flashes.push({ x: rnd(0, W), y: rnd(lowerTop, boardsTop), life: rnd(0.06, 0.16) });
      }
      for (let i = drawState.flashes.length - 1; i >= 0; i--) {
        const fl = drawState.flashes[i]; fl.life -= 0.016;
        if (fl.life <= 0) { drawState.flashes.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(255,255,255,${clamp(fl.life * 8, 0, 0.9)})`;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, 2.2, 0, 6.29); ctx.fill();
      }

      /* ================= AD BOARDS ================= */
      const zAd = zFar + 19;
      const adBase = farY - infieldH;
      for (let wx = Math.floor((camX - 150) / 12) * 12; wx < camX + 200; wx += 12) {
        if (wx < -30) continue;
        const x1 = projX(wx, zAd), x2 = projX(wx + 11.4, zAd);
        if (x2 < -10 || x1 > W + 10) continue;
        const hAd = boardH * 0.92 * (Pof(zAd) / 0.42);
        const idx = Math.abs(Math.floor(wx / 12));
        const colA = ["#173252", "#3D1F16", "#123B2E", "#3A2A48"][idx % 4];
        const colT = ["#4CC3FF", "#FFC531", "#3DDC97", "#FF8AC2"][idx % 4];
        ctx.fillStyle = colA;
        ctx.fillRect(x1, adBase - hAd, x2 - x1, hAd);
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.fillRect(x1, adBase - hAd, x2 - x1, 2);
        ctx.fillStyle = colT;
        ctx.font = `700 ${Math.max(7, hAd * 0.42)}px Oswald, sans-serif`;
        ctx.fillText(CFG.boards[idx % CFG.boards.length], x1 + 4, adBase - hAd * 0.32);
      }

      /* ================= INFIELD ================= */
      ctx.fillStyle = CFG.pal === "night" ? "#1E4A2E" : "#2E7A44";
      ctx.fillRect(0, adBase, W, farY - adBase);
      // mow stripes
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,.045)" : "rgba(0,0,0,.05)";
        const y1 = adBase + ((farY - adBase) / 5) * i;
        ctx.fillRect(0, y1, W, (farY - adBase) / 5);
      }
      // inner curb
      ctx.fillStyle = "#E8E8E8";
      ctx.fillRect(0, farY - 2.5, W, 2.5);

      /* ================= TRACK ================= */
      // surface: lane bands with slight alternation + distance darkening
      for (let l = 0; l < nL; l++) {
        const z1 = l * laneWm, z2 = (l + 1) * laneWm;
        ctx.beginPath();
        let first = true;
        for (let xf = -70; xf <= 80; xf += 8) {
          const px = projX(camX + xf, z1), py = groundY(z1, xf);
          if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
        }
        for (let xf = 80; xf >= -70; xf -= 8) ctx.lineTo(projX(camX + xf, z2), groundY(z2, xf));
        ctx.closePath();
        const base = l % 2 ? "#B34526" : "#A83E22";
        ctx.fillStyle = base;
        ctx.fill();
      }
      // depth shading over track
      const tshade = ctx.createLinearGradient(0, farY, 0, nearY);
      tshade.addColorStop(0, "rgba(30,10,5,.30)"); tshade.addColorStop(0.35, "rgba(30,10,5,.05)"); tshade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = tshade;
      ctx.beginPath();
      ctx.moveTo(0, farY); ctx.lineTo(W, farY); ctx.lineTo(W, nearY + 60); ctx.lineTo(0, nearY + 60);
      ctx.fill();
      // track sheen (sun / floodlights)
      if (CFG.pal !== "night") {
        const sheen = ctx.createLinearGradient(0, farY, 0, nearY);
        sheen.addColorStop(0, "rgba(255,220,170,.10)"); sheen.addColorStop(0.5, "rgba(255,220,170,0)");
        ctx.fillStyle = sheen;
        ctx.fillRect(0, farY, W, nearY - farY);
      }
      // lane lines (converging)
      for (let l = 0; l <= nL; l++) {
        const z = l * laneWm;
        ctx.strokeStyle = l === 0 || l === nL ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.5)";
        ctx.lineWidth = l === 0 || l === nL ? 2 : 1.3;
        ctx.beginPath();
        for (let xf = -70; xf <= 84; xf += 6) {
          const px = projX(camX + xf, z), py = groundY(z, xf);
          if (xf === -70) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // distance ticks + painted numbers on apron + cross-lines every 50m
      for (let m2 = Math.floor((camX - 70) / 10) * 10; m2 < camX + 84; m2 += 10) {
        if (m2 < 0 || m2 > D) continue;
        const cross = m2 % 50 === 0;
        if (cross) {
          ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(projX(m2, 0), groundY(0, m2 - camX));
          ctx.lineTo(projX(m2, zFar), groundY(zFar, m2 - camX));
          ctx.stroke();
        }
        // apron number
        const nx = projX(m2, -1.3), ny = groundY(-1.3, m2 - camX);
        if (nx > -30 && nx < W + 30 && (cross || m2 % 20 === 0)) {
          ctx.save();
          ctx.translate(nx, ny);
          ctx.scale(1, 0.55);
          ctx.fillStyle = cross ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.25)";
          ctx.font = `700 ${cross ? 17 : 11}px Oswald, sans-serif`;
          ctx.fillText(String(m2), -8, 0);
          ctx.restore();
        }
      }
      // lane numbers painted near start
      for (let l = 0; l < nL; l++) {
        const lx = projX(3.2, (l + 0.5) * laneWm), ly = groundY((l + 0.5) * laneWm, 3.2 - camX);
        if (lx < -20 || lx > W + 20) continue;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.scale(1, 0.5);
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.font = `700 ${clamp(bandH * spacingNorm(l) * 0.42, 9, 22)}px Oswald, sans-serif`;
        ctx.fillText(String(l + 1), -4, 0);
        ctx.restore();
      }

      /* ================= APRON (near foreground) ================= */
      ctx.beginPath();
      let firstA = true;
      for (let xf = -70; xf <= 84; xf += 8) {
        const px = projX(camX + xf, 0), py = groundY(0, xf);
        if (firstA) { ctx.moveTo(px, py); firstA = false; } else ctx.lineTo(px, py);
      }
      for (let xf = 84; xf >= -70; xf -= 8) ctx.lineTo(projX(camX + xf, -2.4), groundY(-2.4, xf));
      ctx.closePath();
      ctx.fillStyle = CFG.pal === "night" ? "#5E2B18" : "#7A3A22";
      ctx.fill();
      // foreground pit below apron
      const apronEdgeY = groundY(-2.4, 0);
      ctx.fillStyle = "#1A130E";
      ctx.fillRect(0, apronEdgeY, W, H - apronEdgeY + 8);

      /* ---- start line + blocks ---- */
      const stX0 = projX(0, 0), stX1 = projX(0, zFar);
      if (stX0 > -40 && stX0 < W + 40) {
        ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(stX0, groundY(0, -camX)); ctx.lineTo(stX1, groundY(zFar, -camX)); ctx.stroke();
        for (const r of racers) {
          const bx = projX(-0.4, (r.lane + 0.5) * laneWm), by = groundY((r.lane + 0.5) * laneWm, -0.4 - camX);
          ctx.fillStyle = "#2A2F3A";
          const bs = clamp(bandH * spacingNorm(r.lane) * 0.12, 3, 9);
          ctx.fillRect(bx - bs, by - bs * 0.4, bs, bs * 0.8);
          ctx.fillRect(bx - bs * 1.9, by - bs * 0.2, bs, bs * 0.8);
        }
      }

      /* ---- finish checker band ---- */
      const fnVis = D - camX > -30 && D - camX < 110;
      if (fnVis) {
        for (let l = 0; l < nL; l++) {
          const zc = (l + 0.5) * laneWm;
          for (let k = 0; k < 2; k++) {
            const xw = D + k * 0.7;
            const fx = projX(xw, zc), fy = groundY(zc, xw - camX);
            const wCk = 0.7 * M * Pof(zc);
            ctx.fillStyle = (l + k) % 2 ? "#F4F4F4" : "#141414";
            ctx.fillRect(fx - wCk / 2, fy - 2.4, wCk, 4.8);
          }
        }
      }

      /* ================= TRACKSIDE PROPS ================= */
      for (const pr of props) {
        const dx = projX(pr.x, pr.z);
        if (dx < -40 || dx > W + 40) continue;
        const dy = groundY(pr.z, pr.x - camX);
        const pz = Pof(pr.z);
        const s = clamp(pz * 1.15, 0.35, 1.5) * zoom;
        if (pr.t === "cone") {
          ctx.fillStyle = "#FF7A2B";
          ctx.beginPath(); ctx.moveTo(dx, dy - 11 * s); ctx.lineTo(dx - 5 * s, dy); ctx.lineTo(dx + 5 * s, dy); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#F4F4F4"; ctx.fillRect(dx - 3.4 * s, dy - 6 * s, 6.8 * s, 2 * s);
        } else if (pr.t === "bag") {
          ctx.fillStyle = "#2C3A52";
          ctx.beginPath(); ctx.roundRect(dx - 8 * s, dy - 7 * s, 16 * s, 7 * s, 3 * s); ctx.fill();
          ctx.fillStyle = "#FF5A2B"; ctx.fillRect(dx - 8 * s, dy - 4.4 * s, 16 * s, 1.6 * s);
        } else if (pr.t === "cam") {
          // tripod + camera
          ctx.strokeStyle = "#3A4250"; ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(dx, dy - 16 * s); ctx.lineTo(dx - 7 * s, dy);
          ctx.moveTo(dx, dy - 16 * s); ctx.lineTo(dx + 7 * s, dy);
          ctx.moveTo(dx, dy - 16 * s); ctx.lineTo(dx, dy - 2 * s);
          ctx.stroke();
          ctx.fillStyle = "#1C222E";
          ctx.fillRect(dx - 6 * s, dy - 24 * s, 12 * s, 8 * s);
          ctx.fillStyle = "#4CC3FF";
          ctx.beginPath(); ctx.arc(dx + 5 * s, dy - 20 * s, 2.6 * s, 0, 6.29); ctx.fill();
          if (player.fin && Math.floor(now / 300) % 2 === 0) {
            ctx.fillStyle = "rgba(255,255,255,.9)";
            ctx.beginPath(); ctx.arc(dx + 5 * s, dy - 20 * s, 4 * s, 0, 6.29); ctx.fill();
          }
        } else if (pr.t === "judge") {
          ctx.fillStyle = "#22304A";
          ctx.beginPath(); ctx.roundRect(dx - 4 * s, dy - 14 * s, 8 * s, 14 * s, 2 * s); ctx.fill();
          ctx.fillStyle = "#E8C8A0";
          ctx.beginPath(); ctx.arc(dx, dy - 17 * s, 3.4 * s, 0, 6.29); ctx.fill();
          ctx.fillStyle = "#F4F4F4";
          ctx.fillRect(dx + 2 * s, dy - 11 * s, 3 * s, 4 * s);
        } else if (pr.t === "bench") {
          ctx.fillStyle = "#8A5A2B";
          ctx.fillRect(dx - 14 * s, dy - 5 * s, 28 * s, 2.6 * s);
          ctx.fillRect(dx - 12 * s, dy - 2.6 * s, 2.4 * s, 3 * s);
          ctx.fillRect(dx + 10 * s, dy - 2.6 * s, 2.4 * s, 3 * s);
        } else if (pr.t === "table") {
          ctx.fillStyle = "#2C61C8";
          ctx.fillRect(dx - 16 * s, dy - 8 * s, 32 * s, 3 * s);
          ctx.fillStyle = "#22304A";
          ctx.fillRect(dx - 14 * s, dy - 5 * s, 2.6 * s, 5 * s);
          ctx.fillRect(dx + 11 * s, dy - 5 * s, 2.6 * s, 5 * s);
          ctx.fillStyle = "#F4F4F4";
          ctx.fillRect(dx - 6 * s, dy - 11 * s, 8 * s, 3 * s);
        }
      }

      /* ================= FLOODLIGHT TOWERS ================= */
      for (let wx = Math.floor((camX - 190) / 90) * 90; wx < camX + (W / parF) + 60; wx += 90) {
        const tx = projX(wx + 45, zStand + 4);
        if (tx < -60 || tx > W + 60) continue;
        const baseYt = upperTop + 2;
        const poleH = H * 0.16;
        ctx.strokeStyle = CFG.pal === "night" ? "#2C3A58" : "#4A5A78";
        ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(tx, baseYt); ctx.lineTo(tx, baseYt - poleH); ctx.stroke();
        ctx.fillStyle = CFG.pal === "night" ? "#1C2740" : "#3D4C6E";
        ctx.fillRect(tx - 13, baseYt - poleH - 10, 26, 11);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = CFG.flood ? "#FFF2C8" : "#6A7690";
          ctx.beginPath(); ctx.arc(tx - 9 + k * 6, baseYt - poleH - 4.5, 2.4, 0, 6.29); ctx.fill();
        }
        if (CFG.flood) {
          const gl = ctx.createRadialGradient(tx, baseYt - poleH - 4, 4, tx, baseYt - poleH - 4, 70);
          gl.addColorStop(0, "rgba(255,242,200,.5)"); gl.addColorStop(1, "rgba(255,242,200,0)");
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(tx, baseYt - poleH - 4, 70, 0, 6.29); ctx.fill();
          // light cone to track
          ctx.fillStyle = "rgba(255,242,200,.05)";
          ctx.beginPath();
          ctx.moveTo(tx - 10, baseYt - poleH);
          ctx.lineTo(tx + 10, baseYt - poleH);
          ctx.lineTo(tx + 130, nearY);
          ctx.lineTo(tx - 60, nearY);
          ctx.closePath(); ctx.fill();
        }
      }

      /* ================= HURDLES ================= */
      if (ev.hurdles) {
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = ev.h1 + h * ev.hs;
          if (hx - camX < -20 || hx - camX > 60) continue;
          for (let l = 0; l < nL; l++) {
            const zc = (l + 0.5) * laneWm;
            const dx = projX(hx, zc), dy = groundY(zc, hx - camX);
            const hh = clamp(bandH * spacingNorm(l) * 0.62, 10, 34);
            const hw = clamp(bandH * spacingNorm(l) * 0.42, 8, 22);
            ctx.strokeStyle = "#C8CCD6"; ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(dx - hw / 2, dy); ctx.lineTo(dx - hw / 2, dy - hh * 0.82);
            ctx.moveTo(dx + hw / 2, dy); ctx.lineTo(dx + hw / 2, dy - hh * 0.82);
            ctx.stroke();
            ctx.fillStyle = "#FFC531";
            ctx.fillRect(dx - hw / 2 - 1, dy - hh, hw + 2, hh * 0.22);
            ctx.fillStyle = "#141414";
            ctx.fillRect(dx - 2, dy - hh, 4, hh * 0.22);
          }
        }
      }

      /* ================= RACERS ================= */
      const sortedR = [...racers].sort((a, b) => groundY(a.lane * laneWm, a.x - camX) - groundY(b.lane * laneWm, b.x - camX));
      for (const r of sortedR) {
        const zc = r.lane * laneWm;
        const gx = projX(r.x, zc), gy = groundY(zc, r.x - camX);
        if (gx < -80 || gx > W + 80) continue;
        const sp = bandH * spacingNorm(r.lane);
        const s = clamp(sp * 2.55, 40, 220) / 60;
        // speed lines
        if (r.v > r.vPace * 0.85 && !r.fin) {
          ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 1.4;
          for (let k = 0; k < 3; k++) {
            const ly = gy - 8 - k * 11 * s;
            ctx.beginPath(); ctx.moveTo(gx - 26 - k * 12, ly); ctx.lineTo(gx - 8 - k * 6, ly); ctx.stroke();
          }
        }
        drawAthlete(ctx, gx, gy, r, now, s * r.viz.hScale, sp);
        if (r.isPlayer || r === leader || r.x > D) {
          ctx.font = `600 ${clamp(10 * zoom, 9, 13)}px Oswald, sans-serif`;
          const label = r.isPlayer ? `${r.a.first} (TÚ)` : `${r.a.last}`;
          ctx.fillStyle = r.isPlayer ? "#FFC531" : "rgba(255,255,255,.72)";
          ctx.fillText(label, gx - 16, gy - 62 * s - 8);
        }
      }

      /* ================= FINISH GANTRY + OFFICIAL CLOCK ================= */
      if (fnVis) {
        const zn = -1.7, zf = zFar + 1.6;
        const x1 = projX(D, zn), y1 = groundY(zn, D - camX);
        const x2 = projX(D, zf), y2 = groundY(zf, D - camX);
        const h1 = H * 0.24 * Pof(zn) * zoom, h2 = H * 0.24 * Pof(zf) * zoom;
        // posts
        ctx.fillStyle = "#22304A";
        ctx.fillRect(x1 - 4, y1 - h1, 8, h1);
        ctx.fillRect(x2 - 3, y2 - h2, 6, h2);
        // beam
        ctx.beginPath();
        ctx.moveTo(x1 - 4, y1 - h1);
        ctx.lineTo(x2 + 3, y2 - h2);
        ctx.lineTo(x2 + 3, y2 - h2 + 12);
        ctx.lineTo(x1 - 4, y1 - h1 + 16);
        ctx.closePath();
        ctx.fillStyle = CFG.pal === "night" ? "#1C2740" : "#2C3A58";
        ctx.fill();
        ctx.fillStyle = "#FFC531";
        ctx.font = `700 ${clamp(13 * zoom, 10, 17)}px Oswald, sans-serif`;
        const midX = (x1 + x2) / 2, midY = (y1 - h1 + y2 - h2) / 2;
        ctx.textAlign = "center";
        ctx.fillText("M E T A", midX, midY + 12);
        ctx.textAlign = "left";
        // hanging official clock
        const cw = 96 * zoom, ch = 34 * zoom;
        const cxk = midX, cyk = midY + 18;
        ctx.fillStyle = "#050810";
        ctx.beginPath(); ctx.roundRect(cxk - cw / 2, cyk, cw, ch, 4); ctx.fill();
        ctx.strokeStyle = "#2C3A58"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(cxk - cw / 2, cyk, cw, ch, 4); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "#FF7A2B";
        ctx.font = `700 ${18 * zoom}px 'Courier New', monospace`;
        ctx.fillText(fmtTime(Math.max(0, raceT)), cxk, cyk + ch * 0.62);
        ctx.fillStyle = "#8AA0C0";
        ctx.font = `600 ${8 * zoom}px Oswald, sans-serif`;
        ctx.fillText(EV[evk].label.toUpperCase() + " · CRONO OFICIAL", cxk, cyk + ch * 0.9);
        ctx.textAlign = "left";
      }

      /* ================= PARTICLES / FLOATS ================= */
      for (const p of dust) {
        const zc = (p.lane + 0.5) * laneWm;
        const x = projX(p.x, zc), y = groundY(zc, p.x - camX) - p.y * 8;
        ctx.globalAlpha = clamp(p.life * 1.6, 0, 0.5);
        ctx.fillStyle = "#E8C9A8";
        ctx.beginPath(); ctx.arc(x, y, p.r * zoom, 0, 6.29); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const p of floats) {
        const zc = (player.lane + 0.5) * laneWm;
        const x = projX(p.x, zc), y = groundY(zc, p.x - camX) - 90 * zoom - p.y * 10;
        ctx.globalAlpha = clamp(p.life * 2, 0, 1);
        ctx.font = `${p.big ? "700 16px" : "700 13px"} Oswald, sans-serif`;
        ctx.fillStyle = p.color;
        ctx.fillText(p.txt, x - 16, y);
      }
      ctx.globalAlpha = 1;

      /* ---- confetti ---- */
      if (player.fin && player.place === 1) {
        if (confetti.length < 110) confetti.push({ x: rnd(0, W), y: -10, vy: rnd(60, 170), c: pick(JERSEYS), ph: rnd(0, 6) });
        for (const p of confetti) {
          p.y += p.vy / 60; p.x += Math.sin(now / 300 + p.ph) * 0.8;
          ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 4, 6);
          if (p.y > H) { p.y = -10; p.x = rnd(0, W); }
        }
      }

      /* ================= LIGHTING OVERLAYS ================= */
      if (CFG.pal === "dusk") {
        ctx.fillStyle = "rgba(255,120,50,.08)";
        ctx.fillRect(0, 0, W, H);
      } else if (CFG.pal === "night") {
        ctx.fillStyle = "rgba(8,12,32,.22)";
        ctx.fillRect(0, 0, W, H);
        // bright pool on track
        const pool = ctx.createRadialGradient(vpX - W * 0.15, (farY + nearY) / 2, 40, vpX - W * 0.15, (farY + nearY) / 2, W * 0.55);
        pool.addColorStop(0, "rgba(255,240,200,.10)"); pool.addColorStop(1, "rgba(255,240,200,0)");
        ctx.fillStyle = pool;
        ctx.fillRect(0, farY - 30, W, nearY - farY + 60);
      }
      // vignette
      const vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.95);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(5,8,16,.34)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      /* ================= MINIMAP ================= */
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

      /* ================= HUD ================= */
      $("#clock").textContent = fmtTime(Math.max(0, raceT));
      const alive = racers.filter((r) => !r.dq);
      const place = 1 + alive.filter((r) => r.x > player.x).length;
      if (player.fin) player.place = player.place || 1 + alive.filter((r) => r.t < player.t).length;
      $("#distline").textContent = `${Math.min(D, Math.floor(player.x))} m / ${D} m · POS ${player.dq ? "DQ" : player.fin ? player.place : place}/${alive.length} · ${(player.v * 3.6).toFixed(1)} km/h`;
      $("#ebar").style.width = player.E + "%";
      $("#ebar").style.background = player.E < 20 ? "repeating-linear-gradient(115deg,#FF4D5E 0 8px,#C22836 8px 16px)" : "";
      $("#eval").textContent = Math.round(player.E);
      $("#fbar").style.width = player.fat + "%";
      $("#fval").textContent = Math.round(player.fat);
      $("#draftline").style.display = player.drafting && !player.fin ? "block" : "none";
      /* cadence module */
      $("#cadbig").textContent = player.cad.toFixed(1);
      const ratio = player.cad / player.cadOpt;
      const perfect = ratio >= 0.94 && ratio <= 1.05 && player.combo >= 4 && !player.fin;
      const lamp = $("#plamp");
      lamp.className = "perfectlamp " + (perfect ? "on" : ratio > 1.18 ? "over" : "");
      lamp.textContent = perfect ? "¡PERFECT!" : ratio > 1.18 ? "¡EXCESO!" : "RITMO";
      $("#cadbig").style.color = perfect ? "var(--grn)" : ratio > 1.18 ? "var(--red)" : "var(--txt)";
      $("#combo").textContent = player.combo >= 3 ? `RITMO ×${player.combo}` : "";
      $("#cadobj").textContent = `OBJ ${player.cadOpt.toFixed(1)}`;
      /* sprint button */
      const sb = $("#sprintbtn");
      const sprAvail = !player.sprint && player.sprintCd <= 0 && f0(player) >= P.spr && player.E >= 15 && !player.fin && !player.dq;
      sb.disabled = !(sprAvail || player.sprint);
      sb.classList.toggle("ready", sprAvail);
      sb.classList.toggle("active", player.sprint);
      sb.innerHTML = player.sprint ? `SPRINT ACTIVO — ${Math.max(0, 12 - player.sprintT).toFixed(0)}s` : `SPRINT FINAL <b>[S]</b>`;
      /* positions */
      let sortedByProg = [...alive].sort((a, b) => b.x - a.x);
      const shown = sortedByProg.slice(0, 6);
      if (!shown.some((r) => r.isPlayer) && alive.includes(player)) shown.push(player);
      $("#poslist").innerHTML = shown.map((r, i) => {
        const gap = i === 0 ? (r.fin ? fmtTime(r.t) : "LÍDER") : `+${((sortedByProg[0].x - r.x) / Math.max(r.vPace, 1)).toFixed(2)}s`;
        return `<div class="posline ${r.isPlayer ? "mepos" : ""}"><span class="dotc" style="background:${r.isPlayer ? "#FFC531" : r.color}"></span>
          <span>${i + 1}. ${r.a.last}</span><span class="gapv">${r.dq ? "DQ" : gap}</span></div>`;
      }).join("");
    }

    /* ---------- articulated athlete ---------- */
    function limb(c2: any, x: number, y: number, a1: number, l1: number, a2: number, l2: number, w: number, col1: string, col2: string, splitAt = 0.5) {
      const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
      const ex = kx + Math.sin(a2) * l2, ey = ky + Math.cos(a2) * l2;
      c2.lineCap = "round";
      // proximal segment in two colors (sleeve/shorts then skin)
      const mx = x + Math.sin(a1) * l1 * splitAt, my = y + Math.cos(a1) * l1 * splitAt;
      c2.strokeStyle = col1; c2.lineWidth = w + 1.6;
      c2.beginPath(); c2.moveTo(x, y); c2.lineTo(mx, my); c2.stroke();
      c2.strokeStyle = col2; c2.lineWidth = w;
      c2.beginPath(); c2.moveTo(mx, my); c2.lineTo(kx, ky); c2.stroke();
      c2.beginPath(); c2.moveTo(kx, ky); c2.lineTo(ex, ey); c2.stroke();
      return { kx, ky, ex, ey };
    }

    function drawAthlete(c2: any, x: number, y: number, r: any, now: number, s: number, laneH: number) {
      const vz = r.viz;
      const at = r.a.attrs;
      const φ = r.legPhase;
      const moving = r.v > 0.4 && !r.dq;
      const sprinting = r.sprint;
      const tired = r.fat / 100;
      const blend = r.startBlend ?? 1;
      const blocks = !moving && raceT < (r.reaction ?? 0) + 0.2 && !r.fin && !r.dq;
      c2.save();
      const hop = r.fin && r.place === 1 && r.isPlayer ? Math.abs(Math.sin(now / 140)) * 6 : 0;
      c2.translate(x, y - hop);
      c2.scale(s, s);
      // shadow (offset by light direction)
      c2.fillStyle = "rgba(0,0,0,.35)";
      c2.beginPath(); c2.ellipse(2.5, 1, 11, 3, 0, 0, 6.29); c2.fill();
      // player marker
      if (r.isPlayer) {
        c2.strokeStyle = "rgba(255,197,49,.5)"; c2.lineWidth = 1.6;
        c2.beginPath(); c2.ellipse(0, 1, 13, 4, 0, 0, 6.29); c2.stroke();
      }
      const skin = vz.skin, skinD = shade(vz.skin, 0.78);
      const shirt = vz.shirt, shirtD = shade(vz.shirt, 0.72);
      const shorts = vz.shorts, shortsD = shade(vz.shorts, 0.75);
      const shoe = vz.shoes, shoeD = shade(vz.shoes, 0.7);
      const hair = vz.hair;
      const build = vz.build;

      if (blocks && blend < 0.35) {
        drawBlocksPose(c2, r, blend, { skin, skinD, shirt, shirtD, shorts, shortsD, shoe, shoeD, hair, build });
        c2.restore();
        return;
      }

      /* --- run pose --- */
      const spd = clamp(r.v / (r.vPace || 8), 0, 1.15);
      const drive = 1 - blend;
      const lean = 0.55 * drive + (0.12 + 0.16 * (1 - spd)) + tired * 0.10 + (r.dipped ? 0.45 : 0);
      const bobAmp = (1.1 + spd * 1.2) * (1 - drive * 0.7) * (moving ? 1 : 0.25);
      const bob = moving ? Math.abs(Math.sin(φ)) * bobAmp : Math.sin(now / 500) * 0.5;
      const hipY = -27 + bob * 0.45 + drive * 12;
      const hipX = 0;
      const shX = hipX + Math.sin(lean) * 18, shY = hipY - Math.cos(lean) * 18;
      const ampLeg = 0.62 + spd * 0.42 + r.stepAnim * 0.12;
      const ampArm = 0.5 + spd * 0.42;
      const tiredAmp = 1 - tired * 0.22;

      const legPose = (ph: number) => {
        const thighA = ampLeg * Math.sin(ph) * tiredAmp - 0.08 + drive * 0.5;
        const kneeBend = 0.35 + 1.15 * Math.max(0, Math.sin(ph + 0.2)) * (0.7 + spd * 0.5);
        return { thighA, shinA: thighA - kneeBend * 0.85 };
      };
      const armPose = (ph: number) => {
        const armA = -ampArm * Math.sin(ph) * tiredAmp + drive * 0.3;
        const eb = 1.05 + 0.3 * Math.cos(ph);
        return { armA, foreA: armA + eb };
      };
      const shoeAt = (ex: number, ey: number, shinA: number, col: string, colD: string) => {
        c2.save();
        c2.translate(ex, ey);
        c2.rotate(-shinA * 0.25 + 0.12 + (r.dipped ? 0.3 : 0));
        c2.fillStyle = col;
        c2.beginPath();
        c2.roundRect(-2.4, -1.6, 7.6, 3.4, 1.6);
        c2.fill();
        c2.fillStyle = colD;
        c2.fillRect(-2.4, 1.2, 7.6, 1);
        c2.fillStyle = "rgba(255,255,255,.65)";
        c2.fillRect(3.6, -1.2, 1.2, 2);
        c2.restore();
      };
      const sockAt = (kx: number, ky: number, ex: number, ey: number, col: string) => {
        c2.strokeStyle = col; c2.lineWidth = 3.6; c2.lineCap = "round";
        c2.beginPath();
        c2.moveTo(kx + (ex - kx) * 0.62, ky + (ey - ky) * 0.62);
        c2.lineTo(kx + (ex - kx) * 0.86, ky + (ey - ky) * 0.86);
        c2.stroke();
      };

      const legFar = legPose(φ + Math.PI), legNear = legPose(φ);
      const armFar = armPose(φ), armNear = armPose(φ + Math.PI);

      /* far arm */
      let p = limb(c2, shX, shY + 1.5, armFar.armA, 10.5, armFar.foreA, 9.5, 3.4, shirtD, skinD, 0.42);
      c2.fillStyle = skinD; c2.beginPath(); c2.arc(p.ex, p.ey, 1.5, 0, 6.29); c2.fill();
      /* far leg */
      p = limb(c2, hipX, hipY, legFar.thighA, 15, legFar.shinA, 14, 4.2, shortsD, skinD, 0.42);
      sockAt(p.kx, p.ky, p.ex, p.ey, "#E8E8E8");
      shoeAt(p.ex, p.ey, legFar.shinA, shoeD, shade(shoeD, 0.7));
      /* torso */
      c2.lineCap = "round";
      c2.strokeStyle = shirt; c2.lineWidth = 8.2 * build;
      c2.beginPath(); c2.moveTo(hipX, hipY - 1); c2.lineTo(shX, shY + 1); c2.stroke();
      // bib
      const bibX = hipX + (shX - hipX) * 0.55 + 2.6, bibY = hipY + (shY - hipY) * 0.55;
      c2.save(); c2.translate(bibX, bibY); c2.rotate(-lean * 0.4);
      c2.fillStyle = "#F4F4F4"; c2.fillRect(-2.4, -2.6, 5, 4.4);
      c2.fillStyle = "#16202F"; c2.font = "700 3.4px Oswald, sans-serif";
      c2.fillText(String(vz.bib), -1.6, 0.8);
      c2.restore();
      // pelvis/shorts
      c2.fillStyle = shorts;
      c2.beginPath(); c2.arc(hipX, hipY, 4.6 * build, 0, 6.29); c2.fill();
      /* neck + head */
      const nkX = shX + Math.sin(lean) * 2.6, nkY = shY - Math.cos(lean) * 2.6;
      const hdX = nkX + Math.sin(lean * 0.7 - tired * 0.15) * 4.4, hdY = nkY - Math.cos(lean * 0.7) * 4.4;
      c2.strokeStyle = skin; c2.lineWidth = 2.6;
      c2.beginPath(); c2.moveTo(shX, shY); c2.lineTo(nkX, nkY); c2.stroke();
      c2.fillStyle = skin;
      c2.beginPath(); c2.arc(hdX, hdY, 4.6, 0, 6.29); c2.fill();
      // face hint
      c2.fillStyle = "rgba(20,20,20,.8)";
      c2.beginPath(); c2.arc(hdX + 2.6, hdY - 0.8, 0.6, 0, 6.29); c2.fill();
      // hair styles
      c2.fillStyle = hair;
      if (vz.hairStyle === 0) { c2.beginPath(); c2.arc(hdX - 0.6, hdY - 1.6, 4.4, Math.PI * 0.95, Math.PI * 2.02); c2.fill(); }
      else if (vz.hairStyle === 1) { c2.beginPath(); c2.arc(hdX - 0.4, hdY - 2.2, 4.7, Math.PI * 0.85, Math.PI * 2.1); c2.fill(); }
      else if (vz.hairStyle === 2) { c2.beginPath(); c2.arc(hdX - 1.2, hdY - 2.4, 5.2, 0, 6.29); c2.fill(); c2.fillStyle = skin; c2.beginPath(); c2.arc(hdX + 0.8, hdY + 0.4, 3.7, 0, 6.29); c2.fill(); }
      else if (vz.hairStyle === 3) {
        c2.beginPath(); c2.arc(hdX - 0.6, hdY - 1.8, 4.5, Math.PI * 0.9, Math.PI * 2.05); c2.fill();
        c2.strokeStyle = hair; c2.lineWidth = 2.2;
        c2.beginPath(); c2.moveTo(hdX - 4.4, hdY - 1); c2.quadraticCurveTo(hdX - 8, hdY + 1 + Math.sin(now / 120) * 1.2, hdX - 10, hdY + 3.4); c2.stroke();
      } else {
        c2.beginPath(); c2.arc(hdX - 0.6, hdY - 1.8, 4.5, Math.PI * 0.9, Math.PI * 2.05); c2.fill();
        c2.fillStyle = vz.shirt; c2.beginPath(); c2.arc(hdX - 0.4, hdY - 3.4, 4.2, Math.PI, Math.PI * 2); c2.fill();
      }
      // sweat when tired
      if (tired > 0.35 && Math.floor(now / 300) % 2 === 0) {
        c2.fillStyle = "rgba(120,200,255,.8)";
        c2.beginPath(); c2.arc(hdX - 3.4, hdY + 2 + (now / 60 % 3), 0.8, 0, 6.29); c2.fill();
      }
      /* near leg */
      p = limb(c2, hipX, hipY, legNear.thighA, 15, legNear.shinA, 14, 4.6, shorts, skin, 0.42);
      sockAt(p.kx, p.ky, p.ex, p.ey, "#F4F4F4");
      shoeAt(p.ex, p.ey, legNear.shinA, shoe, shoeD);
      /* near arm */
      p = limb(c2, shX, shY + 1.5, armNear.armA, 10.5, armNear.foreA, 9.5, 3.8, shirt, skin, 0.42);
      c2.fillStyle = skin; c2.beginPath(); c2.arc(p.ex, p.ey, 1.6, 0, 6.29); c2.fill();
      /* sprint aura */
      if (sprinting && !r.fin) {
        c2.strokeStyle = "rgba(255,197,49,.55)"; c2.lineWidth = 1.6;
        c2.beginPath(); c2.ellipse(0, -14, 12 + Math.sin(now / 90) * 2, 22, 0, 0, 6.29); c2.stroke();
      }
      // exhausted marker
      if (r.E < 12 && !r.fin) { c2.fillStyle = "rgba(255,77,94,.85)"; c2.font = "700 8px Oswald"; c2.fillText("!", hdX - 1, hdY - 8); }
      c2.restore();
    }

    function drawBlocksPose(c2: any, r: any, blend: number, C: any) {
      const set = blend > 0.001 ? 1 : 0.6;
      const hipX = -6, hipY = -14 - set * 6;
      const lean = 0.85;
      const shX = hipX + Math.sin(lean) * 17, shY = hipY - Math.cos(lean) * 17;
      // legs folded to blocks
      c2.lineCap = "round";
      const legFold = (off: number, colS: string, colSk: string, w: number) => {
        const kx = hipX + 4 + off, ky = hipY + 9;
        const ax = hipX - 3 + off * 1.6, ay = hipY + 14;
        c2.strokeStyle = colS; c2.lineWidth = w + 1.4;
        c2.beginPath(); c2.moveTo(hipX, hipY); c2.lineTo(kx, ky); c2.stroke();
        c2.strokeStyle = colSk; c2.lineWidth = w;
        c2.beginPath(); c2.moveTo(kx, ky); c2.lineTo(ax, ay); c2.stroke();
        c2.fillStyle = colSk === C.skin ? C.shoe : shade(C.shoe, 0.7);
        c2.beginPath(); c2.roundRect(ax - 2, ay - 1.6, 6.6, 3.2, 1.4); c2.fill();
      };
      legFold(-2, C.shortsD, C.skinD, 4);
      // far arm to ground
      c2.strokeStyle = C.skinD; c2.lineWidth = 3.2;
      c2.beginPath(); c2.moveTo(shX, shY + 1); c2.lineTo(shX + 2, 0); c2.stroke();
      // torso
      c2.strokeStyle = C.shirt; c2.lineWidth = 8 * C.build;
      c2.beginPath(); c2.moveTo(hipX, hipY); c2.lineTo(shX, shY); c2.stroke();
      c2.fillStyle = C.shorts; c2.beginPath(); c2.arc(hipX, hipY, 4.4 * C.build, 0, 6.29); c2.fill();
      // head down
      const hdX = shX + 3.6, hdY = shY + 1.6;
      c2.fillStyle = C.skin; c2.beginPath(); c2.arc(hdX, hdY, 4.4, 0, 6.29); c2.fill();
      c2.fillStyle = C.hair; c2.beginPath(); c2.arc(hdX - 0.8, hdY - 1.6, 4.2, Math.PI * 0.9, Math.PI * 2.05); c2.fill();
      // near leg + arm
      legFold(2, C.shorts, C.skin, 4.4);
      c2.strokeStyle = C.skin; c2.lineWidth = 3.6;
      c2.beginPath(); c2.moveTo(shX, shY + 1); c2.lineTo(shX + 3.4, 0); c2.stroke();
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
    const tier = clamp(opts.importance || 1, 1, 5);
    const CFG = stadiumCfg(tier);
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
    const crowdStripR = makeCrowdStrip(CFG.den);

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

    function drawRelay(now: number) {
      const W = cv.width / dpr, H = cv.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // sky
      let sky: any;
      if (CFG.pal === "night") { sky = ctx.createLinearGradient(0, 0, 0, H * 0.2); sky.addColorStop(0, "#060B1C"); sky.addColorStop(1, "#243B63"); }
      else if (CFG.pal === "dusk") { sky = ctx.createLinearGradient(0, 0, 0, H * 0.2); sky.addColorStop(0, "#2A3B66"); sky.addColorStop(1, "#E88A4A"); }
      else { sky = ctx.createLinearGradient(0, 0, 0, H * 0.2); sky.addColorStop(0, "#5FB4E8"); sky.addColorStop(1, "#D8ECF8"); }
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.2);
      // stands
      ctx.fillStyle = CFG.pal === "night" ? "#182238" : "#33425F";
      ctx.fillRect(0, H * 0.05, W, H * 0.15);
      for (let x = 0; x < W; x += 640) ctx.drawImage(crowdStripR, x, H * 0.06, 640, H * 0.13);
      ctx.fillStyle = CFG.pal === "night" ? "#223048" : "#4A5A78";
      ctx.fillRect(0, H * 0.195, W, 4);
      // track
      const trackTop = H * 0.2, laneH = Math.min(40, (H * 0.7) / totals.length);
      const tg = ctx.createLinearGradient(0, trackTop, 0, H);
      tg.addColorStop(0, "#C24E2C"); tg.addColorStop(1, "#8E3320");
      ctx.fillStyle = tg; ctx.fillRect(0, trackTop, W, H - trackTop);
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      for (let i = 0; i <= totals.length; i++) { ctx.beginPath(); ctx.moveTo(0, trackTop + i * laneH + 6); ctx.lineTo(W, trackTop + i * laneH + 6); ctx.stroke(); }
      const fx = W * 0.86;
      for (let yy = trackTop; yy < H; yy += 8) { ctx.fillStyle = Math.floor(yy / 8) % 2 === 0 ? "#fff" : "#111"; ctx.fillRect(fx, yy, 5, 8); }
      ctx.font = "700 13px Oswald"; ctx.fillStyle = "#FFC531"; ctx.fillText("META", fx - 12, trackTop - 4);
      ctx.fillStyle = "rgba(76,195,255,.15)"; ctx.fillRect(W * 0.74, trackTop, W * 0.12, H - trackTop);
      ctx.font = "600 10px Oswald"; ctx.fillStyle = "rgba(76,195,255,.9)"; ctx.fillText("ZONA DE CAMBIO", W * 0.745, trackTop + 14);
      if (CFG.pal === "night") { ctx.fillStyle = "rgba(8,12,32,.20)"; ctx.fillRect(0, 0, W, H); }
      totals.forEach((t: any, i: number) => {
        const y = trackTop + i * laneH + 6 + laneH * 0.75;
        const x = W * 0.08 + clamp(t.progFrac || 0, 0, 1) * (fx - W * 0.08);
        if (t.dq) { ctx.fillStyle = "rgba(255,77,94,.8)"; ctx.font = "700 12px Oswald"; ctx.fillText("DQ", 20, y); return; }
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x, y + 2, 8, 2.4, 0, 0, 6.29); ctx.fill();
        const ph = now / 90 + i;
        ctx.strokeStyle = "#C6885C"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
        ctx.beginPath(); c2leg(ctx, x, y, ph); ctx.stroke();
        ctx.strokeStyle = t.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 1, y - 19); ctx.stroke();
        ctx.fillStyle = "#C6885C"; ctx.beginPath(); ctx.arc(x + 2, y - 23, 2.8, 0, 6.29); ctx.fill();
        ctx.font = "600 10px Oswald"; ctx.fillStyle = t.team.isPlayer ? "#FFC531" : "rgba(255,255,255,.7)";
        ctx.fillText(t.team.name, x - 10, y - 30);
      });
    }
    function c2leg(c2: any, x: number, y: number, ph: number) {
      c2.moveTo(x, y - 10); c2.lineTo(x + Math.sin(ph) * 5, y); c2.moveTo(x, y - 10); c2.lineTo(x - Math.sin(ph) * 5, y);
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
        $("#rsub").textContent = "¡Te toca! Alterna ← → para esprintar tu posta.";
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
