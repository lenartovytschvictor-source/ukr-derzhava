// ⚙️ Автоматична дія закону: вибір у формі законопроєкту, опис на сторінці, застосування.
import { S, B, player, pos, lands, land, isAdmin, log } from "../store.js";
import { t } from "../i18n.js";
import { esc, run, pickImage } from "../ui.js";
import { FX_GROUPS, LAND_STATUSES, articles, nextArtNum, fxOps, fxPending } from "../effects.js";

const cits = () => S.players.filter(p => p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk"));
const opt = (v, l, sel) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(l)}</option>`;
const sel = (name, items, cur, lbl, req = true) => `<label>${esc(t(lbl))}<select name="fx_${name}"${req ? " required" : ""}><option value="">—</option>${items.map(([v, l]) => opt(v, l, cur)).join("")}</select></label>`;
const inp = (name, lbl, cur = "", extra = "") => `<label>${esc(t(lbl))}<input name="fx_${name}" value="${esc(cur)}" ${extra}></label>`;
const lawLabel = l => `${l.kind === "decree" ? "🪶" : "📜"} №${l.no || "?"} ${l.title}`;
const constText = () => (S.constitution && S.constitution.text) || "";
const placesAll = () => [...lands().map(l => ["land_" + l.id, "🗺 " + l.name, l.id]), ...S.places.map(p => ["place_" + p.id, (p.kind === "city" ? "🏙 " : "🏘 ") + p.name + " (" + ((land(p.land) || {}).short || p.land) + ")", p.land])];

// селектор типу дії
export function fxSelect(cur = "") {
  return `<label>${esc(t("fx.what"))}<select name="fx_type" data-fxtype><option value="">${esc(t("fx.none"))}</option>${FX_GROUPS.map(([g, list]) =>
    `<optgroup label="${esc(t("fx.g." + g))}">${list.map(k => opt(k, t("fx.t." + k), cur)).join("")}</optgroup>`).join("")}</select></label><div class="fxbox" data-fxbox>${fxFields(cur)}</div>`;
}
// поля для конкретного типу
export function fxFields(type, fx = {}) {
  const arts = articles(constText());
  const artItems = arts.map(a => [a.num, a.head.length > 70 ? a.head.slice(0, 70) + "…" : a.head]);
  switch (type) {
    case "constRep": return `${sel("art", artItems, fx.art, "fx.art")}<label>${esc(t("fx.newArt"))}<textarea name="fx_text" rows="6" maxlength="20000" required data-fxart>${esc(fx.text || "")}</textarea></label><p class="hint">${esc(t("fx.constRepHint"))}</p>`;
    case "constAdd": return `${sel("after", artItems, fx.after, "fx.after", false)}<label>${esc(t("fx.newArt"))}<textarea name="fx_text" rows="5" maxlength="20000" required>${esc(fx.text || t("fx.artTpl", { n: nextArtNum(constText()) }))}</textarea></label>`;
    case "constDel": return sel("art", artItems, fx.art, "fx.art");
    case "constFull": return `<p class="hint">${esc(t("fx.constFullHint"))}</p>`;
    case "appoint": return sel("pos", S.positions.map(p => [p.id, p.title + (p.holder ? " — " + ((player(p.holder) || {}).name || "?") : "")]), fx.pos, "fx.pos") + sel("pid", cits().map(p => [p.id, p.name]), fx.pid, "fx.pid");
    case "dismiss": return sel("pos", S.positions.filter(p => p.holder).map(p => [p.id, p.title + " — " + ((player(p.holder) || {}).name || "?")]), fx.pos, "fx.pos");
    case "landRename": return sel("land", lands().map(l => [l.id, l.name]), fx.land, "fx.land") + `<div class="row2">${inp("name", "fx.newName", fx.name, 'required maxlength="80"')}${inp("short", "fx.newShort", fx.short, 'maxlength="40"')}</div>`;
    case "landSym": return sel("key", placesAll().map(([k, l]) => [k, l]), fx.key, "fx.symOf") + `<div class="row2 fxsym">${["coat", "flag"].map(f => `<div class="slot"><span class="pv" data-fxpv="${f}">${fx[f] ? `<img src="${esc(fx[f])}" alt="">` : f === "coat" ? "🛡" : "🏳"}</span><span><b>${esc(t(f === "coat" ? "sy.coat" : "sy.flag"))}</b><br><button type="button" class="ghost sm" data-fximg="${f}">${esc(t("sy.upload"))}</button></span><input type="hidden" name="fx_${f}" value="${esc(fx[f] || "")}"></div>`).join("")}</div>`;
    case "landNew": return `<div class="row2">${inp("name", "fx.newName", fx.name, 'required maxlength="80"')}${inp("short", "fx.newShort", fx.short, 'maxlength="40"')}</div><label>${esc(t("fx.color"))}<input type="color" name="fx_color" value="${esc(fx.color || "#9aa7b8")}"></label>`;
    case "landStatus": return sel("land", lands().map(l => [l.id, l.name]), fx.land, "fx.land") + sel("status", LAND_STATUSES.map(s => [s, t("ls." + s)]), fx.status || "normal", "fx.status") + inp("note", "fx.note", fx.note, 'maxlength="200"');
    case "placeMove": return sel("place", S.places.map(p => [p.id, p.name + " (" + ((land(p.land) || {}).short || p.land) + ")"]), fx.place, "fx.place") + sel("land", lands().map(l => [l.id, l.name]), fx.land, "fx.toLand");
    case "lawRepeal": case "lawRedo": return sel("law", S.laws.filter(l => l.kind === "law" && l.status !== "repealed").sort((a, b) => (b.no || 0) - (a.no || 0)).map(l => [l.id, lawLabel(l)]), fx.law, "fx.law") + (type === "lawRedo" ? `<p class="hint">${esc(t("fx.lawRedoHint"))}</p>` : "");
    case "decreeRevoke": return sel("law", S.laws.filter(l => l.kind === "decree" && l.status !== "repealed").sort((a, b) => (b.no || 0) - (a.no || 0)).map(l => [l.id, lawLabel(l)]), fx.law, "fx.decree");
    case "holidayAdd": return `<div class="row2">${inp("name", "fx.hName", fx.name, 'required maxlength="80"')}<label>${esc(t("fx.hDate"))}<input type="date" name="fx_date" required value="${fx.date ? "2026-" + esc(fx.date) : ""}"></label></div>${inp("desc", "fx.hDesc", fx.desc, 'maxlength="200"')}`;
    case "holidayDel": return sel("holiday", S.holidays.filter(h => h.kind === "state").map(h => [h.id, h.name]), fx.holiday, "fx.holiday");
    case "emerOn": return `${inp("reason", "fx.reason", fx.reason, 'required maxlength="300"')}${inp("days", "fx.days", fx.days || 7, 'type="number" min="1" max="30" required')}`;
    case "emerOff": return `<p class="hint">${esc(t("fx.emerOffHint"))}</p>`;
    default: return "";
  }
}
export function bindFx(form) {
  const ts = form.querySelector("[data-fxtype]"), box = form.querySelector("[data-fxbox]");
  if (!ts) return;
  const wire = () => {
    const a = box.querySelector("[name=fx_art]"), ta = box.querySelector("[data-fxart]");
    if (a && ta) a.onchange = () => { const x = articles(constText()).find(y => y.num === a.value); if (x) ta.value = x.body; };
    box.querySelectorAll("[data-fximg]").forEach(b => b.onclick = async () => {
      const f = b.dataset.fximg, v = await pickImage(f === "flag" ? 240 : 200); if (!v) return;
      box.querySelector(`[name=fx_${f}]`).value = v; box.querySelector(`[data-fxpv=${f}]`).innerHTML = `<img src="${esc(v)}" alt="">`;
    });
  };
  ts.onchange = () => { box.innerHTML = fxFields(ts.value); wire(); };
  wire();
}
// зчитати дію з форми
export function fxRead(form) {
  const type = (form.fx_type && form.fx_type.value) || "";
  if (!type) return null;
  const fx = { type };
  form.querySelectorAll("[name^=fx_]").forEach(i => { const k = i.name.slice(3); if (k !== "type" && i.value !== "") fx[k] = i.value; });
  if (fx.date) fx.date = fx.date.slice(5);
  if (fx.days) fx.days = Math.max(1, Math.min(30, parseInt(fx.days, 10) || 7));
  if (type === "landSym") { const pl = placesAll().find(x => x[0] === fx.key); fx.land = pl ? pl[2] : ""; if (!fx.coat && !fx.flag) throw new Error(t("fx.needImg")); }
  return fx;
}
// людський опис
export function fxDesc(fx) {
  if (!fx || !fx.type) return "";
  const P = id => (pos(id) || {}).title || id, N = id => (player(id) || {}).name || id, Ln = id => (land(id) || {}).name || id;
  const Lw = id => { const l = S.laws.find(x => x.id === id); return l ? lawLabel(l) : id; };
  const k = fx.type, T = t("fx.t." + k);
  switch (k) {
    case "constRep": case "constDel": return `${T}: ${t("fx.artN", { n: fx.art })}`;
    case "constAdd": return `${T}${fx.after ? " (" + t("fx.afterN", { n: fx.after }) + ")" : ""}`;
    case "appoint": return `${T}: ${P(fx.pos)} — ${N(fx.pid)}`;
    case "dismiss": return `${T}: ${P(fx.pos)}`;
    case "landRename": return `${T}: ${Ln(fx.land)} → ${fx.name}`;
    case "landSym": { const x = placesAll().find(y => y[0] === fx.key); return `${T}: ${x ? x[1] : fx.key}`; }
    case "landNew": return `${T}: ${fx.name}`;
    case "landStatus": return `${T}: ${Ln(fx.land)} — ${t("ls." + fx.status)}`;
    case "placeMove": return `${T}: ${((S.places.find(p => p.id === fx.place)) || {}).name || fx.place} → ${Ln(fx.land)}`;
    case "lawRepeal": case "lawRedo": case "decreeRevoke": return `${T}: ${Lw(fx.law)}`;
    case "holidayAdd": return `${T}: ${fx.name} (${fx.date ? fx.date.split("-").reverse().join(".") : ""})`;
    case "holidayDel": return `${T}: ${((S.holidays.find(h => h.id === fx.holiday)) || {}).name || fx.holiday}`;
    case "emerOn": return `${T}: ${t("fx.daysN", { n: fx.days })} — ${fx.reason || ""}`;
    default: return T;
  }
}
// картка дії на сторінці законопроєкту
export function fxCard(b) {
  if (!b.fx || !b.fx.type) return "";
  const st = b.fxDone ? `<span class="tag ok">✅ ${esc(t("fx.done"))}</span>` : b.fxErr ? `<span class="tag bad">⚠️ ${esc(t("fx.err"))}: ${esc(b.fxErr)}</span>`
    : fxPending(b) ? `<span class="tag warn">⏳ ${esc(t("fx.pending"))}</span>` : `<span class="tag">${esc(t("fx.ifPassed"))}</span>`;
  let extra = "";
  if (["constRep", "constAdd"].includes(b.fx.type) && b.fx.text) extra = `<details><summary class="hint">${esc(t("fx.showText"))}</summary><pre class="fxpre">${esc(b.fx.text)}</pre></details>`;
  if (b.fx.type === "landSym") extra = `<div class="row">${b.fx.coat ? `<img class="fxim" src="${esc(b.fx.coat)}" alt="${esc(t("sy.coat"))}">` : ""}${b.fx.flag ? `<img class="fxim flag" src="${esc(b.fx.flag)}" alt="${esc(t("sy.flag"))}">` : ""}</div>`;
  return `<section class="card fxcard"><h2>⚙️ ${esc(t("fx.title"))}</h2><p><b>${esc(b.fxText || fxDesc(b.fx))}</b></p>${extra}<p>${st}</p>
    ${isAdmin() && fxPending(b) ? `<button type="button" class="sm primary" data-fxapply>⚙️ ${esc(t("fx.applyNow"))}</button>` : ""}</section>`;
}
// застосувати (адмін — одразу; інакше це зробить бот)
export async function applyFx(b, quiet) {
  const law = S.laws.find(l => l.bill === b.id) || null;
  let ops;
  try { ops = fxOps(b, { positions: S.positions, lands: lands(), places: S.places, laws: S.laws, holidays: S.holidays, constitution: S.constitution, law }, B.now()); }
  catch (e) { return run(() => B.update("ud_bills", b.id, { fxErr: String(e.message || e).slice(0, 200) })); }
  ops.push({ op: "update", c: "ud_bills", id: b.id, v: { fxDone: true, fxAt: B.now(), fxErr: "" } });
  const ok = await run(() => B.batch(ops), quiet ? undefined : t("fx.applied"));
  if (ok) log("law", `⚙️ ${b.title}: ${b.fxText || fxDesc(b.fx)}`);
  return ok;
}
export function bindFxCard(root, b) {
  const a = root.querySelector("[data-fxapply]"); if (a) a.onclick = () => applyFx(b);
}
