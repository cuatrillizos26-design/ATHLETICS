// @ts-nocheck
/* ============ UI: screens, overlays, toasts ============ */
import { EV, RANK_EVENTS, IND_EVENTS, RELAYS, RELAY_EVENTS, ATTRS, SPECS, COUNTRIES, TRAINING, ACHIEVEMENTS, MONTHS, TIERS, PRIZES, SPONSORS, CLUBS, SKINS, HAIRS, JERSEYS, INJURIES } from "./data";
import { S, G, clamp, fmtMoney } from "./store";
import { fmtTime, pointsFor, potArrows, specLabel, getWR, getNR, getCR, rankOfPlayerUI, estimateRelay, findAth, legendScore } from "./uimodel";
import { snd } from "./sound";

/* ---------- icons ---------- */
const IC: any = {
  run: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="15" cy="4" r="2"/><path d="M13 7l-3 4 3 3-2 6M10 11l-4 2M13 14l4 1 3 4"/></svg>`,
  train: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8v8M2 10v4M22 10v4M20 8v8M7 6v12M17 6v12M7 12h10"/></svg>`,
  cal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>`,
  trophy: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4v4h-4z"/></svg>`,
  chart: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V4M4 20h16M8 16l3-5 3 3 5-8"/></svg>`,
  team: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M2 20c1-3.5 3.5-5 6-5s5 1.5 6 5M14.5 15.5c2.5 0 5.5 1.5 6.5 4.5"/></svg>`,
  gear: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>`,
  medal: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="14" r="5"/><path d="M9 3l3 6M15 3l-3 6M9 3H6l3.5 6M15 3h3l-3.5 6"/></svg>`,
};

