// ⛪ Церква: Патріарх, духовенство, парафії, Статут Церкви, календар церковних і державних свят.
import { S, B, me, pos, player, lands, land, isAdmin, canChurch, canHolidays, log, ms } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, toast } from "../ui.js";
import { txt, empty, paras } from "./common.js";
import { pickImage, fmtDate } from "../ui.js";
import { docDialog } from "../docimg.js";

const SANY = ["Митрополит", "Архієпископ", "Єпископ", "Протоієрей", "Священник", "Диякон"];
const lng = () => document.documentElement.lang || "uk";
// найближча дата свята: щорічне (MM-DD) — цього або наступного року; разове (YYYY-MM-DD) — як є
export function nextDate(h) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (h.yearly) {
    const [m, d] = String(h.date || "").slice(-5).split("-").map(Number); if (!m || !d) return null;
    let x = new Date(now.getFullYear(), m - 1, d); if (x < now) x = new Date(now.getFullYear() + 1, m - 1, d); return x;
  }
  const x = new Date(String(h.date || "") + "T00:00:00"); return isNaN(x) || x < now ? null : x;
}
export function upcoming(n) {
  return S.holidays.map(h => ({ h, d: nextDate(h) })).filter(x => x.d).sort((a, b) => a.d - b.d).slice(0, n);
}
const daysTo = d => { const n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((d - n) / 864e5); };

