// 🗺 Карта: 9 земель і Київ, сторінка землі з Осавулом, представником у Палаті, уділами (джури) і містами (війти).
// Уділ або місто = документ ud_places + посада pl_<id> у Сотенній лаві Палати, яку призначає Крайовий Осавул.
import { asset } from "../ui.js";
import { meetsRank, S, B, me, pos, player, lands, land, landsFromPlan, canLands, canAppoint, canPlaces, isAdmin, isCitizen, log, changed } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, confirmBox, toast } from "../ui.js";
import { txt, empty, holderSel, symHtml, symEditor, bindSym } from "./common.js";
import { modal } from "../ui.js";

let GEO = null, geoLoading = false;
function geo() {
  if (!GEO && !geoLoading) {
    geoLoading = true;
    fetch(asset("data/map-lands.json")).then(r => r.json()).then(d => { GEO = d; changed(); }).catch(() => { geoLoading = false; });
  }
  return GEO;
}
const residents = id => S.players.filter(p => p.land === id && p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk"));
const placesOf = (id, kind) => S.places.filter(p => p.land === id && p.kind === kind);
// назви посад зберігаються українською — це дані держави, а не підписи інтерфейсу
const placeTitle = (kind, name) => (kind === "city" ? "Війт міста " : "Джура уділу ") + name;
const vb = () => (GEO.viewBox || "0 0 1000 700").split(" ").map(Number);

export function render(parts) {
  return parts[1] ? landPage(parts[1]) : overview();
}

// ---------- огляд: карта + картки земель ----------
function svgMap(sel) {
  const g = geo();
  if (!g) return `<div class="mapbox loading">${esc(t("loading"))}</div>`;
  const [, , W] = vb();
  let s = `<svg class="umap" viewBox="${esc(g.viewBox)}" role="img" aria-label="${esc(t("map.title"))}">`;
  for (const l of lands()) {
    const shp = g.lands[l.id]; if (!shp) continue;
    s += `<a href="#/derzhava/karta/${esc(l.id)}" aria-label="${esc(l.name)}"><path class="ld${sel === l.id ? " sel" : ""}" d="${shp.d}" style="--lc:${esc(l.color || "#ccc")}"/></a>`;
  }
  for (const l of lands()) {
    const shp = g.lands[l.id]; if (!shp) continue;
    const name = l.short || l.name, n = residents(l.id).length;
    const fs = Math.max(14, Math.min(19, shp.r / 3.4));
    const lines = name.includes("-") ? name.replace("-", "-\n").split("\n") : [name];
    const w = Math.max(...lines.map(x => x.length)) * Math.max(fs, 19) * 0.56;   // 19 — розмір підпису на телефоні
    const x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, shp.lx));
    const y0 = shp.ly - (lines.length - 1) * fs * 0.55;
    s += `<text class="lbl" x="${x}" y="${y0}" font-size="${fs}">${lines.map((ln, i) => `<tspan x="${x}" dy="${i ? fs * 1.1 : 0}">${esc(ln)}</tspan>`).join("")}<tspan class="cnt" x="${x}" dy="${fs * 1.15}" font-size="${fs * 0.78}">👥 ${n}</tspan></text>`;
  }
  const k = land("kyiv");
  if (k && g.kyiv) s += `<a href="#/derzhava/karta/kyiv" aria-label="${esc(k.name)}"><circle class="kyiv${sel === "kyiv" ? " sel" : ""}" cx="${g.kyiv.x}" cy="${g.kyiv.y}" r="9"/><text class="lbl cap" x="${g.kyiv.x}" y="${g.kyiv.y - 15}" font-size="15">${esc(k.short || k.name)}</text></a>`;
  return `<div class="mapbox">${s}</svg></div>`;
}

