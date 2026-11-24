// 🍂🎃🎄🌸🛡🇺🇦 Сезонне оформлення сайту (адаптовано зі старого сайту під новий дизайн).
// Налаштування — в ud_config/site: season ("auto" | au | hw | xm | sp | df | ind | "off") і music.
//   🍂 осінь 1.09–30.11 (інколи на 2–3 хв дощ) · 🛡 День захисників 1.10 · 🎃 Хелловін 25.10–1.11
//   🎄 зимові свята з 6:00 5.12 до 10.01 · 🌸 весна березень–травень · 🇺🇦 День Незалежності 24.08
import { S } from "./store.js";
import { t } from "./i18n.js";

export const SEASONS = ["au", "hw", "xm", "sp", "df", "ind"];
export const SEASON_IC = { au: "🍂", hw: "🎃", xm: "🎄", sp: "🌸", df: "🛡", ind: "🇺🇦" };
const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } };
const cfg = () => S.site || {};
export const seasonMode = () => cfg().season || "auto";

export function seasonNow() {
  const m = seasonMode();
  if (SEASONS.includes(m)) return m;
  if (m === "off") return "";
  let d = "", h = 12;
  try {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kiev", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const g = k => (f.find(x => x.type === k) || {}).value; d = g("month") + "-" + g("day"); h = +g("hour");
  } catch (_) { d = new Date().toISOString().slice(5, 10); }
  if ((d >= "10-25" && d <= "10-31") || d === "11-01") return "hw";
  if ((d === "12-05" && h >= 6) || d > "12-05" || d <= "01-10") return "xm";
  if (d === "10-01") return "df";
  if (d === "08-24") return "ind";
  if (d >= "09-01" && d <= "11-30") return "au";
  if (d >= "03-01" && d <= "05-31") return "sp";
  return "";
}

// ---------- частинки, що падають ----------
const LEAVES = [
  '<svg viewBox="0 0 100 100"><path class="lf" d="M50 4L56 20L63 15L61 34L72 23L75 30L89 26L83 40L91 45L74 57L77 63L57 61L52 74L48 74L43 61L23 63L26 57L9 45L17 40L11 26L25 30L28 23L39 34L37 15L44 20Z"/><path class="lv" d="M50 74V10M50 52L82 31M50 52L18 31M50 64L71 58M50 64L29 58M50 76Q51 86 54 97"/></svg>',
  '<svg viewBox="0 0 100 100"><path class="lf" d="M50 8C58 8 60 16 57 22C66 18 72 24 66 32C76 30 80 40 70 46C80 48 80 60 68 62C76 68 70 78 60 74C60 80 56 86 52 86L48 86C44 86 40 80 40 74C30 78 24 68 32 62C20 60 20 48 30 46C20 40 24 30 34 32C28 24 34 18 43 22C40 16 42 8 50 8Z"/><path class="lv" d="M50 86V12M50 30L62 26M50 30L38 26M50 46L66 40M50 46L34 40M50 62L64 60M50 62L36 60M50 86Q50 92 52 97"/></svg>',
  '<svg viewBox="0 0 100 100"><path class="lf" d="M50 6C70 20 82 46 68 72C62 82 55 87 51 90L49 90C45 87 38 82 32 72C18 46 30 20 50 6Z"/><path class="lv" d="M50 90V12M50 34L64 26M50 34L36 26M50 50L68 42M50 50L32 42M50 66L64 60M50 66L36 60M50 90Q50 94 52 98"/></svg>',
];
const BAT = '<svg viewBox="0 0 64 28"><path class="bt" d="M32 9c1.6-3 3-4 3-4l1 3c2.5-.6 4.2.2 4.2.2 3.2-5 9.8-7 16.6-5.4-4.4 1.6-6.4 4.6-6.4 4.6 4.6-.6 9.2 1.4 11.6 5-4-.4-7.4.4-9.4 2.4 1.8 2 2.2 4.8 2.2 4.8-3.6-2.6-8.4-2.6-11 .2C42 15 38 13.6 32 22c-6-8.4-10-7-11.8-3.6-2.6-2.8-7.4-2.8-11-.2 0 0 .4-2.8 2.2-4.8-2-2-5.4-2.8-9.4-2.4 2.4-3.6 7-5.6 11.6-5 0 0-2-3-6.4-4.6C14 -.2 20.6 1.8 23.8 6.8c0 0 1.7-.8 4.2-.2l1-3s1.4 1 3 4z"/></svg>';
const FLAKE = '<svg viewBox="0 0 40 40"><g class="fl"><path d="M20 2V38M4.4 11L35.6 29M4.4 29L35.6 11"/><path d="M20 8l-4-4M20 8l4-4M20 32l-4 4M20 32l4 4M9.6 14l-5.4 1.2M9.6 14l-1.6-5.2M30.4 26l5.4-1.2M30.4 26l1.6 5.2M9.6 26l-5.4-1.2M9.6 26l-1.6 5.2M30.4 14l5.4 1.2M30.4 14l1.6-5.2"/></g></svg>';
const PETAL = '<svg viewBox="0 0 40 40"><path class="pt" d="M20 3C28 10 32 20 27 30C24 36 20 38 20 38S16 36 13 30C8 20 12 10 20 3Z"/></svg>';
const STAR = '<svg viewBox="0 0 40 40"><path class="st" d="M20 3l4.9 10 11 1.6-8 7.8 1.9 11L20 28.2 10.2 33.4l1.9-11-8-7.8 11-1.6z"/></svg>';
const RIBBON = '<svg viewBox="0 0 20 40"><rect class="rb" x="4" y="0" width="12" height="40" rx="3"/></svg>';
const PARTS = {
  au: () => LEAVES[Math.floor(Math.random() * 3)], hw: () => BAT, xm: () => FLAKE, sp: () => PETAL, df: () => STAR, ind: () => RIBBON,
};
const COUNT = { au: 14, hw: 7, xm: 26, sp: 14, df: 12, ind: 18 };

