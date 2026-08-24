// @ts-nocheck
/* ============ SOUND: tiny WebAudio synth ============ */
import { S } from "./store";

let ctx: any = null;
export function audio(): any {
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { ctx = null; }
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}
function env(g: any, t0: number, a: number, d: number, v: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
export function snd(type: string) {
  if (!S.settings.sound) return;
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  const out = c.createGain(); out.gain.value = 0.5; out.connect(c.destination);
  const osc = (f: number, dur: number, wave = "square", vol = 0.25, when = 0) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = wave; o.frequency.value = f; env(g, t + when, 0.008, dur, vol);
    o.connect(g); g.connect(out); o.start(t + when); o.stop(t + when + dur + 0.05);
  };
  const noise = (dur: number, vol = 0.3, when = 0, freq = 1200) => {
    const len = c.sampleRate * dur; const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq;
    const g = c.createGain(); env(g, t + when, 0.005, dur, vol);
    src.connect(f); f.connect(g); g.connect(out); src.start(t + when);
  };
  switch (type) {
    case "click": osc(660, 0.06, "square", 0.12); break;
    case "tab": osc(440, 0.05, "square", 0.09); break;
    case "ready": osc(392, 0.12, "sine", 0.2); break;
    case "set": osc(494, 0.12, "sine", 0.2); break;
    case "gun": noise(0.16, 0.6, 0, 900); osc(180, 0.14, "sawtooth", 0.3); break;
    case "false": osc(220, 0.3, "sawtooth", 0.25); osc(180, 0.4, "sawtooth", 0.2, 0.12); break;
    case "tick": osc(880, 0.04, "sine", 0.08); break;
    case "finish": noise(0.9, 0.35, 0, 1600); osc(523, 0.3, "triangle", 0.22, 0.05); osc(659, 0.35, "triangle", 0.22, 0.2); osc(784, 0.5, "triangle", 0.24, 0.35); break;
    case "pb": osc(523, 0.14, "triangle", 0.25); osc(659, 0.14, "triangle", 0.25, 0.13); osc(784, 0.14, "triangle", 0.25, 0.26); osc(1047, 0.5, "triangle", 0.28, 0.39); break;
    case "record": osc(392, 0.16, "triangle", 0.26); osc(523, 0.16, "triangle", 0.26, 0.15); osc(659, 0.16, "triangle", 0.26, 0.3); osc(784, 0.16, "triangle", 0.26, 0.45); osc(1047, 0.8, "triangle", 0.3, 0.6); noise(1.1, 0.3, 0.6, 2000); break;
    case "win": osc(523, 0.12, "square", 0.16); osc(659, 0.12, "square", 0.16, 0.12); osc(784, 0.4, "square", 0.18, 0.24); noise(0.8, 0.3, 0.2, 1800); break;
    case "bad": osc(196, 0.25, "sawtooth", 0.2); osc(147, 0.35, "sawtooth", 0.18, 0.15); break;
    case "coin": osc(988, 0.07, "square", 0.15); osc(1319, 0.18, "square", 0.15, 0.07); break;
    case "swap": noise(0.08, 0.25, 0, 2400); break;
    case "ach": osc(659, 0.1, "triangle", 0.22); osc(880, 0.1, "triangle", 0.22, 0.1); osc(1175, 0.4, "triangle", 0.24, 0.2); break;
  }
}
