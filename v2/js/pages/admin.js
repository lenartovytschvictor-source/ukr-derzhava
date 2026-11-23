// 🛠 Адмінпанель: гравці, адміни, перенесення зі старого сайту, журнал, резервна копія.
import { S, B, OWNERS, isAdmin, isOwner, player, land, positionsOf, emailOf, log } from "../store.js";
import { render as rerender } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, run, toast, confirmBox, fmtDate, normEmail, okEmail, profNum, today } from "../ui.js";
import { tabs, empty, statusLabel, statusIcon } from "./common.js";
import { playerForm } from "./people.js";

const TABS = [["gravtsi", "👥", "ad.tab.players"], ["admins", "🛡", "ad.tab.admins"], ["perenesennya", "📦", "ad.tab.migrate"], ["zhurnal", "📒", "ad.tab.log"], ["kopiya", "💾", "ad.tab.backup"]];

export function render(parts) {
  if (!S.user) return `<section class="card center"><p>${esc(t("pf.needLogin"))}</p><button type="button" class="primary" data-act="login">${esc(t("login"))}</button></section>`;
  if (!isAdmin()) return `<section class="card center">${empty(t("ad.noAccess"))}</section>`;
  const cur = TABS.some(x => x[0] === parts[0]) ? parts[0] : "gravtsi";
  let h = `<h1 class="ptitle">🛠 ${esc(t("nav.admin"))}</h1>${tabs("admin", TABS, cur)}`;
  if (cur === "gravtsi") h += playersTab();
  else if (cur === "admins") h += adminsTab();
  else if (cur === "perenesennya") h += migrateTab();
  else if (cur === "zhurnal") h += `<section class="card"><h2>${esc(t("ad.tab.log"))}</h2><div data-log>${esc(t("loading"))}</div></section>`;
  else h += backupTab();
  return h;
}

// ---------- Гравці ----------
function playersTab() {
  const all = S.players.slice().sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const unlinked = all.filter(p => !emailOf(p.id)).length;
  return `<section class="card"><div class="row between"><h2>${esc(t("ad.tab.players"))} <span class="badge">${all.length}</span></h2><button type="button" class="primary sm" data-padd>+ ${esc(t("pl.add"))}</button></div>
    <p class="hint">${esc(t("ad.unlinked", { n: unlinked }))}</p>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>${esc(t("pl.name"))}</th><th>${esc(t("pl.status"))}</th><th>${esc(t("pl.land"))}</th><th>${esc(t("pl.email"))}</th><th>${esc(t("pl.positions"))}</th><th></th></tr></thead><tbody>
    ${all.map(p => { const L = land(p.land); const m = emailOf(p.id); return `<tr><td><span class="cellp">${avatar(p, "av sm")}<a href="#/narod/gravets/${esc(p.id)}">${esc(p.name)}</a></span></td>
      <td>${statusIcon(p.status)} ${esc(statusLabel(p.status))}</td><td>${L ? esc(L.short || L.name) : "—"}</td><td>${m ? esc(m) : `<span class="muted">${esc(t("ad.noMail"))}</span>`}</td>
      <td class="small">${esc(positionsOf(p.id).map(x => x.title).join(", "))}</td><td><button type="button" class="ghost sm" data-pedit="${esc(p.id)}" aria-label="${esc(t("edit"))}: ${esc(p.name)}">✏️</button></td></tr>`; }).join("")}
    </tbody></table></div></section>`;
}

// ---------- Адміни ----------
function adminsTab() {
  return `<section class="card"><h2>${esc(t("ad.tab.admins"))}</h2><p class="hint">${esc(t("ad.adminsHint"))}</p>
    <ul class="list">${OWNERS.map(e => `<li>🔒 ${esc(e)} <span class="tag">${esc(t("ad.owner"))}</span></li>`).join("")}
    ${S.admins.map(e => `<li>🛡 ${esc(e)} <button type="button" class="ghost sm danger" data-adrm="${esc(e)}">${esc(t("delete"))}</button></li>`).join("")}</ul>
    <form class="row" data-adadd><input type="email" name="email" required placeholder="name@gmail.com" aria-label="${esc(t("pl.email"))}"><button class="sm">+ ${esc(t("ad.addAdmin"))}</button></form></section>`;
}

