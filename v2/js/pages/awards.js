// 🏅 Нагороди: створення в кілька кліків, видача з причиною, відкликання з причиною.
import { S, B, me, player, pos, canAwards, canIssue, ms, log } from "../store.js";
import { EDIT, go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, pickImage, toast, fmtDate } from "../ui.js";
import { txt, empty } from "./common.js";

const award = id => S.awards.find(a => a.id === id) || null;
const active = id => S.grants.filter(g => g.award === id && !g.revoked);
export const icon = a => a && a.img ? `<img class="awi" src="${esc(a.img)}" alt="">` : `<span class="awi" aria-hidden="true">${esc((a && a.emoji) || "🏅")}</span>`;
export function grantsOf(pid) { return S.grants.filter(g => g.pid === pid && !g.revoked && award(g.award)); }
export function awardChips(pid) {
  const g = grantsOf(pid);
  return g.length ? `<div class="awchips">${g.map(x => { const a = award(x.award); return `<a class="awchip" href="#/narod/nagorody/${esc(a.id)}" title="${esc(x.reason || "")}">${icon(a)}<span>${esc(a.name)}</span></a>`; }).join("")}</div>` : "";
}

export function render(parts) {
  return parts[1] ? awardPage(parts[1]) : overview();
}
function overview() {
  let h = txt("nagorody", "intro", t("aw.intro"), { cls: "lead" });
  if (canAwards()) h += `<div class="row"><button type="button" class="primary sm" data-awnew>+ ${esc(t("aw.new"))}</button></div>`;
  h += S.awards.length ? `<div class="awgrid">${S.awards.map(a => `<a class="awcard" href="#/narod/nagorody/${esc(a.id)}">${icon(a)}<b>${esc(a.name)}</b>${a.desc ? `<small class="hint">${esc(a.desc)}</small>` : ""}<small class="hint">${esc(t("aw.holdersN", { n: active(a.id).length }))}</small></a>`).join("")}</div>`
    : `<div class="card">${empty(t("aw.none"))}</div>`;
  const feed = S.grants.filter(g => !g.revoked && award(g.award)).slice(0, 12);
  if (feed.length) h += `<section class="card"><h2>${esc(t("aw.recent"))}</h2><ul class="slog">${feed.map(g => { const a = award(g.award), p = player(g.pid);
    return `<li>${icon(a)} <a href="#/narod/gravets/${esc(g.pid)}">${esc(p ? p.name : "?")}</a> — <a href="#/narod/nagorody/${esc(a.id)}">${esc(a.name)}</a>${g.reason ? `: ${esc(g.reason)}` : ""} <small class="hint">${esc(fmtDate(g.at))}</small></li>`; }).join("")}</ul></section>`;
  return h;
}
function awardPage(id) {
  const a = award(id);
  if (!a) return `<p><a href="#/narod/nagorody">← ${esc(t("aw.back"))}</a></p><div class="card">${empty(S.awards.length ? t("aw.notFound") : t("loading"))}</div>`;
  const act = active(a.id), rev = S.grants.filter(g => g.award === a.id && g.revoked);
  const can = canIssue(a);
  const issuers = (a.issuers || []).map(pos).filter(Boolean).map(p => p.title);
  let h = `<p><a href="#/narod/nagorody">← ${esc(t("aw.back"))}</a></p><section class="card awhead">${icon(a)}<div class="grow"><h1>${esc(a.name)}</h1>${a.desc ? `<p>${esc(a.desc)}</p>` : ""}
    <p class="hint">${esc(t("aw.issuedBy"))}: ${esc([t("aw.hetmanAdmins"), ...issuers].join(", "))}</p></div>${EDIT && canAwards() ? `<button type="button" class="sm" data-awedit>✏️ ${esc(t("edit"))}</button>` : ""}</section>`;
  if (can) {
    const has = new Set(act.map(g => g.pid));
    h += `<details class="card newbill"><summary><b>🎖 ${esc(t("aw.give"))}</b></summary><form class="form" data-give>
      <label>${esc(t("aw.whom"))}<select name="pid" required><option value="">—</option>${S.players.filter(p => p.status !== "ex").sort((x, y) => x.name.localeCompare(y.name, "uk")).map(p => `<option value="${esc(p.id)}">${esc(p.name)}${has.has(p.id) ? " ✓" : ""}</option>`).join("")}</select></label>
      <label>${esc(t("aw.reason"))}<input name="reason" required maxlength="300" placeholder="${esc(t("aw.reasonPh"))}"></label>
      <div class="row end"><button class="primary">${esc(t("aw.giveBtn"))}</button></div></form></details>`;
  }
  h += `<section class="card"><h2>${esc(t("aw.holders"))} <span class="badge">${act.length}</span></h2>${act.length ? `<div class="glist">${act.map(g => { const p = player(g.pid), by = player(g.by);
    return `<div class="grow-row">${avatar(p || { name: "?" }, "av md")}<div class="grow"><a href="#/narod/gravets/${esc(g.pid)}"><b>${esc(p ? p.name : "?")}</b></a><small class="hint"> · ${esc(fmtDate(g.at))}${by ? " · " + esc(t("aw.by", { x: by.name })) : ""}</small>${g.reason ? `<p>${esc(g.reason)}</p>` : ""}</div>
      ${can ? `<button type="button" class="ghost sm danger" data-revoke="${esc(g.id)}">${esc(t("aw.revoke"))}</button>` : ""}</div>`; }).join("")}</div>` : empty(t("aw.noHolders"))}</section>`;
  if (rev.length) h += `<details class="card"><summary><b>${esc(t("aw.revoked"))}</b> <span class="badge">${rev.length}</span></summary><ul class="slog">${rev.map(g => { const p = player(g.pid);
    return `<li><s>${esc(p ? p.name : "?")}</s> — ${esc(g.revoked.reason || "")} <small class="hint">${esc(fmtDate(g.revoked.at))}</small></li>`; }).join("")}</ul></details>`;
  return h;
}
function awardForm(a) {
  const isNew = !a; a = a || { name: "", emoji: "🏅", img: "", desc: "", issuers: [], order: S.awards.length };
  let img = a.img || "";
  const P = S.positions.filter(p => p.id !== "hetman");
  const w = modal(isNew ? t("aw.new") : a.name, `<form class="form" data-af>
    <div class="avedit"><span class="flagprev">${img ? `<img src="${esc(img)}" alt="">` : esc(a.emoji || "🏅")}</span><label class="fl">${esc(t("aw.emoji"))} <input name="emoji" maxlength="4" value="${esc(a.emoji || "🏅")}" style="width:4em"></label><button type="button" class="ghost sm" data-img>${esc(t("aw.image"))}</button></div>
    <label>${esc(t("aw.name"))}<input name="name" required maxlength="80" value="${esc(a.name)}"></label>
    <label>${esc(t("aw.desc"))}<textarea name="desc" rows="2" maxlength="500">${esc(a.desc || "")}</textarea></label>
    <fieldset class="lawpick"><legend>${esc(t("aw.whoIssues"))}</legend><p class="hint">${esc(t("aw.whoHint"))}</p>${P.map(p => `<label class="chk"><input type="checkbox" name="iss" value="${esc(p.id)}"${(a.issuers || []).includes(p.id) ? " checked" : ""}> ${esc(p.title)}</label>`).join("")}</fieldset>
    <div class="row end">${isNew ? "" : `<button type="button" class="ghost danger" data-adel>${esc(t("delete"))}</button>`}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div></form>`);
  w.querySelector("[data-img]").onclick = async () => { const v = await pickImage(128); if (v) { img = v; w.querySelector(".flagprev").innerHTML = `<img src="${v}" alt="">`; } };
  const d = w.querySelector("[data-adel]");
  if (d) d.onclick = async () => {
    if (S.grants.some(g => g.award === a.id)) return toast(t("aw.hasGrants"), "err");
    if (await confirmBox(t("aw.delQ", { x: a.name }), t("delete")) && await run(() => B.del("ud_awards", a.id), t("deleted"))) { log("award", `− ${a.name}`); closeModal(); go("narod/nagorody"); }
  };
  w.querySelector("[data-af]").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const iss = [...f.querySelectorAll("[name=iss]:checked")].map(x => x.value);
    if (iss.length > 3) return toast(t("aw.max3"), "err");
    const v = { name: f.name.value.trim().slice(0, 80), emoji: f.emoji.value.trim().slice(0, 4) || "🏅", img, desc: f.desc.value.trim().slice(0, 500), issuers: iss, order: a.order ?? 0 };
    const id = isNew ? B.newId("ud_awards") : a.id;
    if (await run(() => B.set("ud_awards", id, v), t("saved"))) { log("award", `${isNew ? "+" : "✏️"} ${v.name}`); closeModal(); if (isNew) go("narod/nagorody/" + id); }
  };
}