const CTABS = [["eparkhii", "⛪", "chu.t.ep"], ["dukhovenstvo", "🕯", "chu.t.cl"], ["poslannya", "✉️", "chu.t.msg"], ["postanovy", "📜", "chu.t.dec"], ["statut", "📖", "chu.t.st"], ["kalendar", "📅", "chu.t.cal"]];
export const churchName = () => ((S.church && S.church.title) || t("chu.name"));
export function render(parts = []) {
  const ed = EDIT && canChurch(), c = S.church || {};
  const sub = CTABS.some(x => x[0] === parts[1]) ? parts[1] : "eparkhii";
  const msgs = S.chdocs.filter(x => x.kind === "msg"), decs = S.chdocs.filter(x => x.kind === "dec");
  let h = txt("tserkva", "intro", t("chu.intro"), { cls: "lead" });
  const pat = pos("patriarch"), pp = pat && player(pat.holder);
  h += `<section class="card chhero"><div class="chtop">${c.emblem ? `<img class="chemb" src="${esc(c.emblem)}" alt="${esc(t("chu.emblem"))}">` : `<div class="chemb none" aria-hidden="true">✝</div>`}
    <div class="chtx"><h2>${esc(churchName())}</h2>${c.note ? `<p class="hint">${esc(c.note)}</p>` : ""}
      <div class="dchips"><span class="tag">⛪ ${esc(t("chu.t.ep"))}: <b>${S.eparchies.length}</b></span><span class="tag">🕯 ${esc(t("chu.clergy"))}: <b>${S.clergy.length}</b></span><span class="tag">📜 ${esc(t("chu.t.dec"))}: <b>${decs.length}</b></span></div>
      ${ed ? `<div class="row"><button type="button" class="ghost sm" data-chemb>🖼 ${esc(t(c.emblem ? "chu.embChange" : "chu.embUpload"))}</button>${c.emblem ? `<button type="button" class="ghost sm danger" data-chembdel>✕</button>` : ""}</div>` : ""}</div></div>
    <div class="pcard big">${avatar(pp || { name: "?" }, "av xl")}<div class="pct"><small>${esc(pat ? pat.title : t("chu.patriarch"))}</small>
    <b>${pp ? `<a href="#/narod/gravets/${esc(pp.id)}">${esc(pp.name)}</a>` : `<i class="vac">${esc(t("vacant"))}</i>`}</b>
    ${!pat && isAdmin() ? `<button type="button" class="sm" data-patseed>${esc(t("chu.seedPat"))}</button>` : ""}
    ${pat && EDIT && isAdmin() ? `<select data-pathold aria-label="${esc(t("chu.patriarch"))}"><option value="">— ${esc(t("vacant"))} —</option>${S.players.filter(p => p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}"${p.id === pat.holder ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` : ""}</div></div>
    ${c.about ? `<div class="billtext">${paras(c.about)}</div>` : ""}</section>`;
  h += `<div class="tabs sub" role="tablist">${CTABS.map(([k, ic, l]) => `<a role="tab" href="#/narod/tserkva/${k}" class="${k === sub ? "act" : ""}" aria-selected="${k === sub}"><span aria-hidden="true">${ic}</span> ${esc(t(l))}</a>`).join("")}</div>`;
  const part = {};
  // календар
  const up = upcoming(50);
  part.kalendar = `<section class="card"><div class="row between"><h2>📅 ${esc(t("chu.calendar"))}</h2><a class="btn sm" href="#/derzhava/kalendar">🗓 ${esc(t("cal.open"))}</a></div>${up.length ? `<div class="hlist">${up.map(({ h: x, d }) => {
    const n = daysTo(d);
    return `<div class="hday k-${esc(x.kind)}"><div class="hdate"><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString(lng(), { month: "short" }))}</small></div>
      <div class="grow"><b>${x.kind === "church" ? "⛪" : "🏛"} ${esc(x.name)}</b>${x.desc ? `<small class="hint">${esc(x.desc)}</small>` : ""}</div>
      <span class="tag">${n === 0 ? esc(t("chu.today")) : esc(t("chu.inDays", { n }))}</span>${EDIT && canHolidays(x.kind) ? `<button type="button" class="ghost sm danger" data-hdel="${esc(x.id)}" aria-label="${esc(t("delete"))}">✕</button>` : ""}</div>`; }).join("")}</div>` : empty(t("chu.noHolidays"))}
    ${EDIT && (canHolidays("church") || canHolidays("state")) ? `<form class="form addhol" data-hadd><div class="row2"><label>${esc(t("chu.hName"))}<input name="name" required maxlength="80"></label><label>${esc(t("chu.hDate"))}<input type="date" name="date" required></label></div>
      <div class="row2"><label>${esc(t("chu.hKind"))}<select name="kind">${canHolidays("church") ? `<option value="church">⛪ ${esc(t("chu.kChurch"))}</option>` : ""}${canHolidays("state") ? `<option value="state">🏛 ${esc(t("chu.kState"))}</option>` : ""}</select></label>
      <label class="chk"><input type="checkbox" name="yearly" checked> ${esc(t("chu.yearly"))}</label></div>
      <label>${esc(t("chu.hDesc"))}<input name="desc" maxlength="200"></label><div class="row end"><button class="sm primary">+ ${esc(t("chu.addHoliday"))}</button></div></form>` : ""}</section>`;
  // духовенство
  part.dukhovenstvo = `<section class="card"><h2>🕯 ${esc(t("chu.clergy"))} <span class="badge">${S.clergy.length}</span></h2>${S.clergy.length ? `<div class="pgrid">${S.clergy.map(x => { const p = player(x.pid), pr = S.parishes.find(y => y.id === x.parish);
      return `<div class="pcard">${avatar(p || { name: "?" }, "av lg")}<div class="pct"><small>${esc(x.title)}</small><b>${p ? `<a href="#/narod/gravets/${esc(p.id)}">${esc(p.name)}</a>` : "?"}</b>${pr ? `<small class="hint">⛪ ${esc(pr.name)}</small>` : ""}
        ${ed ? `<button type="button" class="ghost sm danger" data-cldel="${esc(x.id)}">${esc(t("delete"))}</button>` : ""}</div></div>`; }).join("")}</div>` : empty(t("chu.noClergy"))}
    ${ed ? `<form class="row addcode" data-cladd><select name="pid" required><option value="">${esc(t("chu.who"))}</option>${S.players.filter(p => p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>
      <input name="title" required maxlength="40" list="sany" placeholder="${esc(t("chu.san"))}"><datalist id="sany">${SANY.map(x => `<option value="${x}">`).join("")}</datalist>
      <select name="parish"><option value="">— ${esc(t("chu.noParish"))} —</option>${S.parishes.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select><button class="sm primary">+</button></form>` : ""}</section>`;
  // єпархії й парафії
  part.eparkhii = eparchies(ed) + `<section class="card"><h2>⛪ ${esc(t("chu.parishes"))} <span class="badge">${S.parishes.length}</span></h2>${S.parishes.length ? `<div class="lgrid">${S.parishes.map(x => { const L = land(x.land), pr = player(x.priest);
      return `<div class="lcard" style="--lc:${esc((L && L.color) || "#c9a227")}"><h3>${esc(x.name)}</h3><p class="hint">${L ? "🗺 " + esc(L.name) : ""}${pr ? ` · 🕯 ${esc(pr.name)}` : ""}</p>${x.desc ? `<p class="hint">${esc(x.desc)}</p>` : ""}
        ${ed ? `<button type="button" class="ghost sm" data-paredit="${esc(x.id)}">✏️</button>` : ""}</div>`; }).join("")}</div>` : empty(t("chu.noParishes"))}
    ${ed ? `<button type="button" class="sm" data-pnew>+ ${esc(t("chu.addParish"))}</button>` : ""}</section>`;
  // Статут
  part.statut = `<section class="card"><h2>📖 ${esc(t("chu.statute"))}</h2>${c.statute ? `<div class="billtext">${paras(c.statute)}</div>` : empty(t("chu.noStatute"))}</section>`;
  part.poslannya = docs("msg", msgs);
  part.postanovy = docs("dec", decs);
  h += part[sub] || "";
  if (ed) h += `<details class="card"><summary><b>✏️ ${esc(t("chu.editTexts"))}</b></summary><form class="form" data-ctext>
    <div class="row2"><label>${esc(t("chu.title"))}<input name="title" maxlength="100" value="${esc(c.title || "")}" placeholder="${esc(t("chu.name"))}"></label><label>${esc(t("chu.note"))}<input name="note" maxlength="200" value="${esc(c.note || "")}"></label></div>
    <label>${esc(t("chu.about"))}<textarea name="about" rows="3" maxlength="3000">${esc(c.about || "")}</textarea></label>
    <label>${esc(t("chu.statute"))}<textarea name="statute" rows="12" maxlength="50000">${esc(c.statute || "")}</textarea></label>
    <div class="row end"><button class="primary">${esc(t("save"))}</button></div></form></details>`;
  return h;
}

// ---------- єпархії ----------
function eparchies(ed) {
  const taken = new Set(S.eparchies.flatMap(e => e.lands || []));
  const free = lands().filter(l => !taken.has(l.id));
  return `<section class="card"><h2>⛪ ${esc(t("chu.t.ep"))} <span class="badge">${S.eparchies.length}</span></h2>${S.eparchies.length ? `<div class="epgrid">${S.eparchies.map(e => {
      const bp = player(e.bishop), pr = S.parishes.filter(x => (e.lands || []).includes(x.land));
      return `<article class="epcard">${e.img ? `<img src="${esc(e.img)}" alt="">` : `<div class="epimg none" aria-hidden="true">⛪</div>`}<div class="epbody"><h3>${esc(e.name)}</h3>
        ${bp ? `<p class="hint">🕯 ${esc(t("chu.bishop"))}: <a href="#/narod/gravets/${esc(bp.id)}">${esc(bp.name)}</a></p>` : ""}
        <p>${(e.lands || []).map(id => `<span class="tag">${esc((land(id) || {}).short || (land(id) || {}).name || id)}</span>`).join(" ") || `<span class="hint">${esc(t("chu.noLands"))}</span>`}</p>
        ${pr.length ? `<p class="hint">⛪ ${pr.map(x => esc(x.name)).join(", ")}</p>` : ""}
        ${ed ? `<button type="button" class="ghost sm" data-epedit="${esc(e.id)}">✏️</button>` : ""}</div></article>`; }).join("")}</div>` : empty(t("chu.noEp"))}
    ${free.length && S.eparchies.length ? `<p class="hint">${esc(t("chu.freeLands"))}: ${free.map(l => esc(l.short || l.name)).join(", ")}</p>` : ""}
    ${ed ? `<button type="button" class="sm" data-epnew>+ ${esc(t("chu.addEp"))}</button>` : ""}</section>`;
}
function eparchyForm(x) {
  const isNew = !x; x = x || { name: "", img: "", bishop: "", lands: [] };
  const taken = new Set(S.eparchies.filter(e => e.id !== x.id).flatMap(e => e.lands || []));
  const w = modal(isNew ? t("chu.addEp") : x.name, `<form class="form" data-epf>
    <div class="row"><button type="button" class="avbtn" data-epimg title="${esc(t("chu.epImg"))}">${x.img ? `<img src="${esc(x.img)}" alt="">` : "🖼"}</button><input type="hidden" name="img" value="${esc(x.img || "")}">
      <label class="grow">${esc(t("chu.epName"))}<input name="name" required maxlength="80" value="${esc(x.name)}" placeholder="${esc(t("chu.epNamePh"))}"></label></div>
    <label>${esc(t("chu.bishop"))}<select name="bishop"><option value="">—</option>${S.players.filter(p => p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}"${x.bishop === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <fieldset class="lawpick"><legend>${esc(t("chu.epLands"))}</legend>${lands().map(l => `<label class="chk${taken.has(l.id) ? " dis" : ""}"><input type="checkbox" name="land" value="${esc(l.id)}"${(x.lands || []).includes(l.id) ? " checked" : ""}${taken.has(l.id) ? " disabled" : ""}> ${esc(l.name)}</label>`).join("")}</fieldset>
    <p class="hint">${esc(t("chu.epHint"))}</p>
    <div class="row end">${isNew ? "" : `<button type="button" class="ghost danger" data-epdel>${esc(t("delete"))}</button>`}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div></form>`);
  const f = w.querySelector("[data-epf]");
  w.querySelector("[data-epimg]").onclick = async () => { const v = await pickImage(240); if (!v) return; f.img.value = v; w.querySelector("[data-epimg]").innerHTML = `<img src="${esc(v)}" alt="">`; };
  const d = w.querySelector("[data-epdel]");
  if (d) d.onclick = async () => { if (await confirmBox(t("chu.delEpQ", { x: x.name }), t("delete")) && await run(() => B.del("ud_eparchies", x.id), t("deleted"))) { log("church", `− ${x.name}`); closeModal(); } };
  f.onsubmit = async e => {
    e.preventDefault();
    const v = { name: f.name.value.trim().slice(0, 80), img: f.img.value, bishop: f.bishop.value, lands: [...f.querySelectorAll("[name=land]:checked")].map(i => i.value), order: x.order ?? S.eparchies.length };
    if (await run(() => B.set("ud_eparchies", isNew ? B.newId("ud_eparchies") : x.id, v), t("saved"))) { log("church", `${isNew ? "+" : "✏️"} ${v.name}`); closeModal(); }
  };
}
// ---------- послання й постанови ----------
function docs(kind, list) {
  const can = canChurch() && !!me();
  const sorted = list.slice().sort((a, b) => (ms(b.at) || Date.now()) - (ms(a.at) || Date.now()));
  return `${can ? `<details class="card newbill"><summary><b>✍️ ${esc(t(kind === "msg" ? "chu.newMsg" : "chu.newDec"))}</b></summary><form class="form" data-cdnew="${kind}">
      <label>${esc(t("chu.dTitle"))}<input name="title" required maxlength="200" placeholder="${esc(t(kind === "msg" ? "chu.msgPh" : "chu.decPh"))}"></label>
      <label>${esc(t("chu.dText"))}<textarea name="text" rows="8" maxlength="10000" required></textarea></label>
      <p class="hint">${esc(t("chu.dHint"))}</p><div class="row end"><button class="primary">${esc(t("chu.publish"))}</button></div></form></details>` : ""}
    ${sorted.length ? sorted.map(x => { const p = player(x.by);
      return `<article class="card chdoc"><p class="tags"><span class="tag">${kind === "msg" ? "✉️ " + esc(t("chu.msg")) : "📜 " + esc(t("chu.decN", { n: x.no || "?" }))}</span><span class="tag">📅 ${esc(fmtDate(x.at))}</span></p>
        <h2>${esc(x.title)}</h2><div class="billtext">${paras(x.text)}</div><p class="hint">${p ? `— ${esc(t("chu.patriarch"))} ${esc(p.name)}` : ""}</p>
        <div class="row end"><button type="button" class="ghost sm" data-cdimg="${esc(x.id)}">🖼 ${esc(t("dc.asImage"))}</button>${can ? `<button type="button" class="ghost sm danger" data-cddel="${esc(x.id)}">${esc(t("delete"))}</button>` : ""}</div></article>`; }).join("")
      : `<div class="card">${empty(t(kind === "msg" ? "chu.noMsg" : "chu.noDec"))}</div>`}`;
}

function parishForm(x) {
  const isNew = !x; x = x || { name: "", land: "", priest: "", desc: "" };
  const w = modal(isNew ? t("chu.addParish") : x.name, `<form class="form" data-pf>
    <label>${esc(t("chu.pName"))}<input name="name" required maxlength="80" value="${esc(x.name)}"></label>
    <div class="row2"><label>${esc(t("chu.pLand"))}<select name="land"><option value="">—</option>${lands().map(l => `<option value="${esc(l.id)}"${x.land === l.id ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>
    <label>${esc(t("chu.priest"))}<select name="priest"><option value="">—</option>${S.clergy.map(c => player(c.pid)).filter(Boolean).map(p => `<option value="${esc(p.id)}"${x.priest === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>
    <label>${esc(t("chu.hDesc"))}<textarea name="desc" rows="2" maxlength="500">${esc(x.desc || "")}</textarea></label>
    <div class="row end">${isNew ? "" : `<button type="button" class="ghost danger" data-pdel>${esc(t("delete"))}</button>`}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div></form>`);
  const d = w.querySelector("[data-pdel]");
  if (d) d.onclick = async () => { if (await confirmBox(t("chu.delParishQ", { x: x.name }), t("delete")) && await run(() => B.del("ud_parishes", x.id), t("deleted"))) { log("church", `− ${x.name}`); closeModal(); } };
  w.querySelector("[data-pf]").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const v = { name: f.name.value.trim().slice(0, 80), land: f.land.value, priest: f.priest.value, desc: f.desc.value.trim().slice(0, 500) };
    if (await run(() => B.set("ud_parishes", isNew ? B.newId("ud_parishes") : x.id, v), t("saved"))) { log("church", `${isNew ? "+" : "✏️"} ${v.name}`); closeModal(); }
  };
}

export function mount(root) {
  const ps = root.querySelector("[data-patseed]");
  if (ps) ps.onclick = async () => { if (await run(() => B.set("ud_positions", "patriarch", { title: "Патріарх", order: 90, appointBy: "admin", holder: "", church: true }), t("saved"))) log("position", "+ Патріарх"); };
  const ph = root.querySelector("[data-pathold]");
  if (ph) ph.onchange = async () => { if (await run(() => B.update("ud_positions", "patriarch", { holder: ph.value, since: B.now() }), t("saved"))) log("appoint", `Патріарх: ${(player(ph.value) || {}).name || t("vacant")}`); };
  const ha = root.querySelector("[data-hadd]");
  if (ha) ha.onsubmit = async e => {
    e.preventDefault();
    const yearly = ha.yearly.checked, date = ha.date.value; if (!date) return;
    const v = { name: ha.name.value.trim().slice(0, 80), date: yearly ? date.slice(5) : date, yearly, kind: ha.kind.value, desc: ha.desc.value.trim().slice(0, 200) };
    if (await run(() => B.set("ud_holidays", B.newId("ud_holidays"), v), t("saved"))) { log("holiday", `+ ${v.name}`); ha.reset(); }
  };
  root.querySelectorAll("[data-hdel]").forEach(b => b.onclick = async () => { const x = S.holidays.find(y => y.id === b.dataset.hdel); if (x && await confirmBox(t("chu.delHolidayQ", { x: x.name }), t("delete")) && await run(() => B.del("ud_holidays", x.id), t("deleted"))) log("holiday", `− ${x.name}`); });
  const ca = root.querySelector("[data-cladd]");
  if (ca) ca.onsubmit = async e => {
    e.preventDefault(); if (!ca.pid.value) return;
    if (S.clergy.some(c => c.pid === ca.pid.value)) return toast(t("chu.already"), "err");
    const v = { pid: ca.pid.value, title: ca.title.value.trim().slice(0, 40), parish: ca.parish.value, order: S.clergy.length };
    if (await run(() => B.set("ud_clergy", B.newId("ud_clergy"), v), t("saved"))) { log("church", `+ ${v.title} ${player(v.pid).name}`); ca.reset(); }
  };
  root.querySelectorAll("[data-cldel]").forEach(b => b.onclick = async () => { const x = S.clergy.find(y => y.id === b.dataset.cldel); if (x && await confirmBox(t("chu.delClergyQ"), t("delete")) && await run(() => B.del("ud_clergy", x.id), t("deleted"))) log("church", `− ${(player(x.pid) || {}).name}`); });
  const pn = root.querySelector("[data-pnew]"); if (pn) pn.onclick = () => parishForm(null);
  root.querySelectorAll("[data-paredit]").forEach(b => b.onclick = () => parishForm(S.parishes.find(x => x.id === b.dataset.paredit)));
  const ct = root.querySelector("[data-ctext]");
  if (ct) ct.onsubmit = async e => { e.preventDefault(); if (await run(() => B.set("ud_church", "main", { title: ct.title.value.trim().slice(0, 100), note: ct.note.value.trim().slice(0, 200), about: ct.about.value.slice(0, 3000), statute: ct.statute.value.slice(0, 50000) }, true), t("saved"))) log("church", t("chu.editTexts")); };
  const ce = root.querySelector("[data-chemb]");
  if (ce) ce.onclick = async () => { const v = await pickImage(240); if (v && await run(() => B.set("ud_church", "main", { emblem: v }, true), t("saved"))) log("church", t("chu.emblem")); };
  const cx = root.querySelector("[data-chembdel]");
  if (cx) cx.onclick = () => run(() => B.set("ud_church", "main", { emblem: "" }, true), t("saved"));
  const en = root.querySelector("[data-epnew]"); if (en) en.onclick = () => eparchyForm(null);
  root.querySelectorAll("[data-epedit]").forEach(b => b.onclick = () => eparchyForm(S.eparchies.find(x => x.id === b.dataset.epedit)));
  const dn = root.querySelector("[data-cdnew]");
  if (dn) dn.onsubmit = async e => {
    e.preventDefault(); const kind = dn.dataset.cdnew;
    const no = kind === "dec" ? Math.max(0, ...S.chdocs.filter(x => x.kind === "dec").map(x => x.no || 0)) + 1 : 0;
    const v = { kind, no, title: dn.title.value.trim().slice(0, 200), text: dn.text.value.trim().slice(0, 10000), by: me().id, at: B.now() };
    if (await run(() => B.set("ud_chdocs", B.newId("ud_chdocs"), v), t("chu.published"))) { log("church", `${kind === "msg" ? "✉️" : "📜"} ${v.title}`); dn.reset(); }
  };
  root.querySelectorAll("[data-cdimg]").forEach(b => b.onclick = () => { const x = S.chdocs.find(y => y.id === b.dataset.cdimg); if (!x) return; const p = player(x.by), pat = pos("patriarch");
    docDialog({ issuer: { role: pat ? pat.title : t("chu.patriarch"), name: p ? p.name : "", kind: "church" }, type: x.kind === "msg" ? "epistle" : "resolution", no: x.no ? String(x.no) : "", title: x.title, text: x.text, auto: true }); });
  root.querySelectorAll("[data-cddel]").forEach(b => b.onclick = async () => { if (await confirmBox(t("chu.delDocQ"), t("delete")) && await run(() => B.del("ud_chdocs", b.dataset.cddel), t("deleted"))) log("church", "− " + b.dataset.cddel); });
}