// ---------- Перенесення зі старого сайту ----------
let MIG = null;   // { players: [...], hist: {...} }
function migrateTab() {
  let h = `<section class="card"><h2>📦 ${esc(t("ad.migPlayers"))}</h2><p>${esc(t("ad.migPlayersHint"))}</p>`;
  if (!MIG || !MIG.players) h += `<button type="button" class="primary" data-migload>${esc(t("ad.migLoad"))}</button>`;
  else {
    const rows = MIG.players;
    const neu = rows.filter(r => !r.exists).length;
    h += `<p><b>${esc(t("ad.migFound", { n: rows.length, k: neu }))}</b></p>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>${esc(t("pl.name"))}</th><th>${esc(t("pl.status"))}</th><th>${esc(t("pl.email"))}</th><th>${esc(t("pl.profile"))}</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.exists ? "muted" : ""}"><td>${esc(r.name)}</td><td>${statusIcon(r.status)} ${esc(statusLabel(r.status))}</td><td>${esc(r.email || "—")}</td><td>${esc(r.profile || "—")}</td><td>${r.exists ? esc(t("ad.migExists")) : "✓"}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="row"><button type="button" class="primary" data-migrun ${neu ? "" : "disabled"}>${esc(t("ad.migRun", { n: neu }))}</button><button type="button" class="ghost" data-migload>${esc(t("ad.migReload"))}</button></div>`;
  }
  h += `</section><section class="card"><h2>📜 ${esc(t("ad.migHist"))}</h2><p>${esc(t("ad.migHistHint"))}</p>
    ${S.history ? `<p class="hint">✓ ${esc(t("ad.histSaved"))}</p>` : ""}
    <button type="button" class="primary" data-mighist>${esc(t("ad.migHistRun"))}</button></section>`;
  return h;
}

async function loadOldPlayers() {
  const d = await B.get("site", "players");
  let list = [];
  if (d && d.json) { try { list = JSON.parse(d.json).list || []; } catch (_) {} }
  if (!list.length) {   // реєстр міг лежати всередині site/state
    const s = await B.get("site", "state");
    if (s && s.json) { try { list = ((JSON.parse(s.json).sections || []).find(x => x.kind === "players") || {}).list || []; } catch (_) {} }
  }
  const names = new Set(S.players.map(p => p.name.toLowerCase()));
  const mails = new Set(S.links.map(l => l.id));
  return list.filter(p => String(p.name || "").trim()).map(p => {
    const email = normEmail(p.email);
    return {
      name: String(p.name).trim().slice(0, 60), email: okEmail(email) ? email : "", profile: profNum(p.profile) || "",
      status: p.exiled ? "exiled" : p.tourist ? "tour" : "cit", since: String(p.since || "").slice(0, 20), img: String(p.img || ""),
      exists: names.has(String(p.name).trim().toLowerCase()) || (okEmail(email) && mails.has(email)),
    };
  });
}
async function resolveImg(v) {
  if (!v) return "";
  if (v.startsWith("img:")) { try { const d = await B.get("images", v.slice(4)); v = (d && d.data) || ""; } catch (_) { v = ""; } }
  if (v.startsWith("data:") && v.length > 150000) return "";   // завеликі картинки не переносимо — підтягнеться аватар із гри
  return v.startsWith("data:") || v.startsWith("https://") ? v : "";
}
async function runMigration() {
  const rows = MIG.players.filter(r => !r.exists);
  const seen = new Set();
  const ops = [];
  for (const r of rows) {
    if (seen.has(r.name.toLowerCase())) continue; seen.add(r.name.toLowerCase());
    const id = B.newId("ud_players");
    ops.push({ op: "set", c: "ud_players", id, v: { name: r.name, profile: r.profile, status: r.status, land: "", since: r.since || today(), img: await resolveImg(r.img), at: B.now() } });
    if (r.email && !seen.has(r.email)) { seen.add(r.email); ops.push({ op: "set", c: "ud_links", id: r.email, v: { pid: id } }); }
  }
  for (let i = 0; i < ops.length; i += 400) await B.batch(ops.slice(i, i + 400));
  return rows.length;
}
async function migrateHistory() {
  let h = null;
  const s = await B.get("site", "state");
  if (s && s.json) { try { h = (JSON.parse(s.json).sections || []).find(x => x.kind === "history") || null; } catch (_) {} }
  if (!h || !(h.tree || []).length) h = await (await fetch("data/history-default.json")).json();
  const tree = await Promise.all((h.tree || []).map(async n => ({ ...n, img: await resolveImg(n.img || "") })));
  const doc = { tree, events: h.events || [], at: B.now(), by: S.user.email };
  if (Array.isArray(h.arrows)) doc.arrows = h.arrows;
  if (JSON.stringify(doc).length > 900000) throw new Error(t("hs.tooBig"));
  await B.set("ud_history", "main", doc);
}

