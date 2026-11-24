// ⚖️ Закон: Конституція · Кодекси · Закони й укази · Суд
import { S, B, me, pos, player, isAdmin, isHetman, holds, canCodes, canDecree, isJudge, JUDGES, cases, ms, log, changed } from "../store.js";
import { EDIT, go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, toast, fmtDate } from "../ui.js";
import { tabs, txt, empty, paras, holderSel, bindHolders } from "./common.js";

const TABS = [["konstytutsiya", "📜", "lw.tab.const"], ["kodeksy", "📚", "lw.tab.codes"], ["zakony", "📑", "lw.tab.laws"], ["sud", "⚖️", "lw.tab.court"]];
export const DEFAULT_CODES = [["admin", "Адміністративний кодекс"], ["criminal", "Кримінальний кодекс"], ["military", "Військовий кодекс"]];
const LST = { active: "🟢", amended: "🟡", repealed: "⚪" };
const CST = { filed: "📨", accepted: "📂", hearing: "🔨", verdict: "⚖️", rejected: "❌", withdrawn: "↩️" };
const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDay = s => { const d = Date.parse(String(s || "") + "T12:00:00"); return isNaN(d) ? "" : new Date(d).toLocaleDateString(document.documentElement.lang || "uk", { day: "numeric", month: "long", year: "numeric" }); };
const nm = pid => pid === "state" ? t("lw.state") : ((player(pid) || {}).name || "?");

// ---------- спільне ----------
export const lawNo = l => t(l.kind === "decree" ? "lw.no.decree" : "lw.no.law", { n: l.no || "?" });
export const nextNo = kind => Math.max(0, ...S.laws.filter(l => l.kind === kind).map(l => l.no || 0)) + 1;
const code = id => S.codes.find(c => c.id === id) || null;
const lawById = id => S.laws.find(l => l.id === id) || null;
// вибір кодексу при підписанні закону (викликається з Палати Земель)
export function pickCode(title) {
  return new Promise(res => {
    const w = modal(title, `<form class="form" data-pc><label>${esc(t("lw.code"))}<select name="code"><option value="">— ${esc(t("lw.noCode"))} —</option>${S.codes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>
      <p class="hint">${esc(t("lw.pickCodeHint"))}</p><div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">📜 ${esc(t("ch.signLaw"))}</button></div></form>`);
    w.querySelector("[data-close]").onclick = () => { closeModal(); res(null); };
    w.querySelector("[data-pc]").onsubmit = e => { e.preventDefault(); const v = e.target.code.value; closeModal(); res({ code: v }); };
  });
}

export function render(parts) {
  const cur = TABS.some(x => x[0] === parts[0]) ? parts[0] : "konstytutsiya";
  let h = `<h1 class="ptitle">⚖️ ${esc(t("nav.law"))}</h1>${tabs("zakon", TABS, cur)}`;
  if (cur === "konstytutsiya") h += constitution();
  else if (cur === "kodeksy") h += parts[1] ? codePage(parts[1]) : codesTab();
  else if (cur === "zakony") h += parts[1] ? lawPage(parts[1]) : lawsTab();
  else h += parts[1] ? casePage(parts[1]) : courtTab();
  return h;
}

