// 👥 Народ: Громадяни · Військо · Церква · Історія УД (+ сторінка гравця)
import { S, B, player, me, lands, land, positionsOf, canPlayers, canHistory, canAppoint, emailOf, log } from "../store.js";
import { EDIT, render as rerender, go } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, profUrl, run, modal, closeModal, confirmBox, pickImage, today, normEmail, okEmail, profNum, toast } from "../ui.js";
import { tabs, soon, txt, empty, statusLabel, statusIcon } from "./common.js";

const TABS = [["gromadyany", "🪪", "pp.tab.citizens"], ["viysko", "🎖", "pp.tab.army"], ["tserkva", "⛪", "pp.tab.church"], ["istoriya", "📜", "pp.tab.history"]];
let F = { st: "cit", land: "" };   // фільтри реєстру

export function render(parts) {
  if (parts[0] === "gravets") return playerPage(parts[1]);
  const cur = TABS.some(x => x[0] === parts[0]) ? parts[0] : "gromadyany";
  let h = `<h1 class="ptitle">👥 ${esc(t("nav.people"))}</h1>${tabs("narod", TABS, cur)}`;
  if (cur === "gromadyany") h += registry();
  else if (cur === "istoriya") h += history();
  else if (cur === "viysko") h += soon(5, t("soon.army"));
  else h += soon(5, t("soon.church"));
  return h;
}

// ---------- Реєстр ----------
function appsBlock() {
  if (!canPlayers()) return "";
  const open = S.apps.filter(a => a.status === "new");
  if (!open.length) return "";
  return `<section class="card apps"><h2>📨 ${esc(t("ap.review"))} <span class="badge">${open.length}</span></h2>${open.map(a => {
    const pu = profUrl(a);
    return `<div class="aprow"><div><b>${esc(a.name)}</b> <span class="tag">${esc(t(a.kind === "cit" ? "ap.kind.cit" : "ap.kind.tour"))}</span>
      <div class="hint">${esc(a.id)}${pu ? ` · <a href="${esc(pu)}" target="_blank" rel="noopener">${esc(t("pl.gameProfile"))} ↗</a>` : ""}</div>${a.note ? `<p class="note">${esc(a.note)}</p>` : ""}</div>
      <div class="row"><button type="button" class="primary sm" data-apok="${esc(a.id)}">✓ ${esc(t("ap.approve"))}</button><button type="button" class="ghost sm danger" data-apno="${esc(a.id)}">✕ ${esc(t("ap.reject"))}</button></div></div>`;
  }).join("")}</section>`;
}
function pcard(p) {
  const L = land(p.land); const ps = positionsOf(p.id);
  return `<a class="plc" href="#/narod/gravets/${esc(p.id)}" data-name="${esc((p.name + " " + (p.profile || "")).toLowerCase())}">
    ${avatar(p, "av lg")}<span class="plt"><b>${esc(p.name)}</b>
    ${ps.length ? `<small class="roles">${esc(ps.map(x => x.title).join(" · "))}</small>` : ""}
    <small class="hint">${statusIcon(p.status)} ${esc(statusLabel(p.status))}${L ? " · " + esc(L.short || L.name) : ""}</small></span></a>`;
}
function registry() {
  const all = S.players.slice().sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const cnt = k => all.filter(p => k === "all" || p.status === k).length;
  const list = all.filter(p => (F.st === "all" || p.status === F.st) && (!F.land || p.land === F.land));
  let h = appsBlock();
  h += `<div class="toolbar">
    <input type="search" data-live data-psearch placeholder="🔎 ${esc(t("pl.search"))}" aria-label="${esc(t("pl.search"))}">
    <div class="chips">${[["cit", "st.cits"], ["tour", "st.tours"], ["exiled", "st.exileds"], ["all", "st.all"]].map(([k, l]) =>
      `<button type="button" class="chip${F.st === k ? " on" : ""}" data-fst="${k}" aria-pressed="${F.st === k}">${esc(t(l))} · ${cnt(k)}</button>`).join("")}</div>
    <select data-fland aria-label="${esc(t("pl.landFilter"))}"><option value="">${esc(t("pl.allLands"))}</option>${lands().map(l => `<option value="${esc(l.id)}"${F.land === l.id ? " selected" : ""}>${esc(l.short || l.name)}</option>`).join("")}</select>
    ${EDIT && canPlayers() ? `<button type="button" class="primary sm" data-padd>+ ${esc(t("pl.add"))}</button>` : ""}
  </div>`;
  h += list.length ? `<div class="plgrid">${list.map(pcard).join("")}</div><p class="empty" data-nores hidden>${esc(t("pl.nores"))}</p>` : empty(t("pl.none"));
  return h;
}