function overview() {
  const L = lands();
  let h = txt("karta", "intro", t("map.intro"), { cls: "lead" });
  if (!S.lands && canLands()) h += `<div class="card warn small">${esc(t("map.notSaved"))} <button type="button" class="sm" data-lseed>${esc(t("map.save"))}</button></div>`;
  const noOsavul = L.filter(l => !pos("osavul_" + l.id));
  if (isAdmin() && noOsavul.length) h += `<div class="card warn small">${esc(t("map.noOsavulPos"))} <button type="button" class="sm" data-oseed>${esc(t("map.seedOsavul"))}</button></div>`;
  h += `<section class="card mapcard">${svgMap("")}</section>`;
  h += `<div class="lgrid">${L.map(l => {
    const o = pos("osavul_" + l.id), op = o && player(o.holder);
    return `<a class="lcard" href="#/derzhava/karta/${esc(l.id)}" style="--lc:${esc(l.color || "#ccc")}"><h3>${symHtml("land_" + l.id, "sm")}${esc(l.name)}</h3>
      <p class="hint">${esc(t("map.osavul"))}: ${op ? `<b>${esc(op.name)}</b>` : `<i>${esc(t("vacant"))}</i>`}</p>
      <p class="hint">👥 ${residents(l.id).length} · ${esc(t("map.udilsN", { n: placesOf(l.id, "udil").length }))} · ${esc(t("map.citiesN", { n: placesOf(l.id, "city").length }))}</p></a>`;
  }).join("")}</div>`;
  return h;
}

// ---------- сторінка землі ----------
function personCard(p, label) {
  if (!p) return `<div class="pcard"><span class="av lg ini" aria-hidden="true">?</span><div class="pct"><small>${esc(label)}</small><b><i class="vac">${esc(t("map.noPos"))}</i></b></div></div>`;
  const pl = player(p.holder);
  const can = EDIT && canAppoint(p);
  return `<div class="pcard">${avatar(pl || { name: "?" }, "av lg")}<div class="pct"><small>${esc(label)}</small>
    ${can ? holderSelect(p, S.players.filter(x => x.status === "cit")) : `<b>${pl ? `<a href="#/narod/gravets/${esc(pl.id)}">${esc(pl.name)}</a>` : `<i class="vac">${esc(t("vacant"))}</i>`}</b>`}
    ${!pl && p.appointBy === "election" ? `<a class="hint" href="#/derzhava/vybory">${esc(t("map.byElection"))}</a>` : ""}</div></div>`;
}
const holderSelect = (p, _people) => holderSel(p, p.land);   // спершу прописані в землі, далі всі громадяни
function placeList(l, kind) {
  const list = placesOf(l.id, kind), ed = EDIT && canPlaces(l.id);
  const people = residents(l.id);
  const rows = list.map(pl => {
    const p = pos("pl_" + pl.id), who = p && player(p.holder);
    const can = EDIT && p && canAppoint(p);
    return `<div class="place">
      ${symHtml("place_" + pl.id, "sm")}<div class="grow">${ed ? `<input class="ttl" data-pname="${esc(pl.id)}" value="${esc(pl.name)}" maxlength="60" aria-label="${esc(t("map.placeName"))}">` : `<b>${esc(pl.name)}</b>`}
        ${pl.note && !ed ? `<small class="hint">${esc(pl.note)}</small>` : ""}</div>
      <div class="who">${who ? avatar(who, "av sm") : ""}<span><small>${esc(t(kind === "city" ? "map.viit" : "map.dzhura"))}</small>
        ${can ? holderSelect(p, people.length ? people : S.players.filter(x => x.status === "cit")) : who ? `<a href="#/narod/gravets/${esc(who.id)}">${esc(who.name)}</a>` : `<i class="vac">${esc(t("vacant"))}</i>`}</span></div>
      ${ed ? `<button type="button" class="ghost sm" data-psym="${esc(pl.id)}" title="${esc(t("sy.both"))}" aria-label="${esc(t("sy.both"))}">🛡</button><button type="button" class="ghost sm danger" data-pdel="${esc(pl.id)}" aria-label="${esc(t("delete"))}">✕</button>` : ""}</div>`;
  }).join("");
  return `<section class="card"><h2>${kind === "city" ? "🏙" : "🏘"} ${esc(t(kind === "city" ? "map.cities" : "map.udils"))} <span class="badge">${list.length}</span></h2>
    <p class="hint">${esc(t(kind === "city" ? "map.citiesHint" : "map.udilsHint"))}</p>
    ${rows || empty(t(kind === "city" ? "map.noCities" : "map.noUdils"))}
    ${ed ? `<form class="row addplace" data-padd="${kind}"><input name="name" required maxlength="60" placeholder="${esc(t(kind === "city" ? "map.cityPh" : "map.udilPh"))}"><button class="sm">+ ${esc(t(kind === "city" ? "map.addCity" : "map.addUdil"))}</button></form>` : ""}</section>`;
}

