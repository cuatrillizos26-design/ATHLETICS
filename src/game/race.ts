// @ts-nocheck
/* ============ RACES: interactive stride-control engine + articulated athletes ============ */
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

    /* ---------- drawing ---------- */
    let dpr = 1;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = (root.querySelector(".racecanvas") as HTMLElement).getBoundingClientRect();
      cv.width = rect.width * dpr; cv.height = rect.height * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    const crowd: any[] = [];
    for (let i = 0; i < 260; i++) crowd.push({ x: Math.random(), y: Math.random(), c: pick(JERSEYS), ph: rnd(0, 6.28), s: rnd(2.4, 3.6) });
    const ADS = ["ATHLETICS RISE", "VOLT", "AERO SPIKES", "RUNFAST", "GLOBAL SPORTS", "RISE FM"];

    function draw(now: number) {
      const W = cv.width / dpr, H = cv.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shake > 0) ctx.translate(rnd(-3, 3) * shake, rnd(-2, 2) * shake);
      /* --- sky & stadium --- */
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0B1526"); sky.addColorStop(0.28, "#152541"); sky.addColorStop(0.45, "#28324A"); sky.addColorStop(1, "#3A2A1E");
      ctx.fillStyle = sky; ctx.fillRect(-6, -6, W + 12, H + 12);
      const leader = racers.reduce((m, r) => (r.x > m.x ? r : m), racers[0]);
      const focus = camMode === 1 ? leader : (player || leader);
      const laneH = clamp((H * 0.62) / Math.max(racers.length, 1), 24, 58);
      const scale = clamp((laneH * 2.05) / 60, 1.15, 1.85);
      const ppm = clamp(W / 95, 6, 14);
      const camTarget = clamp(focus.x - 34, -14, D - 55);
      drawState.camX = drawState.camX + (camTarget - drawState.camX) * 0.08;
      const camX = drawState.camX;
      const trackTop = H * 0.34;
      const groundY = trackTop + laneH * racers.length + 26;

      /* floodlights */
      for (const lx of [0.18, 0.82]) {
        const px = lx * W - camX * ppm * 0.12;
        ctx.strokeStyle = "#22304A"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(px, trackTop * 0.5); ctx.lineTo(px, 6); ctx.stroke();
        ctx.fillStyle = "#33436188"; ctx.fillRect(px - 16, 2, 32, 10);
        const gl = ctx.createRadialGradient(px, 10, 4, px, 10, 90);
        gl.addColorStop(0, "rgba(255,244,200,.5)"); gl.addColorStop(1, "rgba(255,244,200,0)");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, 10, 90, 0, 6.29); ctx.fill();
      }
      /* stands + crowd (parallax) */
      const standsTop = trackTop * 0.16, standsBot = trackTop * 0.62;
      ctx.fillStyle = "#1B2438"; ctx.fillRect(0, standsTop, W, standsBot - standsTop);
      const excite = clamp(1.6 - Math.abs(leader.x - (D - 15)) / 60, 0.3, 1.6) * (leader.x > D * 0.7 ? 1.5 : 0.85);
      for (const c of crowd) {
        const cx = ((c.x * W * 2 - camX * ppm * 0.35) % (W + 40) + W + 40) % (W + 40) - 20;
        const cy = standsTop + 4 + c.y * (standsBot - standsTop - 10);
        const bounce = Math.abs(Math.sin(now / 240 + c.ph)) * 3.4 * excite;
        ctx.fillStyle = c.c; ctx.globalAlpha = 0.62;
        ctx.fillRect(cx, cy - bounce, c.s, c.s + 2);
      }
      ctx.globalAlpha = 1;
      /* ad boards (parallax) */
      const boardY = trackTop * 0.66, boardH = trackTop * 0.2;
      const bw = 130;
      const offB = (camX * ppm * 0.6) % bw;
      for (let x = -offB - bw, i = 0; x < W + bw; x += bw, i++) {
        const ad = ADS[Math.abs(i + Math.floor((camX * ppm * 0.6) / bw)) % ADS.length];
        ctx.fillStyle = i % 2 ? "#173252" : "#3D1F16";
        ctx.fillRect(x, boardY, bw - 6, boardH);
        ctx.fillStyle = i % 2 ? "#4CC3FF" : "#FFC531";
        ctx.font = `700 ${Math.max(9, boardH * 0.42)}px Oswald, sans-serif`;
        ctx.fillText(ad, x + 8, boardY + boardH * 0.66);
      }
      /* grass strip + curb */
      ctx.fillStyle = "#1E5233"; ctx.fillRect(0, trackTop - 12, W, 12);
      ctx.fillStyle = "#E8E8E8"; ctx.fillRect(0, trackTop - 3, W, 3);
      /* track surface */
      const tg = ctx.createLinearGradient(0, trackTop, 0, H);
      tg.addColorStop(0, "#C24E2C"); tg.addColorStop(0.5, "#A83E22"); tg.addColorStop(1, "#8E3320");
      ctx.fillStyle = tg; ctx.fillRect(0, trackTop, W, H - trackTop);
      /* lanes */
      for (let i = 0; i <= racers.length; i++) {
        const y = trackTop + i * laneH + 8;
        ctx.strokeStyle = i === 0 ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.42)";
        ctx.lineWidth = i === 0 ? 2 : 1.4;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      /* distance ticks + painted numbers */
      ctx.font = `700 ${clamp(laneH * 0.5, 12, 20)}px Oswald, sans-serif`;
      const startM = Math.floor(camX / 10) * 10;
      for (let m = startM; m < camX + 120; m += 10) {
        if (m < 0 || m > D) continue;
        const x = (m - camX) * ppm;
        ctx.strokeStyle = m % 50 === 0 ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.10)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, trackTop + 3); ctx.lineTo(x, H - 3); ctx.stroke();
        if (m % 50 === 0 && m > 0 && m < D) {
          ctx.fillStyle = "rgba(255,255,255,.20)";
          ctx.fillText(String(m), x + 5, trackTop + laneH * racers.length * 0.55);
        }
      }
      /* start blocks + line */
      const sx = (0 - camX) * ppm;
      if (sx > -30 && sx < W + 30) {
        ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(sx - 1.5, trackTop, 3, H - trackTop);
        for (const r of racers) {
          const y = trackTop + r.lane * laneH + 8 + laneH * 0.82;
          ctx.fillStyle = "#2A2F3A";
          ctx.fillRect(sx - 10, y - 3, 7, 5);
          ctx.fillRect(sx - 16, y + 1, 7, 5);
        }
      }
      /* hurdles */
      if (ev.hurdles) {
        for (let h = 0; h < ev.hurdles; h++) {
          const hx = (ev.h1 + h * ev.hs - camX) * ppm;
          if (hx < -14 || hx > W + 14) continue;
          const hy = trackTop + 6, hh = H - trackTop - 12;
          ctx.strokeStyle = "#C8CCD6"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(hx - 3, hy + hh); ctx.lineTo(hx - 3, hy + 6); ctx.moveTo(hx + 3, hy + hh); ctx.lineTo(hx + 3, hy + 6); ctx.stroke();
          ctx.fillStyle = "#FFC531"; ctx.fillRect(hx - 6, hy + 2, 12, 5);
          ctx.fillStyle = "#111"; ctx.fillRect(hx - 2, hy + 2, 4, 5);
        }
      }
      /* finish gantry */
      const fx = (D - camX) * ppm;
      if (fx > -80 && fx < W + 80) {
        for (let yy = trackTop; yy < H; yy += 8) {
          ctx.fillStyle = (Math.floor(yy / 8) % 2 === 0) ? "#fff" : "#111";
          ctx.fillRect(fx - 3, yy, 6, 8);
        }
        ctx.fillStyle = "#22304A"; ctx.fillRect(fx - 4, trackTop - 46, 8, 46);
        ctx.fillRect(fx - 90, trackTop - 46, 180, 26);
        ctx.fillStyle = "#FFC531"; ctx.font = `700 15px Oswald, sans-serif`;
        ctx.fillText("M E T A", fx - 32, trackTop - 28);
        ctx.fillStyle = "#0E1626"; ctx.fillRect(fx + 14, trackTop - 40, 62, 18);
        ctx.fillStyle = "#FF5A2B"; ctx.font = `700 12px 'Courier New', monospace`;
        ctx.fillText(fmtTime(Math.max(0, raceT)), fx + 18, trackTop - 27);
      }
      /* dust particles */
      for (const p of dust) {
        const x = (p.x - camX) * ppm, y = groundY - p.y * laneH * 0.12 - laneH * racers.length + laneH * p.lane + laneH;
        ctx.globalAlpha = clamp(p.life * 1.6, 0, 0.5);
        ctx.fillStyle = "#E8C9A8";
        ctx.beginPath(); ctx.arc(x, y, p.r * scale, 0, 6.29); ctx.fill();
      }
      ctx.globalAlpha = 1;
      /* racers */
      const sorted = [...racers].sort((a, b) => a.lane - b.lane);
      for (const r of sorted) {
        const x = (r.x - camX) * ppm, y = trackTop + r.lane * laneH + 8 + laneH * 0.92;
        if (x < -60 || x > W + 60) continue;
        // speed lines
        if (r.v > r.vPace * 0.85 && !r.fin) {
          ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 1.4;
          for (let k = 0; k < 3; k++) {
            const ly = y - 8 - k * 11 * scale;
            ctx.beginPath(); ctx.moveTo(x - 26 - k * 12, ly); ctx.lineTo(x - 8 - k * 6, ly); ctx.stroke();
          }
        }
        drawAthlete(ctx, x, y, r, now, scale * r.viz.hScale, laneH);
        if (r.isPlayer || r === leader || r.x > D) {
          ctx.font = `600 10px Oswald, sans-serif`;
          const label = r.isPlayer ? `${r.a.first} (TÚ)` : `${r.a.last}`;
          ctx.fillStyle = r.isPlayer ? "#FFC531" : "rgba(255,255,255,.72)";
          ctx.fillText(label, x - 16, y - 62 * scale * r.viz.hScale - 8);
        }
      }
      /* floats (PERFECT / ×) */
      for (const p of floats) {
        const x = (p.x - camX) * ppm;
        const y = groundY - p.y * laneH - laneH * racers.length * 0.4;
        ctx.globalAlpha = clamp(p.life * 2, 0, 1);
        ctx.font = `${p.big ? "700 15px" : "700 13px"} Oswald, sans-serif`;
        ctx.fillStyle = p.color;
        ctx.fillText(p.txt, x - 14, y - 46 * scale);
      }
      ctx.globalAlpha = 1;
      /* confetti */
      if (player.fin && player.place === 1) {
        if (confetti.length < 90) confetti.push({ x: rnd(0, W), y: -10, vy: rnd(60, 160), c: pick(JERSEYS), ph: rnd(0, 6) });
        for (const p of confetti) {
          p.y += p.vy / 60; p.x += Math.sin(now / 300 + p.ph) * 0.8;
          ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 4, 6);
          if (p.y > H) { p.y = -10; p.x = rnd(0, W); }
        }
      }
      /* minimap */
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
      /* HUD */
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
    const drawState: any = { camX: 0 };

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
      // shadow
      c2.fillStyle = "rgba(0,0,0,.35)";
      c2.beginPath(); c2.ellipse(0, 1, 11, 3, 0, 0, 6.29); c2.fill();
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

    function drawRelay(now: number) {
      const W = cv.width / dpr, H = cv.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0B1526"); g.addColorStop(0.3, "#241812"); g.addColorStop(1, "#3A1E12");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
