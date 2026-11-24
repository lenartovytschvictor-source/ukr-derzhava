// 💬 Чат: Загальний · Чат землі · Чат уряду · Особисті.
// Особисті повідомлення бачать лише двоє учасників — модератори й адміни їх не читають (так само в правилах бази)
// і вони ніколи не перекладаються автоматично.
import { S, B, me, player, land, lands, isGov, isMod, muteOf, unread, chatHooks, ms, log, changed } from "../store.js";
import { go } from "../app.js";
import { t, lang } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, toast } from "../ui.js";
import { empty } from "./common.js";
import { translate, trOn, setTrOn } from "../tr.js";

const TABS = [["zagalnyi", "💬", "cht.general"], ["zemlia", "🗺", "cht.land"], ["uriad", "🏛", "cht.gov"], ["osobysti", "✉️", "cht.dm"]];
const MAX = 1000;
const V = { key: "", path: "", dm: false, modLand: "", drafts: {}, atBottom: true, scroll: 0, showOrig: new Set() };
const dmId = (a, b) => [a, b].sort().join("__");
const other = c => { const m = me(); return (c.members || []).find(x => x !== (m && m.id)) || ""; };
const timeOf = x => { const d = new Date(ms(x.at) || Date.now()); const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString(document.documentElement.lang || "uk", today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };

// текст: екранування → посилання → згадки @Ім'я
function fmt(text) {
  const m = me(), names = S.players.map(p => p.name).filter(Boolean).sort((a, b) => b.length - a.length);
  let h = esc(text).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, u => `<a href="${u}" target="_blank" rel="noopener nofollow">${u}</a>`);
  if (names.length) {
    const re = new RegExp("@(" + names.map(n => esc(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");
    h = h.replace(re, (all, n) => `<span class="ment${m && esc(m.name) === n ? " me" : ""}">@${n}</span>`);
  }
  return h.replace(/\n/g, "<br>");
}
const mentionsMe = text => { const m = me(); return !!(m && String(text || "").includes("@" + m.name)); };

function msgsHtml(list) {
  const m = me(), mod = isMod() && !V.dm;
  if (!list) return `<p class="empty">${esc(t("loading"))}</p>`;
  if (!list.length) return empty(t("cht.empty"));
  let h = "", prev = null;
  for (const x of list) {
    const p = player(x.by), mine = m && x.by === m.id;
    const cont = prev && prev.by === x.by && ms(x.at) - ms(prev.at) < 5 * 60e3;
    const tr = !V.dm && trOn() && !V.showOrig.has(x.id);
    h += `<div class="msg${cont ? " cont" : ""}${mine ? " mine" : ""}${mentionsMe(x.text) && !mine ? " hit" : ""}" data-mid="${esc(x.id)}">
      ${cont ? `<span class="avsp"></span>` : avatar(p || { name: "?" }, "av sm")}
      <div class="mb">${cont ? "" : `<div class="mh"><button type="button" class="mname" data-at="${esc(p ? p.name : "")}" title="${esc(t("cht.mention"))}">${esc(p ? p.name : "?")}</button><small class="hint">${esc(timeOf(x))}</small></div>`}
        <div class="mt"${tr ? ` data-tr="${esc(x.id)}"` : ""}>${fmt(x.text)}</div>${!V.dm && V.showOrig.has(x.id) ? `<button type="button" class="linkbtn" data-retr="${esc(x.id)}">🌐 ${esc(t("cht.showTr"))}</button>` : ""}</div>
      <div class="macts">${mine || mod ? `<button type="button" class="ghost sm" data-mdel="${esc(x.id)}" aria-label="${esc(t("delete"))}">🗑</button>` : ""}${mod && !mine && p ? `<button type="button" class="ghost sm" data-mute="${esc(x.by)}" aria-label="${esc(t("cht.mute"))}">🔇</button>` : ""}</div></div>`;
    prev = x;
  }
  return h;
}

function tabRow(cur) {
  const m = me();
  const badge = n => n ? ` <span class="badge">${n > 99 ? "99+" : n}</span>` : "";
  const n = { zagalnyi: unread("general"), zemlia: m && m.land ? unread("land_" + m.land) : 0, uriad: isGov() ? unread("gov") : 0, osobysti: S.dms.reduce((a, c) => a + unread("dm_" + c.id), 0) };
  return `<div class="tabs" role="tablist">${TABS.filter(([k]) => k !== "uriad" || isGov()).map(([k, ic, l]) => `<a role="tab" href="#/chat/${k}" class="${k === cur ? "act" : ""}" aria-selected="${k === cur}"><span aria-hidden="true">${ic}</span> ${esc(t(l))}${badge(n[k])}</a>`).join("")}</div>`;
}

export function render(parts) {
  let h = `<h1 class="ptitle">💬 ${esc(t("nav.chat"))}</h1>`;
  if (!S.user) { V.key = ""; return h + `<div class="card">${empty(t("cht.login"))}<button type="button" class="primary" data-act="login">${esc(t("login"))}</button></div>`; }
  const cur = TABS.some(x => x[0] === parts[0]) && (parts[0] !== "uriad" || isGov()) ? parts[0] : "zagalnyi";
  h += tabRow(cur);
  const m = me();
  if (cur === "zagalnyi") return h + room("general", "ud_chat/general/msgs", t("cht.generalHint"));
  if (cur === "uriad") return h + room("gov", "ud_chat/gov/msgs", t("cht.govHint"));
  if (cur === "zemlia") {
    const mod = isMod();
    const lid = mod && V.modLand ? V.modLand : m && m.land;
    const pick = mod ? `<label class="fl">${esc(t("cht.modLand"))} <select data-modland><option value="">${esc(t("cht.myLand"))}</option>${lands().map(l => `<option value="${esc(l.id)}"${V.modLand === l.id ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>` : "";
    if (!lid) { V.key = ""; return h + `<div class="card">${pick}${empty(t("cht.noLand"))}<a class="btn sm" href="#/derzhava/karta">${esc(t("cht.chooseLand"))}</a></div>`; }
    const L = land(lid);
    return h + room("land_" + lid, `ud_chat/land_${lid}/msgs`, t("cht.landHint", { x: L ? L.name : lid }), pick);
  }
  // особисті
  if (parts[1]) {
    const c = S.dms.find(x => x.id === parts[1]);
    const oid = c ? other(c) : parts[1].split("__").find(x => x !== (m && m.id));
    if (!m || !oid || !parts[1].split("__").includes(m.id)) { V.key = ""; return h + `<div class="card">${empty(t("cht.dmNotFound"))}</div>`; }
    const op = player(oid);
    return h + `<p><a href="#/chat/osobysti">← ${esc(t("cht.allDms"))}</a></p>` + room("dm_" + parts[1], `ud_dms/${parts[1]}/msgs`, "", "", { dm: true, title: op ? op.name : "?", oid });
  }
  V.key = "";
  const list = S.dms;
  return h + `<section class="card"><div class="row between"><h2>✉️ ${esc(t("cht.dm"))}</h2>${m ? `<button type="button" class="primary sm" data-newdm>+ ${esc(t("cht.newDm"))}</button>` : ""}</div>
    <p class="hint">🔒 ${esc(t("cht.dmPrivate"))}</p>
    ${list.length ? `<div class="dmlist">${list.map(c => { const op = player(other(c)), n = unread("dm_" + c.id);
      return `<a class="dmrow${n ? " unread" : ""}" href="#/chat/osobysti/${esc(c.id)}">${avatar(op || { name: "?" }, "av md")}<span class="grow"><b>${esc(op ? op.name : "?")}</b><small class="hint">${c.last ? (c.last.by === (m && m.id) ? esc(t("cht.you")) + ": " : "") + esc(c.last.text) : ""}</small></span><small class="hint">${c.last ? esc(timeOf(c.last)) : ""}</small>${n ? `<span class="badge">●</span>` : ""}</a>`; }).join("")}</div>` : empty(t("cht.noDms"))}</section>`;
}

function room(key, path, hint, extra, o = {}) {
  const m = me();
  if (V.key !== key) {
    V.key = key; V.path = path; V.dm = !!o.dm; V.atBottom = true; V.scroll = 0; V.showOrig = new Set();
    if (o.dm) watchDm(key, path); else watchDm("", "");
  }
  const list = o.dm ? DM.list : S.chat[key];
  const mute = m && muteOf(m.id);
  const ro = !m ? t("cht.noPlayer") : m.status === "exiled" ? t("cht.exiled") : mute ? t("cht.muted", { x: new Date(ms(mute.until)).toLocaleString(document.documentElement.lang || "uk"), r: mute.reason || "—" }) : "";
  return `<section class="card chatbox">
    <div class="chead"><div class="grow">${o.dm ? `<b>✉️ ${esc(o.title)}</b> <small class="hint">🔒 ${esc(t("cht.dmPrivateShort"))}</small>` : `<small class="hint">${esc(hint)}</small>`}${extra ? " " + extra : ""}</div>
      ${o.dm ? "" : `<label class="fl trsw"><input type="checkbox" data-trsw${trOn() ? " checked" : ""}> 🌐 ${esc(t("cht.autoTr"))}</label>`}</div>
    <div class="msgs" id="msgs" aria-live="polite">${msgsHtml(list)}</div>
    ${ro ? `<p class="roinfo">${esc(ro)}</p>` : `<form class="chatform" data-send${o.oid ? ` data-oid="${esc(o.oid)}"` : ""}><textarea name="text" rows="1" maxlength="${MAX}" placeholder="${esc(t("cht.ph"))}" aria-label="${esc(t("cht.ph"))}">${esc(V.drafts[key] || "")}</textarea><button class="primary" aria-label="${esc(t("ch.send"))}">➤</button></form>`}
  </section>`;
}

// особисті: окрема підписка на відкриту розмову
const DM = { key: "", un: null, list: null };
function watchDm(key, path) {
  if (DM.key === key) return;
  if (DM.un) { try { DM.un(); } catch (_) {} }
  Object.assign(DM, { key, un: null, list: null });
  if (key) DM.un = B.watchLast(path, 200, r => { DM.list = r.reverse(); onUpdate(key); }, () => { DM.list = []; onUpdate(key); });
}

// ---------- живе оновлення стрічки ----------
function onUpdate(k) {
  if (k !== V.key) return;
  const box = document.getElementById("msgs"); if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = msgsHtml(V.dm ? DM.list : S.chat[k]);
  bindMsgs(box);
  if (near) box.scrollTop = box.scrollHeight;
  markRead();
  fillTranslations(box);
}
chatHooks.add(onUpdate);

let readT = 0;
function markRead() {
  clearTimeout(readT);
  readT = setTimeout(() => {
    const m = me(); if (!m || !V.key || document.hidden) return;
    const list = V.dm ? DM.list : S.chat[V.key]; if (!list || !list.length) return;
    const last = Math.max(...list.map(x => ms(x.at) || 0));
    if (last > (ms(S.reads[V.key]) || 0)) B.set("ud_reads", m.id, { [V.key]: B.now() }, true).catch(() => {});
  }, 600);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) markRead(); });

async function fillTranslations(root) {
  if (V.dm || !trOn()) return;
  const want = lang();
  for (const el of root.querySelectorAll("[data-tr]")) {
    const id = el.dataset.tr, list = S.chat[V.key] || [], x = list.find(y => y.id === id); if (!x) continue;
    const r = await translate(x.text, want, id);
    if (!r || !el.isConnected || el.dataset.tr !== id) continue;
    el.innerHTML = fmt(r.text) + ` <button type="button" class="linkbtn trnote" data-orig="${esc(id)}">🌐 ${esc(t("cht.translated", { x: r.from.toUpperCase() }))}</button>`;
    el.querySelector("[data-orig]").onclick = () => { V.showOrig.add(id); onUpdate(V.key); };
  }
}

function bindMsgs(box) {
  const m = me();
  box.querySelectorAll("[data-at]").forEach(b => b.onclick = () => {
    const ta = document.querySelector("[data-send] textarea"); if (!ta || !b.dataset.at) return;
    ta.value = (ta.value ? ta.value.replace(/\s*$/, " ") : "") + "@" + b.dataset.at + " "; ta.focus(); V.drafts[V.key] = ta.value;
  });
  box.querySelectorAll("[data-retr]").forEach(b => b.onclick = () => { V.showOrig.delete(b.dataset.retr); onUpdate(V.key); });
  box.querySelectorAll("[data-mdel]").forEach(b => b.onclick = async () => {
    const list = V.dm ? DM.list : S.chat[V.key], x = (list || []).find(y => y.id === b.dataset.mdel); if (!x) return;
    if (!(await confirmBox(t("cht.delQ"), t("delete")))) return;
    if (await run(() => B.del(V.path, x.id), t("deleted")) && !V.dm && x.by !== (m && m.id)) log("chat", `🗑 ${(player(x.by) || {}).name}: ${String(x.text).slice(0, 80)}`);
  });
  box.querySelectorAll("[data-mute]").forEach(b => b.onclick = () => muteForm(b.dataset.mute));
}

function muteForm(pid) {
  const p = player(pid); if (!p) return;
  const cur = muteOf(pid);
  const w = modal(t("cht.muteT", { x: p.name }), `<form class="form" data-mf>
    <label>${esc(t("cht.muteFor"))}<select name="h">${[[1, "cht.h1"], [24, "cht.h24"], [168, "cht.d7"], [720, "cht.d30"], [87600, "cht.forever"]].map(([h, l]) => `<option value="${h}">${esc(t(l))}</option>`).join("")}</select></label>
    <label>${esc(t("cht.muteWhy"))}<input name="why" required maxlength="200"></label>
    <div class="row end">${cur ? `<button type="button" class="ghost" data-unmute>${esc(t("cht.unmute"))}</button>` : ""}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="danger">🔇 ${esc(t("cht.mute"))}</button></div></form>`);
  const um = w.querySelector("[data-unmute]");
  if (um) um.onclick = async () => { if (await run(() => B.del("ud_mutes", pid), t("saved"))) { log("chat", `🔊 ${p.name}`); closeModal(); } };
  w.querySelector("[data-mf]").onsubmit = async e => {
    e.preventDefault(); const f = e.target, h = parseInt(f.h.value, 10) || 1;
    const v = { until: new Date(Date.now() + h * 3600e3), reason: f.why.value.trim().slice(0, 200), by: me().id, at: B.now() };
    if (await run(() => B.set("ud_mutes", pid, v), t("saved"))) { log("chat", `🔇 ${p.name} (${f.h.selectedOptions[0].textContent}): ${v.reason}`); closeModal(); }
  };
}

function newDmForm() {
  const m = me();
  const w = modal(t("cht.newDm"), `<form class="form" data-nd><label>${esc(t("cht.to"))}<select name="pid" required><option value="">—</option>${S.players.filter(p => p.id !== m.id).sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
    <div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("cht.open"))}</button></div></form>`);
  w.querySelector("[data-nd]").onsubmit = e => { e.preventDefault(); const pid = e.target.pid.value; if (!pid) return; closeModal(); go("chat/osobysti/" + dmId(m.id, pid)); };
}

export function mount(root) {
  const nd = root.querySelector("[data-newdm]"); if (nd) nd.onclick = newDmForm;
  const ml = root.querySelector("[data-modland]"); if (ml) ml.onchange = () => { V.modLand = ml.value; changed(); };
  const sw = root.querySelector("[data-trsw]"); if (sw) sw.onchange = () => { setTrOn(sw.checked); V.showOrig = new Set(); onUpdate(V.key); };
  const box = root.querySelector("#msgs");
  if (box) { bindMsgs(box); box.scrollTop = box.scrollHeight; markRead(); fillTranslations(box); }
  const f = root.querySelector("[data-send]");
  if (!f) return;
  const ta = f.text;
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; };
  ta.oninput = () => { V.drafts[V.key] = ta.value; grow(); }; grow();
  ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = async e => {
    e.preventDefault();
    const text = ta.value.trim().slice(0, MAX), m = me(); if (!text || !m) return;
    const key = V.key, path = V.path;
    ta.value = ""; V.drafts[key] = ""; grow();
    const msg = { by: m.id, text, at: B.now() };
    let ok;
    if (V.dm) {
      const id = key.slice(3), members = id.split("__");
      ok = await run(() => B.batch([
        { op: "set", c: "ud_dms", id, merge: true, v: { members, at: B.now(), last: { by: m.id, text: text.slice(0, 80), at: B.now() } } },
        { op: "set", c: path, id: B.newId("ud_dms"), v: msg },
      ]));
    } else ok = await run(() => B.set(path, B.newId("ud_chat"), msg));
    if (!ok) { ta.value = text; V.drafts[key] = text; grow(); }
    const bx = document.getElementById("msgs"); if (bx) bx.scrollTop = bx.scrollHeight;
  };
}
