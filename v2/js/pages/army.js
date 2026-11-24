// 🎖 Військо: список зі званнями, підрозділи (вкладені), зірочки з журналом, таблиця звань.
// Звання рахуються самі з днів служби й зірочок; Полковник — лише призначенням.
import { S, B, me, player, isAdmin, ranks, RANKS_DEFAULT, soldier, serviceDays, rankOf, nextRank, canArmy, unit, commands, ms, log, changed } from "../store.js";
import { EDIT, go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, pickImage, toast, fmtDate } from "../ui.js";
import { txt, empty, paras } from "./common.js";

const todayIso = () => new Date().toISOString().slice(0, 10);
const AF = { unit: "", sort: "rank" };
const kids = id => S.units.filter(u => (u.parent || "") === (id || ""));
const descendants = id => { const out = []; const walk = x => kids(x).forEach(k => { out.push(k.id); walk(k.id); }); walk(id); return out; };
// командир керує своїм підрозділом і всіма вкладеними
const myCommand = () => { const m = me(); if (!m) return []; const top = S.units.filter(u => u.commander === m.id).map(u => u.id); return [...new Set(top.flatMap(id => [id, ...descendants(id)]))]; };
// командир не може видавати зірочки сам собі
const canStar = a => !!a && (canArmy() || (!!a.unit && myCommand().includes(a.unit) && !(me() && me().id === a.id)));
const members = uid => S.army.filter(a => a.unit === uid);

