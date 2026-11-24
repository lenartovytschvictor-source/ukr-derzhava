// 💰 Економіка: нагадування про внески — хто, що й до коли має внести.
// Нічого не рахує: Секретар фінансів, Генеральний писар, Гетьман або адмін вручну відмічають «вніс».
import { S, B, me, player, pos, lands, isAdmin, isHetman, holds, GOV, ms, log, changed } from "../store.js";
import { t } from "../i18n.js";
import { esc, avatar, run, modal, closeModal, confirmBox, toast, fmtDate } from "../ui.js";
import { txt, empty } from "./common.js";

export const canEcon = () => isAdmin() || isHetman() || holds("finance") || holds("pysar");
const EF = { st: "open" };
const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtDay = s => { const d = Date.parse(String(s || "") + "T12:00:00"); return isNaN(d) ? "" : new Date(d).toLocaleDateString(document.documentElement.lang || "uk", { day: "numeric", month: "long" }); };
const daysLeft = s => { const d = Date.parse(String(s || "") + "T23:59:59"); return isNaN(d) ? null : Math.ceil((d - Date.now()) / 864e5); };
export function dueBadge(x) {
  if (x.status === "paid") return `<span class="tag ok">✅ ${esc(t("ec.paid"))}</span>`;
  const n = daysLeft(x.due); if (n == null) return `<span class="tag">${esc(t("ec.noDate"))}</span>`;
  return n < 0 ? `<span class="tag bad">⏰ ${esc(t("ec.overdue", { x: fmtDay(x.due) }))}</span>` : `<span class="tag${n <= 1 ? " warn" : ""}">📅 ${esc(t("ec.until", { x: fmtDay(x.due) }))}</span>`;
}
export const myDues = pid => S.dues.filter(x => x.pid === pid);
// групи «кому» для масового нагадування
function groups() {
  const cit = S.players.filter(p => p.status === "cit").map(p => p.id);
  const holders = ids => [...new Set(ids.map(pos).filter(p => p && p.holder).map(p => p.holder))];
  return [
    ["osavuls", t("ec.g.osavuls"), holders(lands().map(l => "osavul_" + l.id))],
    ["gov", t("ec.g.gov"), holders(GOV)],
    ["chamber", t("ec.g.chamber"), [...new Set(S.positions.filter(p => p.chamber && p.holder).map(p => p.holder))]],
    ["cit", t("ec.g.cit"), cit],
  ];
}

function row(x, ed) {
  const p = player(x.pid), by = player(x.paidBy || x.by);
  return `<div class="duerow${x.status === "paid" ? " paid" : daysLeft(x.due) < 0 ? " late" : ""}" data-s="${esc(((p && p.name) || "").toLowerCase())}">
    <a class="who" href="#/narod/gravets/${esc(x.pid)}">${avatar(p || { name: "?" }, "av md")}<b>${esc(p ? p.name : "?")}</b></a>
    <div class="grow"><b>${esc(x.what)}</b>${x.note ? `<small class="hint">${esc(x.note)}</small>` : ""}${x.status === "paid" && x.paidNote ? `<small class="hint">✅ ${esc(x.paidNote)}</small>` : ""}</div>
    <div class="dueinfo">${dueBadge(x)}${x.status === "paid" ? `<small class="hint">${esc(fmtDate(x.paidAt))}${by ? " · " + esc(by.name) : ""}</small>` : ""}</div>
    ${ed ? `<div class="sact">${x.status === "open" ? `<button type="button" class="sm primary" data-paid="${esc(x.id)}">✅ ${esc(t("ec.markPaid"))}</button>` : `<button type="button" class="ghost sm" data-unpaid="${esc(x.id)}" title="${esc(t("ec.undo"))}">↩️</button>`}<button type="button" class="ghost sm danger" data-ddel="${esc(x.id)}" aria-label="${esc(t("delete"))}">✕</button></div>` : ""}</div>`;
}

