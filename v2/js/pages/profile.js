// 👤 Профіль: мій профіль, прописка, заявка на громадянство, налаштування, вихід.
import { S, B, me, lands, land, positionsOf, isAdmin, log } from "../store.js";
import { t, LANGS, lang, setLang } from "../i18n.js";
import { render as rerender } from "../app.js";
import { esc, avatar, profUrl, run, profNum, toast } from "../ui.js";
import { statusLabel, statusIcon } from "./common.js";

export function render() {
  const u = S.user;
  if (!u) return `<section class="card center"><h1>${esc(t("nav.profile"))}</h1><p>${esc(t("pf.needLogin"))}</p><button type="button" class="primary" data-act="login">${esc(t("login"))}</button></section>`;
  const m = me();
  let h = `<h1 class="ptitle">👤 ${esc(t("nav.profile"))}</h1>`;
  if (m) {
    const ps = positionsOf(m.id); const L = land(m.land); const pu = profUrl(m);
    h += `<section class="card pprof">${avatar(m, "av xl")}<div><h2>${esc(m.name)}</h2>
      <p class="tags"><span class="tag st-${esc(m.status)}">${statusIcon(m.status)} ${esc(statusLabel(m.status))}</span>${m.since ? `<span class="tag">📅 ${esc(t("pl.since"))} ${esc(m.since)}</span>` : ""}</p>
      ${ps.length ? `<p><b>${esc(t("pl.positions"))}:</b> ${esc(ps.map(x => x.title).join(" · "))}</p>` : ""}
      <p class="row"><a class="btn ghost sm" href="#/narod/gravets/${esc(m.id)}">${esc(t("pf.public"))}</a>${pu ? `<a class="btn ghost sm" href="${esc(pu)}" target="_blank" rel="noopener">${esc(t("pl.gameProfile"))} ↗</a>` : ""}</p></div></section>
    <section class="card"><h2>🗺 ${esc(t("pf.residence"))}</h2><p class="hint">${esc(t("pf.residenceHint"))}</p>
      <select data-myland aria-label="${esc(t("pf.residence"))}"><option value="">— ${esc(t("pf.noLand"))} —</option>${lands().map(l => `<option value="${esc(l.id)}"${m.land === l.id ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select>
      ${L ? `<p class="hint">${esc(t("pf.livesIn", { x: L.name }))}</p>` : ""}</section>`;
  } else h += applyBlock();
  h += `<section class="card"><h2>⚙️ ${esc(t("pf.settings"))}</h2>
    <label class="fl">${esc(t("lang"))} <select data-mylang>${LANGS.map(([k, l]) => `<option value="${k}"${k === lang() ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <p class="hint">${esc(t("pf.signedAs"))} <b>${esc(u.email)}</b></p>
    <div class="row">${isAdmin() ? `<a class="btn sm" href="#/admin">🛠 ${esc(t("nav.admin"))}</a>` : ""}<button type="button" class="ghost sm" data-act="logout">${esc(t("logout"))}</button></div></section>
    <section class="card muted small">${esc(t("pf.later"))}</section>`;
  return h;
}

function applyBlock() {
  const a = S.myApp;
  if (a && a.status === "new") return `<section class="card"><h2>📨 ${esc(t("ap.mine"))}</h2><p>${esc(t("ap.pending", { k: t(a.kind === "cit" ? "ap.kind.cit" : "ap.kind.tour") }))}</p>
    <p class="hint">${esc(a.name)}${a.profile ? " · " + esc(t("pl.profile")) + " " + esc(a.profile) : ""}</p><button type="button" class="ghost sm danger" data-apcancel>${esc(t("ap.cancel"))}</button></section>`;
  return `<section class="card"><h2>📝 ${esc(t("ap.title"))}</h2>
    ${a && a.status === "no" ? `<p class="warn">${esc(t("ap.wasRejected"))}</p>` : ""}
    <p>${esc(t("ap.intro"))}</p>
    <form class="form" data-apform>
      <fieldset class="kinds"><legend class="sr">${esc(t("ap.kind"))}</legend>
        <label class="kind"><input type="radio" name="kind" value="cit" checked><span><b>🪪 ${esc(t("ap.kind.cit"))}</b><small>${esc(t("ap.kind.citHint"))}</small></span></label>
        <label class="kind"><input type="radio" name="kind" value="tour"><span><b>🧳 ${esc(t("ap.kind.tour"))}</b><small>${esc(t("ap.kind.tourHint"))}</small></span></label></fieldset>
      <label>${esc(t("ap.name"))}<input name="name" required maxlength="60" value="${esc((a && a.name) || "")}"></label>
      <label>${esc(t("pl.profile"))}<input name="profile" required maxlength="80" placeholder="https://dragpolit.com/profile/257" value="${esc((a && a.profile) || "")}"></label>
      <label>${esc(t("ap.note"))}<textarea name="note" maxlength="500" rows="3"></textarea></label>
      <button class="primary">${esc(t("ap.send"))}</button></form></section>`;
}

export function mount(root) {
  const sl = root.querySelector("[data-myland]");
  if (sl) sl.onchange = async () => {
    const m = me(); const L = land(sl.value);
    if (await run(() => B.update("ud_players", m.id, { land: sl.value }), t("saved"))) log("land", `${m.name} → ${L ? L.name : "—"}`);
  };
  const ml = root.querySelector("[data-mylang]"); if (ml) ml.onchange = () => { setLang(ml.value); rerender(); };
  const f = root.querySelector("[data-apform]");
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const name = f.name.value.trim(), profile = profNum(f.profile.value);
    if (!name) return;
    if (!profile) return toast(t("ap.badProfile"), "err");
    const v = { name: name.slice(0, 60), profile, kind: f.kind.value, note: f.note.value.trim().slice(0, 500), status: "new", at: B.now() };
    if (await run(() => B.set("ud_apps", S.user.email, v), t("ap.sent"))) log("app", `📨 ${name}`);
  };
  const c = root.querySelector("[data-apcancel]");
  if (c) c.onclick = () => run(() => B.del("ud_apps", S.user.email), t("ap.cancelled"));
}