let applied = null, fx = null;
export function applySeason() {
  const sn = seasonNow();
  if (sn === applied) return;
  applied = sn;
  const R = document.documentElement;
  SEASONS.forEach(k => R.classList.toggle("ss-" + k, sn === k));
  if (fx) { fx.remove(); fx = null; }
  rainStop(true);
  if (!sn) { musicSync(); return; }
  if (!reduced()) {
    fx = document.createElement("div"); fx.className = "sfx sfx-" + sn; fx.setAttribute("aria-hidden", "true");
    const n = Math.round(COUNT[sn] * (innerWidth < 700 ? 0.55 : 1));
    let h = "";
    for (let i = 0; i < n; i++) {
      const size = sn === "xm" ? 10 + Math.random() * 14 : sn === "hw" ? 26 + Math.random() * 22 : 16 + Math.random() * 16;
      const dur = (sn === "xm" ? 9 : sn === "hw" ? 14 : 11) + Math.random() * 10;
      const hue = sn === "au" ? ["#c0392b", "#d35400", "#e67e22", "#b7950b", "#a04000"][i % 5] : "";
      h += `<i style="left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${dur}s,${3 + Math.random() * 3}s;animation-delay:${-Math.random() * dur}s,${-Math.random() * 3}s;${hue ? `--c:${hue};` : ""}${sn === "ind" ? `--c:${i % 2 ? "#ffd700" : "#0057b7"};` : ""}">${PARTS[sn]()}</i>`;
    }
    fx.innerHTML = h;
    document.body.appendChild(fx);
  }
  if (sn === "au") rainSchedule(true);
  musicSync();
}

