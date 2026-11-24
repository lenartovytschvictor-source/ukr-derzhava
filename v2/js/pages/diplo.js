// 🤝 Дипломатія: держави, з якими є відносини, і угоди зі строками дії.
import { asset } from "../ui.js";
import { S, B, canDiplo, ms, log } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, run, modal, closeModal, confirmBox, pickImage, toast } from "../ui.js";
import { txt, empty, paras } from "./common.js";

const REL = { ally: "🤝", peace: "🕊", nonaggression: "🛡", neutral: "⚪", tension: "⚠️", war: "⚔️" };
const day = 864e5;
const parseDay = s => { const d = Date.parse(String(s || "") + "T12:00:00"); return isNaN(d) ? 0 : d; };
const fmtDay = s => { const d = parseDay(s); return d ? new Date(d).toLocaleDateString(document.documentElement.lang || "uk", { day: "numeric", month: "long", year: "numeric" }) : ""; };
function expiry(tr) {
  const u = parseDay(tr.until); if (!u) return { cls: "", txt: t("dp.noEnd") };
  const d = Math.ceil((u - Date.now()) / day);
  if (d < 0) return { cls: "ended", txt: t("dp.expired", { x: fmtDay(tr.until) }) };
  return { cls: d <= 14 ? "soon" : "", txt: t("dp.until", { x: fmtDay(tr.until), n: d }) };
}

export function render() {
  const ed = EDIT && canDiplo();
  const states = S.states.slice().sort((a, b) => a.name.localeCompare(b.name, "uk"));
  let h = txt("dyplomatiya", "intro", t("dp.intro"), { cls: "lead" });
  if (canDiplo() && !S.states.length && !S.treaties.length) h += `<div class="card warn small">${esc(t("dp.seedHint"))} <button type="button" class="sm" data-dseed>${esc(t("dp.seed"))}</button></div>`;
  h += `<section class="card"><div class="row between"><h2>${esc(t("dp.states"))}</h2>${ed ? `<button type="button" class="primary sm" data-snew>+ ${esc(t("dp.addState"))}</button>` : ""}</div>
    ${states.length ? `<div class="sgrid">${states.map(s => {
      const n = S.treaties.filter(x => x.state === s.id).length;
      return `<div class="scard rel-${esc(s.status)}">${s.flag ? `<img src="${esc(s.flag)}" alt="${esc(t("hs.flag"))}">` : `<span class="noflag" aria-hidden="true">🏳</span>`}
        <div class="grow"><b>${esc(s.name)}</b><div class="relb">${REL[s.status] || ""} ${esc(t("dp.rel." + s.status))}</div>${s.note ? `<small class="hint">${esc(s.note)}</small>` : ""}<small class="hint">${esc(t("dp.treatiesN", { n }))}</small></div>
        ${ed ? `<button type="button" class="ghost sm" data-sedit="${esc(s.id)}" aria-label="${esc(t("edit"))}">✏️</button>` : ""}</div>`;
    }).join("")}</div>` : empty(t("dp.noStates"))}</section>`;
  const trs = S.treaties.slice().sort((a, b) => parseDay(b.signed) - parseDay(a.signed));
  h += `<section class="card"><div class="row between"><h2>${esc(t("dp.treaties"))}</h2>${ed && states.length ? `<button type="button" class="primary sm" data-tnew>+ ${esc(t("dp.addTreaty"))}</button>` : ""}</div>
    ${trs.length ? trs.map(tr => {
      const s = S.states.find(x => x.id === tr.state); const ex = expiry(tr);
      return `<details class="treaty"><summary><span class="grow"><b>${esc(tr.title)}</b><small class="hint">${s ? esc(s.name) + " · " : ""}${esc(t("dp.signed", { x: fmtDay(tr.signed) }))}</small></span><span class="exp ${ex.cls}">${esc(ex.txt)}${tr.untilNote ? " · " + esc(tr.untilNote) : ""}</span></summary>
        <div class="ttext">${paras(tr.text)}</div>${ed ? `<div class="row end"><button type="button" class="ghost sm" data-tedit="${esc(tr.id)}">✏️ ${esc(t("edit"))}</button></div>` : ""}</details>`;
    }).join("") : empty(t("dp.noTreaties"))}</section>`;
  return h;
}