export function render() {
  const ed = canEcon(), m = me();
  let h = txt("ekonomika", "intro", t("ec.intro"), { cls: "lead" });
  if (m && !ed) {
    const mine = myDues(m.id).filter(x => x.status === "open");
    if (mine.length) h += `<section class="card"><h2>💰 ${esc(t("ec.mine"))}</h2><div class="duelist">${mine.map(x => row(x, false)).join("")}</div></section>`;
  }
  if (ed) {
    const G = groups();
    h += `<details class="card newbill"><summary><b>➕ ${esc(t("ec.new"))}</b></summary><form class="form" data-dnew>
      <label>${esc(t("ec.who"))}<select name="to" required><option value="">—</option>
        <optgroup label="${esc(t("ec.groups"))}">${G.map(([k, l, ids]) => `<option value="g:${k}">${esc(l)} (${ids.length})</option>`).join("")}</optgroup>
        <optgroup label="${esc(t("ec.people"))}">${S.players.filter(p => p.status !== "ex").sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="p:${esc(p.id)}">${esc(p.name)}</option>`).join("")}</optgroup></select></label>
      <div class="row2"><label>${esc(t("ec.what"))}<input name="what" required maxlength="120" placeholder="${esc(t("ec.whatPh"))}"></label>
      <label>${esc(t("ec.dueDate"))}<input type="date" name="due" min="${todayIso()}"></label></div>
      <label>${esc(t("ec.note"))}<input name="note" maxlength="200" placeholder="${esc(t("ec.notePh"))}"></label>
      <p class="hint">${esc(t("ec.newHint"))}</p>
      <div class="row end"><button class="primary">${esc(t("ec.create"))}</button></div></form></details>`;
  }
  const open = S.dues.filter(x => x.status === "open"), paid = S.dues.filter(x => x.status === "paid");
  const list = (EF.st === "paid" ? paid.slice().sort((a, b) => ms(b.paidAt) - ms(a.paidAt)) : EF.st === "all" ? S.dues.slice() : open.slice().sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")));
  h += `<section class="card"><div class="row between"><h2>💰 ${esc(t("ec.list"))}</h2><span class="hint">${esc(t("ec.counts", { o: open.length, l: open.filter(x => daysLeft(x.due) < 0).length }))}</span></div>
    <div class="filters"><input type="search" data-dq placeholder="🔍 ${esc(t("ec.search"))}" aria-label="${esc(t("ec.search"))}">
      <select data-dst aria-label="${esc(t("ec.status"))}">${[["open", "ec.f.open"], ["paid", "ec.f.paid"], ["all", "ec.f.all"]].map(([k, l]) => `<option value="${k}"${EF.st === k ? " selected" : ""}>${esc(t(l))}</option>`).join("")}</select></div>
    ${list.length ? `<div class="duelist">${list.map(x => row(x, ed)).join("")}</div><p class="empty" data-dnone hidden>${esc(t("ec.nothing"))}</p>` : empty(t(EF.st === "paid" ? "ec.nonePaid" : "ec.none"))}</section>`;
  return h;
}

export function mount(root) {
  const st = root.querySelector("[data-dst]"); if (st) st.onchange = () => { EF.st = st.value; changed(); };
  const q = root.querySelector("[data-dq]");
  if (q) q.oninput = () => { const v = q.value.trim().toLowerCase(); let n = 0; root.querySelectorAll(".duerow[data-s]").forEach(r => { const ok = !v || r.dataset.s.includes(v); r.hidden = !ok; if (ok) n++; }); const e = root.querySelector("[data-dnone]"); if (e) e.hidden = n > 0; };
  const f = root.querySelector("[data-dnew]");
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const to = f.to.value; if (!to) return;
    const ids = to.startsWith("g:") ? (groups().find(g => g[0] === to.slice(2)) || [, , []])[2] : [to.slice(2)];
    if (!ids.length) return toast(t("ec.emptyGroup"), "err");
    if (ids.length > 1 && !(await confirmBox(t("ec.manyQ", { n: ids.length }), t("ec.create")))) return;
    const base = { what: f.what.value.trim().slice(0, 120), due: f.due.value || "", note: f.note.value.trim().slice(0, 200), status: "open", by: me().id, at: B.now() };
    const ops = ids.slice(0, 400).map(pid => ({ op: "set", c: "ud_dues", id: B.newId("ud_dues"), v: { pid, ...base } }));
    if (await run(() => B.batch(ops), t("ec.created", { n: ops.length }))) { log("economy", `+ ${base.what} × ${ops.length}`); f.reset(); }
  };
  root.querySelectorAll("[data-paid]").forEach(b => b.onclick = () => {
    const x = S.dues.find(d => d.id === b.dataset.paid); if (!x) return;
    const p = player(x.pid);
    const w = modal(t("ec.markPaid"), `<form class="form" data-pf><p><b>${esc(p ? p.name : "?")}</b> — ${esc(x.what)}</p>
      <label>${esc(t("ec.paidNote"))}<input name="note" maxlength="200" placeholder="${esc(t("ec.paidNotePh"))}"></label>
      <div class="row end"><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">✅ ${esc(t("ec.markPaid"))}</button></div></form>`);
    w.querySelector("[data-pf]").onsubmit = async e => { e.preventDefault();
      if (await run(() => B.update("ud_dues", x.id, { status: "paid", paidNote: e.target.note.value.trim().slice(0, 200), paidBy: me().id, paidAt: B.now() }), t("saved"))) { log("economy", `✅ ${p ? p.name : "?"}: ${x.what}`); closeModal(); } };
  });
  root.querySelectorAll("[data-unpaid]").forEach(b => b.onclick = () => run(() => B.update("ud_dues", b.dataset.unpaid, { status: "open", paidNote: "", paidBy: "", paidAt: null }), t("saved")));
  root.querySelectorAll("[data-ddel]").forEach(b => b.onclick = async () => { if (await confirmBox(t("ec.delQ"), t("delete")) && await run(() => B.del("ud_dues", b.dataset.ddel), t("deleted"))) log("economy", "− " + b.dataset.ddel); });
}
