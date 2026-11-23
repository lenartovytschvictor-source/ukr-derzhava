// 🗳 Вибори на будь-яку посаду: висування → голосування → підсумки.
// Хто голосує, фіксується в момент старту голосування (переїзд після старту не дає другого голосу).
import { S, B, me, player, pos, land, isAdmin, isCitizen, canChamber, CH, ms, log, changed } from "../store.js";
import { EDIT, go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, confirmBox, toast, fmtDate } from "../ui.js";
import { txt, empty, paras } from "./common.js";

const CUR = { id: "", cands: [], myVote: null, un: [] };
function follow(id) {
  if (CUR.id === id) return;
  CUR.un.forEach(f => { try { f(); } catch (_) {} });
  Object.assign(CUR, { id, cands: [], myVote: null, un: [] });
  if (!id) return;
  CUR.un.push(B.watch(`ud_elections/${id}/cands`, r => { CUR.cands = r.sort((a, b) => ms(a.at) - ms(b.at)); changed(); }));
  const m = me();
  if (m) CUR.un.push(B.watchDoc(`ud_elections/${id}/votes`, m.id, d => { CUR.myVote = d; changed(); }, () => {}));
}
const left = end => { const d = ms(end) - Date.now(); if (d <= 0) return t("ch.ended"); const h = Math.floor(d / 3600e3), m = Math.floor(d % 3600e3 / 60e3); return t("ch.left", { h, m }); };
const scopeName = e => e.scope ? ((land(e.scope) || {}).name || e.scope) : t("el.allCitizens");
// хто може висуватися й голосувати: громадяни; на виборах у землі — лише прописані в ній
const eligible = (p, e) => p && p.status === "cit" && (!e.scope || p.land === e.scope);
const STAGE = { nomination: "📝", voting: "🗳", done: "🏁", tie: "⚖️", cancelled: "✕" };

export function render(parts) {
  if (parts[1]) { follow(parts[1]); return page(parts[1]); }
  follow("");
  const act = S.elections.filter(e => ["nomination", "voting"].includes(e.stage)).sort((a, b) => ms(b.at) - ms(a.at));
  const past = S.elections.filter(e => !["nomination", "voting"].includes(e.stage)).sort((a, b) => ms(b.at) - ms(a.at));
  let h = txt("vybory", "intro", t("el.intro"), { cls: "lead" });
  if (canChamber()) h += createForm();
  h += `<section class="card"><h2>${esc(t("el.active"))}</h2>${act.length ? `<div class="bills">${act.map(row).join("")}</div>` : empty(t("el.noActive"))}</section>`;
  if (past.length) h += `<section class="card"><h2>${esc(t("el.past"))}</h2><div class="bills">${past.map(row).join("")}</div></section>`;
  return h;
}
function row(e) {
  const w = player(e.winner);
  return `<a class="bill" href="#/derzhava/vybory/${esc(e.id)}"><span class="bst" aria-hidden="true">${STAGE[e.stage] || "•"}</span><span class="bt"><b>${esc(e.title)}</b>
    <small class="hint">${esc(t("el.stage." + e.stage))} · ${esc(scopeName(e))}${e.stage === "nomination" ? " · " + esc(left(e.nomEnd)) : e.stage === "voting" ? " · " + esc(left(e.voteEnd)) : ""}${w ? " · 🏆 " + esc(w.name) : ""}</small></span></a>`;
}
function createForm() {
  const list = S.positions.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return `<details class="card"><summary><b>➕ ${esc(t("el.create"))}</b></summary><form class="form" data-enew>
    <label>${esc(t("el.position"))}<select name="pos" required>${list.map(p => `<option value="${esc(p.id)}">${esc(p.title)}${p.land ? " (" + esc((land(p.land) || {}).short || p.land) + ")" : ""}</option>`).join("")}</select></label>
    <div class="row2"><label>${esc(t("ch.set.nom"))}<input type="number" name="nh" min="1" max="336" value="${CH().nomHours}"></label>
    <label>${esc(t("ch.set.vote"))}<input type="number" name="vh" min="1" max="336" value="${CH().voteHours}"></label></div>
    <p class="hint">${esc(t("el.createHint"))}</p><button class="primary">${esc(t("el.announce"))}</button></form></details>`;
}