// ---------- осінній дощ: інколи на 2–3 хвилини ----------
const RAIN = { t: 0, raf: 0, cv: null, drops: [], until: 0, alpha: 0 };
function rainSchedule(first) {
  clearTimeout(RAIN.t); if (reduced()) return;
  const min = first ? 3 : 14, max = first ? 9 : 35;
  RAIN.t = setTimeout(() => rainStart(120000 + Math.random() * 60000), (min + Math.random() * (max - min)) * 60000);
}
export function rainStart(dur) {
  if (seasonNow() !== "au" || reduced()) return;
  let cv = RAIN.cv;
  if (!cv) { cv = document.createElement("canvas"); cv.className = "srain"; cv.setAttribute("aria-hidden", "true"); document.body.appendChild(cv); RAIN.cv = cv; }
  const fit = () => {
    const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; RAIN.d = d;
    const n = Math.round(innerWidth * innerHeight / 7000);
    RAIN.drops = Array.from({ length: n }, () => ({ x: Math.random() * innerWidth * 1.2, y: Math.random() * innerHeight, l: 10 + Math.random() * 16, v: 9 + Math.random() * 7, o: .18 + Math.random() * .3 }));
  };
  fit(); window.removeEventListener("resize", RAIN.fit); RAIN.fit = fit; window.addEventListener("resize", fit);
  RAIN.until = Date.now() + (dur || 150000); document.documentElement.classList.add("raining");
  cancelAnimationFrame(RAIN.raf);
  const ctx = cv.getContext("2d");
  const step = () => {
    const left = RAIN.until - Date.now();
    RAIN.alpha = left > 4000 ? Math.min(1, RAIN.alpha + .02) : Math.max(0, left / 4000);
    ctx.setTransform(RAIN.d, 0, 0, RAIN.d, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.strokeStyle = "rgba(150,170,195,1)"; ctx.lineWidth = 1.1;
    for (const p of RAIN.drops) {
      ctx.globalAlpha = p.o * RAIN.alpha; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.l * .25, p.y + p.l); ctx.stroke();
      p.y += p.v; p.x -= p.v * .25; if (p.y > innerHeight) { p.y = -20; p.x = Math.random() * innerWidth * 1.2; }
    }
    if (left > 0) RAIN.raf = requestAnimationFrame(step); else rainStop();
  };
  step();
}
function rainStop(hard) {
  cancelAnimationFrame(RAIN.raf); document.documentElement.classList.remove("raining");
  if (RAIN.cv) { RAIN.cv.remove(); RAIN.cv = null; }
  if (hard) clearTimeout(RAIN.t); else rainSchedule(false);
}

// ---------- музика: синтезовані мелодії (суспільне надбання) + свої треки за посиланням ----------
const NOTE = n => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0; const b = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); return 440 * Math.pow(2, (b + (+m[3] - 4) * 12 - 9) / 12); };
const MU = { ctx: null, master: null, on: false, timer: 0, idx: 0, sn: "", audio: null };
const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
function bell(t, f, d) { const C = MU.ctx; [[1, .5], [2, .18], [3.01, .08], [4.2, .04]].forEach(([k, v]) => { const o = C.createOscillator(), g = C.createGain(); o.type = "sine"; o.frequency.value = f * k; env(g, t, .004, v, Math.max(.5, d * 2.2) / (k > 1 ? 1.6 : 1)); o.connect(g).connect(MU.master); o.start(t); o.stop(t + d * 2.5 + 1); }); }
function pad(t, f, d, v) { const C = MU.ctx, o = C.createOscillator(), g = C.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v || .12, t + .08); g.gain.setValueAtTime(v || .12, t + d * .8); g.gain.exponentialRampToValueAtTime(.0001, t + d + .3); o.connect(g).connect(MU.master); o.start(t); o.stop(t + d + .4); }
function pluck(t, f) { const C = MU.ctx, o = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter(); o.type = "sawtooth"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(300, t + .25); env(g, t, .005, .28, .32); o.connect(lp).connect(g).connect(MU.master); o.start(t); o.stop(t + .5); }
function organ(t, f, d, v) { const C = MU.ctx, g = C.createGain(), lp = C.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1700; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v || .13, t + .03); g.gain.setValueAtTime(v || .13, t + Math.max(.05, d - .05)); g.gain.exponentialRampToValueAtTime(.0001, t + d + .35);
  [[1, "sawtooth", .5], [2, "square", .18], [.5, "sine", .5]].forEach(([k, ty, vv]) => { const o = C.createOscillator(), og = C.createGain(); o.type = ty; o.frequency.value = f * k; og.gain.value = vv; o.connect(og).connect(lp); o.start(t); o.stop(t + d + .4); }); lp.connect(g).connect(MU.master); }
