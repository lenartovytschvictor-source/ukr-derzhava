// 🗓 Календар держави й Церкви: сітка місяця зі святами, строками (голосування, вибори, внески) і подіями.
import { S, me, player, ms, changed } from "../store.js";
import { t } from "../i18n.js";
import { esc } from "../ui.js";
import { upcoming } from "./church.js";
import { canEcon } from "./economy.js";

const CAL = { y: 0, m: 0, d: 0 };
const lng = () => document.documentElement.lang || "uk";
const pad = n => String(n).padStart(2, "0");
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function events(y, m) {
  const ev = {}, dim = new Date(y, m + 1, 0).getDate();
  const add = (d, e) => { if (d >= 1 && d <= dim) (ev[d] = ev[d] || []).push(e); };
  const inM = v => { const x = ms(v); if (!x) return 0; const d = new Date(x); return d.getFullYear() === y && d.getMonth() === m ? d.getDate() : 0; };
  const dayIso = s => { const d = Date.parse(String(s || "") + "T12:00:00"); return isNaN(d) ? 0 : inM(d); };
  const time = v => { const d = new Date(ms(v)); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  // свята
  for (const h of S.holidays) {
    const [mm, dd] = String(h.date || "").slice(-5).split("-").map(Number);
    if (h.yearly ? mm === m + 1 : String(h.date).startsWith(`${y}-${pad(m + 1)}`)) add(Math.min(dd, dim), { cls: h.kind === "church" ? "hol chol" : "hol", ic: h.kind === "church" ? "✝" : "🎉", tx: h.name, sub: [h.desc, t(h.kind === "church" ? "cal.church" : "cal.state")].filter(Boolean).join(" · ") });
  }
  // строки
  for (const b of S.bills) {
    if (b.status === "voting") add(inM(b.voteEnd), { cls: "dl", ic: "🗳", tx: t("cal.voteEnd", { x: b.title }), t: b.voteEnd, href: "#/derzhava/palata/" + b.id });
    if (b.status === "override") add(inM(b.ovEnd), { cls: "dl", ic: "🔁", tx: t("cal.ovEnd", { x: b.title }), t: b.ovEnd, href: "#/derzhava/palata/" + b.id });
  }
  for (const e of S.elections) {
    if (e.stage === "nomination") add(inM(e.nomEnd), { cls: "dl", ic: "🙋", tx: t("cal.nomEnd", { x: e.title }), t: e.nomEnd, href: "#/derzhava/vybory/" + e.id });
    if (e.stage === "voting") add(inM(e.voteEnd), { cls: "dl", ic: "🗳", tx: t("cal.elEnd", { x: e.title }), t: e.voteEnd, href: "#/derzhava/vybory/" + e.id });
    if (["done", "tie"].includes(e.stage)) add(inM(e.closedAt), { cls: "past", ic: "🏆", tx: e.winner ? t("cal.elected", { x: e.title, w: (player(e.winner) || {}).name || "?" }) : e.title, href: "#/derzhava/vybory/" + e.id });
  }
  const m0 = me(), dues = S.dues.filter(x => x.status === "open" && x.due && (canEcon() || (m0 && x.pid === m0.id)));
  const byDay = {};
  dues.forEach(x => { const d = dayIso(x.due); if (d) (byDay[d] = byDay[d] || []).push(x); });
  Object.entries(byDay).forEach(([d, xs]) => add(+d, { cls: "dl", ic: "💰", tx: xs.length === 1 ? t("cal.due", { x: xs[0].what }) : t("cal.dues", { n: xs.length }), sub: xs.map(x => (player(x.pid) || {}).name).filter(Boolean).slice(0, 6).join(", "), href: "#/derzhava/ekonomika" }));
  // події
  for (const l of S.laws) add(dayIso(l.date), { cls: "past", ic: l.kind === "decree" ? "🪶" : "📜", tx: `${t(l.kind === "decree" ? "lw.no.decree" : "lw.no.law", { n: l.no || "?" })} «${l.title}»`, href: "#/zakon/zakony/" + l.id });
  for (const n of S.news) add(inM(n.at), { cls: "past", ic: "📰", tx: n.title, href: "#/novyny/" + n.id });
  for (const x of S.treaties) add(dayIso(x.signed), { cls: "past", ic: "🤝", tx: x.title, href: "#/derzhava/dyplomatiya" });
  for (const x of S.chdocs) add(inM(x.at), { cls: "past", ic: x.kind === "msg" ? "✉️" : "⛪", tx: x.title, href: "#/narod/tserkva/" + (x.kind === "msg" ? "poslannya" : "postanovy") });
  Object.values(ev).forEach(list => list.forEach(e => { if (e.t && e.cls === "dl") e.sub = [e.sub, t("cal.at", { x: time(e.t) })].filter(Boolean).join(" · "); }));
  return ev;
}
// дні надзвичайного стану
function emDays(y, m) {
  const e = S.site && S.site.emergency; if (!e || !e.from) return () => false;
  const to = e.on ? ms(e.until) : (ms(e.ended) || ms(e.until));
  return d => { const a = new Date(y, m, d).getTime(), b = a + 864e5; return ms(e.from) < b && to > a; };
}

export function render() {
  const now = new Date();
  if (!CAL.y) { CAL.y = now.getFullYear(); CAL.m = now.getMonth(); }
  const { y, m } = CAL, ev = events(y, m), em = emDays(y, m);
  const off = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const monthName = cap(new Date(y, m, 1).toLocaleDateString(lng(), { month: "long", year: "numeric" }));
  const wds = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(lng(), { weekday: "short" }));
  let cells = "";
  for (let i = 0; i < off; i++) cells += `<div class="cd out" aria-hidden="true"></div>`;
  for (let d = 1; d <= dim; d++) {
    const es = ev[d] || [], hol = es.filter(e => e.cls.startsWith("hol"));
    const today = now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;
    cells += `<button type="button" class="cd${today ? " today" : ""}${hol.length ? " hol" : ""}${hol.some(e => e.cls.includes("chol")) ? " ch" : ""}${em(d) ? " em" : ""}${CAL.d === d ? " sel" : ""}" data-cald="${d}" aria-pressed="${CAL.d === d}" aria-label="${d}${hol.length ? ": " + esc(hol.map(e => e.tx).join(", ")) : ""}${es.length ? " · " + es.length : ""}">
      <span class="dn">${d}</span>${hol.map(e => `<span class="hn">${esc(e.tx)}</span>`).join("")}<span class="dots">${es.filter(e => !e.cls.startsWith("hol")).slice(0, 5).map(e => `<i class="${e.cls}"></i>`).join("")}</span></button>`;
  }
  const tail = (7 - (off + dim) % 7) % 7;
  for (let i = 0; i < tail; i++) cells += `<div class="cd out" aria-hidden="true"></div>`;
  const days = CAL.d && CAL.d <= dim ? [CAL.d] : Object.keys(ev).map(Number).sort((a, b) => a - b);
  const list = days.length ? days.map(d => `<div class="cday"><div class="cdh">${esc(cap(new Date(y, m, d).toLocaleDateString(lng(), { day: "numeric", month: "long", weekday: "long" })))}</div>
    ${(ev[d] || []).map(e => `<${e.href ? `a href="${esc(e.href)}"` : "div"} class="cev ${e.cls}"><span class="ci" aria-hidden="true">${e.ic}</span><span><span>${e.cls.startsWith("hol") ? `<b>${esc(e.tx)}</b>` : esc(e.tx)}</span>${e.sub ? `<small class="hint">${esc(e.sub)}</small>` : ""}</span></${e.href ? "a" : "div"}>`).join("") || `<p class="hint">${esc(t("cal.noDay"))}</p>`}</div>`).join("")
    : `<p class="empty">${esc(t("cal.noMonth"))}</p>`;
  const up = upcoming(8);
  const isNow = y === now.getFullYear() && m === now.getMonth();
  return `<div class="calwrap"><section class="card calmain"><div class="calnav"><button type="button" class="ghost sm" data-calm="-1" aria-label="${esc(t("cal.prev"))}">‹</button><h2>${esc(monthName)}</h2><button type="button" class="ghost sm" data-calm="1" aria-label="${esc(t("cal.next"))}">›</button>${isNow ? "" : `<button type="button" class="sm" data-calm="0">${esc(t("cal.today"))}</button>`}</div>
      <div class="calgrid">${wds.map(w => `<div class="wd">${esc(w)}</div>`).join("")}${cells}</div>
      <div class="callegend"><span><i class="hol"></i>${esc(t("cal.state"))}</span><span><i class="chol"></i>${esc(t("cal.church"))}</span><span><i class="dl"></i>${esc(t("cal.deadlines"))}</span><span><i class="past"></i>${esc(t("cal.events"))}</span>${S.site && S.site.emergency && S.site.emergency.from ? `<span><i class="em"></i>${esc(t("em.bar"))}</span>` : ""}</div></section>
    <aside class="card calside"><h2>🎉 ${esc(t("cal.hols"))}</h2>${up.length ? `<ul class="hols">${up.map(({ h, d }) => { const n = Math.round((d - new Date(new Date().toDateString())) / 864e5);
      return `<li class="${n === 0 ? "now" : ""}"><div class="hd"><b>${d.getDate()}</b><span>${esc(d.toLocaleDateString(lng(), { month: "short" }))}</span></div><div><div>${h.kind === "church" ? "✝ " : ""}${esc(h.name)}</div><small class="hint">${n === 0 ? "🎉 " + esc(t("chu.today")) : esc(t("chu.inDays", { n }))}</small></div></li>`; }).join("")}</ul>` : `<p class="empty">${esc(t("chu.noHolidays"))}</p>`}
      <p class="hint">${esc(t("cal.holHint"))}</p></aside></div>
    <section class="card callist"><div class="row between"><h2>${CAL.d && CAL.d <= dim ? esc(new Date(y, m, CAL.d).toLocaleDateString(lng(), { day: "numeric", month: "long" })) : esc(t("cal.monthEvents"))}</h2>${CAL.d ? `<button type="button" class="ghost sm" data-cald="0">${esc(t("cal.allMonth"))}</button>` : ""}</div>${list}</section>`;
}
export function mount(root) {
  root.querySelectorAll("[data-calm]").forEach(b => b.onclick = () => {
    const k = +b.dataset.calm;
    if (!k) { const n = new Date(); CAL.y = n.getFullYear(); CAL.m = n.getMonth(); }
    else { const d = new Date(CAL.y, CAL.m + k, 1); CAL.y = d.getFullYear(); CAL.m = d.getMonth(); }
    CAL.d = 0; changed();
  });
  root.querySelectorAll("[data-cald]").forEach(b => b.onclick = () => { const d = +b.dataset.cald; CAL.d = CAL.d === d ? 0 : d; changed(); });
}
