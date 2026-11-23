// 🏛 Держава: Влада · Палата Земель · Вибори · Карта · Дипломатія
import { S, B, pos, player, lands, landsFromPlan, positionsOf, canAppoint, isAdmin, canLands, log } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, confirmBox, toast } from "../ui.js";
import { tabs, soon, txt, empty } from "./common.js";
import * as chamber from "./chamber.js";
import * as elections from "./elections.js";
import * as diplo from "./diplo.js";
import * as map from "./map.js";

const TABS = [["vlada", "👑", "st.tab.power"], ["palata", "🏛", "st.tab.chamber"], ["vybory", "🗳", "st.tab.elections"], ["karta", "🗺", "st.tab.map"], ["dyplomatiya", "🤝", "st.tab.diplo"]];

export const DEFAULT_POSITIONS = [
  ["hetman", "Гетьман", "election"], ["pysar", "Генеральний писар", "hetman"], ["finance", "Секретар фінансів", "hetman"],
  ["interior", "Секретар внутрішніх справ", "hetman"], ["foreign", "Секретар закордонних справ", "hetman"],
  ["defense", "Секретар оборони (головнокомандувач)", "hetman"], ["press", "Прес-секретар", "hetman"], ["prosecutor", "Прокурор", "hetman"],
];

export function render(parts) {
  const cur = TABS.some(x => x[0] === parts[0]) ? parts[0] : "vlada";
  let h = `<h1 class="ptitle">🏛 ${esc(t("nav.state"))}</h1>${tabs("derzhava", TABS, cur)}`;
  if (cur === "vlada") h += power();
  else if (cur === "karta") h += map.render(parts);
  else if (cur === "palata") h += chamber.render(parts);
  else if (cur === "vybory") h += elections.render(parts);
  else h += diplo.render(parts);
  return h;
}

// ---------- Влада ----------
const citizens = () => S.players.filter(p => p.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk"));
function holderSelect(p) {
  return `<select data-hold="${esc(p.id)}" aria-label="${esc(t("pw.holder"))}: ${esc(p.title)}"><option value="">— ${esc(t("vacant"))} —</option>${citizens().map(c => `<option value="${esc(c.id)}"${c.id === p.holder ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`;
}
function posCard(p, big) {
  const pl = player(p.holder);
  const edit = EDIT && canAppoint(p);
  const adm = EDIT && isAdmin();
  return `<div class="pcard${big ? " big" : ""}">
    ${avatar(pl || { name: "?" }, big ? "av xl" : "av lg")}
    <div class="pct">
      ${adm ? `<input type="text" class="ttl" data-ptitle="${esc(p.id)}" value="${esc(p.title)}" maxlength="80" aria-label="${esc(t("pw.title"))}">` : `<small>${esc(p.title)}</small>`}
      ${edit ? holderSelect(p) : `<b>${pl ? `<a href="#/narod/gravets/${esc(pl.id)}">${esc(pl.name)}</a>` : `<i class="vac">${esc(t("vacant"))}</i>`}</b>`}
      ${adm ? `<div class="row sm"><label class="fl">${esc(t("pw.by"))} <select data-pby="${esc(p.id)}">${[["hetman", "pw.by.hetman"], ["election", "pw.by.election"], ["admin", "pw.by.admin"]].map(([k, l]) => `<option value="${k}"${p.appointBy === k ? " selected" : ""}>${esc(t(l))}</option>`).join("")}</select></label>
        ${p.id === "hetman" ? "" : `<button type="button" class="ghost sm danger" data-pdel="${esc(p.id)}">${esc(t("delete"))}</button>`}</div>`
        : (EDIT && p.appointBy !== "hetman" && !isAdmin() ? `<p class="hint">${esc(t(p.appointBy === "election" ? "pw.byElection" : "pw.byAdmin"))}</p>` : "")}
    </div></div>`;
}
function power() {
  let h = txt("derzhava", "power.intro", t("pw.intro"), { cls: "lead" });
  if (!S.positions.length) {
    h += `<div class="card">${empty(t("pw.none"))}${isAdmin() ? `<button type="button" class="primary" data-pseed>${esc(t("pw.seed"))}</button>` : ""}</div>`;
    return h;
  }
  const het = pos("hetman");
  const gov = S.positions.filter(p => p.id !== "hetman" && !p.chamber && !p.land);
  if (het) h += `<section class="card hetman">${posCard(het, true)}</section>`;
  h += `<section class="card"><h2>${esc(t("pw.gov"))}</h2><div class="pgrid">${gov.map(p => posCard(p)).join("")}</div>
    ${EDIT && isAdmin() ? `<form class="row addpos" data-padd><input type="text" name="title" maxlength="80" placeholder="${esc(t("pw.newTitle"))}" required><button class="sm">+ ${esc(t("pw.add"))}</button></form>` : ""}</section>`;
  return h;
}

export function mount(root, parts) {
  const cur = parts[0] || "vlada";
  if (cur === "palata") return chamber.mount(root, parts);
  if (cur === "vybory") return elections.mount(root, parts);
  if (cur === "dyplomatiya") return diplo.mount(root, parts);
  if (cur === "karta") return map.mount(root, parts);
  root.querySelectorAll("[data-hold]").forEach(s => s.onchange = async () => {
    const p = pos(s.dataset.hold); const pl = player(s.value);
    if (await run(() => B.update("ud_positions", p.id, { holder: s.value || "", since: B.now() }), t("saved")))
      log("appoint", `${p.title}: ${pl ? pl.name : t("vacant")}`);
  });
  root.querySelectorAll("[data-ptitle]").forEach(i => i.onchange = async () => {
    const v = i.value.trim(); if (!v) return;
    if (await run(() => B.update("ud_positions", i.dataset.ptitle, { title: v }), t("saved"))) log("position", `${t("pw.renamed")}: ${v}`);
  });
  root.querySelectorAll("[data-pby]").forEach(s => s.onchange = () => run(() => B.update("ud_positions", s.dataset.pby, { appointBy: s.value }), t("saved")));
  root.querySelectorAll("[data-pdel]").forEach(b => b.onclick = async () => {
    const p = pos(b.dataset.pdel);
    if (!(await confirmBox(t("pw.delq", { x: p.title }), t("delete")))) return;
    if (await run(() => B.del("ud_positions", p.id), t("deleted"))) log("position", `${t("deleted")}: ${p.title}`);
  });
  const f = root.querySelector("[data-padd]");
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const title = f.title.value.trim(); if (!title) return;
    const order = Math.max(0, ...S.positions.map(p => p.order || 0)) + 1;
    if (await run(() => B.set("ud_positions", B.newId("ud_positions"), { title, order, appointBy: "hetman", holder: "" }), t("saved"))) log("position", `+ ${title}`);
  };
  const seed = root.querySelector("[data-pseed]");
  if (seed) seed.onclick = async () => {
    if (await run(() => B.batch(DEFAULT_POSITIONS.map(([id, title, by], i) => ({ op: "set", c: "ud_positions", id, v: { title, order: i, appointBy: by, holder: "" } }))), t("saved")))
      log("position", t("pw.seed"));
  };
}
