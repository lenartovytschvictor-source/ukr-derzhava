// 📰 Новини: пишуть Гетьман, Генеральний писар, Прес-секретар і адміни. Бот передає їх у Telegram.
import { S, B, me, player, pos, isAdmin, isHetman, holds, ms, log } from "../store.js";
import { EDIT, go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, pickImage, fmtDate } from "../ui.js";
import { empty, paras } from "./common.js";

export const canNews = () => isAdmin() || isHetman() || holds("pysar") || holds("press");
export const newsSorted = () => S.news.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || ms(b.at) - ms(a.at));
const short = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

export function newsCard(n, big) {
  const a = player(n.by);
  return `<a class="ncard${big ? " big" : ""}${n.pinned ? " pinned" : ""}" href="#/novyny/${esc(n.id)}">${n.img ? `<img src="${esc(n.img)}" alt="" loading="lazy">` : ""}
    <span class="nb"><b>${n.pinned ? "📌 " : ""}${esc(n.title)}</b><span class="hint">${esc(short(n.text, big ? 220 : 120))}</span>
    <small class="hint">${esc(fmtDate(n.at))}${a ? " · " + esc(a.name) : ""}</small></span></a>`;
}

export function render(parts) {
  if (parts[0]) return article(parts[0]);
  const list = newsSorted();
  let h = `<h1 class="ptitle">📰 ${esc(t("nw.title"))}</h1>`;
  if (canNews()) h += `<div class="row"><button type="button" class="primary sm" data-nnew>+ ${esc(t("nw.new"))}</button></div>`;
  h += list.length ? `<div class="nlist">${list.map(n => newsCard(n, true)).join("")}</div>` : `<div class="card">${empty(t("nw.none"))}</div>`;
  return h;
}
function article(id) {
  const n = S.news.find(x => x.id === id);
  if (!n) return `<p><a href="#/novyny">← ${esc(t("nw.all"))}</a></p><div class="card">${empty(t("nw.notFound"))}</div>`;
  const a = player(n.by), ap = a && S.positions.find(p => p.holder === a.id && ["hetman", "pysar", "press"].includes(p.id));
  return `<p><a href="#/novyny">← ${esc(t("nw.all"))}</a></p><article class="card narticle">
    ${n.img ? `<img class="nimg" src="${esc(n.img)}" alt="">` : ""}
    <h1>${n.pinned ? "📌 " : ""}${esc(n.title)}</h1>
    <p class="nmeta">${a ? avatar(a, "av sm") : ""}<span>${a ? `<a href="#/narod/gravets/${esc(a.id)}">${esc(a.name)}</a>${ap ? ` · ${esc(ap.title)}` : ""} · ` : ""}${esc(fmtDate(n.at))}</span></p>
    <div class="billtext">${paras(n.text)}</div>
    ${canNews() ? `<div class="row end"><button type="button" class="ghost sm" data-nedit="${esc(n.id)}">✏️ ${esc(t("edit"))}</button></div>` : ""}</article>`;
}

export function newsForm(n) {
  const isNew = !n; n = n || { title: "", text: "", img: "", pinned: false };
  let img = n.img || "";
  const w = modal(isNew ? t("nw.new") : n.title, `<form class="form" data-nf>
    <label>${esc(t("nw.head"))}<input name="title" required maxlength="140" value="${esc(n.title)}"></label>
    <label>${esc(t("nw.text"))}<textarea name="text" rows="10" maxlength="10000" required>${esc(n.text)}</textarea></label>
    <div class="row"><span class="nprev">${img ? `<img src="${esc(img)}" alt="">` : ""}</span><button type="button" class="ghost sm" data-nimg>🖼 ${esc(t("nw.img"))}</button>${img ? `<button type="button" class="ghost sm" data-nimgx>${esc(t("nw.imgRemove"))}</button>` : ""}
      <label class="chk"><input type="checkbox" name="pinned"${n.pinned ? " checked" : ""}> 📌 ${esc(t("nw.pin"))}</label></div>
    <p class="hint">${esc(t("nw.tgHint"))}</p>
    <div class="row end">${isNew ? "" : `<button type="button" class="ghost danger" data-ndel>${esc(t("delete"))}</button>`}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t(isNew ? "nw.publish" : "save"))}</button></div></form>`, { wide: true });
  w.querySelector("[data-nimg]").onclick = async () => { const v = await pickImage(900); if (v) { img = v; w.querySelector(".nprev").innerHTML = `<img src="${v}" alt="">`; } };
  const nx = w.querySelector("[data-nimgx]"); if (nx) nx.onclick = () => { img = ""; w.querySelector(".nprev").innerHTML = ""; nx.remove(); };
  const d = w.querySelector("[data-ndel]");
  if (d) d.onclick = async () => { if (await confirmBox(t("nw.delQ"), t("delete")) && await run(() => B.del("ud_news", n.id), t("deleted"))) { log("news", `− ${n.title}`); closeModal(); go("novyny"); } };
  w.querySelector("[data-nf]").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const v = { title: f.title.value.trim().slice(0, 140), text: f.text.value.slice(0, 10000), img, pinned: f.pinned.checked };
    const id = isNew ? B.newId("ud_news") : n.id;
    const ok = await run(() => isNew ? B.set("ud_news", id, { ...v, by: me().id, at: B.now() }) : B.update("ud_news", id, v), t("saved"));
    if (ok) { log("news", `${isNew ? "+" : "✏️"} ${v.title}`); closeModal(); if (isNew) go("novyny/" + id); }
  };
}

export function mount(root) {
  const nn = root.querySelector("[data-nnew]"); if (nn) nn.onclick = () => newsForm(null);
  root.querySelectorAll("[data-nedit]").forEach(b => b.onclick = () => newsForm(S.news.find(x => x.id === b.dataset.nedit)));
}
