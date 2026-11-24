// Спільне для сторінок: вкладки, заглушки майбутніх етапів, тексти, які можна правити на місці.
import { S, B, canTexts, player, meetsRank, log } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, run, toast } from "../ui.js";

export function tabs(base, list, cur) {
  return `<div class="tabs" role="tablist">${list.map(([k, ic, label]) =>
    `<a role="tab" href="#/${base}/${k}" class="${k === cur ? "act" : ""}" aria-selected="${k === cur}"><span aria-hidden="true">${ic}</span> ${esc(t(label))}</a>`).join("")}</div>`;
}

export function soon(stage, what) {
  return `<div class="card soon"><div class="soonic" aria-hidden="true">🛠</div><h3>${esc(t("soon.title"))}</h3>
    <p>${esc(what)}</p><p class="hint">${esc(t("soon.stage", { n: stage }))}</p></div>`;
}

// абзаци з простого тексту: порожній рядок — новий абзац, **жирний**
export function paras(s) {
  return String(s || "").split(/\n{2,}|\r\n\r\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>")}</p>`).join("");
}

// текст, який адмін може змінити прямо на сторінці (зберігається в ud_texts/<сторінка>)
export function txt(page, key, def, { tag = "div", cls = "" } = {}) {
  const val = (S.texts[page] && S.texts[page][key] != null) ? S.texts[page][key] : def;
  if (EDIT && canTexts()) {
    return `<div class="etext ${cls}"><textarea data-tpage="${esc(page)}" data-tkey="${esc(key)}" rows="${Math.min(8, Math.max(2, String(val).split("\n").length + 1))}">${esc(val)}</textarea>
      <div class="row end"><button type="button" class="sm" data-tsave>${esc(t("save"))}</button></div></div>`;
  }
  return tag === "p" ? `<p class="${cls}">${esc(val)}</p>` : `<${tag} class="${cls}">${paras(val)}</${tag}>`;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-tsave]");
  if (!b) return;
  const ta = b.closest(".etext").querySelector("textarea");
  const page = ta.dataset.tpage, key = ta.dataset.tkey;
  if (await run(() => B.set("ud_texts", page, { [key]: ta.value.slice(0, 5000) }, true), t("saved"))) log("text", `${page}.${key}`);
});

export function empty(msg) { return `<p class="empty">${esc(msg)}</p>`; }
export const statusLabel = s => t(s === "cit" ? "st.cit" : s === "tour" ? "st.tour" : s === "exiled" ? "st.exiled" : "st.none");
export const statusIcon = s => s === "cit" ? "🪪" : s === "tour" ? "🧳" : s === "exiled" ? "⛔" : "❔";

// Вибір людини на посаду (адмін, Гетьман, Осавул — у режимі «Редагувати»).
// Якщо посада належить землі — спершу прописані в ній, далі всі інші громадяни.
// Хто не має мінімального звання посади — у списку, але недоступний.
export function holderSel(p, landId) {
  const cit = S.players.filter(c => c.status === "cit").sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const opt = c => { const ok = meetsRank(c.id, p.minRank);
    return `<option value="${esc(c.id)}"${c.id === p.holder ? " selected" : ""}${ok || c.id === p.holder ? "" : " disabled"}>${esc(c.name)}${ok ? "" : " — " + esc(t("pw.lowRank"))}</option>`; };
  const here = landId ? cit.filter(c => c.land === landId) : [];
  const rest = landId ? cit.filter(c => c.land !== landId) : cit;
  return `<select data-hold="${esc(p.id)}" aria-label="${esc(p.title)}"><option value="">— ${esc(t("vacant"))} —</option>${here.length
    ? `<optgroup label="${esc(t("pw.residents"))}">${here.map(opt).join("")}</optgroup><optgroup label="${esc(t("pw.others"))}">${rest.map(opt).join("")}</optgroup>`
    : rest.map(opt).join("")}</select>`;
}
export function bindHolders(root) {
  root.querySelectorAll("[data-hold]").forEach(s => s.onchange = async () => {
    const p = S.positions.find(x => x.id === s.dataset.hold); if (!p) return;
    const pl = player(s.value);
    if (await run(() => B.update("ud_positions", p.id, { holder: s.value || "", since: B.now() }), t("saved")))
      log("appoint", `${p.title}: ${pl ? pl.name : t("vacant")}`);
  });
}
