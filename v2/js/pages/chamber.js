// 🏛 Палата Земель: Голова, Земська й Сотенна лави, законопроєкти, петиції, голосування.
import { S, B, me, player, pos, lands, seats, mySeat, isAdmin, isHetman, isCitizen, isChair, canChamber, CH, ms, log, changed } from "../store.js";
import { EDIT, go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, confirmBox, toast, fmtDate } from "../ui.js";
import { txt, empty, paras } from "./common.js";

// законопроєкт: signatures (петиція збирає підписи) → discussion → voting → passed / rejected → signed / vetoed
const ST = { signatures: "✍️", discussion: "💬", voting: "🗳", passed: "✅", rejected: "❌", signed: "📜", vetoed: "⛔", withdrawn: "↩️" };

// ---------- живі дані відкритого законопроєкту ----------
const CUR = { id: "", votes: [], signs: [], cmts: [], un: [] };
function follow(id) {
  if (CUR.id === id) return;
  CUR.un.forEach(f => { try { f(); } catch (_) {} });
  Object.assign(CUR, { id, votes: [], signs: [], cmts: [], un: [] });
  if (!id) return;
  CUR.un.push(B.watch(`ud_bills/${id}/votes`, r => { CUR.votes = r; changed(); }));
  CUR.un.push(B.watch(`ud_bills/${id}/signs`, r => { CUR.signs = r; changed(); }));
  CUR.un.push(B.watch(`ud_bills/${id}/cmts`, r => { CUR.cmts = r.sort((a, b) => ms(a.at) - ms(b.at)); changed(); }));
}

// члени Палати — унікальні люди: хто обіймає два місця (напр. Голова й представник землі), має один голос
const occupied = () => [...new Set(seats().filter(p => p.holder && player(p.holder)).map(p => p.holder))];
const quorumNeed = () => Math.floor(occupied().length * CH().quorum / 100) + 1;
function tally(votes) {
  const valid = votes.filter(v => occupied().includes(v.id));   // голоси тих, хто досі в Палаті
  const c = { for: 0, against: 0, abstain: 0 };
  valid.forEach(v => { if (c[v.v] != null) c[v.v]++; });
  const cast = c.for + c.against + c.abstain;
  return { ...c, cast, quorum: cast >= quorumNeed(), pass: cast >= quorumNeed() && c.for > c.against };
}
const left = end => { const d = ms(end) - Date.now(); if (d <= 0) return t("ch.ended"); const h = Math.floor(d / 3600e3), m = Math.floor(d % 3600e3 / 60e3); return t("ch.left", { h, m }); };
const votingOpen = b => b.status === "voting" && ms(b.voteEnd) > Date.now();

export function render(parts) {
  if (parts[1]) { follow(parts[1]); return billPage(parts[1]); }
  follow("");
  return overview();
}

