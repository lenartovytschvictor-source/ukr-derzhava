// ⚖️ Суд, частина 2: адміністративні протоколи, штрафи й боржники, колегія адвокатів.
import { S, B, me, player, cases, isAdmin, canProtocols, canLicense, isLawyer, isCitizen, holds, ms, log } from "../store.js";
import { go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, toast, fmtDate } from "../ui.js";
import { empty } from "./common.js";

const nm = pid => (player(pid) || {}).name || "?";
const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDay = s => { const d = Date.parse(String(s || "") + "T12:00:00"); return isNaN(d) ? "" : new Date(d).toLocaleDateString(document.documentElement.lang || "uk", { day: "numeric", month: "long" }); };
const late = s => { const d = Date.parse(String(s || "") + "T23:59:59"); return !isNaN(d) && d < Date.now(); };
const PST = { open: "🟠", paid: "✅", void: "⚪", appealed: "⚖️" };
const canFines = () => canProtocols() || holds("finance");

// борги: неоплачені штрафи з протоколів і з вироків суду
export function debts() {
  const fromP = S.protocols.filter(p => p.fine && p.status === "open").map(p => ({ src: "p", id: p.id, pid: p.pid, fine: p.fine, due: p.due, no: p.no, title: p.what }));
  const fromC = cases().filter(c => c.status === "verdict" && c.fine && !c.finePaid && !c.pardon).map(c => ({ src: "c", id: c.id, pid: c.defendant, fine: c.fine, due: c.fineDue, no: c.no, title: c.title }));
  return [...fromP, ...fromC];
}

