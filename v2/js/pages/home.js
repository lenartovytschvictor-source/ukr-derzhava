// 🏠 Головна: (для нового відвідувача — привітання) · Влада зараз · Новини · Що зараз відбувається · План розвитку · Найближчі свята.
import { S, B, pos, player, me, isAdmin, isHetman, holds, cases, ms, log } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, fmtDate } from "../ui.js";
import { txt, empty } from "./common.js";
import { canNews, newsSorted, newsCard, newsForm } from "./news.js";
import { upcoming } from "./church.js";

const POWER = ["hetman", "chair", "patriarch", "defense"];
const canPlan = () => isAdmin() || isHetman() || holds("pysar");
// «лишилось …» — оновлюється щохвилини без перемальовування сторінки
export function left(until) {
  const d = ms(until) - Date.now(); if (d <= 0) return t("ch.ended");
  const days = Math.floor(d / 864e5), h = Math.floor(d % 864e5 / 36e5), m = Math.floor(d % 36e5 / 6e4);
  return days ? t("hm.leftD", { d: days, h }) : t("ch.left", { h, m });
}
const timer = until => `<span class="timer" data-until="${ms(until)}">⏳ ${esc(left(until))}</span>`;

function events() {
  const ev = [];
  for (const b of S.bills) {
    if (b.status === "voting") ev.push({ at: ms(b.voteEnd), html: `<a class="ev" href="#/derzhava/palata/${esc(b.id)}"><span class="evi">🗳</span><span class="grow"><b>${esc(b.title)}</b><small class="hint">${esc(t("hm.evBill"))}</small></span>${timer(b.voteEnd)}</a>` });
    else if (b.status === "passed") ev.push({ at: Infinity, html: `<a class="ev" href="#/derzhava/palata/${esc(b.id)}"><span class="evi">✍️</span><span class="grow"><b>${esc(b.title)}</b><small class="hint">${esc(t("hm.evSign"))}</small></span></a>` });
  }
  for (const e of S.elections) {
    if (e.stage === "nomination") ev.push({ at: ms(e.nomEnd), html: `<a class="ev" href="#/derzhava/vybory/${esc(e.id)}"><span class="evi">🙋</span><span class="grow"><b>${esc(e.title)}</b><small class="hint">${esc(t("hm.evNom"))}</small></span>${timer(e.nomEnd)}</a>` });
    if (e.stage === "voting") ev.push({ at: ms(e.voteEnd), html: `<a class="ev" href="#/derzhava/vybory/${esc(e.id)}"><span class="evi">🗳</span><span class="grow"><b>${esc(e.title)}</b><small class="hint">${esc(t("hm.evVote"))}</small></span>${timer(e.voteEnd)}</a>` });
  }
  for (const c of cases()) if (!c.closed && c.status === "hearing") ev.push({ at: Infinity - 1, html: `<a class="ev" href="#/zakon/sud/${esc(c.id)}"><span class="evi">⚖️</span><span class="grow"><b>${esc(t("lw.caseNo", { n: c.no }))}: ${esc(c.title)}</b><small class="hint">${esc(t("hm.evCourt"))}</small></span></a>` });
  return ev.sort((a, b) => a.at - b.at).map(x => x.html);
}

function planBlock() {
  const pl = S.plan || {}, goals = pl.goals || [], ed = EDIT && canPlan();
  if (!goals.length && !ed) return "";
  let h = `<section class="card"><h2>🎯 ${esc(pl.title || t("hm.plan"))}</h2>`;
  h += goals.length ? `<div class="goals">${goals.map(g => `<div class="goal"><div class="row between"><b>${esc(g.t)}</b><span class="hint">${g.p || 0}%</span></div><div class="meter"><span style="width:${Math.max(0, Math.min(100, g.p || 0))}%"></span></div>${g.note ? `<small class="hint">${esc(g.note)}</small>` : ""}</div>`).join("")}</div>` : empty(t("hm.noPlan"));
  if (ed) h += `<details class="planed"><summary>✏️ ${esc(t("hm.planEdit"))}</summary><form class="form" data-plan>
    <label>${esc(t("hm.planTitle"))}<input name="title" maxlength="80" value="${esc(pl.title || "")}" placeholder="${esc(t("hm.plan"))}"></label>
    <div data-goals>${[...goals, { t: "", p: 0, note: "" }].map((g, i) => goalRow(g, i)).join("")}</div>
    <div class="row"><button type="button" class="ghost sm" data-gadd>+ ${esc(t("hm.goalAdd"))}</button><span class="grow"></span><button class="primary sm">${esc(t("save"))}</button></div>
    <p class="hint">${esc(t("hm.planHint"))}</p></form></details>`;
  return h + `</section>`;
}
const goalRow = (g, i) => `<div class="grow-row goalrow"><input name="gt${i}" maxlength="120" value="${esc(g.t)}" placeholder="${esc(t("hm.goal"))}" aria-label="${esc(t("hm.goal"))}"><input type="number" name="gp${i}" min="0" max="100" value="${g.p || 0}" aria-label="%"><input name="gn${i}" maxlength="160" value="${esc(g.note || "")}" placeholder="${esc(t("hm.goalNote"))}" aria-label="${esc(t("hm.goalNote"))}"></div>`;