export function avatar(a: any, size = 84): string {
  const skin = a.skin || "#C6885C", hair = a.hair || "#1C1B1A", j = a.jersey || "#FF5A2B";
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
    <ellipse cx="50" cy="88" rx="26" ry="5" fill="rgba(0,0,0,.4)"/>
    <g stroke-linecap="round">
      <path d="M52 52 L38 74 M52 52 L66 72" stroke="${skin}" stroke-width="7"/>
      <path d="M52 52 L56 30" stroke="${j}" stroke-width="12"/>
      <path d="M54 36 L40 46 M54 36 L68 44" stroke="${skin}" stroke-width="5.5"/>
      <circle cx="58" cy="20" r="9" fill="${skin}"/>
      <path d="M50 16 a9 9 0 0 1 16 3 l-4 -2 -3 2 -4 -1 z" fill="${hair}"/>
    </g>
    <path d="M44 58 L60 58 L58 66 L46 66 z" fill="${j}"/>
  </svg>`;
}

/* ---------- init ---------- */
export function initUI(rootEl: HTMLElement) {
  rootEl.innerHTML = `<div class="app-bg"></div><div class="lane-deco"></div><div class="app" id="app"></div><div class="toasts" id="toasts"></div><div id="ovroot"></div>`;
  rootEl.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest("[data-act]") as HTMLElement;
    if (!el) return;
    snd("click");
    G.act(el.dataset.act, el);
  });
  rootEl.addEventListener("change", (e) => {
    const el = (e.target as HTMLElement).closest("[data-act]") as HTMLElement;
    if (!el) return;
    G.chg(el.dataset.act, el);
  });
}

const $app = () => document.getElementById("app")!;

export function go(screen: string, params: any = {}) {
  S.screen = screen; S.params = params;
  render();
  window.scrollTo({ top: 0 });
}
export function refresh() { render(); }

function dateStr(): string {
  const m = MONTHS[clamp(Math.floor((S.week - 1) / 4), 0, MONTHS.length - 1)];
  const days = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  return `S${S.week} · ${m} ${S.year} · ${days[S.day]}`;
}

function topbar(): string {
  if (!S.careerActive || S.screen === "menu") return "";
  const p = S.player;
  return `<div class="topbar">
    <div class="logo" data-act="nav-dash" style="cursor:pointer">ATHLETICS<em>:</em>RISE</div>
    <div class="spacer"></div>
    <span class="savechip" id="savechip">●</span>
    <div class="moneybox">${fmtMoney(S.career.money)}</div>
    <div class="datebox">${dateStr()}</div>
  </div>`;
}

export function render() {
  const fn: any = SCREENS[S.screen] || SCREENS.dashboard;
  $app().innerHTML = topbar() + `<div class="main">${fn()}</div>`;
  const post = POST[S.screen];
  if (post) post();
}

/* ---------- toasts ---------- */
G.toast = (msg: string, cls = "") => toast(msg, cls);
export function toast(msg: string, cls = "") {
  const box = document.getElementById("toasts");
  if (!box) return;
  const t = document.createElement("div");
  t.className = "toast " + cls;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 3600);
  while (box.children.length > 5) box.firstChild!.remove();
}

/* ---------- overlays ---------- */
const $ov = () => document.getElementById("ovroot")!;
export function confirmOv(title: string, text: string, danger = false): Promise<boolean> {
  return new Promise((res) => {
    $ov().innerHTML = `<div class="ov"><div class="ov-box panel ${danger ? "hot" : ""}">
      <div class="panel-title ${danger ? "" : "g"}">${title}</div>
      <p style="margin-bottom:18px;font-size:15px">${text}</p>
      <div class="btnrow"><button class="btn ${danger ? "danger" : "primary"}" id="ov-yes">SÍ</button>
      <button class="btn" id="ov-no">NO</button></div></div></div>`;
    ($ov().querySelector("#ov-yes") as HTMLElement).onclick = () => { $ov().innerHTML = ""; snd("click"); res(true); };
    ($ov().querySelector("#ov-no") as HTMLElement).onclick = () => { $ov().innerHTML = ""; snd("click"); res(false); };
  });
}
export function showPB(evk: string, t: number, prev: number | null): Promise<void> {
  return new Promise((res) => {
    snd("pb");
    $ov().innerHTML = `<div class="ov-pb">
      <div class="band" style="font-family:var(--num);letter-spacing:6px;font-weight:600;color:#032416;background:var(--grn);padding:7px 28px;animation:bandin .5s both">RÉCORD PERSONAL</div>
      <h1>NEW PERSONAL BEST</h1>
      <div class="tt num" style="letter-spacing:3px;color:var(--mut);font-size:15px;margin-top:6px">${EV[evk].label.toUpperCase()}</div>
      <div class="tm">${fmtTime(t)}</div>
      ${prev != null ? `<div class="delta">Anterior: ${fmtTime(prev)} · Mejora: <b>−${(prev - t).toFixed(2)} s</b></div>` : `<div class="delta">Primera marca registrada</div>`}
      <button class="btn grnb mt20" id="pb-ok">CONTINUAR</button></div>`;
    const close = () => { $ov().innerHTML = ""; res(); };
    ($ov().querySelector("#pb-ok") as HTMLElement).onclick = close;
    setTimeout(close, 6000);
  });
}
export function showRecord(scope: string, evk: string, t: number, who: string): Promise<void> {
  return new Promise((res) => {
    snd("record");
    const title = scope === "world" ? "WORLD RECORD" : scope === "national" ? "NATIONAL RECORD" : "CHAMPIONSHIP RECORD";
    const band = scope === "world" ? "RÉCORD DEL MUNDO" : scope === "national" ? "RÉCORD NACIONAL" : "RÉCORD DEL CAMPEONATO";
    $ov().innerHTML = `<div class="ov-record ${scope === "world" ? "wr" : ""}"><div class="rec-rays"></div>
      <div class="band">${band}</div>
      <h1>${title}</h1>
      <div class="tt num" style="letter-spacing:3px;color:var(--mut);font-size:15px">${EV[evk].label.toUpperCase()}</div>
      <div class="tm">${fmtTime(t)}</div>
      <div class="who">${who}</div>
      <button class="btn goldb mt20" id="rec-ok">CONTINUAR</button></div>`;
    const close = () => { $ov().innerHTML = ""; res(); };
    ($ov().querySelector("#rec-ok") as HTMLElement).onclick = close;
    setTimeout(close, 7000);
  });
}
export function showTutorial(step: number): void {
  const steps = [
    { t: "Bienvenido a ATHLETICS: RISE", b: "Empiezas con 16 años y un sueño: convertirte en leyenda del atletismo. Cada decisión cuenta — entrena, compite y gestiona tu cuerpo." },
    { t: "1 · Entrena", b: "Cada día puedes hacer UNA sesión: velocidad, resistencia, fuerza, técnica… Cada una mejora atributos distintos y acumula fatiga." },
    { t: "2 · Gestiona la fatiga", b: "Con fatiga alta rindes menos, mejoras menos y te lesionas. Descansa y haz recuperación ligera para llegar en forma a las citas clave." },
    { t: "3 · Compite", b: "El calendario tiene meetings locales, regionales, el Nacional y grandes campeonatos. Cuando llegue el día, pulsa COMPETIR." },
    { t: "4 · La carrera es tuya", b: "TÚ corres: pulsa ← → alternando las piernas — cada pulsación es una zancada. Busca tu CADENCIA ÓPTIMA (no machaques: pasarte gasta energía y no te hace más rápido). Elige esfuerzo con 1–4, guarda energía para el SPRINT FINAL [S], salta vallas con ESPACIO e inclínate en la meta." },
    { t: "5 · Sube en el ranking", b: "Las buenas marcas dan puntos de ranking, premios y fama. Del meeting local al podio olímpico: construye tu historia." },
  ];
  const s = steps[step];
  if (!s) { $ov().innerHTML = ""; G.act("tut-done"); return; }
  $ov().innerHTML = `<div class="ov"><div class="ov-box panel">
    <div class="tut-step"><h3>${s.t}</h3><p>${s.b}</p></div>
    <div class="progress-dots">${steps.map((_: any, i: number) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>
    <div class="btnrow"><button class="btn primary" data-act="tut-next" data-step="${step + 1}">${step === steps.length - 1 ? "¡A LA PISTA!" : "SIGUIENTE"}</button>
    <button class="btn ghost" data-act="tut-skip">SALTAR</button></div></div></div>`;
}

/* ================= SCREENS ================= */
const barRow = (lbl: string, v: number, cls = "", valTxt?: string) =>
  `<div class="statrow"><span class="lbl">${lbl}</span><div class="bar ${cls} ${cls === "fat" && v > 70 ? "hi" : ""}"><i style="width:${clamp(v, 0, 100)}%"></i></div><span class="val">${valTxt ?? Math.round(v)}</span></div>`;

function tierChip(t: number) { return `<span class="chip ${TIERS[t].color}">${TIERS[t].n}</span>`; }

function nextMeetInfo(): any {
  return S.calendar.find((m: any) => !m.done && m.week >= S.week) || null;
}
export function daysToMeet(m: any): number {
  return (m.week - S.week) * 7 + (6 - S.day);
}

const SCREENS: any = {};
const POST: any = {};

/* ---------- MENU ---------- */
SCREENS.menu = () => {
  const lines = Array.from({ length: 7 }, (_, i) => `<i style="top:${12 + i * 13}%;animation-delay:${i * 0.45}s;animation-duration:${2.6 + (i % 3)}s"></i>`).join("");
  const has = G.hasSaveFn();
  return `<div class="menu"><div class="tracklines">${lines}</div>
    <div class="menu-title">ATHLETICS<br><em>RISE</em></div>
    <div class="menu-sub">De desconocido a leyenda · una carrera, mil historias</div>
    <div class="menu-btns">
      <button class="btn primary big" data-act="menu-new">NUEVA CARRERA</button>
      <button class="btn big" data-act="menu-continue" ${has ? "" : "disabled"}>CONTINUAR${has ? ` — ${G.saveSummary()}` : ""}</button>
      <button class="btn" data-act="menu-records">RÉCORDS</button>
      <button class="btn" data-act="menu-hof">SALÓN DE LA FAMA</button>
      <button class="btn" data-act="menu-settings">CONFIGURACIÓN</button>
    </div>
    <div class="menu-foot">Gestiona · Entrena · Compite · Conviértete en leyenda</div>
    <div class="ver">v1.0 · HTML5 CANVAS</div></div>`;
};

/* ---------- CREATE ---------- */
SCREENS.create = () => {
  const specCards = SPECS.map((s: any) => `<button class="opt" data-act="create-spec" data-id="${s.id}">${s.n}<small style="display:block;font-weight:400;font-size:10.5px;opacity:.75">${s.desc}</small></button>`).join("");
  return `<div class="screen"><h1 class="big mb14">CREAR <span class="acc">ATLETA</span></h1>
  <div class="create-grid">
    <div class="panel">
      <div class="grid-2">
        <div class="field"><label>Nombre</label><input id="cr-first" value="David" maxlength="14"/></div>
        <div class="field"><label>Apellido</label><input id="cr-last" value="Ríos" maxlength="14"/></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>País</label><select id="cr-country">${COUNTRIES.map((c: any) => `<option value="${c.c}" ${c.c === "ESP" ? "selected" : ""}>${c.n}</option>`).join("")}</select></div>
        <div class="field"><label>Edad</label><select id="cr-age"><option value="16" selected>16</option><option value="17">17</option><option value="18">18</option></select></div>
      </div>
      <div class="field"><label>Especialidad</label><div class="optgrid" id="specgrid">${specCards}</div></div>
      <div class="field"><label>Especialidad secundaria</label><select id="cr-spec2">${IND_EVENTS.map((e: string) => `<option value="${e}">${EV[e].label}</option>`).join("")}</select></div>
      <div class="grid-2">
        <div class="field"><label>Piel</label><div class="swatches" id="sw-skin">${SKINS.map((c: string, i: number) => `<div class="sw ${i === 2 ? "on" : ""}" style="background:${c}" data-act="create-skin" data-c="${c}"></div>`).join("")}</div></div>
        <div class="field"><label>Pelo</label><div class="swatches" id="sw-hair">${HAIRS.map((c: string, i: number) => `<div class="sw ${i === 0 ? "on" : ""}" style="background:${c}" data-act="create-hair" data-c="${c}"></div>`).join("")}</div></div>
      </div>
      <div class="field"><label>Color de equipación</label><div class="swatches" id="sw-jersey">${JERSEYS.map((c: string, i: number) => `<div class="sw ${i === 0 ? "on" : ""}" style="background:${c}" data-act="create-jersey" data-c="${c}"></div>`).join("")}</div></div>
      <button class="btn primary big wide mt14" data-act="create-start">COMENZAR CARRERA</button>
    </div>
    <div class="col">
      <div class="panel gold"><div class="panel-title g">Vista previa</div>
        <div class="preview-ath" id="preview">${avatar({ skin: SKINS[2], hair: HAIRS[0], jersey: JERSEYS[0] }, 130)}
        <div class="center num" id="prev-name" style="font-weight:600;letter-spacing:1px">David Ríos</div>
        <div class="dim small" id="prev-spec">Elige especialidad…</div></div>
      </div>
      <div class="panel"><div class="panel-title b">El camino</div>
        <p class="small mut">Empezarás con marcas modestas (≈ 1:58 en 800 m si eres mediofondista). Entrena con cabeza, llega descansado a las citas y la progresión hará el resto. El potencial se descubre con los años.</p>
      </div>
    </div>
  </div></div>`;
};
POST.create = () => {
  document.querySelector('[data-act="create-spec"][data-id="mid"]')?.classList.add("on");
  (G as any).createDraft = { spec: "mid", skin: SKINS[2], hair: HAIRS[0], jersey: JERSEYS[0] };
  updatePrevSpec();
  ["#cr-first", "#cr-last"].forEach((id) => (document.querySelector(id) as HTMLInputElement).addEventListener("input", updatePrevName));
};
function updatePrevName() {
  const f = (document.querySelector("#cr-first") as HTMLInputElement)?.value || "";
  const l = (document.querySelector("#cr-last") as HTMLInputElement)?.value || "";
  const el = document.querySelector("#prev-name");
  if (el) el.textContent = `${f} ${l}`.trim();
}
function updatePrevSpec() {
  const d = (G as any).createDraft || {};
  const sp = SPECS.find((s: any) => s.id === d.spec);
  const el = document.querySelector("#prev-spec");
  if (el && sp) el.textContent = `${sp.n} · ${sp.desc}`;
  const sel2 = document.querySelector("#cr-spec2") as HTMLSelectElement;
  if (sel2 && sp) sel2.value = sp.ev2;
}

/* ---------- DASHBOARD ---------- */
SCREENS.dashboard = () => {
  const p = S.player;
  const nm = nextMeetInfo();
  const meetToday = nm && nm.week === S.week && S.day === 6;
  const rank = rankOfPlayerUI(p.spec);
  const rival = G.mainRival();
  const inj = p.injury ? INJURIES.find((i: any) => i.id === p.injury.type) : null;
  const canEnter = nm ? G.canEnterMeet(nm).ok : false;
  return `<div class="screen">
  <div class="grid-dash">
    <div class="col">
      <div class="panel hot">
        <div class="flexrow" style="align-items:flex-start">
          <div style="flex:none">${avatar(p, 92)}</div>
          <div style="flex:1;min-width:0">
            <h2 class="sec">${p.first} <span class="acc">${p.last}</span></h2>
            <div class="flexrow mt8" style="gap:6px">
              <span class="chip ev">${COUNTRIES.find((c: any) => c.c === p.country)?.n || p.country}</span>
              <span class="chip ev">${p.age} años</span>
            </div>
            <div class="mt8 num" style="font-weight:600;letter-spacing:1px;color:var(--gold)">${specLabel(p)}</div>
            <div class="dim small">Potencial: <b class="num" style="color:var(--txt)">${({ low: "Modesto", normal: "Normal", high: "Alto", prodigy: "Prodigio" } as any)[p.pot]}</b> · ${S.career.club.name}</div>
            ${inj ? `<div class="badge r mt8">LESIONADO — ${inj.n} (${p.injury.daysLeft}d)</div>` : ""}
          </div>
        </div>
        <hr class="hr"/>
        ${barRow("FORMA", p.form, "", Math.round(p.form))}
        ${barRow("FATIGA", p.fatigue, "fat", Math.round(p.fatigue))}
      </div>
      <div class="tipbox"><div><b>ENTRENADOR</b><div class="mt8">${S.flags.coachTip || "Bienvenido a la pista."}</div></div></div>
      ${rival ? `<div class="panel"><div class="panel-title">RIVALIDAD</div>
        <div class="num" style="font-weight:600;font-size:16px">${p.first} ${p.last} <span class="dim">vs</span> ${rival.a.first} ${rival.a.last}</div>
        <div class="small mut mt8">Carreras: ${rival.races} · Ganadas: <b class="grn">${rival.w}</b> · Perdidas: <b class="red">${rival.l}</b></div>
        <div class="small mut">Tu mejor marca: <b class="num">${fmtTime(rival.pbP)}</b> · La suya: <b class="num">${fmtTime(rival.pbA)}</b></div></div>` : ""}
    </div>
    <div class="col">
      <div class="panel ${nm && nm.tier >= 4 ? "gold" : ""}">
        <div class="panel-title ${nm && nm.tier >= 4 ? "g" : ""}">Próxima competición</div>
        ${nm ? `
          <div class="flexrow"><h2 class="sec" style="flex:1">${nm.name}</h2>${tierChip(nm.tier)}</div>
          <div class="flexrow mt8" style="gap:6px">${nm.events.map((e: string) => `<span class="chip ev">${EV[e].label}</span>`).join("")}${nm.relay ? RELAY_EVENTS.map((r) => `<span class="chip ev">${RELAYS[r].label}</span>`).join("") : ""}</div>
          <div class="mt8 num" style="letter-spacing:1px;color:var(--blu)">${daysToMeet(nm) === 0 ? "¡ES HOY!" : `EN ${daysToMeet(nm)} DÍAS`} · ${nm.city}</div>
          ${nm.week === S.week ? `<div class="btnrow mt14">
            <button class="btn primary big wide" data-act="open-meet" ${meetToday && !S.flags.racedToday ? "" : "disabled"}>${meetToday ? (canEnter || nm.tier <= 2 ? "COMPETIR" : "COMPETIR (RELEVOS)") : (S.flags.racedToday ? "YA HAS COMPETIDO HOY" : "ESPERA AL DOMINGO")}</button></div>` : ""}
        ` : `<div class="mut">No hay más competiciones esta temporada.</div>
          <button class="btn wide mt14" data-act="season-finish">CERRAR TEMPORADA</button>`}
      </div>
      <div class="panel">
        <div class="panel-title n">Hoy · ${dateStr()}</div>
        <div class="btnrow">
          <button class="btn grnb" data-act="nav-train">${IC.train} ENTRENAR</button>
          <button class="btn" data-act="rest-day">DESCANSAR</button>
          <button class="btn" data-act="advance-day">AVANZAR DÍA ▸</button>
          ${nm && daysToMeet(nm) > 0 ? `<button class="btn goldb" data-act="skip-meet">SALTAR HASTA COMPETICIÓN ⏩</button>` : ""}
        </div>
        <div class="dim small mt8">Una acción por día. El domingo (día 7 de la semana) es día de competición.</div>
      </div>
      <div class="grid-2">
        <div class="panel"><div class="panel-title b">Ranking · ${EV[p.spec].label}</div>
          <div class="num" style="font-size:34px;font-weight:700">${rank ? "#" + rank : "—"}</div>
          <div class="dim small">mundial · ${pointsFor(p.spec, p.sb[p.spec] || p.pb[p.spec] || 9e9)} pts (SB)</div>
          <button class="btn sm mt14" data-act="nav-rank">VER RANKING</button></div>
        <div class="panel"><div class="panel-title g">Medallero</div>
          <div class="flexrow" style="gap:14px">
            <div><span class="medal g">O</span> <b class="num">${S.career.medals.g}</b></div>
            <div><span class="medal s">P</span> <b class="num">${S.career.medals.s}</b></div>
            <div><span class="medal b">B</span> <b class="num">${S.career.medals.b}</b></div>
          </div>
          <div class="dim small mt8">Victorias: ${S.career.totalWins} · Fama: ${Math.round(S.career.fame)}</div>
          <div class="btnrow mt14"><button class="btn sm" data-act="nav-hist">HISTORIAL</button><button class="btn sm" data-act="nav-records">RÉCORDS</button></div></div>
      </div>
    </div>
    <div class="col">
      <div class="panel"><div class="panel-title b">Noticias del mundo</div>
        ${S.world.news.slice(0, 7).map((n: any) => `<div class="newsitem"><span class="nw-d">S${n.w} · ${n.y}</span>${n.msg}</div>`).join("") || `<div class="dim small">El mundo del atletismo espera tu irrupción…</div>`}
      </div>
      <div class="panel"><div class="panel-title g">Patrocinadores</div>
        ${S.career.sponsors.length ? S.career.sponsors.map((sp: any) => `<div class="kv"><span>${sp.name}</span><b class="grn">+${fmtMoney(sp.week)}/sem</b></div>`).join("") : `<div class="dim small">Sin contratos. Mejora tu fama para atraer marcas.</div>`}
        ${S.career.sponsorOffers.length ? `<hr class="hr"/>` + S.career.sponsorOffers.map((sp: any, i: number) => `<div class="kv"><span>${sp.name} <span class="dim small">(${fmtMoney(sp.week)}/sem)</span></span><button class="btn sm grnb" data-act="sponsor-accept" data-i="${i}">FIRMAR</button></div>`).join("") : ""}
      </div>
      <div class="panel"><div class="panel-title">Club</div>
        <div class="kv"><span>${S.career.club.name}</span><b>Nivel ${S.career.club.level}</b></div>
        <div class="dim small">Bono de entrenamiento: +${Math.round((CLUBS.find((c: any) => c.level === S.career.club.level)?.bonus || 0) * 100)}%</div>
        ${S.career.clubOffers.length ? S.career.clubOffers.map((c: any, i: number) => `<div class="kv mt8"><span>${c.name} (Nv ${c.level})</span><button class="btn sm goldb" data-act="club-accept" data-i="${i}">UNIRME</button></div>`).join("") : ""}
      </div>
    </div>
  </div>
  <div class="nav">
    <button class="navbtn" data-act="nav-train">${IC.train}<b>Entrenar</b><span>Sesiones del día</span></button>
    <button class="navbtn" data-act="nav-cal">${IC.cal}<b>Calendario</b><span>Temporada ${S.year}</span></button>
    <button class="navbtn" data-act="nav-athlete">${IC.user}<b>Atleta</b><span>Atributos y PBs</span></button>
    <button class="navbtn" data-act="nav-rank">${IC.trophy}<b>Ranking</b><span>${rank ? "#" + rank : "Sin puntos"}</span></button>
    <button class="navbtn" data-act="nav-hist">${IC.chart}<b>Historial</b><span>Carrera y evolución</span></button>
    <button class="navbtn" data-act="nav-relay">${IC.team}<b>Relevos</b><span>Equipos nacionales</span></button>
    <button class="navbtn" data-act="nav-ach">${IC.medal}<b>Logros</b><span>${S.career.achievements.length}/${ACHIEVEMENTS.length}</span></button>
    <button class="navbtn" data-act="nav-set">${IC.gear}<b>Ajustes</b><span>Sonido y datos</span></button>
  </div></div>`;
};

/* ---------- TRAINING ---------- */
SCREENS.training = () => {
  const p = S.player;
  const cat = S.params.cat || "velocidad";
  const cats = Object.keys(TRAINING);
  const sess = TRAINING[cat].sessions;
  const inj = p.injury ? INJURIES.find((i: any) => i.id === p.injury.type) : null;
  const attrName = (k: string) => ATTRS.find((a: any) => a.k === k)?.n.split(" ")[0] || k;
  return `<div class="screen"><h1 class="big mb14">ENTRENO</h1>
  <div class="grid-2 mb14" style="grid-template-columns:1fr 340px">
    <div class="panel">${barRow("FORMA", p.form)}${barRow("FATIGA", p.fatigue, "fat")}
      ${inj ? `<div class="badge r mt8">LESIÓN: ${inj.n} — ${p.injury.daysLeft} días. Solo recuperación.</div>` : ""}
    </div>
    <div class="panel"><div class="panel-title n">Rutina semanal</div>
      <div class="small mut">Alterna carga y descanso. El entrenador recomienda: ${p.fatigue > 60 ? "recuperación hoy." : p.fatigue > 35 ? "carga media." : "puedes apretar."}</div>
      <button class="btn sm mt8" data-act="back-dash">← VOLVER</button></div>
  </div>
  <div class="tr-cats">${cats.map((c: string) => `<button class="tr-cat ${c === cat ? "on" : ""}" data-act="train-cat" data-cat="${c}">${TRAINING[c].n}</button>`).join("")}</div>
  <div class="tr-grid">${sess.map((s: any) => {
    const disabled = inj && cat !== "recuperacion";
    const cantPay = s.cost && S.career.money < s.cost;
    return `<div class="tr-card"><h4>${s.n}</h4><div class="dim small">${s.desc}</div>
      <div class="tr-eff">${Object.entries(s.fx || {}).map(([k, v]: any) => `<span>+${v} ${attrName(k).toUpperCase()}</span>`).join("")}
      ${s.fat < 0 ? `<span style="color:var(--grn)">FATIGA ${s.fat}</span>` : `<span class="cost">FATIGA +${s.fat}</span>`}
      ${s.cost ? `<span class="cost">${s.cost} €</span>` : ""}</div>
      <button class="btn primary sm" data-act="train-do" data-id="${s.id}" data-cat="${cat}" ${(disabled || cantPay || S.flags.racedToday) ? "disabled" : ""}>${S.flags.racedToday ? "HOY YA COMPETISTE" : "REALIZAR · 1 DÍA"}</button>
    </div>`;
  }).join("")}</div></div>`;
};

/* ---------- CALENDAR ---------- */
SCREENS.calendar = () => {
  let html = `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">CALENDARIO <span class="acc">${S.year}</span></h1><button class="btn" data-act="back-dash">← VOLVER</button></div>`;
  let lastMonth = -1;
  for (const m of S.calendar) {
    const mi = clamp(Math.floor((m.week - 1) / 4), 0, 7);
    if (mi !== lastMonth) { html += `<div class="cal-month">${MONTHS[mi]} · ${S.year}</div>`; lastMonth = mi; }
    const isToday = m.week === S.week;
    const past = m.week < S.week || m.done;
    const d = daysToMeet(m);
    html += `<div class="cal-item tier${m.tier} ${past ? "past" : ""} ${isToday && !m.done ? "today" : ""}">
      <div class="wk">SEM ${m.week}<br/><span class="dim">DOM</span></div>
      <div><div class="nm2">${m.name} ${m.relay ? "· RELEVOS" : ""}</div>
        <div class="flexrow mt8" style="gap:5px">${m.events.map((e: string) => `<span class="chip ev">${EV[e].label}</span>`).join("")}
        ${m.result ? m.result.map((r: any) => `<span class="chip ${r.place <= 3 ? "t5" : "ev"}">${(EV[r.evk] || RELAYS[r.evk]).label} · P${r.place} · ${fmtTime(r.t)}</span>`).join("") : ""}</div></div>
      <div>${tierChip(m.tier)}<div class="dim small mt8 num">${past ? (m.result ? m.result.length ? "COMPETIDO" : "SIN PARTICIPAR" : "SIMULADO") : `EN ${d} DÍAS`}</div></div>
    </div>`;
  }
  return html + "</div>";
};

/* ---------- ATHLETE ---------- */
SCREENS.athlete = () => {
  const p = S.player;
  return `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">ATLETA</h1><button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="grid-dash" style="grid-template-columns:320px 1fr 1fr">
    <div class="col">
      <div class="panel hot center">${avatar(p, 120)}
        <h2 class="sec mt8">${p.first} <span class="acc">${p.last}</span></h2>
        <div class="dim small">${COUNTRIES.find((c: any) => c.c === p.country)?.n} · ${p.age} años · ${S.career.club.name}</div>
        <div class="num mt8" style="color:var(--gold);font-weight:600;letter-spacing:1px">${specLabel(p)}</div>
        <div class="mt8"><span class="badge g">POTENCIAL ${({ low: "MODESTO", normal: "NORMAL", high: "ALTO", prodigy: "PRODIGIO" } as any)[p.pot]}</span></div>
        ${barRow("FORMA", p.form, "", Math.round(p.form))}${barRow("FATIGA", p.fatigue, "fat", Math.round(p.fatigue))}
        <hr class="hr"/>
        <button class="btn danger wide" data-act="retire-ask">RETIRARSE</button>
      </div>
    </div>
    <div class="col"><div class="panel"><div class="panel-title">Atributos <span class="dim" style="letter-spacing:1px;font-size:10px">· ▲ margen de mejora</span></div>
      ${ATTRS.map((at: any) => { const ar = potArrows(p, at.k); return `<div class="attrrow"><span class="nm">${at.n}</span>
        <div class="bar"><i style="width:${clamp(p.attrs[at.k], 0, 100)}%"></i></div>
        <span class="num" style="font-weight:600">${Math.round(p.attrs[at.k])}</span><span class="arrow ${ar.cls}">${ar.txt}</span></div>`; }).join("")}
    </div></div>
    <div class="col">
      <div class="panel"><div class="panel-title g">Marcas</div>
        <table class="tbl"><tr><th>Prueba</th><th>PB</th><th>SB</th><th>Rank</th></tr>
        ${RANK_EVENTS.map((e: string) => `<tr ${e === p.spec ? 'class="me"' : ""}><td>${EV[e].label}</td>
          <td class="tt">${p.pb[e] ? fmtTime(p.pb[e]) : "—"}</td><td class="tt">${p.sb[e] ? fmtTime(p.sb[e]) : "—"}</td>
          <td class="tt">${rankOfPlayerUI(e) ? "#" + rankOfPlayerUI(e) : "—"}</td></tr>`).join("")}</table>
      </div>
      <div class="panel"><div class="panel-title n">Palmarés</div>
        <div class="grid-2">
          <div>${barRow("Oros", S.career.medals.g, "", S.career.medals.g)}${barRow("Platas", S.career.medals.s, "", S.career.medals.s)}${barRow("Bronces", S.career.medals.b, "", S.career.medals.b)}</div>
          <div class="small">
            <div class="kv"><span>Victorias</span><b>${S.career.totalWins}</b></div>
            <div class="kv"><span>Med. nacionales</span><b>${S.career.natMedals.g + S.career.natMedals.s + S.career.natMedals.b}</b></div>
            <div class="kv"><span>Med. internac.</span><b>${S.career.intlMedals.g + S.career.intlMedals.s + S.career.intlMedals.b}</b></div>
            <div class="kv"><span>Récords</span><b>${S.career.recordsBroken.length}</b></div>
            <div class="kv"><span>Títulos</span><b>${S.career.titles.length}</b></div>
          </div>
        </div>
        ${S.career.titles.length ? `<div class="flexrow mt8" style="gap:5px;flex-wrap:wrap">${S.career.titles.map((t: string) => `<span class="chip t5">${t}</span>`).join("")}</div>` : ""}
      </div>
    </div>
  </div></div>`;
};

/* ---------- RANKINGS ---------- */
SCREENS.rankings = () => {
  const evk = S.params.evk || S.player?.spec || "800";
  const list = S.world?.rankings?.[evk] || [];
  const top = S.params.top || 10;
  return `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">WORLD RANKING — <span class="acc">${EV[evk].label.toUpperCase()}</span></h1>
    <button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="tr-cats">${RANK_EVENTS.map((e: string) => `<button class="tr-cat ${e === evk ? "on" : ""}" data-act="rank-ev" data-ev="${e}">${EV[e].label}</button>`).join("")}</div>
  <div class="tr-cats">${[10, 50, 100].map((n: number) => `<button class="tr-cat ${top === n ? "on" : ""}" data-act="rank-top" data-n="${n}">TOP ${n}</button>`).join("")}</div>
  <div class="panel"><table class="tbl"><tr><th>#</th><th>Atleta</th><th>País</th><th>Edad</th><th>Puntos</th></tr>
    ${list.slice(0, top).map((r: any, i: number) => { const a = findAth(r.id); if (!a) return "";
      return `<tr class="${a.isPlayer ? "me" : ""} ${i < 3 ? "top" + (i + 1) : ""}"><td class="pos">${i + 1}</td>
      <td>${a.first} ${a.last} ${a.isPlayer ? '<span class="chip me" style="margin-left:6px">TÚ</span>' : ""}</td>
      <td class="num">${a.country}</td><td class="num">${a.age}</td><td class="tt gold">${r.pts}</td></tr>`; }).join("")}
  </table>
  ${!list.length ? `<div class="dim">Aún no hay marcas esta temporada.</div>` : ""}
  ${S.player && rankOfPlayerUI(evk) > top && rankOfPlayerUI(evk) ? `<div class="mt8 small">Tu posición: <b class="num">#${rankOfPlayerUI(evk)}</b></div>` : ""}
  </div></div>`;
};

/* ---------- HISTORY ---------- */
SCREENS.history = () => {
  const seasons = [...S.career.history].reverse();
  const spec = S.player.spec;
  const pts: any[] = [];
  for (const s of S.career.history) {
    const best = Math.min(...s.races.filter((r: any) => r.evk === spec && r.t != null).map((r: any) => r.t).concat([Infinity]));
    if (isFinite(best)) pts.push({ label: String(s.year), t: best });
  }
  return `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">HISTORIAL DE CARRERA</h1><button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="grid-2" style="grid-template-columns:1fr 380px;align-items:start">
    <div class="col">${seasons.length ? seasons.map((s: any) => `<div class="panel">
      <div class="panel-title g">TEMPORADA ${s.year} · ${s.age} años</div>
      ${s.races.length ? s.races.map((r: any) => `<div class="kv"><span class="num" style="letter-spacing:.5px">${EV[r.evk].label} — <b>${fmtTime(r.t)}</b> ${r.pb ? '<span class="badge g">PB</span>' : ""}</span>
        <span><span class="dim small">${r.meet}</span> <b class="num">P${r.place}</b></span></div>`).join("") : `<div class="dim small">Sin carreras.</div>`}
      <div class="dim small mt8">Victorias: ${s.wins} · Medallas: ${s.medals} · Mejor ranking: ${s.bestRank ? "#" + s.bestRank : "—"}</div></div>`).join("") : `<div class="panel"><div class="dim">Tu historia empieza hoy.</div></div>`}
    </div>
    <div class="col">
      <div class="panel"><div class="panel-title b">Evolución · ${EV[spec].label}</div>
        <div class="graphbox">${pts.length >= 2 ? progressGraph(pts) : `<div class="dim small">Necesitas al menos dos temporadas con marcas.</div>`}</div>
      </div>
      <div class="panel"><div class="panel-title g">Logros</div>
        ${ACHIEVEMENTS.map((a: any) => `<div class="ach ${S.career.achievements.includes(a.id) ? "un" : ""}"><div class="ic">${IC.medal}</div><div><b class="num" style="letter-spacing:1px">${a.n}</b><div class="dim small">${a.d}</div></div></div>`).join("")}
      </div>
    </div>
  </div></div>`;
};
function progressGraph(pts: any[]): string {
  const W = 320, H = 150, pad = 30;
  const ts = pts.map((p: any) => p.t);
  const min = Math.min(...ts), max = Math.max(...ts);
  const range = Math.max(max - min, 0.5);
  const X = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const Y = (t: number) => pad + ((t - min) / range) * (H - pad * 2); // lower is better → but bigger y = worse; invert for motivation: best at top
  const line = pts.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${X(i).toFixed(0)},${Y(p.t).toFixed(0)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">
    ${pts.map((p: any, i: number) => `<text x="${X(i)}" y="${H - 8}" font-size="10" fill="#5E6E8C" text-anchor="middle" font-family="Oswald">${p.label}</text>
      <text x="${X(i)}" y="${Y(p.t) - 7}" font-size="10" fill="#3DDC97" text-anchor="middle" font-family="Oswald">${fmtTime(p.t)}</text>`).join("")}
    <path d="${line}" fill="none" stroke="#FF5A2B" stroke-width="2.5"/>
    ${pts.map((p: any, i: number) => `<circle cx="${X(i)}" cy="${Y(p.t)}" r="3.5" fill="#FFC531"/>`).join("")}
  </svg>`;
}

/* ---------- RELAYS ---------- */
SCREENS.relays = () => {
  const rk = S.params.team || "4x100";
  const team = S.relay[rk];
  const rel = RELAYS[rk];
  const pool = S.world.athletes.filter((a: any) => a.country === S.player.country);
  const baseEv = rel.base || "400";
  const sortedPool = [...pool].sort((a: any, b: any) => (a.pb[baseEv] || 9e9) - (b.pb[baseEv] || 9e9));
  const est = estimateRelay(team.ids, rk);
  return `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">RELEVOS</h1><button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="tr-cats">${RELAY_EVENTS.map((r: string) => `<button class="tr-cat ${r === rk ? "on" : ""}" data-act="relay-tab" data-team="${r}">${RELAYS[r].label}</button>`).join("")}</div>
  <div class="grid-2" style="grid-template-columns:1fr 340px;align-items:start">
    <div class="panel"><div class="panel-title g">${rel.label} — Alineación de ${COUNTRIES.find((c: any) => c.c === S.player.country)?.n}</div>
      ${team.ids.map((id: string, i: number) => `<div class="statrow" style="gap:12px">
        <span class="lbl" style="width:110px">POSTA ${i + 1} · ${rel.legs[i]} m</span>
        <select class="dark" style="flex:1" data-act="relay-slot" data-team="${rk}" data-slot="${i}">
          <option value="">— vacío —</option>
          ${sortedPool.map((a: any) => `<option value="${a.id}" ${id === a.id ? "selected" : ""}>${a.first} ${a.last} (${a.age}) ${a.isPlayer ? "★ TÚ" : ""}</option>`).join("")}
          ${S.player && !pool.some((a: any) => a.id === S.player.id) ? `<option value="${S.player.id}" ${id === S.player.id ? "selected" : ""}>${S.player.first} ${S.player.last} ★ TÚ</option>` : ""}
        </select></div>`).join("")}
      <div class="btnrow mt14"><button class="btn sm" data-act="relay-auto" data-team="${rk}">AUTO-SELECCIÓN</button>
        <button class="btn sm" data-act="relay-include" data-team="${rk}">INCLUIRME ${team.ids.includes(S.player.id) ? "(YA ESTÁS)" : ""}</button></div>
      <hr class="hr"/>
      <div class="panel-title b">Estrategia de cambios</div>
      <div class="tr-cats">${["conservador", "normal", "agresivo"].map((s: string) => `<button class="tr-cat ${team.style === s ? "on" : ""}" data-act="relay-style" data-team="${rk}" data-style="${s}">${s}</button>`).join("")}</div>
      <div class="dim small">Conservador: seguro pero lento · Agresivo: araña décimas, riesgo de caída${rk === "4x100" ? " y descalificación" : ""}.</div>
    </div>
    <div class="col">
      <div class="panel gold"><div class="panel-title g">Tiempo estimado</div>
        <div class="num" style="font-size:38px;font-weight:700">${est ? fmtTime(est) : "—"}</div>
        <div class="dim small mt8">Depende de velocidad, técnica, fatiga y cambios. No es la suma de PBs.</div></div>
      <div class="panel"><div class="panel-title">Orden sugerido</div>
        <div class="small mut">4×100: salida → curva → recta → ancla rápida. 4×400 y Medley: el último posta decide — pon ahí tu mejor sprint final.</div></div>
    </div>
  </div></div>`;
};

/* ---------- MEET ENTRY ---------- */
SCREENS.meetEntry = () => {
  const m = S.params.meet;
  if (!m) return `<div class="screen"><button class="btn" data-act="back-dash">← VOLVER</button></div>`;
  const elig = (evk: string) => G.canEnterEvent(m, evk);
  const relayOk = m.relay ? G.relayQualified(m) : null;
  return `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">${m.name.toUpperCase()}</h1>${tierChip(m.tier)}<button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="dim small mb14">${m.city} · Domingo · ${m.events.map((e: string) => EV[e].label).join(" · ")}</div>
  <div class="grid-2" style="align-items:start">
    <div class="panel"><div class="panel-title g">Inscripción individual</div>
      ${m.events.map((e: string) => { const el = elig(e);
        return `<div class="listitem"><div style="flex:1"><b class="num" style="letter-spacing:1px">${EV[e].label}</b>
          <div class="dim small">${el.ok ? (el.rounds ? `Clasificado · ${el.rounds}` : "Clasificado · Final directa") : el.reason}</div></div>
          ${el.ok ? `<button class="btn sm ${S.params.picked?.includes(e) ? "primary" : ""}" data-act="meet-pick" data-ev="${e}">${S.params.picked?.includes(e) ? "ELEGIDA ✓" : "ELEGIR"}</button>` : `<span class="badge r">NO</span>`}</div>`; }).join("")}
      ${m.relay ? `<hr class="hr"/><div class="panel-title b">Relevos</div>
        ${RELAY_EVENTS.map((r: string) => { const q = relayOk[r];
          return `<div class="listitem"><div style="flex:1"><b class="num" style="letter-spacing:1px">${RELAYS[r].label}</b>
            <div class="dim small">${q.ok ? (q.playerIn ? "Equipo clasificado · ESTÁS EN EL EQUIPO" : "Equipo clasificado · no estás en la alineación") : q.reason}</div></div>
            ${q.ok && q.playerIn ? `<button class="btn sm ${S.params.pickedR?.includes(r) ? "primary" : ""}" data-act="meet-pickr" data-ev="${r}">${S.params.pickedR?.includes(r) ? "ELEGIDA ✓" : "ELEGIR"}</button>` : ""}</div>`; }).join("")}` : ""}
    </div>
    <div class="col">
      <div class="panel"><div class="panel-title b">Rondas</div><div class="small mut">${m.tier >= 3 ? "Los grandes campeonatos tienen SERIES → SEMIFINAL → FINAL según la prueba. Dosifica en series: pasar por tiempos también cuenta." : "Este meeting es a final directa. Una sola carrera, sin guardarse nada."}</div></div>
      <div class="panel"><div class="panel-title g">Cómo se corre</div>
        <div class="small mut">
          <b style="color:var(--txt)">← →</b> alterna las piernas: cada pulsación es una zancada. Alterna bien para mantener el <b style="color:var(--grn)">RITMO PERFECT</b> (× combo = más eficiencia).<br>
          Cada prueba tiene su <b style="color:var(--txt)">cadencia óptima</b>: quedarse corto resta velocidad, pasarse gasta energía y fatiga — machacar no compensa.<br>
          <b style="color:var(--txt)">1–4</b> esfuerzo: RECUPERACIÓN → MÁXIMO. En distancias largas gestiona la energía; la <b style="color:var(--red)">fatiga</b> se acumula y pesa al final.<br>
          <b style="color:var(--txt)">S</b> sprint final (cuando esté disponible, cuesta mucha energía) · <b style="color:var(--txt)">ESPACIO</b> vallas e inclinación en meta (−0.08 s).
        </div></div>
      <div class="panel hot"><div class="panel-title">Listo para competir</div>
        <div class="small mut mb8">Seleccionado: <b class="num">${[...(S.params.picked || []), ...(S.params.pickedR || [])].map((e: string) => EV[e] ? EV[e].label : RELAYS[e].label).join(", ") || "nada"}</b></div>
        <button class="btn primary big wide" data-act="meet-start" ${[...(S.params.picked || []), ...(S.params.pickedR || [])].length ? "" : "disabled"}>¡A LA PISTA!</button>
        <button class="btn ghost wide mt8" data-act="meet-skip">NO PARTICIPAR</button>
      </div>
    </div>
  </div></div>`;
};

/* ---------- MEET RESULTS ---------- */
SCREENS.meetResults = () => {
  const rs = S.params.results || [];
  return `<div class="screen"><h1 class="big mb14">RESULTADOS · <span class="acc">${S.params.meetName || ""}</span></h1>
  ${rs.map((r: any) => `<div class="panel mb14"><div class="panel-title g">${r.label} — ${r.roundName}</div>
    <table class="tbl"><tr><th>#</th><th>Atleta</th><th>País</th><th>Marca</th><th></th></tr>
    ${r.rows.map((row: any) => `<tr class="${row.me ? "me" : ""}"><td class="pos">${row.dq ? "DQ" : row.place}</td>
      <td>${row.name} ${row.me ? '<span class="chip me" style="margin-left:6px">TÚ</span>' : ""}</td><td class="num">${row.country}</td>
      <td class="tt ${row.place === 1 ? "gold" : ""}">${row.dq ? "—" : fmtTime(row.t)}</td>
      <td>${row.pb ? '<span class="badge g">PB</span>' : ""} ${row.wr ? '<span class="badge g">WR</span>' : ""} ${row.nr ? '<span class="badge g">NR</span>' : ""}</td></tr>`).join("")}
    </table></div>`).join("")}
  <button class="btn primary big" data-act="results-close">CONTINUAR</button></div>`;
};

/* ---------- RECORDS ---------- */
SCREENS.records = () => {
  const W = S.world;
  const evs = RANK_EVENTS;
  const wrs = evs.map((e: string) => { const r = W?.records?.world?.[e]; return { e, t: r?.t ?? EV[e].wr, h: r?.holder ?? "—", y: r?.y ?? "—" }; });
  const nrs = evs.map((e: string) => { const r = W ? getNR(S.player?.country || "ESP", e) : null; return { e, t: r?.t, h: r?.holder, y: r?.y }; });
  const champKeys = W ? Object.keys(W.records.champs) : [];
  return `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">RÉCORDS</h1><button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="grid-2" style="align-items:start">
    <div class="panel gold"><div class="panel-title g">Récords mundiales</div>
      <table class="tbl"><tr><th>Prueba</th><th>Marca</th><th>Atleta</th><th>Año</th></tr>
      ${wrs.map((r: any) => `<tr><td>${EV[r.e].label}</td><td class="tt gold">${fmtTime(r.t)}</td><td>${r.h}</td><td class="num">${r.y}</td></tr>`).join("")}</table></div>
    <div class="col">
      <div class="panel"><div class="panel-title b">Récords nacionales · ${COUNTRIES.find((c: any) => c.c === (S.player?.country || "ESP"))?.n || ""}</div>
        <table class="tbl"><tr><th>Prueba</th><th>Marca</th><th>Atleta</th></tr>
        ${nrs.map((r: any) => `<tr><td>${EV[r.e].label}</td><td class="tt">${r.t ? fmtTime(r.t) : "—"}</td><td>${r.h || "—"}</td></tr>`).join("")}</table></div>
      <div class="panel"><div class="panel-title">Récords de campeonatos</div>
        ${champKeys.length ? champKeys.map((k: string) => `<div class="mb8"><b class="num" style="letter-spacing:1px">${k}</b>
          ${Object.entries(W.records.champs[k]).map(([e, r]: any) => `<div class="kv"><span>${EV[e].label}</span><b class="tt">${fmtTime(r.t)} · ${r.h}</b></div>`).join("")}</div>`).join("") : `<div class="dim small">Aún no se han establecido.</div>`}
      </div>
    </div>
  </div></div>`;
};

/* ---------- ACHIEVEMENTS ---------- */
SCREENS.achievements = () => `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">LOGROS</h1><button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="panel">${ACHIEVEMENTS.map((a: any) => `<div class="ach ${S.career.achievements.includes(a.id) ? "un" : ""}"><div class="ic">${IC.medal}</div><div><b class="num" style="letter-spacing:1px">${a.n}</b><div class="dim small">${a.d}</div></div></div>`).join("")}</div></div>`;

/* ---------- SETTINGS ---------- */
SCREENS.settings = () => `<div class="screen"><div class="flexrow mb14"><h1 class="big" style="flex:1">CONFIGURACIÓN</h1><button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="panel" style="max-width:560px">
    <div class="kv"><span>Sonido</span><button class="btn sm ${S.settings.sound ? "grnb" : ""}" data-act="set-sound">${S.settings.sound ? "ACTIVADO" : "APAGADO"}</button></div>
    <div class="kv"><span>Velocidad de animación base</span><select class="dark" data-act="set-speed">
      ${[0.75, 1, 1.5].map((s: number) => `<option value="${s}" ${S.settings.speed === s ? "selected" : ""}>${s}×</option>`).join("")}</select></div>
    <div class="kv"><span>Autoguardado</span><b class="grn">ACTIVO (cada día y carrera)</b></div>
    <hr class="hr"/>
    ${S.careerActive ? `<button class="btn wide mb8" data-act="set-quit">GUARDAR Y SALIR AL MENÚ</button>` : ""}
    <button class="btn danger wide" data-act="set-erase">BORRAR PARTIDA</button>
  </div></div>`;

/* ---------- SEASON END ---------- */
SCREENS.seasonEnd = () => {
  const sum = S.params.summary || {};
  return `<div class="screen center" style="max-width:760px;margin:0 auto"><h1 class="big">TEMPORADA <span class="acc">${sum.year}</span></h1>
  <div class="dim mb14 num" style="letter-spacing:2px">RESUMEN ANUAL</div>
  <div class="grid-2" style="text-align:left;align-items:start">
    <div class="panel gold">
      <div class="kv"><span>Edad</span><b class="num">${sum.age} años</b></div>
      <div class="kv"><span>${EV[S.player.spec].label} PB</span><b class="tt gold">${fmtTime(S.player.pb[S.player.spec] || Infinity)}</b></div>
      <div class="kv"><span>Victorias</span><b class="num">${sum.wins}</b></div>
      <div class="kv"><span>Medallas</span><b class="num">${sum.medals}</b></div>
      <div class="kv"><span>Mejor ranking</span><b class="num">${sum.bestRank ? "#" + sum.bestRank : "—"}</b></div>
      <div class="kv"><span>Mejor competición</span><b>${sum.bestMeet || "—"}</b></div>
      <div class="kv"><span>Dinero ganado</span><b class="grn">${fmtMoney(sum.money || 0)}</b></div>
    </div>
    <div class="panel"><div class="panel-title n">Progreso de atributos</div>
      ${Object.entries(sum.diffs || {}).map(([k, v]: any) => `<div class="kv"><span>${ATTRS.find((a: any) => a.k === k)?.n || k}</span>
        <b class="${v >= 0 ? "grn" : "red"} num">${v >= 0 ? "+" : ""}${v.toFixed(1)}</b></div>`).join("") || `<div class="dim small">Sin cambios.</div>`}
    </div>
  </div>
  <button class="btn primary big mt20" data-act="season-next">COMENZAR TEMPORADA ${sum.year + 1} ▸</button></div>`;
};

/* ---------- RETIRE ---------- */
SCREENS.retire = () => {
  const c = S.career, p = S.player;
  const score = legendScore(c, p);
  return `<div class="screen center" style="max-width:720px;margin:0 auto">
    <div class="dim num" style="letter-spacing:4px">FIN DE LA CARRERA</div>
    <h1 class="big mt8">${p.first} <span class="acc">${p.last}</span></h1>
    <div class="legend-num mt14">${score}<span style="font-size:.35em;color:var(--mut)">/100</span></div>
    <div class="num" style="letter-spacing:3px;color:var(--gold)">LEGEND SCORE</div>
    <div class="grid-2 mt20" style="text-align:left">
      <div class="panel">
        <div class="kv"><span>Años de carrera</span><b class="num">${c.seasons.length + 1}</b></div>
        <div class="kv"><span>Victorias</span><b class="num">${c.totalWins}</b></div>
        <div class="kv"><span>Medallas</span><b class="num">${c.medals.g + c.medals.s + c.medals.b}</b></div>
        <div class="kv"><span>Mejor ranking</span><b class="num">${Math.min(...Object.values(c.bestRank).map(Number).concat([99])) < 99 ? "#" + Math.min(...Object.values(c.bestRank).map(Number)) : "—"}</b></div>
      </div>
      <div class="panel">
        <div class="kv"><span>Récords</span><b class="num">${c.recordsBroken.length}</b></div>
        <div class="kv"><span>Títulos</span><b class="num">${c.titles.length}</b></div>
        <div class="kv"><span>Mejor marca (${EV[p.spec].label})</span><b class="tt gold">${fmtTime(p.pb[p.spec] || Infinity)}</b></div>
        <div class="kv"><span>Medallas intl.</span><b class="num">${c.intlMedals.g}O ${c.intlMedals.s}P ${c.intlMedals.b}B</b></div>
      </div>
    </div>
    <button class="btn goldb big mt20" data-act="retire-confirm">ENTRAR EN LA HISTORIA</button>
    <button class="btn ghost mt8" data-act="back-dash">SEGUIR COMPITIENDO</button></div>`;
};

/* ---------- HALL OF FAME ---------- */
SCREENS.hof = () => {
  const hof = G.getHOF();
  return `<div class="screen" style="max-width:760px;margin:0 auto"><div class="flexrow mb14"><h1 class="big" style="flex:1">SALÓN DE LA <span class="gold">FAMA</span></h1><button class="btn" data-act="back-dash">← VOLVER</button></div>
  <div class="panel gold">${hof.length ? hof.map((h: any, i: number) => `<div class="listitem ${i < 3 ? "top" + (i + 1) : ""}">
    <div class="rk">${i + 1}</div>
    <div style="flex:1"><b class="num" style="font-size:16px;letter-spacing:1px">${h.name}</b>
      <div class="dim small">${h.country} · ${h.spec} · ${h.years} temporadas</div></div>
    <div class="num gold" style="font-size:22px;font-weight:700">${h.score}</div></div>`).join("") : `<div class="dim">Aún no hay leyendas. La primera puede ser la tuya.</div>`}</div></div>`;
};