// ---------- Палата: склад + списки ----------
function seatRow(p) {
  const pl = player(p.holder);
  return `<div class="seat">${avatar(pl || { name: "?" }, "av md")}<span><small>${esc(p.title)}</small><b>${pl ? `<a href="#/narod/gravets/${esc(pl.id)}">${esc(pl.name)}</a>` : `<i class="vac">${esc(t("vacant"))}</i>`}</b></span>
    ${EDIT && isAdmin() ? `<button type="button" class="ghost sm danger" data-sdel="${esc(p.id)}" aria-label="${esc(t("delete"))}">✕</button>` : ""}</div>`;
}
function overview() {
  const chair = pos("chair");
  const zem = seats().filter(p => p.chamber === "zemska"), sot = seats().filter(p => p.chamber === "sotenna");
  let h = txt("palata", "intro", t("ch.intro"), { cls: "lead" });
  if (isAdmin() && (!chair || zem.length < lands().length)) h += `<div class="card warn small">${esc(t("ch.noSeats"))} <button type="button" class="sm" data-seed>${esc(t("ch.seed"))}</button></div>`;
  h += `<section class="card"><div class="row between"><h2>${esc(t("ch.compo"))}</h2><span class="hint">${esc(t("ch.quorum", { n: quorumNeed(), of: occupied().length }))}</span></div>
    ${chair ? `<div class="seats chairrow">${seatRow(chair)}</div>` : ""}
    <h3>${esc(t("ch.zemska"))} <small class="hint">${esc(t("ch.zemskaHint"))}</small></h3><div class="seats">${zem.map(seatRow).join("") || empty(t("ch.noZem"))}</div>
    <h3>${esc(t("ch.sotenna"))} <small class="hint">${esc(t("ch.sotennaHint"))}</small></h3><div class="seats">${sot.map(seatRow).join("") || empty(t("ch.noSot"))}</div>
    ${EDIT && isAdmin() ? `<form class="row" data-sadd><input name="title" required maxlength="80" placeholder="${esc(t("ch.sotTitle"))}"><select name="land"><option value="">—</option>${lands().map(l => `<option value="${esc(l.id)}">${esc(l.short || l.name)}</option>`).join("")}</select><button class="sm">+ ${esc(t("ch.addSot"))}</button></form>
      <p class="hint">${esc(t("ch.appointHint"))}</p>` : ""}
  </section>`;
  if (EDIT && isAdmin()) h += settings();
  h += newBillBlock();
  const by = st => S.bills.filter(b => st.includes(b.status)).sort((a, b) => ms(b.at) - ms(a.at));
  const sec = (title, list, open = true) => list.length ? `<section class="card"><h2>${esc(title)} <span class="badge">${list.length}</span></h2><div class="bills">${list.map(billRow).join("")}</div></section>` : "";
  h += sec(t("ch.sec.voting"), by(["voting"]));
  h += sec(t("ch.sec.passed"), by(["passed"]));
  h += sec(t("ch.sec.discussion"), by(["discussion"]));
  h += sec(t("ch.sec.petitions"), by(["signatures"]));
  const arch = by(["signed", "rejected", "vetoed", "withdrawn"]);
  if (arch.length) h += `<details class="card"><summary><b>${esc(t("ch.sec.archive"))}</b> <span class="badge">${arch.length}</span></summary><div class="bills">${arch.map(billRow).join("")}</div></details>`;
  if (!S.bills.length) h += `<div class="card">${empty(t("ch.noBills"))}</div>`;
  return h;
}
function billRow(b) {
  const a = player(b.author);
  return `<a class="bill" href="#/derzhava/palata/${esc(b.id)}"><span class="bst" aria-hidden="true">${ST[b.status] || "•"}</span><span class="bt"><b>${esc(b.title)}</b>
    <small class="hint">${esc(t("ch.st." + b.status))}${b.kind === "call" ? " · " + esc(t("ch.kind.call")) : b.kind === "petition" ? " · " + esc(t("ch.kind.petition")) : ""}${a ? " · " + esc(a.name) : ""}${b.status === "voting" ? " · " + esc(left(b.voteEnd)) : ""}</small></span></a>`;
}
function settings() {
  const c = CH();
  return `<section class="card"><h2>⚙️ ${esc(t("ch.settings"))}</h2><form class="setgrid" data-cset>
    <label>${esc(t("ch.set.hours"))}<input type="number" name="hours" min="1" max="336" value="${c.hours}"></label>
    <label>${esc(t("ch.set.quorum"))}<input type="number" name="quorum" min="1" max="100" value="${c.quorum}"></label>
    <label>${esc(t("ch.set.petition"))}<input type="number" name="petition" min="1" max="100" value="${c.petition}"></label>
    <label>${esc(t("ch.set.nom"))}<input type="number" name="nomHours" min="1" max="336" value="${c.nomHours}"></label>
    <label>${esc(t("ch.set.vote"))}<input type="number" name="voteHours" min="1" max="336" value="${c.voteHours}"></label>
    <div><button class="sm">${esc(t("save"))}</button></div></form></section>`;
}
function newBillBlock() {
  const m = me();
  if (!S.user || !m) return "";
  const full = !!mySeat() || isHetman() || isAdmin();
  if (!full && !isCitizen()) return "";
  const targets = S.positions.filter(p => p.appointBy === "election");
  return `<details class="card newbill"><summary><b>✍️ ${esc(full ? t("ch.newBill") : t("ch.newPetition"))}</b></summary>
    <p class="hint">${esc(full ? t("ch.newBillHint") : t("ch.newPetitionHint", { n: CH().petition }))}</p>
    <form class="form" data-bnew>
      ${full ? `<label>${esc(t("ch.kind"))}<select name="kind"><option value="law">${esc(t("ch.kind.law"))}</option><option value="call">${esc(t("ch.kind.call"))}</option></select></label>
      <label data-target hidden>${esc(t("ch.target"))}<select name="target">${targets.map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("")}</select></label>` : ""}
      <label>${esc(t("ch.title"))}<input name="title" required maxlength="150"></label>
      <label>${esc(t("ch.text"))}<textarea name="text" rows="8" maxlength="20000" required></textarea></label>
      <button class="primary">${esc(t("ch.submit"))}</button></form></details>`;
}