// ---------- Резервна копія ----------
const COLS = ["ud_players", "ud_links", "ud_positions", "ud_config", "ud_texts", "ud_history", "ud_apps", "ud_log"];
function backupTab() {
  return `<section class="card"><h2>💾 ${esc(t("ad.tab.backup"))}</h2><p>${esc(t("ad.backupHint"))}</p><button type="button" class="primary" data-backup>${esc(t("ad.backupRun"))}</button></section>`;
}

export function mount(root, parts) {
  const pa = root.querySelector("[data-padd]"); if (pa) pa.onclick = () => playerForm(null);
  root.querySelectorAll("[data-pedit]").forEach(b => b.onclick = () => playerForm(player(b.dataset.pedit)));
  // адміни
  const af = root.querySelector("[data-adadd]");
  if (af) af.onsubmit = async e => {
    e.preventDefault(); const em = normEmail(af.email.value);
    if (!okEmail(em)) return toast(t("pl.badEmail"), "err");
    if (OWNERS.includes(em) || S.admins.includes(em)) return toast(t("ad.already"), "err");
    if (await run(() => B.set("ud_config", "admins", { emails: [...S.admins, em] }), t("saved"))) log("admins", `+ ${em}`);
  };
  root.querySelectorAll("[data-adrm]").forEach(b => b.onclick = async () => {
    const em = b.dataset.adrm;
    if (em === S.user.email && !isOwner() && !(await confirmBox(t("ad.rmSelf"), t("delete")))) return;
    if (await run(() => B.set("ud_config", "admins", { emails: S.admins.filter(x => x !== em) }), t("saved"))) log("admins", `− ${em}`);
  });
  // перенесення
  root.querySelectorAll("[data-migload]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    const r = await run(() => loadOldPlayers());
    if (r) { MIG = { ...(MIG || {}), players: r }; if (!r.length) toast(t("ad.migNone"), "err"); }
    rerender();
  });
  const mr = root.querySelector("[data-migrun]");
  if (mr) mr.onclick = async () => {
    if (!(await confirmBox(t("ad.migConfirm"), t("ad.migGo")))) return;
    mr.disabled = true; mr.textContent = t("loading");
    const n = await run(() => runMigration());
    if (n) { toast(t("ad.migDone", { n }), "ok"); log("migrate", t("ad.migDone", { n })); MIG = null; rerender(); }
    else mr.disabled = false;
  };
  const mh = root.querySelector("[data-mighist]");
  if (mh) mh.onclick = async () => {
    if (S.history && !(await confirmBox(t("ad.histOverwrite"), t("ad.migGo")))) return;
    mh.disabled = true;
    if (await run(() => migrateHistory(), t("ad.histDone"))) log("migrate", t("ad.histDone"));
    mh.disabled = false;
  };
  // журнал
  const lg = root.querySelector("[data-log]");
  if (lg) B.list("ud_log").then(r => {
    r.sort((a, b) => ts(b.at) - ts(a.at));
    const name = em => { const l = S.links.find(x => x.id === em); const p = l && player(l.pid); return p ? p.name : em; };
    lg.innerHTML = r.length ? `<ul class="loglist">${r.slice(0, 300).map(x => `<li><span class="hint">${esc(fmtDate(x.at))}</span> <b>${esc(name(x.by))}</b> — ${esc(x.text)}</li>`).join("")}</ul>` : empty(t("ad.logEmpty"));
  }).catch(e => { lg.textContent = String(e.message || e); });
  // резервна копія
  const bk = root.querySelector("[data-backup]");
  if (bk) bk.onclick = async () => {
    bk.disabled = true;
    const out = await run(async () => { const o = { at: new Date().toISOString() }; for (const c of COLS) o[c] = await B.list(c); return o; });
    bk.disabled = false;
    if (!out) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }));
    a.download = `ud-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    log("backup", t("ad.backupRun"));
  };
}
const ts = v => v && v.toMillis ? v.toMillis() : typeof v === "number" ? v : v && v.seconds ? v.seconds * 1000 : 0;