// ---------- Сторінка гравця ----------
function playerPage(id) {
  const p = player(id);
  if (!p) return `<div class="card">${empty(S.players.length ? t("pl.notFound") : t("loading"))}<a href="#/narod/gromadyany">← ${esc(t("pl.back"))}</a></div>`;
  const L = land(p.land); const ps = positionsOf(p.id); const pu = profUrl(p);
  const mine = me() && me().id === p.id;
  const mail = canPlayers() ? emailOf(p.id) : "";
  return `<p><a href="#/narod/gromadyany">← ${esc(t("pl.back"))}</a></p>
  <section class="card pprof">${avatar(p, "av xl")}<div>
    <h1>${esc(p.name)}</h1>
    <p class="tags"><span class="tag st-${esc(p.status)}">${statusIcon(p.status)} ${esc(statusLabel(p.status))}</span>${L ? `<span class="tag" style="--lc:${esc(L.color)}">🗺 ${esc(L.name)}</span>` : ""}${p.since ? `<span class="tag">📅 ${esc(t("pl.since"))} ${esc(p.since)}</span>` : ""}</p>
    ${ps.length ? `<p><b>${esc(t("pl.positions"))}:</b> ${esc(ps.map(x => x.title).join(" · "))}</p>` : ""}
    <p class="row">${pu ? `<a class="btn ghost sm" href="${esc(pu)}" target="_blank" rel="noopener">${esc(t("pl.gameProfile"))} ↗</a>` : ""}
      ${mine ? `<a class="btn ghost sm" href="#/profil">${esc(t("pl.myProfile"))}</a>` : ""}
      ${EDIT && canPlayers() ? `<button type="button" class="sm" data-pedit="${esc(p.id)}">✏️ ${esc(t("edit"))}</button>` : ""}</p>
    ${mail ? `<p class="hint">✉️ ${esc(mail)} <span class="muted">(${esc(t("pl.mailPrivate"))})</span></p>` : ""}
  </div></section>
  <section class="card muted small">${esc(t("pl.morelater"))}</section>`;
}