// ---------- сторінка законопроєкту ----------
function billPage(id) {
  const b = S.bills.find(x => x.id === id);
  if (!b) return `<p><a href="#/derzhava/palata">← ${esc(t("ch.back"))}</a></p><div class="card">${empty(S.bills.length ? t("ch.notFound") : t("loading"))}</div>`;
  const a = player(b.author); const m = me();
  const tg = b.kind === "call" ? pos(b.target) : null;
  let h = `<p><a href="#/derzhava/palata">← ${esc(t("ch.back"))}</a></p><section class="card billcard">
    <p class="tags"><span class="tag">${ST[b.status] || ""} ${esc(t("ch.st." + b.status))}</span><span class="tag">${esc(t(b.kind === "call" ? "ch.kind.call" : b.kind === "petition" ? "ch.kind.petition" : "ch.kind.law"))}</span>${b.at ? `<span class="tag">📅 ${esc(fmtDate(b.at))}</span>` : ""}</p>
    <h1>${esc(b.title)}</h1>
    <p class="hint">${esc(t("ch.author"))}: ${a ? `<a href="#/narod/gravets/${esc(a.id)}">${esc(a.name)}</a>` : "—"}${tg ? ` · ${esc(t("ch.target"))}: <b>${esc(tg.title)}</b>` : ""}</p>
    <div class="billtext">${paras(b.text)}</div></section>`;
  // збір підписів
  if (b.status === "signatures") {
    const need = CH().petition, have = CUR.signs.length, signed = m && CUR.signs.some(s => s.id === m.id);
    h += `<section class="card"><h2>✍️ ${esc(t("ch.signs"))} ${have}/${need}</h2><div class="meter"><span style="width:${Math.min(100, have / need * 100)}%"></span></div>
      <p class="hint">${CUR.signs.map(s => esc((player(s.id) || {}).name || "?")).join(", ")}</p>
      <div class="row">${isCitizen() ? `<button type="button" class="${signed ? "ghost" : "primary"}" data-sign="${signed ? 0 : 1}">${esc(t(signed ? "ch.unsign" : "ch.sign"))}</button>` : ""}
      ${canChamber() ? `<button type="button" class="sm" data-to="discussion" ${have >= need || isAdmin() ? "" : "disabled"}>${esc(t("ch.toDiscussion"))}</button>` : ""}</div></section>`;
  }
  // голосування
  if (["voting", "passed", "rejected", "signed", "vetoed"].includes(b.status)) h += votingBlock(b);
  // дії керівництва Палати
  const acts = [];
  if (canChamber() && b.status === "discussion") acts.push(`<button type="button" class="primary" data-open>${esc(t("ch.openVote", { h: CH().hours }))}</button>`);
  if (canChamber() && b.status === "voting" && !votingOpen(b)) acts.push(`<button type="button" class="primary" data-close>${esc(t("ch.finalize"))}</button>`);
  if (isAdmin() && b.status === "voting" && votingOpen(b)) acts.push(`<button type="button" class="ghost sm" data-close>${esc(t("ch.finalizeNow"))}</button>`);
  if ((isHetman() || isAdmin()) && b.status === "passed" && b.kind !== "call") acts.push(`<button type="button" class="primary" data-sign-law>📜 ${esc(t("ch.signLaw"))}</button><button type="button" class="ghost danger" data-veto>⛔ ${esc(t("ch.veto"))}</button>`);
  if (m && b.author === m.id && ["signatures", "discussion"].includes(b.status)) acts.push(`<button type="button" class="ghost sm danger" data-withdraw>${esc(t("ch.withdraw"))}</button>`);
  if (isAdmin()) acts.push(`<button type="button" class="ghost sm danger" data-bdel>${esc(t("delete"))}</button>`);
  if (acts.length) h += `<section class="card"><div class="row">${acts.join("")}</div></section>`;
  // обговорення
  h += `<section class="card"><h2>💬 ${esc(t("ch.discuss"))} <span class="badge">${CUR.cmts.length}</span></h2>${CUR.cmts.map(c => { const p = player(c.by); return `<div class="cmt">${avatar(p || { name: "?" }, "av sm")}<div><b>${esc(p ? p.name : "?")}</b> <span class="hint">${esc(fmtDate(c.at))}</span>${(m && c.by === m.id) || isAdmin() ? ` <button type="button" class="icon sm" data-cdel="${esc(c.id)}" aria-label="${esc(t("delete"))}">✕</button>` : ""}<div>${paras(c.text)}</div></div></div>`; }).join("") || empty(t("ch.noCmts"))}
    ${isCitizen() ? `<form class="cmtform" data-cmt><textarea name="text" rows="2" maxlength="1000" required placeholder="${esc(t("ch.cmtPh"))}"></textarea><button class="sm">${esc(t("ch.send"))}</button></form>` : ""}</section>`;
  return h;
}
function votingBlock(b) {
  const T = tally(CUR.votes); const m = me(); const seat = mySeat();
  const mine = m && CUR.votes.find(v => v.id === m.id);
  const open = votingOpen(b);
  const bar = (k, cls) => `<div class="vbar ${cls}"><span>${esc(t("ch.v." + k))}</span><b>${T[k]}</b><i style="width:${T.cast ? T[k] / T.cast * 100 : 0}%"></i></div>`;
  let h = `<section class="card"><div class="row between"><h2>🗳 ${esc(t("ch.voting"))}</h2><span class="hint">${b.status === "voting" ? esc(left(b.voteEnd)) : esc(t("ch.st." + b.status))}</span></div>
    ${bar("for", "yes")}${bar("against", "no")}${bar("abstain", "abs")}
    <p class="hint">${esc(t("ch.cast", { n: T.cast, q: quorumNeed() }))} ${T.quorum ? "✓" : "✗"}${b.status === "voting" && !open ? " · " + esc(t(T.pass ? "ch.willPass" : "ch.willFail")) : ""}</p>`;
  if (open && seat) h += `<div class="row vbtns">${["for", "against", "abstain"].map(k => `<button type="button" class="${mine && mine.v === k ? "primary" : ""}" data-vote="${k}">${esc(t("ch.v." + k))}</button>`).join("")}</div>${mine ? `<p class="hint">${esc(t("ch.youVoted"))}</p>` : ""}`;
  else if (open && S.user) h += `<p class="hint">${esc(t("ch.onlyMembers"))}</p>`;
  if (CUR.votes.length) h += `<details><summary class="hint">${esc(t("ch.whoVoted"))}</summary><ul class="vlist">${CUR.votes.map(v => `<li>${esc((player(v.id) || {}).name || "?")} — ${esc(t("ch.v." + v.v))}</li>`).join("")}</ul></details>`;
  return h + "</section>";
}