export function render() {
  const u = S.user, m = me();
  let h = "";
  if (!u || !m) {
    h += `<section class="hero card">
      <img src="img/gerb-192.png" alt="" width="88" height="88">
      <div><h1>${esc(t("home.title"))}</h1>${txt("home", "intro", t("home.intro"))}
      <div class="row">${!u ? `<button type="button" class="primary" data-act="login">${esc(t("login"))}</button>` : `<a class="btn primary" href="#/profil">${esc(t("home.join"))}</a>`}
      <a class="btn ghost" href="#/narod/istoriya">${esc(t("home.history"))}</a></div></div></section>`;
  }
  const people = POWER.map(pos).filter(Boolean);
  h += `<section class="card"><h2>${esc(t("home.power"))}</h2>${people.length ? `<div class="power">${people.map(p => {
      const pl = player(p.holder);
      return `<a class="pw" href="${pl ? "#/narod/gravets/" + esc(pl.id) : "#/derzhava/vlada"}">${avatar(pl || { name: "?" }, "av md")}<span><small>${esc(p.title)}</small><b>${pl ? esc(pl.name) : `<i class="vac">${esc(t("vacant"))}</i>`}</b></span></a>`;
    }).join("")}</div>` : `<p class="empty">${esc(t("home.nopower"))}</p>`}</section>`;
  // новини
  const news = newsSorted().slice(0, 4);
  h += `<section class="card"><div class="row between"><h2>📰 ${esc(t("nw.title"))}</h2><span class="row">${canNews() ? `<button type="button" class="sm" data-hnews>+ ${esc(t("nw.new"))}</button>` : ""}<a class="btn ghost sm" href="#/novyny">${esc(t("nw.all"))} →</a></span></div>
    ${news.length ? `<div class="nlist home">${news.map((n, i) => newsCard(n, i === 0)).join("")}</div>` : empty(t("nw.none"))}</section>`;
  // що зараз відбувається + свята — поруч
  const ev = events(), hol = upcoming(2);
  h += `<div class="twocol"><section class="card"><h2>⚡ ${esc(t("hm.now"))}</h2>${ev.length ? `<div class="evs">${ev.join("")}</div>` : empty(t("hm.quiet"))}</section>
    <section class="card"><h2>📅 ${esc(t("hm.holidays"))}</h2>${hol.length ? `<div class="hlist">${hol.map(({ h: x, d }) => { const n = Math.round((d - new Date(new Date().toDateString())) / 864e5);
      return `<div class="hday k-${esc(x.kind)}"><div class="hdate"><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString(document.documentElement.lang || "uk", { month: "short" }))}</small></div><div class="grow"><b>${x.kind === "church" ? "⛪" : "🏛"} ${esc(x.name)}</b></div><span class="tag">${n === 0 ? esc(t("chu.today")) : esc(t("chu.inDays", { n }))}</span></div>`; }).join("")}</div>` : empty(t("chu.noHolidays"))}
      <p><a class="hint" href="#/narod/tserkva">${esc(t("hm.calendar"))} →</a></p></section></div>`;
  h += planBlock();
  return h;
}

let tick = 0;
export function mount(root) {
  const hn = root.querySelector("[data-hnews]"); if (hn) hn.onclick = () => newsForm(null);
  clearInterval(tick);
  tick = setInterval(() => { document.querySelectorAll("[data-until]").forEach(el => { el.textContent = "⏳ " + left(Number(el.dataset.until)); }); }, 30000);
  const pf = root.querySelector("[data-plan]");
  if (pf) {
    pf.querySelector("[data-gadd]").onclick = () => { const box = pf.querySelector("[data-goals]"); box.insertAdjacentHTML("beforeend", goalRow({ t: "", p: 0 }, box.children.length)); };
    pf.onsubmit = async e => {
      e.preventDefault();
      const n = pf.querySelector("[data-goals]").children.length, goals = [];
      for (let i = 0; i < n; i++) { const tt = (pf["gt" + i].value || "").trim(); if (tt) goals.push({ t: tt.slice(0, 120), p: Math.max(0, Math.min(100, parseInt(pf["gp" + i].value, 10) || 0)), note: (pf["gn" + i].value || "").trim().slice(0, 160) }); }
      if (await run(() => B.set("ud_plan", "main", { title: pf.title.value.trim().slice(0, 80), goals }), t("saved"))) log("plan", t("hm.planEdit"));
    };
  }
}
