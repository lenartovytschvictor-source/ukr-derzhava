// 👤 Профіль: мій профіль, прописка, заявка на громадянство, налаштування, вихід.
import { S, B, me, lands, land, positionsOf, isAdmin, cases, log } from "../store.js";
import { dueBadge } from "./economy.js";
import { passportBlob } from "../passport.js";
import { issuers, docDialog } from "../docimg.js";
import { t, LANGS, lang, setLang } from "../i18n.js";
import { render as rerender } from "../app.js";
import { esc, avatar, profUrl, run, profNum, toast, modal } from "../ui.js";
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
    h += affairs(m) + tgBlock(m);
  } else h += applyBlock();
  h += `<section class="card"><h2>⚙️ ${esc(t("pf.settings"))}</h2>
    <label class="fl">${esc(t("lang"))} <select data-mylang>${LANGS.map(([k, l]) => `<option value="${k}"${k === lang() ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    <p class="hint">${esc(t("pf.signedAs"))} <b>${esc(u.email)}</b></p>
    <div class="row">${m ? `<button type="button" class="sm" data-passport>🪪 ${esc(t("pp.my"))}</button>` : ""}${m && issuers().length ? `<button type="button" class="sm" data-docimg>🖼 ${esc(t("dc.title"))}</button>` : ""}${isAdmin() ? `<a class="btn sm" href="#/admin">🛠 ${esc(t("nav.admin"))}</a>` : ""}<button type="button" class="ghost sm" data-act="logout">${esc(t("logout"))}</button></div></section>`;
  return h;
}

// Мої справи: суди, мої законопроєкти, вибори, де я кандидат (кандидатури підвантажуються окремо)
function affairs(m) {
  const my = cases().filter(c => (c.parties || []).includes(m.id) && ["filed", "accepted", "hearing", "verdict"].includes(c.status)).sort((a, b) => (b.no || 0) - (a.no || 0)).slice(0, 8);
  const bills = S.bills.filter(b => b.author === m.id && ["signatures", "discussion", "voting", "passed"].includes(b.status));
  const act = S.elections.filter(e => ["nomination", "voting"].includes(e.stage));
  const role = c => c.judge === m.id ? t("lw.judge") : c.defendant === m.id ? t("lw.defendant") : t("lw.plaintiff");
  const dues = S.dues.filter(x => x.pid === m.id && x.status === "open");
  const rows = [
    ...dues.map(x => `<a class="ev" href="#/derzhava/ekonomika"><span class="evi">💰</span><span class="grow"><b>${esc(x.what)}</b><small class="hint">${esc(t("ec.myDue"))}${x.note ? " · " + esc(x.note) : ""}</small></span>${dueBadge(x)}</a>`),
    ...my.map(c => `<a class="ev" href="#/zakon/sud/${esc(c.id)}"><span class="evi">⚖️</span><span class="grow"><b>${esc(t("lw.caseNo", { n: c.no }))}: ${esc(c.title)}</b><small class="hint">${esc(role(c))} · ${esc(t("lw.cst." + c.status))}</small></span></a>`),
    ...bills.map(b => `<a class="ev" href="#/derzhava/palata/${esc(b.id)}"><span class="evi">📜</span><span class="grow"><b>${esc(b.title)}</b><small class="hint">${esc(t("ch.st." + b.status))}</small></span></a>`),
  ];
  return `<section class="card"><h2>🗂 ${esc(t("pf.affairs"))}</h2>${rows.length ? `<div class="evs">${rows.join("")}</div>` : ""}<div data-mycands="${esc(act.map(e => e.id).join(","))}"></div>${rows.length ? "" : `<p class="empty" data-noaff>${esc(t("pf.noAffairs"))}</p>`}</section>`;
}
// Сповіщення в Telegram: код для бота (/start КОД)
function tgBlock(m) {
  const bot = (S.botCfg.username || "").replace(/^@/, "");
  if (S.tgLink) return `<section class="card"><h2>🔔 ${esc(t("pf.tg"))}</h2><p>✅ ${esc(t("pf.tgOn"))}</p><button type="button" class="ghost sm" data-tgoff>${esc(t("pf.tgOff"))}</button></section>`;
  return `<section class="card"><h2>🔔 ${esc(t("pf.tg"))}</h2><p class="hint">${esc(t("pf.tgHint"))}</p>
    ${bot ? `<button type="button" class="sm primary" data-tgcode>${esc(t("pf.tgConnect"))}</button><div data-tgout></div>` : `<p class="hint">${esc(t("pf.tgNoBot"))}</p>`}</section>`;
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
  const m = me();
  const mc = root.querySelector("[data-mycands]");
  if (mc && m && mc.dataset.mycands) {
    (async () => {
      const out = [];
      for (const id of mc.dataset.mycands.split(",")) {
        try { if (await B.get(`ud_elections/${id}/cands`, m.id)) { const e = S.elections.find(x => x.id === id); if (e) out.push(`<a class="ev" href="#/derzhava/vybory/${esc(e.id)}"><span class="evi">🙋</span><span class="grow"><b>${esc(e.title)}</b><small class="hint">${esc(t("pf.candidate"))} · ${esc(t("el.stage." + e.stage))}</small></span></a>`); } } catch (_) {}
      }
      if (out.length && mc.isConnected) { mc.innerHTML = `<div class="evs">${out.join("")}</div>`; const ne = root.querySelector("[data-noaff]"); if (ne) ne.remove(); }
    })();
  }
  const di = root.querySelector("[data-docimg]"); if (di) di.onclick = () => docDialog();
  const pb = root.querySelector("[data-passport]");
  if (pb && m) pb.onclick = async () => {
    const w = modal(t("pp.my"), `<div class="ppbox"><p class="hint">${esc(t("loading"))}</p></div>`, { wide: true });
    const blob = await passportBlob(m); if (!blob) return;
    const url = URL.createObjectURL(blob), box = w.querySelector(".ppbox");
    box.innerHTML = `<img class="ppimg" src="${url}" alt="${esc(t("pp.my"))}"><div class="row end"><a class="btn primary" href="${url}" download="pasport-${esc(String(m.name).replace(/[^\wа-яіїєґ-]+/gi, "_"))}.png">⬇️ ${esc(t("pp.download"))}</a></div><p class="hint">${esc(t("pp.hint"))}</p>`;
  };
  const tc = root.querySelector("[data-tgcode]");
  if (tc) tc.onclick = async () => {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    if (!(await run(() => B.set("ud_tgcodes", m.id, { code, at: B.now() })))) return;
    const bot = (S.botCfg.username || "").replace(/^@/, "");
    root.querySelector("[data-tgout]").innerHTML = `<p>${esc(t("pf.tgStep"))}</p><p><a class="btn primary" href="https://t.me/${encodeURIComponent(bot)}?start=${code}" target="_blank" rel="noopener">✈️ @${esc(bot)}</a></p><p class="hint">${esc(t("pf.tgManual", { c: code }))}</p>`;
  };
  const toff = root.querySelector("[data-tgoff]");
  if (toff) toff.onclick = () => run(() => B.del("ud_tglinks", m.id), t("saved"));
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
