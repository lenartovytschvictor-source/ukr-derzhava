// 🏛 Зала слави: найбільш нагороджені, найбільше заслуг, ветерани служби, найстаріші громадяни, Гетьмани.
import { S, B, player, pos, soldier, serviceDays, rankOf, ms, isAdmin, log } from "../store.js";
import { EDIT } from "../app.js";
import { t } from "../i18n.js";
import { esc, avatar, fmtDate, run } from "../ui.js";
import { empty } from "./common.js";

const top = (arr, n = 10) => arr.sort((a, b) => b.n - a.n).slice(0, n);
const medal = i => ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
const dmy = s => { const m = String(s || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : Date.parse(s) || 0; };
function board(title, rows, val) {
  return `<section class="card fame"><h2>${title}</h2>${rows.length ? `<ol class="fmlist">${rows.map((r, i) => { const p = player(r.pid);
    return `<li class="${i < 3 ? "podium" : ""}"><span class="fmn">${medal(i)}</span><a class="who" href="#/narod/gravets/${esc(r.pid)}">${avatar(p || { name: "?" }, "av md")}<b>${esc(p ? p.name : "?")}</b></a><span class="grow hint">${r.sub || ""}</span><span class="fmv">${val(r)}</span></li>`; }).join("")}</ol>` : empty(t("hf.empty"))}</section>`;
}
// редактор колишніх Гетьманів (адмін, режим «Редагувати»): гравець з реєстру або просто ім'я
const hrow = (x = {}) => `<div class="hfrow" data-hfr><select data-f="pid"><option value="">${esc(t("hf.notInReg"))}</option>${S.players.slice().sort((a, b) => a.name.localeCompare(b.name, "uk")).map(p => `<option value="${esc(p.id)}"${x.pid === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
  <input data-f="name" maxlength="60" value="${esc(x.name || "")}" placeholder="${esc(t("hf.name"))}"><input data-f="from" maxlength="40" value="${esc(x.from || "")}" placeholder="${esc(t("hf.from"))}"><input data-f="to" maxlength="40" value="${esc(x.to || "")}" placeholder="${esc(t("hf.to"))}">
  <input data-f="note" maxlength="120" value="${esc(x.note || "")}" placeholder="${esc(t("hf.note"))}"><button type="button" class="ghost sm" data-hfup aria-label="↑">↑</button><button type="button" class="ghost sm danger" data-hfdel aria-label="${esc(t("delete"))}">✕</button></div>`;
function hetEditor(list) {
  return `<details class="hfedit"${list.length ? "" : " open"}><summary><b>✏️ ${esc(t("hf.edit"))}</b></summary><p class="hint">${esc(t("hf.editHint"))}</p>
    <div data-hflist>${list.map(hrow).join("")}</div><div class="row"><button type="button" class="sm" data-hfadd>+ ${esc(t("hf.add"))}</button><span class="grow"></span><button type="button" class="primary sm" data-hfsave>${esc(t("save"))}</button></div></details>`;
}
export function mount(root) {
  const box = root.querySelector("[data-hflist]"); if (!box) return;
  const bindRow = r => {
    r.querySelector("[data-hfdel]").onclick = () => r.remove();
    r.querySelector("[data-hfup]").onclick = () => { if (r.previousElementSibling) r.parentNode.insertBefore(r, r.previousElementSibling); };
    const sel = r.querySelector("[data-f=pid]"), nm = r.querySelector("[data-f=name]");
    const sync = () => { nm.hidden = !!sel.value; }; sel.onchange = sync; sync();
  };
  box.querySelectorAll("[data-hfr]").forEach(bindRow);
  root.querySelector("[data-hfadd]").onclick = () => { box.insertAdjacentHTML("beforeend", hrow()); bindRow(box.lastElementChild); };
  root.querySelector("[data-hfsave]").onclick = async () => {
    const list = [...box.querySelectorAll("[data-hfr]")].map(r => { const g = f => r.querySelector(`[data-f=${f}]`).value.trim(); const pid = g("pid");
      return { pid, name: pid ? ((player(pid) || {}).name || "") : g("name"), from: g("from"), to: g("to"), note: g("note") }; }).filter(x => x.pid || x.name);
    if (await run(() => B.set("ud_config", "fame", { hetmans: list.slice(0, 60) }, true), t("saved"))) log("fame", t("hf.hetmans") + ": " + list.length);
  };
}
export function render() {
  const live = S.players.filter(p => p.status !== "exiled");
  const alive = id => live.some(p => p.id === id);
  // нагороди
  const aw = {}; S.grants.filter(g => !g.revoked && alive(g.pid)).forEach(g => { (aw[g.pid] = aw[g.pid] || []).push(g); });
  const awRows = top(Object.entries(aw).map(([pid, gs]) => ({ pid, n: gs.length, sub: gs.map(g => (S.awards.find(a => a.id === g.award) || {}).emoji || "🏅").join(" ") })));
  // заслуги (зірочки)
  const st = {}; S.stars.filter(s => alive(s.pid)).forEach(s => { st[s.pid] = (st[s.pid] || 0) + (s.n || 0); });
  const stRows = top(Object.entries(st).filter(([, n]) => n > 0).map(([pid, n]) => ({ pid, n })));
  // ветерани служби
  const vet = top(S.army.filter(a => alive(a.id)).map(a => { const r = rankOf(a); return { pid: a.id, n: serviceDays(a), sub: r ? esc(r.name) : "" }; }).filter(r => r.n > 0));
  // найдавніші громадяни
  const old = S.players.filter(p => p.status === "cit" && dmy(p.since)).map(p => ({ pid: p.id, n: -dmy(p.since), d: p.since })).sort((a, b) => b.n - a.n).slice(0, 10);
  // Гетьмани: чинний, внесені вручну (колишні) і обрані на виборах на сайті
  const het = pos("hetman"), manual = (S.fame && S.fame.hetmans) || [];
  const hs = [];
  if (het && het.holder) hs.push({ pid: het.holder, cur: true, sub: het.since ? t("hf.sinceX", { x: fmtDate(het.since) }) : "" });
  manual.forEach(x => { if (!(x.pid && het && het.holder === x.pid && !x.to)) hs.push({ pid: x.pid, name: x.name, sub: [x.from, x.to].filter(Boolean).join(" — "), note: x.note }); });
  S.elections.filter(e => e.pos === "hetman" && e.stage === "done" && e.winner).sort((a, b) => ms(b.closedAt) - ms(a.closedAt))
    .forEach(e => { if (!hs.some(x => x.pid === e.winner)) hs.push({ pid: e.winner, sub: t("hf.electedX", { x: fmtDate(e.closedAt) }) }); });
  let h = `<p class="lead">${esc(t("hf.intro"))}</p>`;
  h += `<section class="card fame"><h2>👑 ${esc(t("hf.hetmans"))}</h2>${hs.length ? `<div class="pgrid">${hs.map(x => { const p = x.pid && player(x.pid), nm = p ? p.name : x.name || "?";
    return `<div class="pcard${x.cur ? " cur" : ""}">${avatar(p || { name: nm }, "av lg")}<div class="pct"><small>${esc(x.cur ? t("hf.current") : t("hf.former"))}${x.sub ? " · " + esc(x.sub) : ""}</small><b>${p ? `<a href="#/narod/gravets/${esc(p.id)}">${esc(nm)}</a>` : esc(nm)}</b>${x.note ? `<small class="hint">${esc(x.note)}</small>` : ""}</div></div>`; }).join("")}</div>` : empty(t("hf.empty"))}
    ${EDIT && isAdmin() ? hetEditor(manual) : ""}</section>`;
  h += `<div class="famegrid">`;
  h += board("🏅 " + esc(t("hf.awards")), awRows, r => `<b>${r.n}</b>`);
  h += board("⭐ " + esc(t("hf.stars")), stRows, r => `<b>${r.n}</b>`);
  h += board("🎖 " + esc(t("hf.veterans")), vet, r => `<b>${esc(t("hf.days", { n: r.n }))}</b>`);
  h += board("🪪 " + esc(t("hf.oldest")), old, r => `<small class="hint">${esc(t("hf.since", { x: r.d }))}</small>`);
  return h + `</div>`;
}