function drone(t, f, d) { const C = MU.ctx, o = C.createOscillator(), g = C.createGain(), l = C.createOscillator(), lg = C.createGain(); o.type = "sine"; o.frequency.value = f; l.frequency.value = .18; lg.gain.value = .04; l.connect(lg).connect(g.gain); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.09, t + 2); g.gain.setValueAtTime(.09, t + d - 2); g.gain.linearRampToValueAtTime(.0001, t + d); o.connect(g).connect(MU.master); o.start(t); l.start(t); o.stop(t + d + .1); l.stop(t + d + .1); }
function seq(t, bpm, notes, inst) { const b = 60 / bpm; let x = t; notes.forEach(([n, d]) => { if (n !== "-") { const f = NOTE(n); if (f) inst(x, f, d * b); } x += d * b; }); return x - t; }
const rep = (m, k) => Array.from({ length: k }, () => m).flat();
export const PIECES = {
  xm: [
    { id: "shch", name: "Щедрик (М. Леонтович)", play(t) { const bpm = 168; const A = rep([["Bb4", 1], ["A4", .5], ["Bb4", .5], ["G4", 1]], 4), B = rep([["D5", 1], ["C5", .5], ["D5", .5], ["Bb4", 1]], 4),
      C = [["G5", .5], ["G5", .5], ["G5", .5], ["F5", .5], ["Eb5", .5], ["D5", .5], ["C5", .5], ["C5", .5], ["C5", .5], ["Bb4", .5], ["A4", .5], ["G4", .5], ["F4", .5], ["G4", .5], ["A4", .5], ["Bb4", .5], ["C5", .5], ["D5", .5], ["C5", 3],
        ["G5", .5], ["G5", .5], ["G5", .5], ["F5", .5], ["Eb5", .5], ["D5", .5], ["C5", .5], ["C5", .5], ["C5", .5], ["Bb4", .5], ["A4", .5], ["G4", .5], ["F4", .5], ["G4", .5], ["A4", .5], ["Bb4", .5], ["C5", .5], ["A4", .5], ["G4", 3]];
      const mel = [...A, ...B, ...C, ...A], d = seq(t, bpm, mel, bell); const bass = []; for (let i = 0; i < mel.reduce((a, x) => a + x[1], 0) / 3; i++) bass.push([["G2", "G2", "Eb2", "D2"][Math.floor(i / 4) % 4], 3]); seq(t, bpm, bass, (a, f, dd) => pad(a, f, dd, .07)); return d; } },
    { id: "dobryi", name: "Добрий вечір тобі (колядка)", play(t) { const bpm = 104; const v = [["E5", 1], ["E5", .5], ["E5", .5], ["D5", .5], ["C5", .5], ["B4", 1], ["C5", .5], ["D5", .5], ["E5", .5], ["D5", .5], ["C5", .5], ["B4", .5], ["A4", 2],
      ["A4", .5], ["B4", .5], ["C5", 1], ["B4", .5], ["A4", .5], ["G#4", 1], ["A4", .5], ["B4", .5], ["C5", .5], ["D5", .5], ["E5", 2], ["E5", .5], ["F5", .5], ["E5", .5], ["D5", .5], ["C5", .5], ["B4", .5], ["C5", .5], ["B4", .5], ["A4", 2]];
      const d = seq(t, bpm, [...v, ["-", 1], ...v], bell); const bass = []; for (let i = 0; i < Math.ceil(d / (60 / bpm) / 4); i++) bass.push([["A2", "E2", "A2", "D2", "A2", "E2", "A2", "A2"][i % 8], 4]); seq(t, bpm, bass, (a, f, dd) => pad(a, f, dd, .07)); return d; } },
    { id: "nova", name: "Нова радість стала (колядка)", play(t) { const bpm = 138; const v = [["G4", 1], ["C5", 1], ["C5", 1], ["D5", 1], ["E5", 1], ["E5", 1], ["D5", 1], ["C5", 1], ["D5", 1], ["E5", 2], ["-", 1],
      ["E5", 1], ["F5", 1], ["G5", 1], ["G5", 1], ["F5", 1], ["E5", 1], ["D5", 1], ["E5", 1], ["F5", 1], ["E5", 2], ["-", 1], ["G5", 1], ["E5", 1], ["C5", 1], ["D5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["G4", 1], ["B4", 1], ["C5", 3]];
      const d = seq(t, bpm, [...v, ...v], bell); const ch = ["C3", "C3", "G2", "C3", "C3", "F2", "G2", "C3", "C3", "G2", "G2", "C3"], bass = []; for (let i = 0; i < Math.ceil(d / (60 / bpm) / 3); i++) bass.push([ch[i % ch.length], 3]); seq(t, bpm, bass, (a, f, dd) => pad(a, f, dd, .07)); return d; } },
    { id: "jingle", name: "Jingle Bells (Дж. Пірпонт)", play(t) { const bpm = 200; const h1 = [["E5", 1], ["E5", 1], ["E5", 2], ["E5", 1], ["E5", 1], ["E5", 2], ["E5", 1], ["G5", 1], ["C5", 1.5], ["D5", .5], ["E5", 4], ["F5", 1], ["F5", 1], ["F5", 1.5], ["F5", .5], ["F5", 1], ["E5", 1], ["E5", 1], ["E5", .5], ["E5", .5]];
      const ch = [...h1, ["E5", 1], ["D5", 1], ["D5", 1], ["E5", 1], ["D5", 2], ["G5", 2], ...h1, ["G5", 1], ["G5", 1], ["F5", 1], ["D5", 1], ["C5", 4]];
      const d = seq(t, bpm, ch, bell); seq(t, bpm, ["C3", "C3", "F3", "C3", "D3", "G2", "C3", "G2", "C3", "C3", "F3", "C3", "G2", "G2", "C3", "C3"].map(n => [n, 4]), (a, f, dd) => pad(a, f, dd, .06)); return d; } },
  ],
  hw: [
    { id: "grieg", name: "В печері гірського короля (Е. Гріг)", play(t) { const th = [["B3", .5], ["C#4", .5], ["D4", .5], ["E4", .5], ["F#4", .5], ["D4", .5], ["F#4", 1], ["F4", .5], ["C#4", .5], ["F4", 1], ["E4", .5], ["C4", .5], ["E4", 1],
      ["B3", .5], ["C#4", .5], ["D4", .5], ["E4", .5], ["F#4", .5], ["D4", .5], ["F#4", .5], ["B4", .5], ["A4", .5], ["F#4", .5], ["D4", .5], ["F#4", .5], ["A4", 2]];
      let x = 0; [96, 108, 124, 144].forEach((bpm, k) => { x += seq(t + x, bpm, th, k < 2 ? pluck : (a, f, dd) => { pluck(a, f, dd); pluck(a, f * 2, dd); }); }); drone(t, NOTE("B1"), x); return x; } },
    { id: "bach", name: "Токата ре мінор (Й. С. Бах)", play(t) { const bpm = 72; const a = [["A5", .25], ["G5", .25], ["A5", 1.5], ["-", .5], ["G5", .25], ["F5", .25], ["E5", .25], ["D5", .25], ["C#5", .75], ["D5", 2], ["-", 1],
      ["A4", .25], ["G4", .25], ["A4", 1.5], ["-", .5], ["E4", .5], ["F4", .5], ["C#4", .5], ["D4", 2], ["-", 1], ["A3", .25], ["G3", .25], ["A3", 1.5], ["-", .5], ["G3", .25], ["F3", .25], ["E3", .25], ["D3", .25], ["C#3", .75], ["D3", 3]];
      const d = seq(t, bpm, a, (x, f, dd) => organ(x, f, dd, .18)); seq(t, bpm, [["-", 2], ["D2", 4], ["-", 2], ["D2", 4], ["-", 2], ["D2", 5]], (x, f, dd) => organ(x, f, dd, .11)); drone(t, NOTE("D2"), d); return d; } },
  ],
};
const mcfg = () => cfg().music || {};
export const musicAuto = () => mcfg().auto !== false;
export const musicOff = sn => ((mcfg().off || {})[sn]) || [];
export const musicCustom = sn => ((mcfg().custom || {})[sn]) || [];
export function playlist(sn) {
  return [...(PIECES[sn] || []).filter(p => !musicOff(sn).includes(p.id)).map(p => ({ ...p, type: "synth" })),
    ...musicCustom(sn).filter(x => x && /^https:\/\//.test(x.url || "")).map(x => ({ type: "file", name: x.name || "♪", url: x.url }))];
}
const pref = () => { try { const v = localStorage.getItem("ud2-music"); return v === "1" ? true : v === "0" ? false : null; } catch (_) { return null; } };
const setPref = v => { try { localStorage.setItem("ud2-music", v ? "1" : "0"); } catch (_) {} };
function ensureCtx() {
  if (MU.ctx) return true; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  MU.ctx = new AC(); MU.master = MU.ctx.createGain(); MU.master.gain.value = 0; MU.master.connect(MU.ctx.destination); return true;
}
function next() {
  if (!MU.on) return; const L = playlist(MU.sn); if (!L.length) return stop();
  const p = L[MU.idx % L.length]; MU.idx++; clearTimeout(MU.timer);
  if (MU.audio) { try { MU.audio.pause(); } catch (_) {} MU.audio = null; }
  if (p.type === "file") { const a = new Audio(p.url); a.volume = .6; MU.audio = a; a.onended = () => next(); a.onerror = () => { MU.timer = setTimeout(next, 500); }; a.play().catch(() => { MU.timer = setTimeout(next, 500); }); }
  else { const d = p.play(MU.ctx.currentTime + .1); MU.timer = setTimeout(next, (d + 2.5) * 1000); }
  btn();
}
function start() {
  const sn = seasonNow(); if (!playlist(sn).length || !ensureCtx()) return;
  MU.sn = sn; MU.on = true; MU.ctx.resume();
  const g = MU.master.gain, t = MU.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(.55, t + 1.5);
  next();
}
function stop() {
  MU.on = false; clearTimeout(MU.timer);
  if (MU.audio) { try { MU.audio.pause(); } catch (_) {} MU.audio = null; }
  if (MU.ctx) { const g = MU.master.gain, t = MU.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + .6); }
  btn();
}
function btn() {
  let b = document.getElementById("musbtn");
  const sn = seasonNow(), show = !!sn && playlist(sn).length > 0;
  if (!show) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement("button"); b.id = "musbtn"; b.type = "button";
    b.onclick = () => { if (MU.on) { stop(); setPref(false); } else { setPref(true); start(); } };
    document.body.appendChild(b);
  }
  b.textContent = (MU.on ? "🔊 " : "🔇 ") + SEASON_IC[sn];
  b.title = t(MU.on ? "ss.musOff" : "ss.musOn"); b.setAttribute("aria-label", b.title);
  b.setAttribute("aria-pressed", MU.on ? "true" : "false");
}
function musicSync() {
  if (MU.on && MU.sn !== seasonNow()) stop();
  btn();
}
// браузери дозволяють звук лише після першого натискання на сторінці
document.addEventListener("pointerdown", e => {
  if (e.target && e.target.closest && e.target.closest("#musbtn")) return;
  if (MU.on || !seasonNow()) return;
  const p = pref(); if (p === false || (p === null && !musicAuto())) return;
  start();
}, { capture: true });