function landPage(id) {
  const l = land(id);
  if (!l) return `<p><a href="#/derzhava/karta">← ${esc(t("map.back"))}</a></p><div class="card">${empty(t("map.notFound"))}</div>`;
  const edL = EDIT && canLands();
  const m = me(), res = residents(id);
  let h = `<p><a href="#/derzhava/karta">← ${esc(t("map.back"))}</a></p>`;
  h += `<section class="card landhead" style="--lc:${esc(l.color || "#ccc")}">
    ${edL ? `<form class="setgrid" data-ledit><label>${esc(t("map.name"))}<input name="name" required maxlength="60" value="${esc(l.name)}"></label>
      <label>${esc(t("map.short"))}<input name="short" maxlength="30" value="${esc(l.short || "")}"></label>
      <label>${esc(t("map.color"))}<input type="color" name="color" value="${esc(l.color || "#cccccc")}"></label><button class="primary sm">${esc(t("save"))}</button></form>`
      : `<div class="lhrow">${symHtml("land_" + id, "lg")}<h1>${esc(l.name)}</h1></div>`}
    ${EDIT && canPlaces(id) ? symEditor("land_" + id, id) : ""}
    <p class="hint">👥 ${esc(t("map.residents", { n: res.length }))}</p>
    ${m && m.status === "cit" ? (m.land === id ? `<p class="tag">🏠 ${esc(t("map.youLive"))}</p>` : `<button type="button" class="sm" data-live>🏠 ${esc(t("map.liveHere"))}</button>`) : ""}</section>`;
  h += `<section class="card"><h2>${esc(t("map.leaders"))}</h2><div class="pgrid">
    ${personCard(pos("osavul_" + id), t("map.osavul"))}${personCard(pos("seat_" + id), t("map.rep"))}</div>
    ${EDIT && canPlaces(id) ? `<p class="hint">${esc(t("map.osavulHint"))}</p>` : ""}</section>`;
  h += placeList(l, "udil") + placeList(l, "city");
  // регіони гри
  const regs = l.regions || [];
  h += `<section class="card"><h2>🧭 ${esc(t("map.regions"))} <span class="badge">${regs.length}</span></h2>
    ${regs.length ? (edL ? `<p class="hint">${esc(t("map.moveHint"))}</p><div class="regs ed">${regs.map(r => `<label class="reg"><span>${esc(r.name)}</span><select data-rmove="${esc(r.id)}">${lands().map(x => `<option value="${esc(x.id)}"${x.id === id ? " selected" : ""}>${esc(x.short || x.name)}</option>`).join("")}</select></label>`).join("")}</div>`
      : `<p class="regs">${regs.map(r => esc(r.name)).join(" · ")}</p>`) : empty("—")}</section>`;
  h += `<section class="card"><h2>👥 ${esc(t("map.people"))} <span class="badge">${res.length}</span></h2>
    ${res.length ? `<div class="chips">${res.map(p => `<a class="chip" href="#/narod/gravets/${esc(p.id)}">${avatar(p, "av sm")}<span>${esc(p.name)}</span></a>`).join("")}</div>` : empty(t("map.nobody"))}</section>`;
  return h;
}

// ---------- дії ----------
const listForSave = () => (S.lands || landsFromPlan()).map(x => ({ ...x, regions: (x.regions || []).map(r => ({ ...r })) }));

export function mount(root, parts) {
  const ls = root.querySelector("[data-lseed]");
  if (ls) ls.onclick = async () => { if (await run(() => B.set("ud_config", "lands", { list: landsFromPlan() }), t("saved"))) log("lands", t("map.save")); };
  const os = root.querySelector("[data-oseed]");
  if (os) os.onclick = async () => {
    const ops = lands().filter(l => !pos("osavul_" + l.id)).map((l, i) => ({ op: "set", c: "ud_positions", id: "osavul_" + l.id,
      v: { title: "Крайовий Осавул: " + (l.short || l.name), order: 50 + (l.order ?? i), appointBy: "election", land: l.id, holder: "" } }));
    if (await run(() => B.batch(ops), t("saved"))) log("position", t("map.seedOsavul"));
  };
  root.querySelectorAll("[data-hold]").forEach(s => s.onchange = async () => {
    const p = pos(s.dataset.hold), pl = player(s.value);
    if (await run(() => B.update("ud_positions", p.id, { holder: s.value || "", since: B.now() }), t("saved"))) log("appoint", `${p.title}: ${pl ? pl.name : t("vacant")}`);
  });
  const id = parts[1]; if (!id) return;
  const l = land(id); if (!l) return;
  const lv = root.querySelector("[data-live]");
  if (lv) lv.onclick = async () => { const m = me(); if (await run(() => B.update("ud_players", m.id, { land: id }), t("saved"))) log("land", `${m.name} → ${l.name}`); };
  bindSym(root);
  root.querySelectorAll("[data-psym]").forEach(b => b.onclick = () => {
    const pl = S.places.find(x => x.id === b.dataset.psym); if (!pl) return;
    const draw = () => `<p class="hint">${esc(pl.name)}</p>${symEditor("place_" + pl.id, pl.land)}`;
    const w = modal(t("sy.both"), `<div data-symbox>${draw()}</div><div class="row end"><button type="button" class="primary" data-close>${esc(t("sy.done"))}</button></div>`);
    const box = w.querySelector("[data-symbox]"); bindSym(box);
    // після збереження оновлюємо вікно, щоб було видно нову картинку
    const iv = setInterval(() => { if (!box.isConnected) return clearInterval(iv); const h = draw(); if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; bindSym(box); } }, 500);
  });
  const le = root.querySelector("[data-ledit]");
  if (le) le.onsubmit = async e => {
    e.preventDefault();
    const list = listForSave(), x = list.find(y => y.id === id);
    Object.assign(x, { name: le.name.value.trim().slice(0, 60) || x.name, short: le.short.value.trim().slice(0, 30), color: le.color.value });
    if (await run(() => B.set("ud_config", "lands", { list }), t("saved"))) log("lands", `${x.name}`);
  };
  root.querySelectorAll("[data-rmove]").forEach(s => s.onchange = async () => {
    const to = s.value; if (to === id) return;
    const list = listForSave(), from = list.find(y => y.id === id), dest = list.find(y => y.id === to);
    const r = from.regions.find(y => String(y.id) === s.dataset.rmove); if (!r) return;
    from.regions = from.regions.filter(y => y !== r); dest.regions.push(r);
    if (await run(() => B.set("ud_config", "lands", { list }), t("saved"))) log("lands", `${r.name}: ${from.short || from.name} → ${dest.short || dest.name}`);
  });
  root.querySelectorAll("[data-padd]").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const kind = f.dataset.padd, name = f.name.value.trim().slice(0, 60); if (!name) return;
    if (S.places.some(p => p.land === id && p.kind === kind && p.name.toLowerCase() === name.toLowerCase())) return toast(t("map.exists"), "err");
    const pid = B.newId("ud_places");
    const order = Math.max(0, ...S.places.filter(p => p.land === id).map(p => p.order || 0)) + 1;
    const ok = await run(() => B.batch([
      { op: "set", c: "ud_places", id: pid, v: { land: id, kind, name, note: "", order } },
      { op: "set", c: "ud_positions", id: "pl_" + pid, v: { title: placeTitle(kind, name), order: 300 + order, appointBy: "osavul", chamber: "sotenna", land: id, place: pid, holder: "" } },
    ]), t("saved"));
    if (ok) { log("place", `+ ${placeTitle(kind, name)} (${l.short || l.name})`); f.reset(); }
  });
  root.querySelectorAll("[data-pname]").forEach(i => i.onchange = async () => {
    const pl = S.places.find(p => p.id === i.dataset.pname), name = i.value.trim().slice(0, 60);
    if (!pl || !name || name === pl.name) return;
    const ops = [{ op: "update", c: "ud_places", id: pl.id, v: { name } }];
    if (pos("pl_" + pl.id)) ops.push({ op: "update", c: "ud_positions", id: "pl_" + pl.id, v: { title: placeTitle(pl.kind, name) } });
    if (await run(() => B.batch(ops), t("saved"))) log("place", `${pl.name} → ${name}`);
  });
  root.querySelectorAll("[data-pdel]").forEach(b => b.onclick = async () => {
    const pl = S.places.find(p => p.id === b.dataset.pdel); if (!pl) return;
    if (!(await confirmBox(t("map.delQ", { x: pl.name }), t("delete")))) return;
    const ops = [{ op: "del", c: "ud_places", id: pl.id }];
    if (pos("pl_" + pl.id)) ops.push({ op: "del", c: "ud_positions", id: "pl_" + pl.id });
    if (await run(() => B.batch(ops), t("deleted"))) log("place", `− ${placeTitle(pl.kind, pl.name)}`);
  });
}