export function courtExtra() {
  const m = me(); let h = "";
  // протоколи
  const can = canProtocols() && m;
  const list = S.protocols.slice(0, 60);
  h += `<section class="card"><h2>📝 ${esc(t("ct.protocols"))} <span class="badge">${S.protocols.length}</span></h2><p class="hint">${esc(t("ct.protoHint"))}</p>
    ${can ? `<details class="newbill"><summary><b>✍️ ${esc(t("ct.newProto"))}</b></summary><form class="form" data-pnew>
      <label>${esc(t("ct.who"))}<select name="pid" required><option value="">—</option>${S.players.filter(p => p.status !== "ex").sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
      <label>${esc(t("ct.what"))}<input name="what" required maxlength="150" placeholder="${esc(t("ct.whatPh"))}"></label>
      <label>${esc(t("ct.article"))}<select name="law"><option value="">—</option>${S.laws.filter(l => l.status !== "repealed").sort((a, b) => (a.no || 0) - (b.no || 0)).map(l => `<option value="${esc(l.id)}">${l.kind === "decree" ? "🪶" : "📜"} №${l.no || "?"} ${esc(l.title)}</option>`).join("")}</select></label>
      <label>${esc(t("ct.details"))}<textarea name="text" rows="3" maxlength="2000"></textarea></label>
      <div class="row2"><label>${esc(t("ct.fine"))}<input name="fine" maxlength="80" placeholder="${esc(t("ct.finePh"))}"></label><label>${esc(t("ct.due"))}<input type="date" name="due" min="${todayIso()}"></label></div>
      <div class="row end"><button class="primary">${esc(t("ct.issue"))}</button></div></form></details>` : ""}
    ${list.length ? `<div class="duelist">${list.map(p => protoRow(p, m)).join("")}</div>` : empty(t("ct.noProto"))}</section>`;
  // боржники
  const D = debts();
  h += `<section class="card"><h2>💸 ${esc(t("ct.debtors"))} <span class="badge">${D.length}</span></h2>${D.length ? `<div class="duelist">${D.sort((a, b) => (a.due || "9").localeCompare(b.due || "9")).map(d =>
    `<div class="duerow${late(d.due) ? " late" : ""}"><a class="who" href="#/narod/gravets/${esc(d.pid)}">${avatar(player(d.pid) || { name: "?" }, "av md")}<b>${esc(nm(d.pid))}</b></a>
      <div class="grow"><b>${esc(d.fine)}</b><small class="hint">${d.src === "p" ? esc(t("ct.protoN", { n: d.no || "?" })) : `<a href="#/zakon/sud/${esc(d.id)}">${esc(t("lw.caseNo", { n: d.no || "?" }))}</a>`} · ${esc(d.title)}</small></div>
      <div class="dueinfo">${d.due ? `<span class="tag${late(d.due) ? " bad" : ""}">${late(d.due) ? "⏰ " : "📅 "}${esc(fmtDay(d.due))}</span>` : ""}</div>
      ${canFines() ? `<div class="sact"><button type="button" class="sm primary" data-fpaid="${d.src}:${esc(d.id)}">✅ ${esc(t("ct.paid"))}</button></div>` : ""}</div>`).join("")}</div>` : empty(t("ct.noDebts"))}</section>`;
  // адвокати
  const act = S.lawyers.filter(l => l.status === "active"), apps = S.lawyers.filter(l => l.status === "apply");
  const mine = m && S.lawyers.find(l => l.id === m.id);
  h += `<section class="card"><h2>🎓 ${esc(t("ct.bar"))} <span class="badge">${act.length}</span></h2><p class="hint">${esc(t("ct.barHint"))}</p>
    ${act.length ? `<div class="pgrid">${act.map(l => `<div class="pcard">${avatar(player(l.id) || { name: "?" }, "av lg")}<div class="pct"><small>${esc(t("ct.lawyer"))}${l.since ? " · " + esc(fmtDay(l.since)) : ""}</small><b><a href="#/narod/gravets/${esc(l.id)}">${esc(nm(l.id))}</a></b>
      ${canLicense() ? `<button type="button" class="ghost sm danger" data-lrev="${esc(l.id)}">${esc(t("ct.revoke"))}</button>` : ""}</div></div>`).join("")}</div>` : empty(t("ct.noLawyers"))}
    ${canLicense() && apps.length ? `<h3>${esc(t("ct.apps"))}</h3><div class="duelist">${apps.map(l => `<div class="duerow"><span class="who">${avatar(player(l.id) || { name: "?" }, "av md")}<b>${esc(nm(l.id))}</b></span><div class="grow"><small class="hint">${esc(l.note || "")}</small></div>
      <div class="sact"><button type="button" class="sm primary" data-lok="${esc(l.id)}">✅ ${esc(t("ct.license"))}</button><button type="button" class="ghost sm danger" data-lno="${esc(l.id)}">✕</button></div></div>`).join("")}</div>` : ""}
    ${m && isCitizen() && !mine ? `<details><summary class="hint">🎓 ${esc(t("ct.apply"))}</summary><form class="form" data-lapply><label>${esc(t("ct.applyWhy"))}<input name="note" maxlength="300"></label><div class="row end"><button class="sm primary">${esc(t("ct.applyBtn"))}</button></div></form></details>`
      : mine && mine.status === "apply" ? `<p class="hint">⏳ ${esc(t("ct.applied"))}</p>` : ""}</section>`;
  return h;
}
function protoRow(p, m) {
  const by = player(p.by), law = p.law && S.laws.find(l => l.id === p.law);
  const acts = [];
  if (canProtocols() && p.status === "open") acts.push(`<button type="button" class="ghost sm danger" data-pvoid="${esc(p.id)}" title="${esc(t("ct.void"))}">⚪</button>`);
  if (canFines() && p.status === "open" && p.fine) acts.push(`<button type="button" class="sm primary" data-fpaid="p:${esc(p.id)}">✅ ${esc(t("ct.paid"))}</button>`);
  if (m && p.pid === m.id && p.status === "open") acts.push(`<button type="button" class="sm" data-pappeal="${esc(p.id)}">⚖️ ${esc(t("ct.appeal"))}</button>`);
  if (isAdmin()) acts.push(`<button type="button" class="ghost sm danger" data-pdel="${esc(p.id)}" aria-label="${esc(t("delete"))}">✕</button>`);
  return `<div class="duerow${p.status === "paid" || p.status === "void" ? " paid" : late(p.due) && p.status === "open" ? " late" : ""}">
    <a class="who" href="#/narod/gravets/${esc(p.pid)}">${avatar(player(p.pid) || { name: "?" }, "av md")}<b>${esc(nm(p.pid))}</b></a>
    <div class="grow"><b>${esc(t("ct.protoN", { n: p.no || "?" }))}: ${esc(p.what)}</b>${law ? `<small class="hint">📜 <a href="#/zakon/zakony/${esc(law.id)}">№${law.no} ${esc(law.title)}</a></small>` : ""}${p.text ? `<small class="hint">${esc(p.text)}</small>` : ""}
      <small class="hint">${esc(fmtDate(p.at))}${by ? " · " + esc(by.name) : ""}${p.case ? ` · <a href="#/zakon/sud/${esc(p.case)}">${esc(t("ct.appealCase"))}</a>` : ""}</small></div>
    <div class="dueinfo">${p.fine ? `<span class="tag">💰 ${esc(p.fine)}</span>` : ""}<span class="tag">${PST[p.status] || ""} ${esc(t("ct.ps." + p.status))}</span>${p.due && p.status === "open" ? `<small class="hint">${esc(t("ct.until", { x: fmtDay(p.due) }))}</small>` : ""}</div>
    ${acts.length ? `<div class="sact">${acts.join("")}</div>` : ""}</div>`;
}
// блок адвокатів у справі
export function caseLawyers(c) {
  const m = me(), L = c.lawyers || {};
  const shown = Object.entries(L).map(([party, lw]) => `<span class="tag">🎓 ${esc(nm(lw))} — ${esc(t("ct.forX", { x: nm(party) }))}</span>`).join(" ");
  const iParty = m && (c.plaintiff === m.id || c.defendant === m.id) && !L[m.id] && ["filed", "accepted", "hearing"].includes(c.status);
  const avail = S.lawyers.filter(l => l.status === "active" && !(c.parties || []).includes(l.id));
  if (!shown && !iParty) return "";
  return `<section class="card"><h2>🎓 ${esc(t("ct.advocates"))}</h2>${shown ? `<p>${shown}</p>` : ""}
    ${iParty ? (avail.length ? `<form class="row" data-hire><select name="lw" required><option value="">${esc(t("ct.pickLawyer"))}</option>${avail.map(l => `<option value="${esc(l.id)}">${esc(nm(l.id))}</option>`).join("")}</select><button class="sm primary">${esc(t("ct.hire"))}</button></form><p class="hint">${esc(t("ct.hireHint"))}</p>` : `<p class="hint">${esc(t("ct.noLawyers"))}</p>`) : ""}</section>`;
}

export function mountCourtExtra(root, c) {
  const m = me();
  const pn = root.querySelector("[data-pnew]");
  if (pn) pn.onsubmit = async e => {
    e.preventDefault(); if (!pn.pid.value) return;
    const pc = await B.get("ud_counters", "protocols"), no = ((pc && pc.n) || 0) + 1;
    const v = { no, pid: pn.pid.value, what: pn.what.value.trim().slice(0, 150), law: pn.law.value, text: pn.text.value.trim().slice(0, 2000), fine: pn.fine.value.trim().slice(0, 80), due: pn.due.value || "", status: "open", by: m.id, at: B.now() };
    if (await run(() => B.batch([{ op: "set", c: "ud_counters", id: "protocols", v: { n: no } }, { op: "set", c: "ud_protocols", id: B.newId("ud_protocols"), v }]), t("ct.issued"))) { log("court", `📝 №${no} ${nm(v.pid)}: ${v.what}`); pn.reset(); }
  };
  root.querySelectorAll("[data-pvoid]").forEach(b => b.onclick = async () => { if (await confirmBox(t("ct.voidQ"), t("ct.void"))) run(() => B.update("ud_protocols", b.dataset.pvoid, { status: "void" }), t("saved")); });
  root.querySelectorAll("[data-pdel]").forEach(b => b.onclick = async () => { if (await confirmBox(t("ct.delQ"), t("delete"))) run(() => B.del("ud_protocols", b.dataset.pdel), t("deleted")); });
  root.querySelectorAll("[data-fpaid]").forEach(b => b.onclick = async () => {
    const [src, id] = b.dataset.fpaid.split(":");
    if (!(await confirmBox(t("ct.paidQ"), t("ct.paid")))) return;
    if (src === "p") run(() => B.update("ud_protocols", id, { status: "paid", paidAt: B.now(), paidBy: m.id }), t("saved"));
    else run(() => B.update("ud_cases", id, { finePaid: true, finePaidAt: B.now() }), t("saved"));
  });
  root.querySelectorAll("[data-pappeal]").forEach(b => b.onclick = () => {
    const p = S.protocols.find(x => x.id === b.dataset.pappeal); if (!p) return;
    const w = modal(t("ct.appeal"), `<form class="form" data-apf><p>${esc(t("ct.protoN", { n: p.no }))}: <b>${esc(p.what)}</b></p><label>${esc(t("ct.appealWhy"))}<textarea name="text" rows="5" maxlength="5000" required></textarea></label>
      <div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">⚖️ ${esc(t("ct.appeal"))}</button></div></form>`);
    w.querySelector("[data-apf]").onsubmit = async e => {
      e.preventDefault();
      const no = ((S.caseCounter && S.caseCounter.n) || 0) + 1, id = B.newId("ud_cases");
      const v = { no, title: t("ct.appealTitle", { n: p.no }).slice(0, 150), text: e.target.text.value.slice(0, 10000), plaintiff: m.id, defendant: p.by, forState: false, closed: false, status: "filed", judge: "", parties: [m.id, p.by], at: B.now() };
      if (p.by === m.id) return toast(t("ct.selfAppeal"), "err");
      if (await run(() => B.batch([{ op: "set", c: "ud_counters", id: "cases", v: { n: no } }, { op: "set", c: "ud_cases", id, v }, { op: "update", c: "ud_protocols", id: p.id, v: { status: "appealed", case: id } }]), t("lw.filed"))) { closeModal(); go("zakon/sud/" + id); }
    };
  });
  const la = root.querySelector("[data-lapply]");
  if (la) la.onsubmit = async e => { e.preventDefault(); if (await run(() => B.set("ud_lawyers", m.id, { status: "apply", note: la.note.value.trim().slice(0, 300), at: B.now() }), t("ct.applied"))) log("court", "🎓 " + m.name); };
  root.querySelectorAll("[data-lok]").forEach(b => b.onclick = () => run(() => B.update("ud_lawyers", b.dataset.lok, { status: "active", since: todayIso(), by: m.id }), t("saved")).then(ok => ok && log("court", `🎓 ✅ ${nm(b.dataset.lok)}`)));
  root.querySelectorAll("[data-lno]").forEach(b => b.onclick = async () => { if (await confirmBox(t("ct.rejectAppQ"), t("delete"))) run(() => B.del("ud_lawyers", b.dataset.lno), t("deleted")); });
  root.querySelectorAll("[data-lrev]").forEach(b => b.onclick = async () => { if (await confirmBox(t("ct.revokeQ", { x: nm(b.dataset.lrev) }), t("ct.revoke")) && await run(() => B.del("ud_lawyers", b.dataset.lrev), t("saved"))) log("court", `🎓 − ${nm(b.dataset.lrev)}`); });
  const hf = root.querySelector("[data-hire]");
  if (hf && c) hf.onsubmit = async e => {
    e.preventDefault(); const lw = hf.lw.value; if (!lw) return;
    if (await run(() => B.update("ud_cases", c.id, { lawyers: { ...(c.lawyers || {}), [m.id]: lw }, parties: [...(c.parties || []), lw] }), t("saved"))) log("court", `🎓 ${t("lw.caseNo", { n: c.no })}: ${nm(lw)}`);
  };
}
export { isLawyer, ms };