function page(id) {
  const e = S.elections.find(x => x.id === id);
  if (!e) return `<p><a href="#/derzhava/vybory">← ${esc(t("el.back"))}</a></p><div class="card">${empty(S.elections.length ? t("el.notFound") : t("loading"))}</div>`;
  const m = me(); const p = pos(e.pos);
  const nomOpen = e.stage === "nomination" && ms(e.nomEnd) > Date.now();
  const voteOpen = e.stage === "voting" && ms(e.voteEnd) > Date.now();
  const iAmCand = m && CUR.cands.some(c => c.id === m.id);
  let h = `<p><a href="#/derzhava/vybory">← ${esc(t("el.back"))}</a></p><section class="card">
    <p class="tags"><span class="tag">${STAGE[e.stage] || ""} ${esc(t("el.stage." + e.stage))}</span><span class="tag">🗺 ${esc(scopeName(e))}</span>${e.at ? `<span class="tag">📅 ${esc(fmtDate(e.at))}</span>` : ""}</p>
    <h1>${esc(t("el.title", { x: e.title }))}</h1>
    <p class="hint">${e.stage === "nomination" ? esc(t("el.nomUntil", { x: fmtDate(e.nomEnd) })) + " · " + esc(left(e.nomEnd)) : e.stage === "voting" ? esc(t("el.voteUntil", { x: fmtDate(e.voteEnd) })) + " · " + esc(left(e.voteEnd)) + " · " + esc(t("el.voters", { n: (e.voters || []).length })) : ""}</p>
    ${e.bill ? `<p class="hint">${esc(t("el.byBill"))} <a href="#/derzhava/palata/${esc(e.bill)}">${esc(t("el.openBill"))}</a></p>` : ""}</section>`;
  // кандидати
  const res = e.results || {};
  const cands = CUR.cands.slice().sort((a, b) => (res[b.id] || 0) - (res[a.id] || 0));
  h += `<section class="card"><h2>${esc(t("el.cands"))} <span class="badge">${cands.length}</span></h2>${cands.length ? `<div class="cands">${cands.map(c => {
    const pl = player(c.id); const chosen = CUR.myVote && CUR.myVote.cand === c.id;
    return `<div class="cand${chosen ? " chosen" : ""}${e.winner === c.id ? " win" : ""}">${avatar(pl || { name: "?" }, "av lg")}<div class="grow"><b>${pl ? `<a href="#/narod/gravets/${esc(pl.id)}">${esc(pl.name)}</a>` : "?"}</b>${e.winner === c.id ? " 🏆" : ""}
      ${c.program ? `<div class="prog">${paras(c.program)}</div>` : ""}
      ${["done", "tie"].includes(e.stage) ? `<div class="hint">${esc(t("el.votesN", { n: res[c.id] || 0 }))}</div>` : ""}</div>
      ${voteOpen && m && (e.voters || []).includes(m.id) ? `<button type="button" class="${chosen ? "primary" : ""}" data-evote="${esc(c.id)}">${esc(chosen ? t("el.yourChoice") : t("el.voteFor"))}</button>` : ""}
      ${(isAdmin() && e.stage === "nomination") || (m && c.id === m.id && nomOpen) ? `<button type="button" class="ghost sm danger" data-cwd="${esc(c.id)}">${esc(t("el.withdraw"))}</button>` : ""}</div>`;
  }).join("")}</div>` : empty(t("el.noCands"))}`;
  if (nomOpen && m && !iAmCand) {
    h += eligible(m, e) ? `<form class="form nomform" data-nom><label>${esc(t("el.program"))}<textarea name="program" rows="3" maxlength="2000" placeholder="${esc(t("el.programPh"))}"></textarea></label><button class="primary">${esc(t("el.nominate"))}</button></form>`
      : `<p class="hint">${esc(t(e.scope ? "el.notEligibleLand" : "el.notEligible"))}</p>`;
  }
  if (voteOpen && m && !(e.voters || []).includes(m.id)) h += `<p class="hint">${esc(t("el.notVoter"))}</p>`;
  if (voteOpen && CUR.myVote) h += `<p class="hint">✓ ${esc(t("el.voted"))}</p>`;
  h += "</section>";
  if (["done", "tie"].includes(e.stage)) h += `<section class="card"><h2>🏁 ${esc(t("el.results"))}</h2><p>${esc(t("el.turnout", { n: e.turnout || 0, of: (e.voters || []).length }))}</p>${e.stage === "tie" ? `<p class="warn">${esc(t("el.tieMsg"))}</p>` : e.winner ? `<p>${esc(t("el.winner", { x: (player(e.winner) || {}).name || "?", p: e.title }))}</p>` : `<p>${esc(t("el.noWinner"))}</p>`}</section>`;
  // керування
  const acts = [];
  if (canChamber() && e.stage === "nomination") acts.push(`<button type="button" class="primary" data-start ${CUR.cands.length ? "" : "disabled"}>${esc(t("el.startVote", { h: CH().voteHours }))}</button>`);
  if (isAdmin() && e.stage === "voting") acts.push(`<button type="button" class="primary" data-fin>${esc(voteOpen ? t("el.finEarly") : t("el.finalize"))}</button>`);
  if (canChamber() && ["nomination", "voting"].includes(e.stage)) acts.push(`<button type="button" class="ghost danger sm" data-cancel>${esc(t("el.cancel"))}</button>`);
  if (isAdmin()) acts.push(`<button type="button" class="ghost danger sm" data-edel>${esc(t("delete"))}</button>`);
  if (acts.length) h += `<section class="card"><div class="row">${acts.join("")}</div>${isAdmin() && e.stage === "voting" ? `<p class="hint">${esc(t("el.finHint"))}</p>` : ""}</section>`;
  return h;
}