// ---------- дії ----------
const DEFAULT_CHAIR = { title: "Голова Палати Земель", order: 100, appointBy: "election", chamber: "chair", holder: "" };
export function mount(root, parts) {
  const seed = root.querySelector("[data-seed]");
  if (seed) seed.onclick = async () => {
    const ops = [];
    if (!pos("chair")) ops.push({ op: "set", c: "ud_positions", id: "chair", v: DEFAULT_CHAIR });
    lands().forEach((l, i) => { if (!pos("seat_" + l.id)) ops.push({ op: "set", c: "ud_positions", id: "seat_" + l.id, v: { title: t("ch.seatTitle", { x: l.short || l.name }), order: 101 + i, appointBy: "election", chamber: "zemska", land: l.id, holder: "" } }); });
    if (await run(() => B.batch(ops), t("saved"))) log("chamber", t("ch.seed"));
  };
  root.querySelectorAll("[data-sdel]").forEach(b => b.onclick = async () => {
    const p = pos(b.dataset.sdel); if (!(await confirmBox(t("pw.delq", { x: p.title }), t("delete")))) return;
    if (await run(() => B.del("ud_positions", p.id), t("deleted"))) log("chamber", `− ${p.title}`);
  });
  const sa = root.querySelector("[data-sadd]");
  if (sa) sa.onsubmit = async e => {
    e.preventDefault(); const title = sa.title.value.trim(); if (!title) return;
    const order = 200 + seats().length;
    if (await run(() => B.set("ud_positions", B.newId("ud_positions"), { title, order, appointBy: "admin", chamber: "sotenna", land: sa.land.value, holder: "" }), t("saved"))) log("chamber", `+ ${title}`);
  };
  const cs = root.querySelector("[data-cset]");
  if (cs) cs.onsubmit = async e => {
    e.preventDefault(); const n = k => Math.max(1, Math.min(k === "quorum" || k === "petition" ? 100 : 336, parseInt(cs[k].value, 10) || 1));
    if (await run(() => B.set("ud_config", "chamber", { hours: n("hours"), quorum: n("quorum"), petition: n("petition"), nomHours: n("nomHours"), voteHours: n("voteHours") }), t("saved"))) log("chamber", t("ch.settings"));
  };
  const bn = root.querySelector("[data-bnew]");
  if (bn) {
    const kind = bn.querySelector("[name=kind]"), tl = bn.querySelector("[data-target]");
    if (kind) kind.onchange = () => { tl.hidden = kind.value !== "call"; if (kind.value === "call" && !bn.title.value) bn.title.value = t("ch.callTitle"); };
    bn.onsubmit = async e => {
      e.preventDefault();
      const full = !!mySeat() || isHetman() || isAdmin(); const k = full ? (kind ? kind.value : "law") : "petition";
      const v = { title: bn.title.value.trim().slice(0, 150), text: bn.text.value.trim().slice(0, 20000), kind: k, author: me().id,
        status: full ? "discussion" : "signatures", at: B.now() };
      if (k === "call") { v.target = bn.target.value; if (!v.target) return toast(t("ch.noTarget"), "err"); }
      if (mySeat()) v.seat = mySeat().id;
      const id = B.newId("ud_bills");
      if (await run(() => B.set("ud_bills", id, v), t("ch.submitted"))) { log("bill", `+ ${v.title}`); go("derzhava/palata/" + id); }
    };
  }
  if (!parts[1]) return;
  const b = S.bills.find(x => x.id === parts[1]); if (!b) return;
  const m = me();
  const upd = (v, msg, logText) => run(() => B.update("ud_bills", b.id, v), msg).then(ok => { if (ok && logText) log("bill", logText); return ok; });
  root.querySelectorAll("[data-sign]").forEach(x => x.onclick = () => x.dataset.sign === "1"
    ? run(() => B.set(`ud_bills/${b.id}/signs`, m.id, { at: B.now() }), t("ch.signed"))
    : run(() => B.del(`ud_bills/${b.id}/signs`, m.id)));
  root.querySelectorAll("[data-to]").forEach(x => x.onclick = () => upd({ status: x.dataset.to }, t("saved"), `${b.title}: ${t("ch.st." + x.dataset.to)}`));
  const op = root.querySelector("[data-open]");
  if (op) op.onclick = () => upd({ status: "voting", voteStart: B.now(), voteEnd: new Date(Date.now() + CH().hours * 3600e3) }, t("ch.voteOpened"), `${b.title}: ${t("ch.st.voting")}`);
  root.querySelectorAll("[data-vote]").forEach(x => x.onclick = () => run(() => B.set(`ud_bills/${b.id}/votes`, m.id, { v: x.dataset.vote, seat: mySeat().id, at: B.now() }), t("ch.voted")));
  root.querySelectorAll("[data-close]").forEach(x => x.onclick = async () => {
    if (votingOpen(b) && !(await confirmBox(t("ch.finalizeEarly"), t("ch.finalize")))) return;
    const T = tally(CUR.votes);
    const res = { for: T.for, against: T.against, abstain: T.abstain, cast: T.cast, need: quorumNeed(), seats: occupied().length };
    const status = T.pass ? "passed" : "rejected";
    const ok = await upd({ status, result: res, closedAt: B.now() }, t(T.pass ? "ch.passedMsg" : "ch.rejectedMsg"), `${b.title}: ${t("ch.st." + status)}`);
    // постанова про вибори: якщо ухвалено — одразу оголошуємо вибори на посаду
    if (ok && T.pass && b.kind === "call" && b.target) {
      const p = pos(b.target);
      if (p) await run(() => B.set("ud_elections", B.newId("ud_elections"), { pos: p.id, title: p.title, scope: p.land || "", stage: "nomination", nomEnd: new Date(Date.now() + CH().nomHours * 3600e3), bill: b.id, by: S.user.email, at: B.now() }), t("el.created"));
    }
  });
  const sl = root.querySelector("[data-sign-law]"); if (sl) sl.onclick = () => upd({ status: "signed", signedAt: B.now(), signedBy: m ? m.id : "" }, t("ch.lawSigned"), `📜 ${b.title}`);
  const vt = root.querySelector("[data-veto]"); if (vt) vt.onclick = async () => { if (await confirmBox(t("ch.vetoQ"), t("ch.veto"))) upd({ status: "vetoed", signedAt: B.now(), signedBy: m ? m.id : "" }, t("saved"), `⛔ ${b.title}`); };
  const wd = root.querySelector("[data-withdraw]"); if (wd) wd.onclick = async () => { if (await confirmBox(t("ch.withdrawQ"), t("ch.withdraw"))) upd({ status: "withdrawn" }, t("saved"), `↩️ ${b.title}`); };
  const bd = root.querySelector("[data-bdel]"); if (bd) bd.onclick = async () => { if (await confirmBox(t("ch.delQ"), t("delete")) && await run(() => B.del("ud_bills", b.id), t("deleted"))) { log("bill", `${t("deleted")}: ${b.title}`); go("derzhava/palata"); } };
  const cf = root.querySelector("[data-cmt]");
  if (cf) cf.onsubmit = async e => { e.preventDefault(); const text = cf.text.value.trim(); if (!text) return; if (await run(() => B.add(`ud_bills/${b.id}/cmts`, { by: m.id, text: text.slice(0, 1000), at: B.now() }))) cf.reset(); };
  root.querySelectorAll("[data-cdel]").forEach(x => x.onclick = () => run(() => B.del(`ud_bills/${b.id}/cmts`, x.dataset.cdel)));
}