// форма гравця (додати / змінити) — для Гетьмана, Секретаря внутрішніх справ і адмінів
export function playerForm(p) {
  const isNew = !p; p = p || { name: "", profile: "", status: "cit", land: "", since: today() };
  const mail = isNew ? "" : emailOf(p.id);
  const w = modal(isNew ? t("pl.add") : t("pl.edit"), `<form class="form" data-pform>
    <div class="avedit">${avatar(p, "av lg")}<div><button type="button" class="ghost sm" data-pimg>${esc(t("pl.upload"))}</button>${p.img ? ` <button type="button" class="ghost sm" data-pimgx>${esc(t("pl.useGame"))}</button>` : ""}<p class="hint">${esc(t("pl.avHint"))}</p></div></div>
    <label>${esc(t("pl.name"))}<input name="name" required maxlength="60" value="${esc(p.name)}"></label>
    <label>${esc(t("pl.profile"))}<input name="profile" maxlength="80" value="${esc(p.profile || "")}" placeholder="257 / https://dragpolit.com/profile/257"></label>
    <label>${esc(t("pl.email"))}<input name="email" type="email" maxlength="120" value="${esc(mail)}" placeholder="name@gmail.com"><small class="hint">${esc(t("pl.emailHint"))}</small></label>
    <div class="row2"><label>${esc(t("pl.status"))}<select name="status">${["cit", "tour", "exiled"].map(s => `<option value="${s}"${p.status === s ? " selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}</select></label>
    <label>${esc(t("pl.land"))}<select name="land"><option value="">—</option>${lands().map(l => `<option value="${esc(l.id)}"${p.land === l.id ? " selected" : ""}>${esc(l.short || l.name)}</option>`).join("")}</select></label></div>
    <label>${esc(t("pl.since"))}<input name="since" maxlength="20" value="${esc(p.since || "")}"></label>
    <div class="row end">${isNew ? "" : `<button type="button" class="ghost danger" data-pdel>${esc(t("delete"))}</button>`}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div>
  </form>`);
  let img = p.img || "";
  w.querySelector("[data-pimg]").onclick = async () => { const v = await pickImage(160); if (v) { img = v; w.querySelector(".avedit .av").outerHTML = avatar({ ...p, img }, "av lg"); } };
  const x = w.querySelector("[data-pimgx]"); if (x) x.onclick = () => { img = ""; w.querySelector(".avedit .av").outerHTML = avatar({ ...p, img: "" }, "av lg"); };
  const d = w.querySelector("[data-pdel]");
  if (d) d.onclick = async () => {
    if (!(await confirmBox(t("pl.delq", { x: p.name }), t("delete")))) return;
    const ops = [{ op: "del", c: "ud_players", id: p.id }]; if (mail) ops.push({ op: "del", c: "ud_links", id: mail });
    S.positions.filter(q => q.holder === p.id && canAppoint(q)).forEach(q => ops.push({ op: "update", c: "ud_positions", id: q.id, v: { holder: "" } }));
    if (await run(() => B.batch(ops), t("deleted"))) { log("player", `${t("deleted")}: ${p.name}`); closeModal(); go("narod/gromadyany"); }
  };
  w.querySelector("[data-pform]").onsubmit = async e => {
    e.preventDefault();
    const f = e.target; const name = f.name.value.trim(); const email = normEmail(f.email.value);
    if (!name) return;
    if (email && !okEmail(email)) return toast(t("pl.badEmail"), "err");
    const dupe = S.players.find(q => q.id !== p.id && q.name.toLowerCase() === name.toLowerCase());
    if (dupe) return toast(t("pl.dupe"), "err");
    const owner = email && S.links.find(l => l.id === email && l.pid !== p.id);
    if (owner) return toast(t("pl.mailTaken", { x: (player(owner.pid) || {}).name || "?" }), "err");
    const id = isNew ? B.newId("ud_players") : p.id;
    const v = { name, profile: profNum(f.profile.value) || f.profile.value.trim().slice(0, 20), status: f.status.value, land: f.land.value, since: f.since.value.trim().slice(0, 20), img };
    if (isNew) v.at = B.now();
    const ops = [{ op: "set", c: "ud_players", id, v, merge: !isNew }];
    if (mail && mail !== email) ops.push({ op: "del", c: "ud_links", id: mail });
    if (email && email !== mail) ops.push({ op: "set", c: "ud_links", id: email, v: { pid: id } });
    if (f.status.value !== "cit") S.positions.filter(q => q.holder === id && canAppoint(q)).forEach(q => ops.push({ op: "update", c: "ud_positions", id: q.id, v: { holder: "" } }));
    if (await run(() => B.batch(ops), t("saved"))) { log("player", `${isNew ? "+" : "✏️"} ${name}`); closeModal(); if (isNew) go("narod/gravets/" + id); }
  };
}

// ---------- Історія УД ----------
let HD = null;          // історія за замовчуванням (зі старого сайту)
let HC = null;          // робоча копія під час редагування
const CW = 190;         // ширина картки родоводу
function hist() {
  if (EDIT && canHistory() && HC) return HC;
  return S.history || HD;
}
function ensureDefault() {
  if (HD || S.history) return;
  fetch("data/history-default.json").then(r => r.json()).then(d => { HD = d; rerender(); }).catch(() => {});
}
function placeNodes(tree) {
  let y = 0;
  tree.forEach((n, i) => {
    if (n.x == null || n.y == null) {
      const D = { t1: [150, 10], t2: [150, 320], t3: [420, 320], t4: [690, 320], t5: [150, 640], t6: [470, 640] }[n.id];
      if (D && !tree.some(q => q !== n && q.x === D[0] && q.y === D[1])) { n.x = D[0]; n.y = D[1]; }
      else { y += 300; n.x = 40 + (i % 4) * 240; n.y = y; }
    }
    y = Math.max(y, n.y);
  });
}
const arrowsOf = h => Array.isArray(h.arrows) ? h.arrows : (h.tree || []).filter(n => n.parent && h.tree.some(x => x.id === n.parent))
  .map(n => ({ id: "a" + n.id, from: n.parent, to: n.id, style: n.rel === "dom" ? "dashed" : "solid", label: n.via || "" }));
function nodeDate(n) {
  const from = String(n.from || "").trim(), to = String(n.to || "").trim();
  if (!from && !to) return n.date ? esc(n.date) : "";
  return from && to ? `${esc(from)} — ${esc(to)}` : from ? `${esc(t("hs.from"))} ${esc(from)}` : `${esc(t("hs.to"))} ${esc(to)}`;
}
function canvas(h, edit) {
  const tree = h.tree || []; placeNodes(tree);
  const W = Math.max(1000, ...tree.map(n => n.x + CW + 40)), H = Math.max(300, ...tree.map(n => n.y + 260));
  return `<div class="hcwrap${edit ? " editing" : ""}"><div class="hcin" style="width:${W}px;height:${H}px"><svg class="hcsvg" width="${W}" height="${H}" aria-hidden="true"><defs><marker id="hcar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs></svg>
    ${tree.map(n => `<div class="hnode${n.ended ? " ended" : ""}" data-hn="${esc(n.id)}" style="left:${+n.x}px;top:${+n.y}px;width:${CW}px">
      ${n.img ? `<img src="${esc(n.img)}" alt="${esc(t("hs.flag"))}: ${esc(n.name)}" draggable="false">` : `<div class="noimg" aria-hidden="true">🏳</div>`}
      <b>${esc(n.name)}</b>${nodeDate(n) ? `<span class="hd">${n.ended ? "✝ " : ""}${nodeDate(n)}</span>` : ""}${n.note ? `<small>${esc(n.note)}</small>` : ""}</div>`).join("")}
  </div></div>${edit ? `<p class="hint">✋ ${esc(t("hs.drag"))}</p>` : `<p class="hint center">← ${esc(t("hs.scroll"))} →</p>`}`;
}
function drawArrows(root, h) {
  const wrap = root.querySelector(".hcin"); if (!wrap) return;
  const svg = wrap.querySelector("svg");
  const box = id => { const el = wrap.querySelector(`[data-hn="${CSS.escape(id)}"]`); return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null; };
  let out = "";
  for (const a of arrowsOf(h)) {
    const A = box(a.from), Bx = box(a.to); if (!A || !Bx) continue;
    let p1, p2, vert = Math.abs((Bx.y + Bx.h / 2) - (A.y + A.h / 2)) > Math.abs((Bx.x + Bx.w / 2) - (A.x + A.w / 2)) * 0.6;
    if (vert) { const down = Bx.y > A.y; p1 = [A.x + A.w / 2, down ? A.y + A.h : A.y]; p2 = [Bx.x + Bx.w / 2, down ? Bx.y : Bx.y + Bx.h]; }
    else { const right = Bx.x > A.x; p1 = [right ? A.x + A.w : A.x, A.y + A.h / 2]; p2 = [right ? Bx.x : Bx.x + Bx.w, Bx.y + Bx.h / 2]; }
    const k = vert ? [0, (p2[1] - p1[1]) / 2] : [(p2[0] - p1[0]) / 2, 0];
    const d = `M${p1[0]},${p1[1]} C${p1[0] + k[0]},${p1[1] + k[1]} ${p2[0] - k[0]},${p2[1] - k[1]} ${p2[0]},${p2[1]}`;
    out += `<path d="${d}" class="hcl${a.style === "dashed" ? " dash" : ""}" marker-end="url(#hcar)"/>`;
    if (a.label) out += `<text x="${(p1[0] + p2[0]) / 2}" y="${(p1[1] + p2[1]) / 2 - 6}" text-anchor="middle" class="hct">${esc(a.label)}</text>`;
  }
  svg.querySelectorAll("path.hcl,text").forEach(x => x.remove());
  svg.insertAdjacentHTML("beforeend", out);
}
function history() {
  ensureDefault();
  const edit = EDIT && canHistory();
  if (edit && !HC && (S.history || HD)) HC = JSON.parse(JSON.stringify(S.history || HD));
  if (!edit) HC = null;
  const h = hist();
  let s = txt("narod", "history.intro", t("hs.intro"), { cls: "lead" });
  if (!h) return s + `<div class="card">${empty(t("loading"))}</div>`;
  if (!S.history && canHistory()) s += `<div class="card warn small">${esc(t("hs.notSaved"))}</div>`;
  s += `<section class="card"><h2>${esc(t("hs.tree"))}</h2>${canvas(h, edit)}</section>`;
  if (edit) s += historyEditor(h);
  const ev = (h.events || []).slice().reverse();
  s += `<section class="card"><h2>${esc(t("hs.chron"))} <small class="hint">${esc(t("hs.newFirst"))}</small></h2>${ev.length ? `<ol class="tl">${ev.map(e => `<li><span class="tlic" aria-hidden="true">${esc(e.ic || "•")}</span><div><div class="tld">${esc(e.date || "")}</div><h3>${esc(e.title || "")}</h3>${String(e.text || "").split("\n").filter(x => x.trim()).map(p => `<p>${esc(p)}</p>`).join("")}</div></li>`).join("")}</ol>` : empty(t("hs.noEvents"))}</section>`;
  return s;
}
function historyEditor(h) {
  const tree = h.tree || [], ar = arrowsOf(h), ev = h.events || [];
  const opt = (v) => tree.map(n => `<option value="${esc(n.id)}"${n.id === v ? " selected" : ""}>${esc(n.name)}</option>`).join("");
  return `<section class="card hedit"><h2>✏️ ${esc(t("hs.edit"))}</h2>
    <div class="row end"><button type="button" class="ghost" data-hreset>${esc(t("hs.discard"))}</button><button type="button" class="primary" data-hsave>💾 ${esc(t("hs.save"))}</button></div>
    <h3>${esc(t("hs.states"))}</h3>${tree.map((n, i) => `<div class="erow" data-ni="${i}">
      <button type="button" class="flagbtn" data-nimg="${i}" title="${esc(t("hs.flag"))}">${n.img ? `<img src="${esc(n.img)}" alt="">` : "🏳"}</button>
      <input data-nf="name" value="${esc(n.name || "")}" placeholder="${esc(t("hs.name"))}" maxlength="80">
      <input data-nf="date" value="${esc(n.date || "")}" placeholder="${esc(t("hs.date"))}" maxlength="60">
      <input data-nf="note" value="${esc(n.note || "")}" placeholder="${esc(t("hs.note"))}" maxlength="120">
      <label class="chk"><input type="checkbox" data-nf="ended"${n.ended ? " checked" : ""}> ${esc(t("hs.ended"))}</label>
      <button type="button" class="ghost sm danger" data-ndel="${i}" aria-label="${esc(t("delete"))}">✕</button></div>`).join("")}
    <button type="button" class="sm" data-nadd>+ ${esc(t("hs.addState"))}</button>
    <h3>${esc(t("hs.arrows"))}</h3>${ar.map((a, i) => `<div class="erow" data-ai="${i}"><select data-af="from">${opt(a.from)}</select> → <select data-af="to">${opt(a.to)}</select>
      <input data-af="label" value="${esc(a.label || "")}" placeholder="${esc(t("hs.label"))}" maxlength="40">
      <select data-af="style"><option value="solid"${a.style !== "dashed" ? " selected" : ""}>━ ${esc(t("hs.solid"))}</option><option value="dashed"${a.style === "dashed" ? " selected" : ""}>┅ ${esc(t("hs.dashed"))}</option></select>
      <button type="button" class="ghost sm danger" data-adel="${i}" aria-label="${esc(t("delete"))}">✕</button></div>`).join("")}
    ${tree.length > 1 ? `<button type="button" class="sm" data-aadd>+ ${esc(t("hs.addArrow"))}</button>` : ""}
    <h3>${esc(t("hs.events"))} <small class="hint">${esc(t("hs.oldFirst"))}</small></h3>${ev.map((e, i) => `<div class="evedit" data-ei="${i}"><div class="erow">
      <input data-ef="ic" value="${esc(e.ic || "")}" placeholder="🙂" maxlength="4" class="w4">
      <input data-ef="date" value="${esc(e.date || "")}" placeholder="${esc(t("hs.date"))}" maxlength="60">
      <input data-ef="title" value="${esc(e.title || "")}" placeholder="${esc(t("hs.title"))}" maxlength="120" class="grow">
      <button type="button" class="ghost sm" data-emv="${i}:-1" ${i ? "" : "disabled"} aria-label="↑">↑</button><button type="button" class="ghost sm" data-emv="${i}:1" ${i < ev.length - 1 ? "" : "disabled"} aria-label="↓">↓</button>
      <button type="button" class="ghost sm danger" data-edel="${i}" aria-label="${esc(t("delete"))}">✕</button></div>
      <textarea data-ef="text" rows="3" placeholder="${esc(t("hs.text"))}">${esc(e.text || "")}</textarea></div>`).join("")}
    <button type="button" class="sm" data-eadd>+ ${esc(t("hs.addEvent"))}</button>
    <div class="row end"><button type="button" class="primary" data-hsave>💾 ${esc(t("hs.save"))}</button></div></section>`;
}

export function mount(root, parts) {
  // реєстр: фільтри й пошук (пошук ховає картки без перемальовування, щоб не губився курсор)
  root.querySelectorAll("[data-fst]").forEach(b => b.onclick = () => { F.st = b.dataset.fst; rerender(); });
  const fl = root.querySelector("[data-fland]"); if (fl) fl.onchange = () => { F.land = fl.value; rerender(); };
  const sr = root.querySelector("[data-psearch]");
  if (sr) sr.oninput = () => {
    const q = sr.value.trim().toLowerCase(); let n = 0;
    root.querySelectorAll(".plc").forEach(c => { const ok = !q || c.dataset.name.includes(q); c.hidden = !ok; if (ok) n++; });
    const nr = root.querySelector("[data-nores]"); if (nr) nr.hidden = n > 0;
  };
  const pa = root.querySelector("[data-padd]"); if (pa) pa.onclick = () => playerForm(null);
  root.querySelectorAll("[data-pedit]").forEach(b => b.onclick = () => playerForm(player(b.dataset.pedit)));
  // заявки
  root.querySelectorAll("[data-apok]").forEach(b => b.onclick = () => approve(b.dataset.apok));
  root.querySelectorAll("[data-apno]").forEach(b => b.onclick = async () => {
    const a = S.apps.find(x => x.id === b.dataset.apno);
    if (await run(() => B.update("ud_apps", a.id, { status: "no", by: S.user.email, decided: B.now() }), t("ap.rejected"))) log("app", `✕ ${a.name}`);
  });
  if (parts[0] === "istoriya") mountHistory(root);
}

async function approve(email) {
  const a = S.apps.find(x => x.id === email); if (!a) return;
  if (S.links.some(l => l.id === email)) { toast(t("ap.already"), "err"); return; }
  const st = a.kind === "cit" ? "cit" : "tour";
  // якщо такий гравець уже є в реєстрі (той самий профіль або ім'я) і ще не прив'язаний — прив'язуємо його
  const ex = S.players.find(p => (a.profile && p.profile === a.profile) || p.name.toLowerCase() === a.name.toLowerCase());
  const exLinked = ex && S.links.some(l => l.pid === ex.id);
  const id = ex && !exLinked ? ex.id : B.newId("ud_players");
  const ops = [
    ex && !exLinked ? { op: "update", c: "ud_players", id, v: { status: st } }
      : { op: "set", c: "ud_players", id, v: { name: a.name, profile: a.profile || "", status: st, land: "", since: today(), img: "", at: B.now() } },
    { op: "set", c: "ud_links", id: email, v: { pid: id } },
    { op: "update", c: "ud_apps", id: email, v: { status: "ok", by: S.user.email, decided: B.now() } },
  ];
  if (await run(() => B.batch(ops), t("ap.approved"))) log("app", `✓ ${a.name} (${t(st === "cit" ? "st.cit" : "st.tour")})`);
}

function mountHistory(root) {
  const h = hist(); if (!h) return;
  requestAnimationFrame(() => drawArrows(root, h));
  if (!(EDIT && canHistory() && HC)) return;
  const C = HC;
  const redraw = () => requestAnimationFrame(() => drawArrows(root, C));
  // перетягування карток
  root.querySelectorAll(".hcwrap.editing .hnode").forEach(el => {
    el.onpointerdown = e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const n = C.tree.find(x => x.id === el.dataset.hn); const sx = e.clientX, sy = e.clientY, ox = n.x, oy = n.y;
      el.onpointermove = m => { n.x = Math.max(0, Math.round((ox + m.clientX - sx) / 10) * 10); n.y = Math.max(0, Math.round((oy + m.clientY - sy) / 10) * 10); el.style.left = n.x + "px"; el.style.top = n.y + "px"; drawArrows(root, C); };
      el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; };
    };
  });
  const ensureArrows = () => { if (!Array.isArray(C.arrows)) C.arrows = arrowsOf(C); return C.arrows; };
  root.querySelectorAll("[data-ni]").forEach(r => r.querySelectorAll("[data-nf]").forEach(i => i.onchange = () => {
    const n = C.tree[+r.dataset.ni]; n[i.dataset.nf] = i.type === "checkbox" ? i.checked : i.value; rerender();
  }));
  root.querySelectorAll("[data-nimg]").forEach(b => b.onclick = async () => { const v = await pickImage(240); if (v) { C.tree[+b.dataset.nimg].img = v; rerender(); } });
  root.querySelectorAll("[data-ndel]").forEach(b => b.onclick = () => {
    const n = C.tree[+b.dataset.ndel]; C.tree.splice(+b.dataset.ndel, 1);
    C.arrows = ensureArrows().filter(a => a.from !== n.id && a.to !== n.id); rerender();
  });
  const na = root.querySelector("[data-nadd]"); if (na) na.onclick = () => { ensureArrows(); (C.tree = C.tree || []).push({ id: "n" + Date.now().toString(36), name: t("hs.newState"), date: "", note: "" }); rerender(); };
  root.querySelectorAll("[data-ai]").forEach(r => r.querySelectorAll("[data-af]").forEach(i => i.onchange = () => { ensureArrows()[+r.dataset.ai][i.dataset.af] = i.value; redraw(); }));
  root.querySelectorAll("[data-adel]").forEach(b => b.onclick = () => { ensureArrows().splice(+b.dataset.adel, 1); rerender(); });
  const aa = root.querySelector("[data-aadd]"); if (aa) aa.onclick = () => { ensureArrows().push({ id: "a" + Date.now().toString(36), from: C.tree[0].id, to: C.tree[1].id, style: "solid", label: "" }); rerender(); };
  root.querySelectorAll("[data-ei]").forEach(r => r.querySelectorAll("[data-ef]").forEach(i => i.onchange = () => { C.events[+r.dataset.ei][i.dataset.ef] = i.value; }));
  root.querySelectorAll("[data-emv]").forEach(b => b.onclick = () => { const [i, d] = b.dataset.emv.split(":").map(Number); const E = C.events; [E[i], E[i + d]] = [E[i + d], E[i]]; rerender(); });
  root.querySelectorAll("[data-edel]").forEach(b => b.onclick = () => { C.events.splice(+b.dataset.edel, 1); rerender(); });
  const ea = root.querySelector("[data-eadd]"); if (ea) ea.onclick = () => { (C.events = C.events || []).push({ id: "e" + Date.now().toString(36), ic: "📌", date: "", title: "", text: "" }); rerender(); };
  root.querySelectorAll("[data-hsave]").forEach(b => b.onclick = async () => {
    // текст подій, який ще не «зафіксувався» (поле у фокусі)
    root.querySelectorAll("[data-ei]").forEach(r => r.querySelectorAll("[data-ef]").forEach(i => { C.events[+r.dataset.ei][i.dataset.ef] = i.value; }));
    ensureArrows();
    const size = JSON.stringify(C).length;
    if (size > 900000) return toast(t("hs.tooBig"), "err");
    if (await run(() => B.set("ud_history", "main", { tree: C.tree || [], arrows: C.arrows, events: C.events || [], at: B.now(), by: S.user.email }), t("saved"))) { log("history", t("hs.save")); HC = null; rerender(); }
  });
  const hr = root.querySelector("[data-hreset]"); if (hr) hr.onclick = () => { HC = null; rerender(); };
}