// ---------- Конституція ----------
function parseConst(text) {
  const toc = []; let html = "", para = [];
  const flush = () => { if (para.length) { html += `<p>${para.map(esc).join("<br>")}</p>`; para = []; } };
  String(text || "").split(/\r?\n/).forEach(raw => {
    const ln = raw.trim();
    if (!ln) return flush();
    let m;
    if ((m = ln.match(/^#\s+(.+)/)) && !ln.startsWith("##")) { flush(); const id = "k" + toc.length; toc.push({ id, lvl: 1, text: m[1] }); html += `<h2 id="${id}">${esc(m[1])}</h2>`; return; }
    if ((m = ln.match(/^##\s+(.+)/))) { flush(); const id = "k" + toc.length; toc.push({ id, lvl: 2, text: m[1] }); html += `<h3 id="${id}">${esc(m[1])}</h3>`; return; }
    // «Стаття 5. Назва» — заголовок; якщо після номера йде довгий текст, він стає звичайним абзацом
    if ((m = ln.match(/^((?:Стаття|Article|Статья|Artículo|Artykuł)\s+\d+[\w-]*\.?)\s*(.*)$/i))) {
      flush(); const id = "k" + toc.length, long = m[2].length > 70, head = long ? m[1] : ln;
      toc.push({ id, lvl: 2, text: long ? m[1] + " " + m[2].slice(0, 40) + "…" : ln });
      html += `<h3 id="${id}">${esc(head)}</h3>`; if (long) para.push(m[2]); return;
    }
    para.push(ln);
  });
  flush();
  return { toc, html };
}
function constitution() {
  const c = S.constitution, ed = EDIT && canCodes();
  let h = "";
  if (!c || !c.text) {
    h += `<div class="card">${empty(t("lw.noConst"))}</div>`;
    if (canCodes()) h += constEditor(null);
    return h;
  }
  const { toc, html } = parseConst(c.text), basis = c.basis && lawById(c.basis);
  h += `<p class="hint">${esc(t("lw.edition", { x: fmtDate(c.at), n: c.ver || 1 }))}${basis ? ` · ${esc(t("lw.basis"))}: <a href="#/zakon/zakony/${esc(basis.id)}">${esc(lawNo(basis))} «${esc(basis.title)}»</a>` : ""}</p>`;
  h += `<div class="constwrap">${toc.length ? `<nav class="card ctoc" aria-label="${esc(t("lw.toc"))}"><b>${esc(t("lw.toc"))}</b>${toc.map(x => `<a class="l${x.lvl}" href="javascript:void 0" data-jump="${x.id}">${esc(x.text)}</a>`).join("")}</nav>` : ""}
    <article class="card ctext">${html}</article></div>`;
  h += `<details class="card" data-hist><summary><b>🕓 ${esc(t("lw.history"))}</b></summary><div data-histlist><p class="hint">${esc(t("loading"))}</p></div></details>`;
  if (ed) h += constEditor(c);
  return h;
}
function constEditor(c) {
  const laws = S.laws.filter(l => l.kind === "law" && l.status !== "repealed").sort((a, b) => (b.no || 0) - (a.no || 0));
  return `<details class="card"${c ? "" : " open"}><summary><b>✏️ ${esc(t(c ? "lw.constEdit" : "lw.constNew"))}</b></summary>
    <form class="form" data-cform><p class="hint">${esc(t("lw.constFmt"))}</p>
      <textarea name="text" rows="18" maxlength="200000">${esc(c ? c.text : "")}</textarea>
      <label>${esc(t("lw.basis"))}<select name="basis"><option value="">— ${esc(t(c ? "lw.basisNone" : "lw.basisFirst"))} —</option>${laws.map(l => `<option value="${esc(l.id)}">${esc(lawNo(l))} «${esc(l.title)}»</option>`).join("")}</select></label>
      <div class="row end"><button class="primary">${esc(t("save"))}</button></div></form></details>`;
}

// ---------- Кодекси ----------
function codesTab() {
  let h = txt("kodeksy", "intro", t("lw.codesIntro"), { cls: "lead" });
  if (!S.codes.length && canCodes()) h += `<div class="card warn small">${esc(t("lw.noCodes"))} <button type="button" class="sm" data-cseed>${esc(t("lw.seedCodes"))}</button></div>`;
  h += `<div class="lgrid">${S.codes.map(c => {
    const n = S.laws.filter(l => l.code === c.id && l.status !== "repealed").length;
    return `<a class="lcard codecard" href="#/zakon/kodeksy/${esc(c.id)}"><h3>📘 ${esc(c.name)}</h3>${c.desc ? `<p class="hint">${esc(c.desc)}</p>` : ""}<p class="hint">${esc(t("lw.lawsN", { n }))}</p></a>`;
  }).join("") || ""}</div>`;
  if (!S.codes.length) h += `<div class="card">${empty(t("lw.noCodes"))}</div>`;
  if (EDIT && canCodes()) h += `<form class="card row addcode" data-cadd><input name="name" required maxlength="80" placeholder="${esc(t("lw.codeName"))}"><button class="sm primary">+ ${esc(t("lw.addCode"))}</button></form>`;
  return h;
}
let showRepealed = false;
function lawRows(list) {
  return list.length ? `<div class="bills">${list.map(l => {
    const c = code(l.code);
    return `<a class="bill" href="#/zakon/zakony/${esc(l.id)}" data-s="${esc((lawNo(l) + " " + l.title + " " + (c ? c.name : "")).toLowerCase())}"><span class="bst" aria-hidden="true">${l.kind === "decree" ? "🪶" : "📜"}</span><span class="bt"><b>${esc(l.title)}</b>
      <small>${esc(lawNo(l))} · ${esc(fmtDay(l.date))}${c ? " · " + esc(c.name) : ""} · ${LST[l.status] || ""} ${esc(t("lw.st." + (l.status || "active")))}</small></span></a>`;
  }).join("")}</div>` : empty(t("lw.noLaws"));
}
function codePage(id) {
  const c = code(id);
  if (!c) return `<p><a href="#/zakon/kodeksy">← ${esc(t("lw.toCodes"))}</a></p><div class="card">${empty(S.codes.length ? t("lw.codeNotFound") : t("loading"))}</div>`;
  const all = S.laws.filter(l => l.code === id).sort((a, b) => (a.no || 0) - (b.no || 0));
  const rep = all.filter(l => l.status === "repealed").length;
  const list = showRepealed ? all : all.filter(l => l.status !== "repealed");
  const ed = EDIT && canCodes();
  let h = `<p><a href="#/zakon/kodeksy">← ${esc(t("lw.toCodes"))}</a></p><section class="card">`;
  h += ed ? `<form class="form" data-cedit><label>${esc(t("lw.codeName"))}<input name="name" required maxlength="80" value="${esc(c.name)}"></label>
      <label>${esc(t("lw.codeDesc"))}<textarea name="desc" rows="2" maxlength="500">${esc(c.desc || "")}</textarea></label>
      <div class="row"><button class="primary sm">${esc(t("save"))}</button><span class="grow"></span>${isAdmin() ? `<button type="button" class="ghost sm danger" data-cdel>${esc(t("delete"))}</button>` : ""}</div></form>`
    : `<h2>📘 ${esc(c.name)}</h2>${c.desc ? `<p>${esc(c.desc)}</p>` : ""}`;
  h += `</section><section class="card"><div class="row between"><h2>${esc(t("lw.lawsOfCode"))} <span class="badge">${list.length}</span></h2>
    ${rep ? `<label class="fl"><input type="checkbox" data-showrep${showRepealed ? " checked" : ""}> ${esc(t("lw.showRepealed", { n: rep }))}</label>` : ""}</div>${lawRows(list)}</section>`;
  return h;
}

// ---------- Закони й укази ----------
const LF = { kind: "", code: "", st: "" };
function lawsTab() {
  let list = S.laws.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.no || 0) - (a.no || 0));
  if (LF.kind) list = list.filter(l => l.kind === LF.kind);
  if (LF.code) list = list.filter(l => (LF.code === "-" ? !l.code : l.code === LF.code));
  if (LF.st) list = list.filter(l => (l.status || "active") === LF.st);
  let h = txt("zakony", "intro", t("lw.lawsIntro"), { cls: "lead" });
  const btns = [];
  if (canDecree()) btns.push(`<button type="button" class="primary sm" data-newdecree>🪶 ${esc(t("lw.newDecree"))}</button>`);
  if (canCodes()) btns.push(`<button type="button" class="sm" data-newlaw>+ ${esc(t("lw.addLaw"))}</button>`);
  if (btns.length) h += `<div class="row">${btns.join("")}</div>`;
  h += `<section class="card"><div class="filters">
    <input type="search" data-lq placeholder="🔍 ${esc(t("lw.search"))}" aria-label="${esc(t("lw.search"))}">
    <select data-lf="kind" aria-label="${esc(t("lw.kind"))}"><option value="">${esc(t("lw.allKinds"))}</option><option value="law"${LF.kind === "law" ? " selected" : ""}>📜 ${esc(t("lw.kind.law"))}</option><option value="decree"${LF.kind === "decree" ? " selected" : ""}>🪶 ${esc(t("lw.kind.decree"))}</option></select>
    <select data-lf="code" aria-label="${esc(t("lw.code"))}"><option value="">${esc(t("lw.allCodes"))}</option><option value="-"${LF.code === "-" ? " selected" : ""}>${esc(t("lw.noCode"))}</option>${S.codes.map(c => `<option value="${esc(c.id)}"${LF.code === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
    <select data-lf="st" aria-label="${esc(t("lw.status"))}"><option value="">${esc(t("lw.allSt"))}</option>${Object.keys(LST).map(k => `<option value="${k}"${LF.st === k ? " selected" : ""}>${LST[k]} ${esc(t("lw.st." + k))}</option>`).join("")}</select>
  </div>${lawRows(list)}<p class="empty" data-lnone hidden>${esc(t("lw.nothing"))}</p></section>`;
  return h;
}
function lawPage(id) {
  const l = lawById(id);
  if (!l) return `<p><a href="#/zakon/zakony">← ${esc(t("lw.toLaws"))}</a></p><div class="card">${empty(S.laws.length ? t("lw.lawNotFound") : t("loading"))}</div>`;
  const c = code(l.code), bill = l.bill && S.bills.find(b => b.id === l.bill), by = player(l.by), cs = l.case && cases().find(x => x.id === l.case);
  const ed = EDIT && canCodes();
  let h = `<p><a href="#/zakon/zakony">← ${esc(t("lw.toLaws"))}</a></p><section class="card billcard">
    <p class="tags"><span class="tag">${l.kind === "decree" ? "🪶" : "📜"} ${esc(lawNo(l))}</span><span class="tag">${LST[l.status] || ""} ${esc(t("lw.st." + (l.status || "active")))}</span>${c ? `<a class="tag" href="#/zakon/kodeksy/${esc(c.id)}">📘 ${esc(c.name)}</a>` : ""}<span class="tag">📅 ${esc(fmtDay(l.date))}</span></p>
    <h1>${esc(l.title)}</h1>
    <p class="hint">${l.kind === "decree" ? esc(t("lw.byHetman", { x: by ? by.name : "—" })) : esc(t("lw.byChamber")) + (by ? " · " + esc(t("lw.signedBy", { x: by.name })) : "")}
      ${bill ? ` · <a href="#/derzhava/palata/${esc(bill.id)}">${esc(t("lw.openBill"))}</a>` : ""}${cs ? ` · <a href="#/zakon/sud/${esc(cs.id)}">${esc(t("lw.openCase", { n: cs.no || "?" }))}</a>` : ""}</p>
    ${l.note ? `<p class="note">${esc(l.note)}</p>` : ""}
    <div class="billtext">${paras(l.text)}</div></section>`;
  if (ed) h += `<section class="card"><h2>✏️ ${esc(t("edit"))}</h2><form class="form" data-ledit>
    <div class="row2"><label>${esc(t("lw.status"))}<select name="status">${Object.keys(LST).map(k => `<option value="${k}"${(l.status || "active") === k ? " selected" : ""}>${LST[k]} ${esc(t("lw.st." + k))}</option>`).join("")}</select></label>
    <label>${esc(t("lw.code"))}<select name="code"><option value="">— ${esc(t("lw.noCode"))} —</option>${S.codes.map(x => `<option value="${esc(x.id)}"${l.code === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label></div>
    <label>${esc(t("lw.note"))}<input name="note" maxlength="300" value="${esc(l.note || "")}" placeholder="${esc(t("lw.notePh"))}"></label>
    <label>${esc(t("lw.title"))}<input name="title" required maxlength="150" value="${esc(l.title)}"></label>
    <label>${esc(t("lw.text"))}<textarea name="text" rows="8" maxlength="30000">${esc(l.text || "")}</textarea></label>
    <div class="row"><button class="primary">${esc(t("save"))}</button><span class="grow"></span>${isAdmin() ? `<button type="button" class="ghost danger sm" data-ldel>${esc(t("delete"))}</button>` : ""}</div></form></section>`;
  return h;
}
function lawForm(kind) {
  const w = modal(t(kind === "decree" ? "lw.newDecree" : "lw.addLaw"), `<form class="form" data-lnew>
    <label>${esc(t("lw.title"))}<input name="title" required maxlength="150"></label>
    <div class="row2"><label>${esc(t("lw.date"))}<input type="date" name="date" value="${todayIso()}"></label>
    ${kind === "law" ? `<label>${esc(t("lw.code"))}<select name="code"><option value="">— ${esc(t("lw.noCode"))} —</option>${S.codes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></label>` : "<span></span>"}</div>
    <label>${esc(t("lw.text"))}<textarea name="text" rows="10" maxlength="30000" required></textarea></label>
    ${kind === "law" ? `<p class="hint">${esc(t("lw.addLawHint"))}</p>` : ""}
    <div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t(kind === "decree" ? "lw.sign" : "save"))}</button></div></form>`, { wide: true });
  w.querySelector("[data-lnew]").onsubmit = async e => {
    e.preventDefault(); const f = e.target, m = me();
    const id = B.newId("ud_laws");
    const v = { kind, no: nextNo(kind), title: f.title.value.trim().slice(0, 150), text: f.text.value.slice(0, 30000), code: kind === "law" ? f.code.value : "",
      status: "active", date: f.date.value || todayIso(), by: kind === "decree" ? (m ? m.id : "") : "", at: B.now() };
    if (await run(() => B.set("ud_laws", id, v), t("saved"))) { log("law", `${lawNo(v)} ${v.title}`); closeModal(); go("zakon/zakony/" + id); }
  };
}

// ---------- Суд ----------
const judgePos = () => JUDGES.map(pos).filter(Boolean);
const TERM = 60 * 864e5;   // повноваження судді — 2 місяці
function courtTab() {
  const m = me();
  let h = txt("sud", "intro", t("lw.courtIntro"), { cls: "lead" });
  const jp = judgePos();
  h += `<section class="card"><h2>👨‍⚖️ ${esc(t("lw.judges"))}</h2>`;
  if (!jp.length) h += empty(t("lw.noJudgePos")) + (isAdmin() ? `<button type="button" class="sm" data-jseed>${esc(t("lw.seedJudges"))}</button>` : "");
  else h += `<div class="pgrid">${jp.map(p => {
    const pl = player(p.holder), until = pl && ms(p.since) ? ms(p.since) + TERM : 0;
    return `<div class="pcard">${avatar(pl || { name: "?" }, "av lg")}<div class="pct"><small>${esc(p.title)}</small>${EDIT && isAdmin() ? holderSel(p) : `<b>${pl ? `<a href="#/narod/gravets/${esc(pl.id)}">${esc(pl.name)}</a>` : `<i class="vac">${esc(t("vacant"))}</i>`}</b>`}
      ${until ? `<small class="${until < Date.now() ? "warn" : "hint"}">${esc(t(until < Date.now() ? "lw.termOver" : "lw.termUntil", { x: fmtDate(until) }))}</small>` : !pl ? `<a class="hint" href="#/derzhava/vybory">${esc(t("map.byElection"))}</a>` : ""}</div></div>`;
  }).join("")}</div>`;
  h += `</section>`;
  if (m) h += `<details class="card newbill"><summary><b>📨 ${esc(t("lw.file"))}</b></summary>
    <form class="form" data-fcase><p class="hint">${esc(t("lw.fileHint"))}</p>
      <label>${esc(t("lw.defendant"))}<select name="def" required><option value="">—</option>${S.players.filter(p => p.id !== m.id).sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
      <label>${esc(t("lw.caseTitle"))}<input name="title" required maxlength="150" placeholder="${esc(t("lw.caseTitlePh"))}"></label>
      <label>${esc(t("lw.claim"))}<textarea name="text" rows="6" maxlength="10000" required placeholder="${esc(t("lw.claimPh"))}"></textarea></label>
      <label class="chk"><input type="checkbox" name="closed"> 🔒 ${esc(t("lw.closedCase"))}</label>
      ${holds("prosecutor") ? `<label class="chk"><input type="checkbox" name="state"> 🏛 ${esc(t("lw.forState"))}</label>` : ""}
      <div class="row end"><button class="primary">${esc(t("lw.submit"))}</button></div></form></details>`;
  else if (!S.user) h += `<p class="hint">${esc(t("lw.loginToFile"))}</p>`;
  const all = cases().sort((a, b) => (b.no || 0) - (a.no || 0));
  const act = all.filter(c => ["filed", "accepted", "hearing"].includes(c.status)), done = all.filter(c => !["filed", "accepted", "hearing"].includes(c.status));
  const row = c => `<a class="bill" href="#/zakon/sud/${esc(c.id)}"><span class="bst" aria-hidden="true">${CST[c.status] || "•"}</span><span class="bt"><b>${c.closed ? "🔒 " : ""}${esc(t("lw.caseNo", { n: c.no || "?" }))}: ${esc(c.title)}</b>
    <small>${esc(nm(c.forState ? "state" : c.plaintiff))} ⟶ ${esc(nm(c.defendant))} · ${esc(t("lw.cst." + c.status))}${c.judge ? " · 👨‍⚖️ " + esc(nm(c.judge)) : ""}${c.pardon ? " · 🕊 " + esc(t("lw.pardoned")) : ""}</small></span></a>`;
  h += `<section class="card"><h2>${esc(t("lw.activeCases"))} <span class="badge">${act.length}</span></h2>${act.length ? `<div class="bills">${act.map(row).join("")}</div>` : empty(t("lw.noCases"))}</section>`;
  if (done.length) h += `<details class="card"><summary><b>${esc(t("lw.doneCases"))}</b> <span class="badge">${done.length}</span></summary><div class="bills">${done.map(row).join("")}</div></details>`;
  return h;
}

const CUR = { id: "", msgs: [], un: null };
function watchCase(id) {
  if (CUR.id === id) return;
  if (CUR.un) { try { CUR.un(); } catch (_) {} }
  Object.assign(CUR, { id, msgs: [], un: null });
  if (id) CUR.un = B.watch(`ud_cases/${id}/msgs`, r => { CUR.msgs = r.sort((a, b) => ms(a.at) - ms(b.at)); changed(); }, () => {});
}
function casePage(id) {
  const c = cases().find(x => x.id === id), m = me();
  if (!c) { watchCase(""); return `<p><a href="#/zakon/sud">← ${esc(t("lw.toCourt"))}</a></p><div class="card">${empty(t("lw.caseNotFound"))}</div>`; }
  watchCase(id);
  const iJudge = m && c.judge === m.id, party = m && (c.parties || []).includes(m.id);
  let h = `<p><a href="#/zakon/sud">← ${esc(t("lw.toCourt"))}</a></p><section class="card billcard">
    <p class="tags"><span class="tag">${CST[c.status] || ""} ${esc(t("lw.cst." + c.status))}</span>${c.closed ? `<span class="tag">🔒 ${esc(t("lw.closed"))}</span>` : ""}<span class="tag">📅 ${esc(fmtDate(c.at))}</span>${c.pardon ? `<span class="tag">🕊 ${esc(t("lw.pardoned"))}</span>` : ""}</p>
    <h1>${esc(t("lw.caseNo", { n: c.no || "?" }))}: ${esc(c.title)}</h1>
    <div class="parties">${[["lw.plaintiff", c.forState ? "state" : c.plaintiff], ["lw.defendant", c.defendant], ["lw.judge", c.judge]].map(([k, pid]) => {
      const pl = pid && pid !== "state" ? player(pid) : null;
      return `<div class="party">${pid === "state" ? `<span class="av md ini" aria-hidden="true">🏛</span>` : avatar(pl || { name: "?" }, "av md")}<span><small>${esc(t(k))}</small><b>${pid === "state" ? esc(t("lw.state")) + (c.plaintiff ? ` <small class="hint">(${esc(t("lw.prosecutorX", { x: nm(c.plaintiff) }))})</small>` : "") : pl ? `<a href="#/narod/gravets/${esc(pl.id)}">${esc(pl.name)}</a>` : `<i class="vac">${esc(t(k === "lw.judge" ? "lw.noJudge" : "vacant"))}</i>`}</b></span></div>`;
    }).join("")}</div>
    <h2>${esc(t("lw.claim"))}</h2><div class="billtext">${paras(c.text)}</div></section>`;
  // вирок
  if (c.status === "verdict" || c.status === "rejected") {
    const cited = (c.laws || []).map(lawById).filter(Boolean), pd = c.pardon && lawById(c.pardon);
    h += `<section class="card verdict"><h2>${c.status === "verdict" ? "⚖️ " + esc(t("lw.verdict")) : "❌ " + esc(t("lw.rejectedT"))}</h2>${c.decidedAt ? `<p class="hint">${esc(fmtDate(c.decidedAt))} · ${esc(t("lw.judge"))}: ${esc(nm(c.judge))}</p>` : ""}
      <div class="billtext">${paras(c.verdict)}</div>
      ${c.sentence ? `<p><b>${esc(t("lw.sentence"))}:</b> ${esc(c.sentence)}</p>` : ""}
      ${c.banUntil ? `<p class="ban">⛔ ${esc(t("lw.banText", { x: nm(c.defendant), d: fmtDay(c.banUntil) }))}${c.pardon ? " — " + esc(t("lw.pardonLifts")) : ""}</p>` : ""}
      ${cited.length ? `<p><b>${esc(t("lw.cited"))}:</b></p><ul class="vlist">${cited.map(l => `<li><a href="#/zakon/zakony/${esc(l.id)}">${esc(lawNo(l))} «${esc(l.title)}»</a>${code(l.code) ? ` — ${esc(code(l.code).name)}` : ""}</li>`).join("")}</ul>` : ""}
      ${pd ? `<p>🕊 <a href="#/zakon/zakony/${esc(pd.id)}">${esc(t("lw.pardonBy", { x: lawNo(pd) }))}</a></p>` : ""}</section>`;
  }
  // дії
  const acts = [];
  if (m && isJudge() && c.status === "filed" && !party) acts.push(`<button type="button" class="primary" data-take>👨‍⚖️ ${esc(t("lw.take"))}</button>`);
  if (m && isJudge() && c.status === "filed" && party) acts.push(`<p class="hint">${esc(t("lw.partyJudge"))}</p>`);
  if ((iJudge || isAdmin()) && c.status === "accepted") acts.push(`<button type="button" class="primary" data-cst="hearing">🔨 ${esc(t("lw.startHearing"))}</button>`);
  if ((iJudge || isAdmin()) && ["accepted", "hearing"].includes(c.status)) acts.push(`<button type="button" class="ghost danger sm" data-reject>${esc(t("lw.reject"))}</button>`, `<button type="button" class="ghost sm" data-closed>${c.closed ? "🔓 " + esc(t("lw.open")) : "🔒 " + esc(t("lw.close"))}</button>`);
  if (m && c.plaintiff === m.id && c.status === "filed") acts.push(`<button type="button" class="ghost danger sm" data-cwithdraw>${esc(t("lw.withdraw"))}</button>`);
  if (isHetman() && c.status === "verdict" && !c.pardon) acts.push(`<button type="button" data-pardon>🕊 ${esc(t("lw.pardon"))}</button>`);
  if (isAdmin()) acts.push(`<button type="button" class="ghost danger sm" data-casedel>${esc(t("delete"))}</button>`);
  if (acts.length) h += `<section class="card"><div class="row">${acts.join("")}</div></section>`;
  // форма вироку
  if ((iJudge || isAdmin()) && c.status === "hearing") {
    const laws = S.laws.filter(l => l.status !== "repealed").sort((a, b) => (a.kind > b.kind ? 1 : -1) || (a.no || 0) - (b.no || 0));
    h += `<details class="card newbill"><summary><b>⚖️ ${esc(t("lw.giveVerdict"))}</b></summary><form class="form" data-verdict>
      <label>${esc(t("lw.verdictText"))}<textarea name="verdict" rows="6" maxlength="10000" required></textarea></label>
      <label>${esc(t("lw.sentence"))}<input name="sentence" maxlength="300" placeholder="${esc(t("lw.sentencePh"))}"></label>
      <fieldset class="lawpick"><legend>${esc(t("lw.cited"))}</legend>${laws.length ? laws.map(l => `<label class="chk"><input type="checkbox" name="law" value="${esc(l.id)}"> ${esc(lawNo(l))} «${esc(l.title)}»${code(l.code) ? ` <small class="hint">${esc(code(l.code).name)}</small>` : ""}</label>`).join("") : `<p class="hint">${esc(t("lw.noLaws"))}</p>`}</fieldset>
      <label>${esc(t("lw.banUntil"))}<input type="date" name="ban" min="${todayIso()}"></label><p class="hint">${esc(t("lw.banHint"))}</p>
      <div class="row end"><button class="primary">${esc(t("lw.announce"))}</button></div></form></details>`;
  }
  // засідання
  const canWrite = m && ["accepted", "hearing"].includes(c.status) && (party || holds("prosecutor") || isAdmin());
  if (c.status !== "filed" || CUR.msgs.length) {
    h += `<section class="card"><h2>🔨 ${esc(t("lw.hearing"))} <span class="badge">${CUR.msgs.length}</span></h2>${CUR.msgs.map(x => { const p = player(x.by);
      return `<div class="cmt">${avatar(p || { name: "?" }, "av sm")}<div><b>${esc(p ? p.name : "?")}</b>${x.by === c.judge ? ` <span class="tag">👨‍⚖️</span>` : ""} <span class="hint">${esc(fmtDate(x.at))}</span>${isAdmin() ? ` <button type="button" class="ghost sm" data-mdel="${esc(x.id)}" aria-label="${esc(t("delete"))}">✕</button>` : ""}<p>${esc(x.text)}</p></div></div>`; }).join("") || empty(t("lw.noMsgs"))}
      ${canWrite ? `<form class="cmtform" data-msg><textarea name="text" rows="2" maxlength="2000" required placeholder="${esc(t("lw.msgPh"))}"></textarea><button class="sm">${esc(t("ch.send"))}</button></form>` : ""}</section>`;
  }
  return h;
}

// ---------- дії ----------
export function mount(root, parts) {
  const cur = parts[0] || "konstytutsiya";
  if (cur !== "sud" || !parts[1]) watchCase("");
  if (cur === "konstytutsiya") return mountConst(root);
  if (cur === "kodeksy") return mountCodes(root, parts);
  if (cur === "zakony") return mountLaws(root, parts);
  return mountCourt(root, parts);
}
function mountConst(root) {
  root.querySelectorAll("[data-jump]").forEach(a => a.onclick = () => { const el = document.getElementById(a.dataset.jump); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
  const hd = root.querySelector("[data-hist]");
  if (hd) hd.ontoggle = async () => {
    if (!hd.open) return;
    const box = hd.querySelector("[data-histlist]");
    try {
      const r = (await B.list("ud_law/constitution/hist")).sort((a, b) => (b.ver || 0) - (a.ver || 0));
      box.innerHTML = r.length ? `<ul class="vlist">${r.map(x => { const bl = x.basis && lawById(x.basis);
        return `<li><a href="javascript:void 0" data-ver="${esc(x.id)}">${esc(t("lw.verN", { n: x.ver }))}</a> — ${esc(fmtDate(x.at))}${bl ? " · " + esc(lawNo(bl)) : ""}</li>`; }).join("")}</ul>` : empty("—");
      box.querySelectorAll("[data-ver]").forEach(a => a.onclick = () => { const x = r.find(y => y.id === a.dataset.ver); modal(t("lw.verN", { n: x.ver }), `<article class="ctext">${parseConst(x.text).html}</article>`, { wide: true }); });
    } catch (e) { box.innerHTML = `<p class="warn">${esc(String(e.message || e))}</p>`; }
  };
  const f = root.querySelector("[data-cform]");
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const ver = ((S.constitution && S.constitution.ver) || 0) + 1, m = me();
    const v = { text: f.text.value.slice(0, 200000), basis: f.basis.value, ver, by: m ? m.id : "", at: B.now() };
    if (!v.text.trim()) return;
    if (await run(() => B.batch([{ op: "set", c: "ud_law", id: "constitution", v }, { op: "set", c: "ud_law/constitution/hist", id: "v" + ver, v }]), t("saved")))
      log("law", t("lw.verN", { n: ver }));
  };
}
function mountCodes(root, parts) {
  const sd = root.querySelector("[data-cseed]");
  if (sd) sd.onclick = async () => { if (await run(() => B.batch(DEFAULT_CODES.map(([id, name], i) => ({ op: "set", c: "ud_codes", id, v: { name, desc: "", order: i } }))), t("saved"))) log("code", t("lw.seedCodes")); };
  const ca = root.querySelector("[data-cadd]");
  if (ca) ca.onsubmit = async e => {
    e.preventDefault(); const name = ca.name.value.trim().slice(0, 80); if (!name) return;
    const order = Math.max(0, ...S.codes.map(c => c.order || 0)) + 1;
    if (await run(() => B.set("ud_codes", B.newId("ud_codes"), { name, desc: "", order }), t("saved"))) { log("code", "+ " + name); ca.reset(); }
  };
  const sr = root.querySelector("[data-showrep]"); if (sr) sr.onchange = () => { showRepealed = sr.checked; changed(); };
  const ce = root.querySelector("[data-cedit]"), c = parts[1] && code(parts[1]);
  if (ce && c) ce.onsubmit = async e => { e.preventDefault(); if (await run(() => B.update("ud_codes", c.id, { name: ce.name.value.trim().slice(0, 80) || c.name, desc: ce.desc.value.trim().slice(0, 500) }), t("saved"))) log("code", c.name); };
  const cd = root.querySelector("[data-cdel]");
  if (cd && c) cd.onclick = async () => {
    if (S.laws.some(l => l.code === c.id)) return toast(t("lw.codeHasLaws"), "err");
    if (await confirmBox(t("lw.delCodeQ", { x: c.name }), t("delete")) && await run(() => B.del("ud_codes", c.id), t("deleted"))) { log("code", "− " + c.name); go("zakon/kodeksy"); }
  };
}
function mountLaws(root, parts) {
  const nd = root.querySelector("[data-newdecree]"); if (nd) nd.onclick = () => lawForm("decree");
  const nl = root.querySelector("[data-newlaw]"); if (nl) nl.onclick = () => lawForm("law");
  root.querySelectorAll("[data-lf]").forEach(s => s.onchange = () => { LF[s.dataset.lf] = s.value; changed(); });
  const q = root.querySelector("[data-lq]");
  if (q) q.oninput = () => {
    const v = q.value.trim().toLowerCase(); let n = 0;
    root.querySelectorAll("[data-s]").forEach(r => { const ok = !v || r.dataset.s.includes(v); r.hidden = !ok; if (ok) n++; });
    const none = root.querySelector("[data-lnone]"); if (none) none.hidden = n > 0;
  };
  const l = parts[1] && lawById(parts[1]);
  const le = root.querySelector("[data-ledit]");
  if (le && l) le.onsubmit = async e => {
    e.preventDefault();
    const v = { status: le.status.value, code: l.kind === "law" ? le.code.value : (l.code || ""), note: le.note.value.trim().slice(0, 300), title: le.title.value.trim().slice(0, 150) || l.title, text: le.text.value.slice(0, 30000) };
    if (await run(() => B.update("ud_laws", l.id, v), t("saved"))) log("law", `${lawNo(l)}: ${t("lw.st." + v.status)}`);
  };
  const ld = root.querySelector("[data-ldel]");
  if (ld && l) ld.onclick = async () => { if (await confirmBox(t("lw.delLawQ"), t("delete")) && await run(() => B.del("ud_laws", l.id), t("deleted"))) { log("law", `${t("deleted")}: ${lawNo(l)}`); go("zakon/zakony"); } };
}
function mountCourt(root, parts) {
  bindHolders(root);
  const js = root.querySelector("[data-jseed]");
  if (js) js.onclick = async () => { if (await run(() => B.batch(JUDGES.map((id, i) => ({ op: "set", c: "ud_positions", id, v: { title: `Суддя ${i + 1}`, order: 30 + i, appointBy: "election", holder: "", court: true } }))), t("saved"))) log("position", t("lw.seedJudges")); };
  const fc = root.querySelector("[data-fcase]");
  if (fc) fc.onsubmit = async e => {
    e.preventDefault(); const m = me(); if (!m) return;
    const def = fc.def.value; if (!def) return;
    const no = ((S.caseCounter && S.caseCounter.n) || 0) + 1;
    const id = B.newId("ud_cases");
    const v = { no, title: fc.title.value.trim().slice(0, 150), text: fc.text.value.slice(0, 10000), plaintiff: m.id, defendant: def, forState: !!(fc.state && fc.state.checked),
      closed: !!fc.closed.checked, status: "filed", judge: "", parties: [m.id, def], at: B.now() };
    if (await run(() => B.batch([{ op: "set", c: "ud_counters", id: "cases", v: { n: no } }, { op: "set", c: "ud_cases", id, v }]), t("lw.filed"))) { log("court", `${t("lw.caseNo", { n: no })}: ${v.title}`); go("zakon/sud/" + id); }
  };
  const c = parts[1] && cases().find(x => x.id === parts[1]); if (!c) return;
  const m = me();
  const upd = (v, msg, txt) => run(() => B.update("ud_cases", c.id, v), msg || t("saved")).then(ok => { if (ok && txt) log("court", `${t("lw.caseNo", { n: c.no })}: ${txt}`); return ok; });
  const tk = root.querySelector("[data-take]"); if (tk) tk.onclick = () => upd({ status: "accepted", judge: m.id, parties: [...(c.parties || []), m.id] }, t("saved"), t("lw.cst.accepted"));
  root.querySelectorAll("[data-cst]").forEach(b => b.onclick = () => upd({ status: b.dataset.cst }, t("saved"), t("lw.cst." + b.dataset.cst)));
  const rj = root.querySelector("[data-reject]");
  if (rj) rj.onclick = async () => {
    const w = modal(t("lw.reject"), `<form class="form" data-rj><label>${esc(t("lw.rejectWhy"))}<textarea name="why" rows="4" maxlength="3000" required></textarea></label><div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="danger">${esc(t("lw.reject"))}</button></div></form>`);
    w.querySelector("[data-rj]").onsubmit = async e => { e.preventDefault(); if (await upd({ status: "rejected", verdict: e.target.why.value.slice(0, 3000), decidedAt: B.now() }, t("saved"), t("lw.cst.rejected"))) closeModal(); };
  };
  const cl = root.querySelector("[data-closed]"); if (cl) cl.onclick = () => upd({ closed: !c.closed }, t("saved"), c.closed ? t("lw.open") : t("lw.close"));
  const wd = root.querySelector("[data-cwithdraw]"); if (wd) wd.onclick = async () => { if (await confirmBox(t("lw.withdrawQ"), t("lw.withdraw"))) upd({ status: "withdrawn" }, t("saved"), t("lw.cst.withdrawn")); };
  const vf = root.querySelector("[data-verdict]");
  if (vf) vf.onsubmit = async e => {
    e.preventDefault();
    if (!(await confirmBox(t("lw.verdictQ"), t("lw.announce")))) return;
    const laws = [...vf.querySelectorAll("[name=law]:checked")].map(x => x.value);
    upd({ status: "verdict", verdict: vf.verdict.value.slice(0, 10000), sentence: vf.sentence.value.trim().slice(0, 300), laws, banUntil: vf.ban.value || "", decidedAt: B.now() }, t("lw.verdictDone"), t("lw.cst.verdict"));
  };
  const pd = root.querySelector("[data-pardon]");
  if (pd) pd.onclick = async () => {
    const who = nm(c.defendant);
    const w = modal(t("lw.pardon"), `<form class="form" data-pf><p>${esc(t("lw.pardonHint", { x: who }))}</p><label>${esc(t("lw.text"))}<textarea name="text" rows="5" maxlength="5000">${esc(t("lw.pardonText", { x: who, n: c.no }))}</textarea></label>
      <div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">🕊 ${esc(t("lw.pardon"))}</button></div></form>`);
    w.querySelector("[data-pf]").onsubmit = async e => {
      e.preventDefault();
      const lid = B.newId("ud_laws");
      const v = { kind: "decree", no: nextNo("decree"), title: t("lw.pardonTitle", { x: who, n: c.no }), text: e.target.text.value.slice(0, 5000), code: "", status: "active", date: todayIso(), by: m.id, case: c.id, at: B.now() };
      if (await run(() => B.batch([{ op: "set", c: "ud_laws", id: lid, v }, { op: "update", c: "ud_cases", id: c.id, v: { pardon: lid } }]), t("saved"))) { log("court", `🕊 ${v.title}`); closeModal(); }
    };
  };
  const dl = root.querySelector("[data-casedel]");
  if (dl) dl.onclick = async () => { if (await confirmBox(t("lw.delCaseQ"), t("delete")) && await run(() => B.del("ud_cases", c.id), t("deleted"))) { log("court", `${t("deleted")}: ${t("lw.caseNo", { n: c.no })}`); go("zakon/sud"); } };
  const mf = root.querySelector("[data-msg]");
  if (mf) mf.onsubmit = async e => { e.preventDefault(); const text = mf.text.value.trim(); if (!text) return; if (await run(() => B.add(`ud_cases/${c.id}/msgs`, { by: m.id, text: text.slice(0, 2000), at: B.now() }))) mf.reset(); };
  root.querySelectorAll("[data-mdel]").forEach(b => b.onclick = () => run(() => B.del(`ud_cases/${c.id}/msgs`, b.dataset.mdel)));
}