export function rankBadge(a) {
  const r = rankOf(a); if (!r) return "";
  const i = ranks().findIndex(x => x.id === r.id);
  return `<span class="rank r${Math.min(i, 7)}" title="${esc(r.name)}">${"▮".repeat(Math.min(i + 1, 8)).replace(/▮/g, "<i></i>")}<b>${esc(r.name)}</b></span>`;
}
function progress(a) {
  const nx = nextRank(a); if (!nx) return `<small class="hint">${esc(t("ar.maxRank"))}</small>`;
  const d = serviceDays(a), st = a.stars || 0;
  const needD = Math.max(0, (nx.days || 0) - d), needS = Math.max(0, (nx.stars || 0) - st);
  const pct = Math.round(100 * Math.min(nx.days ? Math.min(1, d / nx.days) : 1, nx.stars ? Math.min(1, st / nx.stars) : 1));
  return `<div class="meter sm" title="${pct}%"><span style="width:${pct}%"></span></div><small class="hint">${esc(t("ar.toNext", { x: nx.name }))}: ${needD ? esc(t("ar.daysN", { n: needD })) : "✓"} · ${needS ? `${needS} ★` : "★ ✓"}</small>`;
}
function soldierRow(a) {
  const p = player(a.id), u = unit(a.unit);
  if (!p) return "";
  return `<div class="srow" data-s="${esc(p.name.toLowerCase())}">
    <a class="who" href="#/narod/gravets/${esc(p.id)}">${avatar(p, "av md")}<span><b>${esc(p.name)}</b>${rankBadge(a)}</span></a>
    <div class="sunit">${u ? `<a href="#/narod/viysko/u/${esc(u.id)}" style="--uc:${esc(u.color || "#888")}" class="udot">${esc(u.name)}</a>` : `<i class="hint">${esc(t("ar.noUnit"))}</i>`}</div>
    <div class="snums"><span title="${esc(t("ar.days"))}">📅 ${serviceDays(a)}</span><span title="${esc(t("ar.stars"))}">★ ${a.stars || 0}</span></div>
    <div class="sprog">${progress(a)}</div>
    <div class="sact">${canStar(a) ? `<button type="button" class="ghost sm" data-star="${esc(a.id)}" aria-label="${esc(t("ar.giveStars"))}">⭐</button>` : ""}${EDIT && canArmy() ? `<button type="button" class="ghost sm" data-sedit="${esc(a.id)}" aria-label="${esc(t("edit"))}">✏️</button>` : ""}</div></div>`;
}
function sorted(list) {
  const R = ranks();
  const ri = a => { const r = rankOf(a); return r ? R.findIndex(x => x.id === r.id) : -1; };
  const nm = a => (player(a.id) || { name: "" }).name;
  return list.slice().sort(AF.sort === "days" ? (a, b) => serviceDays(b) - serviceDays(a) : AF.sort === "stars" ? (a, b) => (b.stars || 0) - (a.stars || 0) : AF.sort === "name" ? (a, b) => nm(a).localeCompare(nm(b), "uk") : (a, b) => ri(b) - ri(a) || (b.stars || 0) - (a.stars || 0));
}
function unitTree(parent, depth) {
  return kids(parent).map(u => {
    const c = player(u.commander), n = members(u.id).length;
    return `<div class="unode" style="--uc:${esc(u.color || "#888")};--d:${depth}"><a href="#/narod/viysko/u/${esc(u.id)}">${u.emblem ? `<img src="${esc(u.emblem)}" alt="">` : `<span class="ucol"></span>`}<b>${esc(u.name)}</b></a>
      <small class="hint">${c ? "👤 " + esc(c.name) + " · " : ""}${esc(t("ar.membersN", { n }))}</small></div>${unitTree(u.id, depth + 1)}`;
  }).join("");
}

export function render(parts) {
  if (parts[1] === "u") return unitPage(parts[2]);
  let list = S.army.filter(a => player(a.id));
  if (AF.unit) list = list.filter(a => AF.unit === "-" ? !a.unit : [AF.unit, ...descendants(AF.unit)].includes(a.unit));
  let h = txt("viysko", "intro", t("ar.intro"), { cls: "lead" });
  const btns = [];
  if (canArmy()) btns.push(`<button type="button" class="primary sm" data-enlist>+ ${esc(t("ar.enlist"))}</button>`, `<button type="button" class="sm" data-unew>+ ${esc(t("ar.newUnit"))}</button>`);
  if (btns.length) h += `<div class="row">${btns.join("")}</div>`;
  h += `<section class="card"><div class="row between"><h2>⚔️ ${esc(t("ar.roster"))} <span class="badge">${list.length}</span></h2></div>
    <div class="filters"><input type="search" data-aq placeholder="🔍 ${esc(t("ar.search"))}" aria-label="${esc(t("ar.search"))}">
      <select data-af="unit" aria-label="${esc(t("ar.unit"))}"><option value="">${esc(t("ar.allUnits"))}</option><option value="-"${AF.unit === "-" ? " selected" : ""}>${esc(t("ar.noUnit"))}</option>${S.units.map(u => `<option value="${esc(u.id)}"${AF.unit === u.id ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select>
      <select data-af="sort" aria-label="${esc(t("ar.sort"))}">${["rank", "stars", "days", "name"].map(k => `<option value="${k}"${AF.sort === k ? " selected" : ""}>${esc(t("ar.sort." + k))}</option>`).join("")}</select></div>
    ${list.length ? `<div class="slist">${sorted(list).map(soldierRow).join("")}</div><p class="empty" data-anone hidden>${esc(t("ar.nothing"))}</p>` : empty(t("ar.noSoldiers"))}</section>`;
  h += `<section class="card"><h2>🛡 ${esc(t("ar.units"))} <span class="badge">${S.units.length}</span></h2>${S.units.length ? `<div class="utree">${unitTree("", 0)}</div>` : empty(t("ar.noUnits"))}</section>`;
  h += ranksBlock();
  const feed = S.stars.slice(0, 15);
  h += `<details class="card"><summary><b>⭐ ${esc(t("ar.log"))}</b> <span class="badge">${S.stars.length}</span></summary>${feed.length ? starLog(feed, true) : empty(t("ar.noLog"))}</details>`;
  return h;
}
export function starLog(list, withWho) {
  return `<ul class="slog">${list.map(x => { const p = player(x.pid), by = player(x.by);
    return `<li><b class="${x.n < 0 ? "neg" : "pos"}">${x.n > 0 ? "+" : ""}${x.n} ★</b>${withWho ? ` ${p ? `<a href="#/narod/gravets/${esc(p.id)}">${esc(p.name)}</a>` : "?"}` : ""} — ${esc(x.reason || "")} <small class="hint">${esc(fmtDate(x.at))}${by ? " · " + esc(by.name) : ""}</small></li>`; }).join("")}</ul>`;
}
function ranksBlock() {
  const R = ranks(), ed = EDIT && isAdmin();
  return `<details class="card"${ed ? " open" : ""}><summary><b>🎖 ${esc(t("ar.rankTable"))}</b></summary>
    <p class="hint">${esc(t("ar.rankHint"))}</p>
    ${ed ? `<form data-ranks><table class="rtable"><thead><tr><th>${esc(t("ar.rank"))}</th><th>${esc(t("ar.days"))}</th><th>★</th></tr></thead><tbody>${R.map((r, i) => `<tr><td><input name="n${i}" value="${esc(r.name)}" maxlength="30" aria-label="${esc(t("ar.rank"))}"></td>
      <td>${r.appoint ? `<i class="hint">${esc(t("ar.byAppoint"))}</i>` : `<input type="number" min="0" max="9999" name="d${i}" value="${r.days || 0}" aria-label="${esc(t("ar.days"))}">`}</td><td>${r.appoint ? "—" : `<input type="number" min="0" max="9999" name="s${i}" value="${r.stars || 0}" aria-label="★">`}</td></tr>`).join("")}</tbody></table>
      <div class="row end"><button type="button" class="ghost sm" data-rreset>${esc(t("ar.rankReset"))}</button><button class="primary sm">${esc(t("save"))}</button></div></form>`
      : `<table class="rtable"><thead><tr><th>${esc(t("ar.rank"))}</th><th>${esc(t("ar.days"))}</th><th>★</th><th>${esc(t("ar.now"))}</th></tr></thead><tbody>${R.map(r => {
        const n = S.army.filter(a => player(a.id) && (rankOf(a) || {}).id === r.id).length;
        return `<tr><td>${rankBadge({ appointed: r.id })}</td><td>${r.appoint ? esc(t("ar.byAppoint")) : r.days || 0}</td><td>${r.appoint ? "—" : r.stars || 0}</td><td>${n}</td></tr>`; }).join("")}</tbody></table>`}</details>`;
}

function unitPage(id) {
  const u = unit(id);
  if (!u) return `<p><a href="#/narod/viysko">← ${esc(t("ar.back"))}</a></p><div class="card">${empty(S.units.length ? t("ar.unitNotFound") : t("loading"))}</div>`;
  const c = player(u.commander), par = unit(u.parent), mem = sorted(members(u.id).filter(a => player(a.id)));
  const canEd = EDIT && (canArmy() || commands(u.id));
  let h = `<p><a href="#/narod/viysko">← ${esc(t("ar.back"))}</a>${par ? ` · <a href="#/narod/viysko/u/${esc(par.id)}">${esc(par.name)}</a>` : ""}</p>
    <section class="card unithead" style="--uc:${esc(u.color || "#888")}">
      <div class="row">${u.emblem ? `<img class="emb" src="${esc(u.emblem)}" alt="">` : `<span class="emb ucol"></span>`}<div class="grow"><h1>${esc(u.name)}</h1>
        <p class="hint">${esc(t("ar.commander"))}: ${c ? `<a href="#/narod/gravets/${esc(c.id)}">${esc(c.name)}</a>` : `<i>${esc(t("vacant"))}</i>`}</p></div>
        ${canEd ? `<button type="button" class="sm" data-uedit="${esc(u.id)}">✏️ ${esc(t("edit"))}</button>` : ""}</div>
      ${u.desc ? `<div class="billtext">${paras(u.desc)}</div>` : ""}</section>`;
  const sub = kids(u.id);
  if (sub.length) h += `<section class="card"><h2>${esc(t("ar.subunits"))}</h2><div class="utree">${unitTree(u.id, 0)}</div></section>`;
  h += `<section class="card"><h2>${esc(t("ar.members"))} <span class="badge">${mem.length}</span></h2>${mem.length ? `<div class="slist">${mem.map(soldierRow).join("")}</div>` : empty(t("ar.noMembers"))}</section>`;
  return h;
}

// ---------- форми ----------
function enlistForm() {
  const free = S.players.filter(p => p.status === "cit" && !soldier(p.id)).sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const w = modal(t("ar.enlist"), `<form class="form" data-en>
    <label>${esc(t("ar.who"))}<select name="pid" required><option value="">—</option>${free.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
    <div class="row2"><label>${esc(t("ar.since"))}<input type="date" name="since" value="${todayIso()}" max="${todayIso()}"></label>
    <label>${esc(t("ar.unit"))}<select name="unit"><option value="">— ${esc(t("ar.noUnit"))} —</option>${S.units.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join("")}</select></label></div>
    <p class="hint">${esc(t("ar.sinceHint"))}</p>
    <div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("ar.enlist"))}</button></div></form>`);
  w.querySelector("[data-en]").onsubmit = async e => {
    e.preventDefault(); const f = e.target; if (!f.pid.value) return;
    const v = { unit: f.unit.value, since: f.since.value || todayIso(), stars: 0, appointed: "" };
    if (await run(() => B.set("ud_army", f.pid.value, v), t("saved"))) { log("army", `+ ${player(f.pid.value).name}`); closeModal(); }
  };
}
function soldierForm(a) {
  const p = player(a.id);
  const w = modal(p.name, `<form class="form" data-se>
    <div class="row2"><label>${esc(t("ar.unit"))}<select name="unit"><option value="">— ${esc(t("ar.noUnit"))} —</option>${S.units.map(u => `<option value="${esc(u.id)}"${a.unit === u.id ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>
    <label>${esc(t("ar.since"))}<input type="date" name="since" value="${esc(a.since || "")}" max="${todayIso()}"></label></div>
    <div class="row2"><label>${esc(t("ar.appointed"))}<select name="appointed"><option value="">— ${esc(t("ar.auto"))} —</option>${ranks().map(r => `<option value="${esc(r.id)}"${a.appointed === r.id ? " selected" : ""}>${esc(r.name)}${r.appoint ? " ★" : ""}</option>`).join("")}</select></label>
    <label>${esc(t("ar.stars"))}<input type="number" name="stars" min="0" max="99999" value="${a.stars || 0}"></label></div>
    <p class="hint">${esc(t("ar.appointHint"))}</p>
    <div class="row end"><button type="button" class="ghost danger" data-discharge>${esc(t("ar.discharge"))}</button><span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div></form>`);
  w.querySelector("[data-discharge]").onclick = async () => {
    if (await confirmBox(t("ar.dischargeQ", { x: p.name }), t("ar.discharge")) && await run(() => B.del("ud_army", a.id), t("saved"))) { log("army", `− ${p.name}`); closeModal(); }
  };
  w.querySelector("[data-se]").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const v = { unit: f.unit.value, since: f.since.value || a.since, appointed: f.appointed.value, stars: Math.max(0, parseInt(f.stars.value, 10) || 0) };
    const ops = [{ op: "update", c: "ud_army", id: a.id, v }];
    const diff = v.stars - (a.stars || 0);
    if (diff) ops.push({ op: "set", c: "ud_stars", id: B.newId("ud_stars"), v: { pid: a.id, n: diff, reason: t("ar.manualFix"), by: me().id, unit: v.unit, at: B.now() } });
    if (await run(() => B.batch(ops), t("saved"))) { log("army", `✏️ ${p.name}`); closeModal(); }
  };
}
function starForm(a) {
  const p = player(a.id), cmd = canArmy();
  const w = modal(t("ar.giveStarsTo", { x: p.name }), `<form class="form" data-st>
    <label>${esc(t("ar.howMany"))}<input type="number" name="n" value="1" ${cmd ? `min="-50" max="50"` : `min="1" max="10"`} required></label>
    <label>${esc(t("ar.reason"))}<input name="reason" required maxlength="200" placeholder="${esc(t("ar.reasonPh"))}"></label>
    <p class="hint">${esc(t(cmd ? "ar.starHintCmd" : "ar.starHint"))}</p>
    <div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">⭐ ${esc(t("ar.give"))}</button></div></form>`);
  w.querySelector("[data-st]").onsubmit = async e => {
    e.preventDefault(); const f = e.target, n = parseInt(f.n.value, 10) || 0;
    if (!n || (!cmd && (n < 1 || n > 10))) return toast(t("ar.badN"), "err");
    const cur = soldier(a.id); const stars = Math.max(0, (cur.stars || 0) + n);
    const before = rankOf(cur), after = rankOf({ ...cur, stars });
    if (await run(() => B.batch([
      { op: "update", c: "ud_army", id: a.id, v: { stars } },
      { op: "set", c: "ud_stars", id: B.newId("ud_stars"), v: { pid: a.id, n, reason: f.reason.value.trim().slice(0, 200), by: me().id, unit: cur.unit || "", at: B.now() } },
    ]), t("ar.given"))) {
      log("army", `${n > 0 ? "+" : ""}${n} ★ ${p.name}`); closeModal();
      if (after && before && after.id !== before.id) toast(t("ar.promoted", { x: p.name, r: after.name }));
    }
  };
}
function unitForm(u) {
  const isNew = !u; u = u || { name: "", color: "#2e5aac", emblem: "", commander: "", parent: "", desc: "", order: S.units.length };
  const full = canArmy();
  let emb = u.emblem || "";
  const banned = isNew ? [] : [u.id, ...descendants(u.id)];
  const w = modal(isNew ? t("ar.newUnit") : u.name, `<form class="form" data-uf>
    <div class="avedit"><span class="flagprev">${emb ? `<img src="${esc(emb)}" alt="">` : "🛡"}</span><button type="button" class="ghost sm" data-emb>${esc(t("ar.emblem"))}</button></div>
    <div class="row2"><label>${esc(t("ar.unitName"))}<input name="name" required maxlength="60" value="${esc(u.name)}"></label><label>${esc(t("ar.color"))}<input type="color" name="color" value="${esc(u.color || "#2e5aac")}"></label></div>
    ${full ? `<div class="row2"><label>${esc(t("ar.commander"))}<select name="commander"><option value="">— ${esc(t("vacant"))} —</option>${S.army.filter(a => player(a.id)).map(a => `<option value="${esc(a.id)}"${u.commander === a.id ? " selected" : ""}>${esc(player(a.id).name)} · ${esc((rankOf(a) || {}).name || "")}</option>`).join("")}</select></label>
      <label>${esc(t("ar.parent"))}<select name="parent"><option value="">— ${esc(t("ar.topLevel"))} —</option>${S.units.filter(x => !banned.includes(x.id)).map(x => `<option value="${esc(x.id)}"${u.parent === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label></div>` : ""}
    <label>${esc(t("ar.desc"))}<textarea name="desc" rows="4" maxlength="3000">${esc(u.desc || "")}</textarea></label>
    <div class="row end">${!isNew && full ? `<button type="button" class="ghost danger" data-udel>${esc(t("delete"))}</button>` : ""}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div></form>`);
  w.querySelector("[data-emb]").onclick = async () => { const v = await pickImage(160); if (v) { emb = v; w.querySelector(".flagprev").innerHTML = `<img src="${v}" alt="">`; } };
  const d = w.querySelector("[data-udel]");
  if (d) d.onclick = async () => {
    if (members(u.id).length || kids(u.id).length) return toast(t("ar.unitNotEmpty"), "err");
    if (await confirmBox(t("ar.delUnitQ", { x: u.name }), t("delete")) && await run(() => B.del("ud_units", u.id), t("deleted"))) { log("army", `− ${u.name}`); closeModal(); go("narod/viysko"); }
  };
  w.querySelector("[data-uf]").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const v = { name: f.name.value.trim().slice(0, 60), color: f.color.value, emblem: emb, desc: f.desc.value.slice(0, 3000) };
    if (full) Object.assign(v, { commander: f.commander.value, parent: f.parent.value, order: u.order ?? 0 });
    const id = isNew ? B.newId("ud_units") : u.id;
    if (await run(() => isNew ? B.set("ud_units", id, v) : B.update("ud_units", id, v), t("saved"))) { log("army", `${isNew ? "+" : "✏️"} ${v.name}`); closeModal(); if (isNew) go("narod/viysko/u/" + id); }
  };
}

export function mount(root, parts) {
  const en = root.querySelector("[data-enlist]"); if (en) en.onclick = enlistForm;
  const un = root.querySelector("[data-unew]"); if (un) un.onclick = () => unitForm(null);
  root.querySelectorAll("[data-uedit]").forEach(b => b.onclick = () => unitForm(unit(b.dataset.uedit)));
  root.querySelectorAll("[data-sedit]").forEach(b => b.onclick = () => soldierForm(soldier(b.dataset.sedit)));
  root.querySelectorAll("[data-star]").forEach(b => b.onclick = () => starForm(soldier(b.dataset.star)));
  root.querySelectorAll("[data-af]").forEach(s => s.onchange = () => { AF[s.dataset.af] = s.value; changed(); });
  const q = root.querySelector("[data-aq]");
  if (q) q.oninput = () => {
    const v = q.value.trim().toLowerCase(); let n = 0;
    root.querySelectorAll(".srow[data-s]").forEach(r => { const ok = !v || r.dataset.s.includes(v); r.hidden = !ok; if (ok) n++; });
    const none = root.querySelector("[data-anone]"); if (none) none.hidden = n > 0;
  };
  const rf = root.querySelector("[data-ranks]");
  if (rf) {
    rf.onsubmit = async e => {
      e.preventDefault();
      const list = ranks().map((r, i) => ({ ...r, name: (rf["n" + i].value.trim() || r.name).slice(0, 30), ...(r.appoint ? {} : { days: Math.max(0, parseInt(rf["d" + i].value, 10) || 0), stars: Math.max(0, parseInt(rf["s" + i].value, 10) || 0) }) }));
      if (await run(() => B.set("ud_config", "ranks", { list }), t("saved"))) log("army", t("ar.rankTable"));
    };
    rf.querySelector("[data-rreset]").onclick = async () => { if (await confirmBox(t("ar.rankResetQ"), t("ar.rankReset")) && await run(() => B.set("ud_config", "ranks", { list: RANKS_DEFAULT }), t("saved"))) log("army", t("ar.rankReset")); };
  }
}