function stateForm(s) {
  const isNew = !s; s = s || { name: "", status: "peace", note: "", flag: "" };
  let flag = s.flag || "";
  const w = modal(isNew ? t("dp.addState") : s.name, `<form class="form" data-sform>
    <div class="avedit"><span class="flagprev">${flag ? `<img src="${esc(flag)}" alt="">` : "🏳"}</span><button type="button" class="ghost sm" data-flag>${esc(t("dp.flag"))}</button></div>
    <label>${esc(t("dp.name"))}<input name="name" required maxlength="80" value="${esc(s.name)}"></label>
    <label>${esc(t("dp.relation"))}<select name="status">${Object.keys(REL).map(k => `<option value="${k}"${s.status === k ? " selected" : ""}>${REL[k]} ${esc(t("dp.rel." + k))}</option>`).join("")}</select></label>
    <label>${esc(t("dp.note"))}<input name="note" maxlength="200" value="${esc(s.note || "")}"></label>
    <div class="row end">${isNew ? "" : `<button type="button" class="ghost danger" data-sdel>${esc(t("delete"))}</button>`}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div></form>`);
  w.querySelector("[data-flag]").onclick = async () => { const v = await pickImage(200); if (v) { flag = v; w.querySelector(".flagprev").innerHTML = `<img src="${v}" alt="">`; } };
  const d = w.querySelector("[data-sdel]");
  if (d) d.onclick = async () => {
    if (S.treaties.some(x => x.state === s.id)) return toast(t("dp.hasTreaties"), "err");
    if (await confirmBox(t("dp.delStateQ", { x: s.name }), t("delete")) && await run(() => B.del("ud_states", s.id), t("deleted"))) { log("diplo", `− ${s.name}`); closeModal(); }
  };
  w.querySelector("[data-sform]").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const v = { name: f.name.value.trim().slice(0, 80), status: f.status.value, note: f.note.value.trim().slice(0, 200), flag };
    if (await run(() => B.set("ud_states", isNew ? B.newId("ud_states") : s.id, v), t("saved"))) { log("diplo", `${v.name}: ${t("dp.rel." + v.status)}`); closeModal(); }
  };
}
function treatyForm(tr) {
  const isNew = !tr; tr = tr || { state: (S.states[0] || {}).id, title: "", signed: new Date().toISOString().slice(0, 10), until: "", untilNote: "", text: "" };
  const w = modal(isNew ? t("dp.addTreaty") : tr.title, `<form class="form" data-tform>
    <label>${esc(t("dp.state"))}<select name="state">${S.states.map(s => `<option value="${esc(s.id)}"${s.id === tr.state ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
    <label>${esc(t("dp.ttitle"))}<input name="title" required maxlength="150" value="${esc(tr.title)}"></label>
    <div class="row2"><label>${esc(t("dp.signedOn"))}<input type="date" name="signed" value="${esc(tr.signed || "")}"></label>
    <label>${esc(t("dp.validUntil"))}<input type="date" name="until" value="${esc(tr.until || "")}"></label></div>
    <label>${esc(t("dp.untilNote"))}<input name="untilNote" maxlength="80" value="${esc(tr.untilNote || "")}" placeholder="${esc(t("dp.untilNotePh"))}"></label>
    <label>${esc(t("dp.text"))}<textarea name="text" rows="10" maxlength="30000">${esc(tr.text || "")}</textarea></label>
    <div class="row end">${isNew ? "" : `<button type="button" class="ghost danger" data-tdel>${esc(t("delete"))}</button>`}<span class="grow"></span><button type="button" class="ghost" data-close>${esc(t("cancel"))}</button><button class="primary">${esc(t("save"))}</button></div></form>`, { wide: true });
  const d = w.querySelector("[data-tdel]");
  if (d) d.onclick = async () => { if (await confirmBox(t("dp.delTreatyQ"), t("delete")) && await run(() => B.del("ud_treaties", tr.id), t("deleted"))) { log("diplo", `− ${tr.title}`); closeModal(); } };
  w.querySelector("[data-tform]").onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const v = { state: f.state.value, title: f.title.value.trim().slice(0, 150), signed: f.signed.value, until: f.until.value, untilNote: f.untilNote.value.trim().slice(0, 80), text: f.text.value.slice(0, 30000) };
    if (await run(() => B.set("ud_treaties", isNew ? B.newId("ud_treaties") : tr.id, v), t("saved"))) { log("diplo", `📄 ${v.title}`); closeModal(); }
  };
}

export function mount(root) {
  const sn = root.querySelector("[data-snew]"); if (sn) sn.onclick = () => stateForm(null);
  root.querySelectorAll("[data-sedit]").forEach(b => b.onclick = () => stateForm(S.states.find(s => s.id === b.dataset.sedit)));
  const tn = root.querySelector("[data-tnew]"); if (tn) tn.onclick = () => treatyForm(null);
  root.querySelectorAll("[data-tedit]").forEach(b => b.onclick = () => treatyForm(S.treaties.find(x => x.id === b.dataset.tedit)));
  const sd = root.querySelector("[data-dseed]");
  if (sd) sd.onclick = async () => {
    const d = await (await fetch(asset("data/diplo-seed.json"))).json();
    const ops = [...d.states.map(({ id, ...v }) => ({ op: "set", c: "ud_states", id, v: { flag: "", ...v } })), ...d.treaties.map(({ id, ...v }) => ({ op: "set", c: "ud_treaties", id, v }))];
    if (await run(() => B.batch(ops), t("saved"))) log("diplo", t("dp.seed"));
  };
}
