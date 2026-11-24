// 🗳 Голосування Уряду («Круглий стіл»): Гетьман і секретарі голосують за внутрішні рішення.
// Бачать і голосують лише члени Уряду (та адміни). Рішення ухвалено, якщо «За» більше, ніж «Проти»;
// за рівності вирішує голос Гетьмана.
import { S, B, me, player, pos, isAdmin, isHetman, holds, GOV, ms, log, changed } from "../store.js";
import { t } from "../i18n.js";
import { esc, avatar, run, confirmBox, fmtDate } from "../ui.js";
import { empty, paras } from "./common.js";

const VOTES = {};          // id голосування → [{id, v}]
const UN = {};
// члени Уряду: люди, що обіймають урядові посади (одна людина — один голос)
export const govMembers = () => [...new Set(GOV.map(pos).filter(p => p && p.holder && player(p.holder)).map(p => p.holder))];
export const inGov = () => { const m = me(); return !!m && govMembers().includes(m.id); };
export const canGovVotes = () => isAdmin() || inGov();
const isOpen = v => ms(v.end) > Date.now() && !v.closed;
function follow() {
  for (const v of S.govvotes) if (!UN[v.id]) UN[v.id] = B.watch(`ud_govvotes/${v.id}/votes`, r => { VOTES[v.id] = r; changed(); }, () => {});
}
export function tallyGov(v) {
  const mem = govMembers(), vs = (VOTES[v.id] || []).filter(x => mem.includes(x.id));
  const c = { for: 0, against: 0, abstain: 0 }; vs.forEach(x => { if (c[x.v] != null) c[x.v]++; });
  const het = pos("hetman"), hv = het && vs.find(x => x.id === het.holder);
  const pass = c.for > c.against || (c.for === c.against && c.for > 0 && hv && hv.v === "for");
  return { ...c, cast: vs.length, of: mem.length, pass, tie: c.for === c.against && c.for > 0, list: vs };
}

export function govBlock() {
  if (!S.user || !canGovVotes()) return "";
  follow();
  const m = me(), open = S.govvotes.filter(isOpen).sort((a, b) => ms(a.end) - ms(b.end)), done = S.govvotes.filter(v => !isOpen(v)).sort((a, b) => ms(b.end) - ms(a.end));
  const card = v => {
    const T = tallyGov(v), mine = m && T.list.find(x => x.id === m.id), live = isOpen(v), by = player(v.by);
    const bar = (k, cls) => `<div class="vbar ${cls}"><span>${esc(t("ch.v." + k))}</span><b>${T[k]}</b><i style="width:${T.cast ? T[k] / T.cast * 100 : 0}%"></i></div>`;
    const left = ms(v.end) - Date.now(), lh = Math.floor(left / 3600e3), lm = Math.floor(left % 3600e3 / 60e3);
    return `<article class="gvcard${live ? "" : " done"}"><div class="row between"><b>${esc(v.title)}</b>${live ? `<span class="tag warn">⏳ ${esc(t("ch.left", { h: lh, m: lm }))}</span>` : `<span class="tag ${T.pass ? "ok" : "bad"}">${T.pass ? "✅ " + esc(t("gv.passed")) : "❌ " + esc(t("gv.failed"))}</span>`}</div>
      ${v.text ? `<div class="billtext">${paras(v.text)}</div>` : ""}<p class="hint">${by ? esc(by.name) + " · " : ""}${esc(fmtDate(v.at))}</p>
      ${bar("for", "yes")}${bar("against", "no")}${bar("abstain", "abs")}
      <p class="hint">${esc(t("gv.cast", { n: T.cast, of: T.of }))}${T.tie ? " · " + esc(t("gv.tie")) : ""}</p>
      ${live && inGov() ? `<div class="row vbtns">${["for", "against", "abstain"].map(k => `<button type="button" class="${mine && mine.v === k ? "primary" : ""}" data-gvote="${esc(v.id)}|${k}">${esc(t("ch.v." + k))}</button>`).join("")}</div>` : ""}
      ${T.list.length ? `<details><summary class="hint">${esc(t("ch.whoVoted"))}</summary><ul class="vlist">${T.list.map(x => `<li>${esc((player(x.id) || {}).name || "?")} — ${esc(t("ch.v." + x.v))}</li>`).join("")}</ul></details>` : ""}
      ${live && (isHetman() || isAdmin() || (m && v.by === m.id)) ? `<div class="row end"><button type="button" class="ghost sm" data-gclose="${esc(v.id)}">${esc(t("gv.closeNow"))}</button></div>` : ""}
      ${isAdmin() ? `<div class="row end"><button type="button" class="ghost sm danger" data-gdel="${esc(v.id)}">${esc(t("delete"))}</button></div>` : ""}</article>`;
  };
  return `<section class="card govvotes"><h2>🗳 ${esc(t("gv.title"))} <span class="badge">${open.length}</span></h2><p class="hint">${esc(t("gv.hint"))}</p>
    ${inGov() ? `<details class="newbill"><summary><b>➕ ${esc(t("gv.new"))}</b></summary><form class="form" data-gnew>
      <label>${esc(t("gv.q"))}<input name="title" required maxlength="150" placeholder="${esc(t("gv.qPh"))}"></label>
      <label>${esc(t("gv.details"))}<textarea name="text" rows="3" maxlength="3000"></textarea></label>
      <label>${esc(t("gv.hours"))}<input type="number" name="hours" min="1" max="168" value="24"></label>
      <div class="row end"><button class="primary">${esc(t("gv.start"))}</button></div></form></details>` : ""}
    ${open.length ? open.map(card).join("") : empty(t("gv.none"))}
    ${done.length ? `<details><summary><b>${esc(t("gv.archive"))}</b> <span class="badge">${done.length}</span></summary>${done.slice(0, 30).map(card).join("")}</details>` : ""}</section>`;
}
export function mountGov(root) {
  const f = root.querySelector("[data-gnew]");
  if (f) f.onsubmit = async e => {
    e.preventDefault(); const h = Math.max(1, Math.min(168, parseInt(f.hours.value, 10) || 24));
    const v = { title: f.title.value.trim().slice(0, 150), text: f.text.value.trim().slice(0, 3000), by: me().id, at: B.now(), end: new Date(Date.now() + h * 3600e3), closed: false };
    if (await run(() => B.set("ud_govvotes", B.newId("ud_govvotes"), v), t("gv.started"))) { log("gov", "🗳 " + v.title); f.reset(); }
  };
  root.querySelectorAll("[data-gvote]").forEach(b => b.onclick = () => { const [id, v] = b.dataset.gvote.split("|"); run(() => B.set(`ud_govvotes/${id}/votes`, me().id, { v, at: B.now() }), t("ch.voted")); });
  root.querySelectorAll("[data-gclose]").forEach(b => b.onclick = async () => { if (await confirmBox(t("gv.closeQ"), t("gv.closeNow"))) run(() => B.update("ud_govvotes", b.dataset.gclose, { closed: true, end: B.now() }), t("saved")); });
  root.querySelectorAll("[data-gdel]").forEach(b => b.onclick = async () => { if (await confirmBox(t("gv.delQ"), t("delete"))) run(() => B.del("ud_govvotes", b.dataset.gdel), t("deleted")); });
}
