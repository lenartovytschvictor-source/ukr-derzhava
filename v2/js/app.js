// Головний файл: запуск, шапка, меню, маршрути й режим редагування.
import { asset } from "./ui.js";
import { applySeason, seasonNow } from "./season.js";
import { S, DEMO, B, initStore, onChange, loadDefaults, me, isAdmin, canEditAnything, unreadTotal, emergency } from "./store.js";
import { t, LANGS, lang, setLang } from "./i18n.js";
import { esc, avatar, run, toast } from "./ui.js";
import * as home from "./pages/home.js";
import * as state from "./pages/state.js";
import * as law from "./pages/law.js";
import * as people from "./pages/people.js";
import * as news from "./pages/news.js";
import * as chat from "./pages/chat.js";
import * as profile from "./pages/profile.js";
import * as admin from "./pages/admin.js";

const PAGES = { "": home, derzhava: state, zakon: law, narod: people, chat, profil: profile, admin, novyny: news };
const NAV = [
  ["", "🏠", "nav.home"], ["derzhava", "🏛", "nav.state"], ["zakon", "⚖️", "nav.law"], ["narod", "👥", "nav.people"], ["chat", "💬", "nav.chat"],
];

export const R = { page: "", parts: [] };
export let EDIT = false;
try { EDIT = sessionStorage.getItem("ud2-edit") === "1"; } catch (_) {}

function parseRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const parts = h.split("/").filter(Boolean);
  R.page = PAGES[parts[0]] ? parts[0] : "";
  R.parts = parts.slice(1);
}
export function go(path) { location.hash = "#/" + path; }

// ---------- шапка й меню ----------
function header() {
  const u = S.user, m = me();
  const editBtn = u && canEditAnything()
    ? `<button type="button" class="editsw${EDIT ? " on" : ""}" data-act="edit" aria-pressed="${EDIT}" title="${esc(t("edit.toggle"))}">✏️<span>${esc(EDIT ? t("edit.on") : t("edit.off"))}</span></button>` : "";
  const who = u
    ? `<a class="me" href="#/profil" title="${esc(t("nav.profile"))}">${avatar(m || { name: u.name || u.email }, "av sm")}</a>`
    : `<button type="button" class="primary sm" data-act="login">${esc(t("login.short"))}</button>`;
  return `<header class="top">
    <a class="brand" href="#/"><img src="${esc((S.site && S.site.coat) || asset("img/gerb-192.png"))}" alt="" width="36" height="36"><span><b>${esc(t("site.name"))}${{ hw: " 🎃", xm: " 🎄" }[seasonNow()] || ""}</b><small>${esc(t("site.sub"))}</small></span></a>
    <div class="tools">
      ${editBtn}
      <label class="langsel"><span class="sr">${esc(t("lang"))}</span><select data-act="lang" aria-label="${esc(t("lang"))}">${LANGS.map(([k, l]) => `<option value="${k}"${k === lang() ? " selected" : ""} title="${l}">${k.toUpperCase()}</option>`).join("")}</select></label>
      ${who}
    </div>
  </header>`;
}
function nav() {
  return `<nav class="menu" aria-label="${esc(t("nav.main"))}">${NAV.map(([k, ic, l]) =>
    `<a href="#/${k}" class="${R.page === k ? "act" : ""}"${R.page === k ? ' aria-current="page"' : ""}><span class="ic" aria-hidden="true">${ic}</span><span>${esc(t(l))}</span>${k === "chat" && unreadTotal() ? `<span class="nbadge" aria-label="${esc(t("cht.unread"))}">${unreadTotal() > 99 ? "99+" : unreadTotal()}</span>` : ""}</a>`).join("")}</nav>`;
}
function demoBar() {
  if (!DEMO) return "";
  return `<div class="demobar">🧪 ${esc(t("demo.bar"))} <select data-act="demo-user" aria-label="${esc(t("demo.who"))}">${B.USERS.map(x => `<option value="${x.key}"${x.key === B.demoUserKey() ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select>
    <button type="button" class="ghost sm" data-act="demo-reset">${esc(t("demo.reset"))}</button></div>`;
}

// ---------- малювання ----------
let pending = false;
function busyTyping() {
  const a = document.activeElement;
  return a && a.closest && a.closest("#main") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.dataset.live && a.type !== "checkbox";
}
export function render(force) {
  if (!force && busyTyping()) { pending = true; return; }
  pending = false;
  const app = document.getElementById("app");
  document.documentElement.lang = lang();
  document.body.classList.toggle("editing", EDIT);
  if (!S.ready) { app.innerHTML = `<div class="boot"><img src="${asset("img/gerb-192.png")}" alt="" width="96" height="96"><p>${esc(t("loading"))}</p></div>`; return; }
  const P = PAGES[R.page] || home;
  let body;
  try { body = P.render(R.parts); } catch (e) { console.error(e); body = `<div class="card err">${esc(t("err.render"))} ${esc(e.message)}</div>`; }
  const y = window.scrollY;
  const em = emergency();
  const emBar = em ? `<div class="emerbar" role="alert">🚨 <b>${esc(t("em.bar"))}</b>${em.reason ? " — " + esc(em.reason) : ""} <span>${esc(t("em.until", { x: new Date(em.until).toLocaleString(lang(), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) }))}</span></div>` : "";
  app.innerHTML = `${demoBar()}${header()}${nav()}${emBar}<main id="main" tabindex="-1">${S.err && isAdmin() ? `<div class="card warn small">⚠️ ${esc(S.err)}</div>` : ""}${body}</main>
    <footer class="foot">${esc(t("site.name"))} · DragPolit</footer>`;
  if (P.mount) try { P.mount(document.getElementById("main"), R.parts); } catch (e) { console.error(e); }
  try { applySeason(); } catch (e) { console.error(e); }
  window.scrollTo(0, y);
}
document.addEventListener("focusout", () => { if (pending) setTimeout(() => { if (!busyTyping() && pending) render(); }, 50); });

// ---------- загальні дії ----------
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const a = b.dataset.act;
  if (a === "login") { e.preventDefault(); await run(() => B.signIn()); }
  else if (a === "logout") { await run(() => B.signOut()); location.hash = "#/"; }
  else if (a === "edit") { EDIT = !EDIT; try { sessionStorage.setItem("ud2-edit", EDIT ? "1" : "0"); } catch (_) {} toast(EDIT ? t("edit.onmsg") : t("edit.offmsg")); render(); }
  else if (a === "demo-reset") { if (confirm(t("demo.resetq"))) B.demoReset(); }
});
document.addEventListener("change", e => {
  const s = e.target.closest("[data-act]");
  if (!s) return;
  if (s.dataset.act === "lang") { setLang(s.value); render(); }
  else if (s.dataset.act === "demo-user") B.demoSwitch(s.value);
});

// перехід на іншу сторінку малюємо завжди, навіть якщо курсор стоїть у полі вводу
window.addEventListener("hashchange", () => { const prev = R.page + "/" + R.parts.join("/"); parseRoute(); render(true); if (prev.split("/")[0] !== R.page) window.scrollTo(0, 0); });

(async function boot() {
  parseRoute();
  render();
  try {
    await loadDefaults();
    onChange(render);
    await initStore();
  } catch (e) {
    console.error(e);
    document.getElementById("app").innerHTML = `<div class="boot"><img src="${asset("img/gerb-192.png")}" alt="" width="96" height="96"><p>${esc(t("err.boot"))}</p><p class="hint">${esc(String(e.message || e))}</p></div>`;
  }
})();
