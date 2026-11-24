// 🏛 Зала слави: найбільш нагороджені, найбільше заслуг, ветерани служби, найстаріші громадяни, Гетьмани.
import { S, player, pos, soldier, serviceDays, rankOf, ms } from "../store.js";
import { t } from "../i18n.js";
import { esc, avatar, fmtDate } from "../ui.js";
import { empty } from "./common.js";

const top = (arr, n = 10) => arr.sort((a, b) => b.n - a.n).slice(0, n);
const medal = i => ["🥇", "🥈", "🥉"][i] || `${i + 1}.`;
const dmy = s => { const m = String(s || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : Date.parse(s) || 0; };
function board(title, rows, val) {
  return `<section class="card fame"><h2>${title}</h2>${rows.length ? `<ol class="fmlist">${rows.map((r, i) => { const p = player(r.pid);
    return `<li class="${i < 3 ? "podium" : ""}"><span class="fmn">${medal(i)}</span><a class="who" href="#/narod/gravets/${esc(r.pid)}">${avatar(p || { name: "?" }, "av md")}<b>${esc(p ? p.name : "?")}</b></a><span class="grow hint">${r.sub || ""}</span><span class="fmv">${val(r)}</span></li>`; }).join("")}</ol>` : empty(t("hf.empty"))}</section>`;
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
  // Гетьмани: обрані на виборах + чинний
  const het = pos("hetman");
  const hs = S.elections.filter(e => e.pos === "hetman" && e.stage === "done" && e.winner).sort((a, b) => ms(b.closedAt) - ms(a.closedAt))
    .map(e => ({ pid: e.winner, when: ms(e.closedAt) }));
  if (het && het.holder && !hs.some(x => x.pid === het.holder)) hs.unshift({ pid: het.holder, when: ms(het.since) });
  let h = `<p class="lead">${esc(t("hf.intro"))}</p>`;
  h += `<section class="card fame"><h2>👑 ${esc(t("hf.hetmans"))}</h2>${hs.length ? `<div class="pgrid">${hs.map((x, i) => { const p = player(x.pid);
    return `<div class="pcard${i === 0 && het && het.holder === x.pid ? " cur" : ""}">${avatar(p || { name: "?" }, "av lg")}<div class="pct"><small>${i === 0 && het && het.holder === x.pid ? esc(t("hf.current")) : esc(t("hf.former"))}${x.when ? " · " + esc(fmtDate(x.when)) : ""}</small><b>${p ? `<a href="#/narod/gravets/${esc(p.id)}">${esc(p.name)}</a>` : "?"}</b></div></div>`; }).join("")}</div>` : empty(t("hf.empty"))}</section>`;
  h += `<div class="famegrid">`;
  h += board("🏅 " + esc(t("hf.awards")), awRows, r => `<b>${r.n}</b>`);
  h += board("⭐ " + esc(t("hf.stars")), stRows, r => `<b>${r.n}</b>`);
  h += board("🎖 " + esc(t("hf.veterans")), vet, r => `<b>${esc(t("hf.days", { n: r.n }))}</b>`);
  h += board("🪪 " + esc(t("hf.oldest")), old, r => `<small class="hint">${esc(t("hf.since", { x: r.d }))}</small>`);
  return h + `</div>`;
}
