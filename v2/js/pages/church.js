// ⛪ Церква: Патріарх, духовенство, парафії, Статут Церкви, календар церковних і державних свят.
import { S, B, me, pos, player, lands, land, isAdmin, canChurch, canHolidays, log } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, toast } from "../ui.js";
import { txt, empty, paras } from "./common.js";

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

export function render() {
  const ed = EDIT && canChurch(), c = S.church || {};
  let h = txt("tserkva", "intro", t("chu.intro"), { cls: "lead" });
  const pat = pos("patriarch"), pp = pat && player(pat.holder);
  h += `<section class="card hetman"><div class="pcard big">${avatar(pp || { name: "?" }, "av xl")}<div class="pct"><small>${esc(pat ? pat.title : t("chu.patriarch"))}</small>
    <b>${pp ? `<a href="#/narod/gravets/${esc(pp.id)}">${esc(pp.name)}</a>` : `<i class="vac">${esc(t("vacant"))}</i>`}</b>
    ${!pat && isAdmin() ? `<button type="button" class="sm" data-patseed>${esc(t("chu.seedPat"))}</button>` : ""}
    ${pat && EDIT && isAdmin() ? `<select data-pathold aria-label="${esc(t("chu.patriarch"))}"><option value="">— ${esc(t("vacant"))} —</option>${S.players.filter(p => p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}"${p.id === pat.holder ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` : ""}</div></div>
    ${c.about ? `<div class="billtext">${paras(c.about)}</div>` : ""}</section>`;
  // календар
  const up = upcoming(50);
  h += `<section class="card"><h2>📅 ${esc(t("chu.calendar"))}</h2>${up.length ? `<div class="hlist">${up.map(({ h: x, d }) => {
    const n = daysTo(d);
    return `<div class="hday k-${esc(x.kind)}"><div class="hdate"><b>${d.getDate()}</b><small>${esc(d.toLocaleDateString(lng(), { month: "short" }))}</small></div>
      <div class="grow"><b>${x.kind === "church" ? "⛪" : "🏛"} ${esc(x.name)}</b>${x.desc ? `<small class="hint">${esc(x.desc)}</small>` : ""}</div>
      <span class="tag">${n === 0 ? esc(t("chu.today")) : esc(t("chu.inDays", { n }))}</span>${EDIT && canHolidays(x.kind) ? `<button type="button" class="ghost sm danger" data-hdel="${esc(x.id)}" aria-label="${esc(t("delete"))}">✕</button>` : ""}</div>`; }).join("")}</div>` : empty(t("chu.noHolidays"))}
    ${EDIT && (canHolidays("church") || canHolidays("state")) ? `<form class="form addhol" data-hadd><div class="row2"><label>${esc(t("chu.hName"))}<input name="name" required maxlength="80"></label><label>${esc(t("chu.hDate"))}<input type="date" name="date" required></label></div>
      <div class="row2"><label>${esc(t("chu.hKind"))}<select name="kind">${canHolidays("church") ? `<option value="church">⛪ ${esc(t("chu.kChurch"))}</option>` : ""}${canHolidays("state") ? `<option value="state">🏛 ${esc(t("chu.kState"))}</option>` : ""}</select></label>
      <label class="chk"><input type="checkbox" name="yearly" checked> ${esc(t("chu.yearly"))}</label></div>
      <label>${esc(t("chu.hDesc"))}<input name="desc" maxlength="200"></label><div class="row end"><button class="sm primary">+ ${esc(t("chu.addHoliday"))}</button></div></form>` : ""}</section>`;
  // духовенство
  h += `<section class="card"><h2>🕯 ${esc(t("chu.clergy"))} <span class="badge">${S.clergy.length}</span></h2>${S.clergy.length ? `<div class="pgrid">${S.clergy.map(x => { const p = player(x.pid), pr = S.parishes.find(y => y.id === x.parish);
      return `<div class="pcard">${avatar(p || { name: "?" }, "av lg")}<div class="pct"><small>${esc(x.title)}</small><b>${p ? `<a href="#/narod/gravets/${esc(p.id)}">${esc(p.name)}</a>` : "?"}</b>${pr ? `<small class="hint">⛪ ${esc(pr.name)}</small>` : ""}
        ${ed ? `<button type="button" class="ghost sm danger" data-cldel="${esc(x.id)}">${esc(t("delete"))}</button>` : ""}</div></div>`; }).join("")}</div>` : empty(t("chu.noClergy"))}
    ${ed ? `<form class="row addcode" data-cladd><select name="pid" required><option value="">${esc(t("chu.who"))}</option>${S.players.filter(p => p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>
      <input name="title" required maxlength="40" list="sany" placeholder="${esc(t("chu.san"))}"><datalist id="sany">${SANY.map(x => `<option value="${x}">`).join("")}</datalist>
      <select name="parish"><option value="">— ${esc(t("chu.noParish"))} —</option>${S.parishes.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select><button class="sm primary">+</button></form>` : ""}</section>`;
  // парафії
  h += `<section class="card"><h2>⛪ ${esc(t("chu.parishes"))} <span class="badge">${S.parishes.length}</span></h2>${S.parishes.length ? `<div class="lgrid">${S.parishes.map(x => { const L = land(x.land), pr = player(x.priest);
      return `<div class="lcard" style="--lc:${esc((L && L.color) || "#c9a227")}"><h3>${esc(x.name)}</h3><p class="hint">${L ? "🗺 " + esc(L.name) : ""}${pr ? ` · 🕯 ${esc(pr.name)}` : ""}</p>${x.desc ? `<p class="hint">${esc(x.desc)}</p>` : ""}
        ${ed ? `<button type="button" class="ghost sm" data-paredit="${esc(x.id)}">✏️</button>` : ""}</div>`; }).join("")}</div>` : empty(t("chu.noParishes"))}
    ${ed ? `<button type="button" class="sm" data-pnew>+ ${esc(t("chu.addParish"))}</button>` : ""}</section>`;
  // Статут
  h += `<details class="card"${c.statute ? "" : " open"}><summary><b>📜 ${esc(t("chu.statute"))}</b></summary>${c.statute ? `<div class="billtext">${paras(c.statute)}</div>` : empty(t("chu.noStatute"))}</details>`;
  if (ed) h += `<details class="card"><summary><b>✏️ ${esc(t("chu.editTexts"))}</b></summary><form class="form" data-ctext>
    <label>${esc(t("chu.about"))}<textarea name="about" rows="3" maxlength="3000">${esc(c.about || "")}</textarea></label>
    <label>${esc(t("chu.statute"))}<textarea name="statute" rows="12" maxlength="50000">${esc(c.statute || "")}</textarea></label>
    <div class="row end"><button class="primary">${esc(t("save"))}</button></div></form></details>`;
  return h;
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
  if (ct) ct.onsubmit = async e => { e.preventDefault(); if (await run(() => B.set("ud_church", "main", { about: ct.about.value.slice(0, 3000), statute: ct.statute.value.slice(0, 50000) }), t("saved"))) log("church", t("chu.editTexts")); };
}
