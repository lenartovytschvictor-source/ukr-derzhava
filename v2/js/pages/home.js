// 🏠 Головна. На етапі 1: привітання, влада зараз, коротко про державу.
// Новини, «що зараз відбувається», план розвитку й свята з'являться на етапі 7.
import { S, pos, player, lands, me } from "../store.js";
import { t } from "../i18n.js";
import { esc, avatar } from "../ui.js";
import { txt } from "./common.js";

const POWER = ["hetman", "chair", "pysar", "defense", "interior", "foreign", "finance"];

export function render() {
  const u = S.user, m = me();
  let h = "";
  if (!u || !m) {
    h += `<section class="hero card">
      <img src="img/gerb-192.png" alt="" width="88" height="88">
      <div><h1>${esc(t("home.title"))}</h1>${txt("home", "intro", t("home.intro"))}
      <div class="row">${!u ? `<button type="button" class="primary" data-act="login">${esc(t("login"))}</button>` : `<a class="btn primary" href="#/profil">${esc(t("home.join"))}</a>`}
      <a class="btn ghost" href="#/narod/istoriya">${esc(t("home.history"))}</a></div></div></section>`;
  }
  const people = POWER.map(pos).filter(Boolean);
  h += `<section class="card"><h2>${esc(t("home.power"))}</h2>${people.length ? `<div class="power">${people.map(p => {
      const pl = player(p.holder);
      return `<a class="pw" href="${pl ? "#/narod/gravets/" + esc(pl.id) : "#/derzhava/vlada"}">${avatar(pl || { name: "?" }, "av md")}<span><small>${esc(p.title)}</small><b>${pl ? esc(pl.name) : `<i class="vac">${esc(t("vacant"))}</i>`}</b></span></a>`;
    }).join("")}</div>` : `<p class="empty">${esc(t("home.nopower"))}</p>`}</section>`;
  const cit = S.players.filter(p => p.status === "cit").length;
  const tour = S.players.filter(p => p.status === "tour").length;
  h += `<section class="stats">
    <a class="stat card" href="#/narod/gromadyany"><b>${cit}</b><span>${esc(t("home.citizens"))}</span></a>
    <a class="stat card" href="#/narod/gromadyany"><b>${tour}</b><span>${esc(t("home.tourists"))}</span></a>
    <a class="stat card" href="#/derzhava/karta"><b>${lands().length}</b><span>${esc(t("home.lands"))}</span></a></section>`;
  h += `<section class="card muted small">${esc(t("home.building"))}</section>`;
  return h;
}