export function mount(root, parts) {
  const f = root.querySelector("[data-enew]");
  if (f) f.onsubmit = async ev => {
    ev.preventDefault(); const p = pos(f.pos.value); if (!p) return;
    if (S.elections.some(x => x.pos === p.id && ["nomination", "voting"].includes(x.stage))) return toast(t("el.already"), "err");
    const nh = Math.max(1, Math.min(336, +f.nh.value || 48));
    const id = B.newId("ud_elections");
    if (await run(() => B.set("ud_elections", id, { pos: p.id, title: p.title, scope: p.land || "", stage: "nomination", nomEnd: new Date(Date.now() + nh * 3600e3), voteHours: Math.max(1, Math.min(336, +f.vh.value || 48)), by: S.user.email, at: B.now() }), t("el.created"))) {
      log("election", `+ ${p.title}`); go("derzhava/vybory/" + id);
    }
  };
  if (!parts[1]) return;
  const e = S.elections.find(x => x.id === parts[1]); if (!e) return;
  const m = me();
  const nf = root.querySelector("[data-nom]");
  if (nf) nf.onsubmit = async ev => { ev.preventDefault(); if (await run(() => B.set(`ud_elections/${e.id}/cands`, m.id, { program: nf.program.value.trim().slice(0, 2000), at: B.now() }), t("el.nominated"))) log("election", `${e.title}: ${m.name}`); };
  root.querySelectorAll("[data-cwd]").forEach(b => b.onclick = async () => { if (await confirmBox(t("el.withdrawQ"), t("el.withdraw"))) run(() => B.del(`ud_elections/${e.id}/cands`, b.dataset.cwd), t("saved")); });
  root.querySelectorAll("[data-evote]").forEach(b => b.onclick = () => run(() => B.set(`ud_elections/${e.id}/votes`, m.id, { cand: b.dataset.evote, at: B.now() }), t("el.votedMsg")));
  const st = root.querySelector("[data-start]");
  if (st) st.onclick = async () => {
    // фіксуємо список виборців на момент старту
    const voters = S.players.filter(p => eligible(p, e)).map(p => p.id);
    const vh = e.voteHours || CH().voteHours;
    if (await run(() => B.update("ud_elections", e.id, { stage: "voting", voters, voteEnd: new Date(Date.now() + vh * 3600e3) }), t("el.voteStarted"))) log("election", `${e.title}: ${t("el.stage.voting")}`);
  };
  const fin = root.querySelector("[data-fin]");
  if (fin) fin.onclick = async () => {
    if (ms(e.voteEnd) > Date.now() && !(await confirmBox(t("el.finEarlyQ"), t("el.finalize")))) return;
    const votes = await run(() => B.list(`ud_elections/${e.id}/votes`)); if (!votes) return;
    const cand = new Set(CUR.cands.map(c => c.id)); const voters = new Set(e.voters || []);
    const results = {}; let turnout = 0;
    votes.forEach(v => { if (voters.has(v.id) && cand.has(v.cand)) { results[v.cand] = (results[v.cand] || 0) + 1; turnout++; } });
    const top = Math.max(0, ...Object.values(results)); const leaders = Object.keys(results).filter(k => results[k] === top);
    const winner = top > 0 && leaders.length === 1 ? leaders[0] : "";
    const ops = [{ op: "update", c: "ud_elections", id: e.id, v: { stage: top > 0 && leaders.length > 1 ? "tie" : "done", results, turnout, winner, closedAt: B.now() } }];
    if (winner && pos(e.pos)) ops.push({ op: "update", c: "ud_positions", id: e.pos, v: { holder: winner, since: B.now() } });
    if (await run(() => B.batch(ops), t("el.finished"))) log("election", `${e.title}: 🏆 ${(player(winner) || {}).name || "—"}`);
  };
  const cc = root.querySelector("[data-cancel]"); if (cc) cc.onclick = async () => { if (await confirmBox(t("el.cancelQ"), t("el.cancel")) && await run(() => B.update("ud_elections", e.id, { stage: "cancelled" }), t("saved"))) log("election", `✕ ${e.title}`); };
  const ed = root.querySelector("[data-edel]"); if (ed) ed.onclick = async () => { if (await confirmBox(t("el.delQ"), t("delete")) && await run(() => B.del("ud_elections", e.id), t("deleted"))) { log("election", `${t("deleted")}: ${e.title}`); go("derzhava/vybory"); } };
}