export function mount(root, parts) {
  const n = root.querySelector("[data-awnew]"); if (n) n.onclick = () => awardForm(null);
  const a = parts[1] && award(parts[1]); if (!a) return;
  const e = root.querySelector("[data-awedit]"); if (e) e.onclick = () => awardForm(a);
  const g = root.querySelector("[data-give]");
  if (g) g.onsubmit = async ev => {
    ev.preventDefault(); const pid = g.pid.value; if (!pid) return;
    const v = { award: a.id, pid, reason: g.reason.value.trim().slice(0, 300), by: me().id, at: B.now() };
    if (await run(() => B.set("ud_grants", B.newId("ud_grants"), v), t("aw.given"))) { log("award", `🏅 ${a.name} → ${player(pid).name}`); g.reset(); }
  };
  root.querySelectorAll("[data-revoke]").forEach(b => b.onclick = () => {
    const gr = S.grants.find(x => x.id === b.dataset.revoke); if (!gr) return;
    const w = modal(t("aw.revoke"), `<form class="form" data-rv><label>${esc(t("aw.revokeWhy"))}<input name="why" required maxlength="300"></label><div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="danger">${esc(t("aw.revoke"))}</button></div></form>`);
    w.querySelector("[data-rv]").onsubmit = async ev => {
      ev.preventDefault();
      if (await run(() => B.update("ud_grants", gr.id, { revoked: { by: me().id, reason: ev.target.why.value.trim().slice(0, 300), at: B.now() } }), t("saved"))) { log("award", `✕ ${a.name} — ${(player(gr.pid) || {}).name}`); closeModal(); }
    };
  });
}
