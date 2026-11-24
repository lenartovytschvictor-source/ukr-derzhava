// ⚙️ Автоматичні дії законів: що зміниться на сайті, коли закон підписано (або Палата подолала вето).
// Модуль без залежностей від браузера: його використовують і сайт (адмін застосовує одразу),
// і державний бот (застосовує сам протягом ~15 хвилин). Сайт і бот мають однаковий результат.

// групи й типи дій (назви — у перекладах fx.t.<тип> і fx.g.<група>)
export const FX_GROUPS = [
  ["const", ["constRep", "constAdd", "constDel", "constFull"]],
  ["posts", ["appoint", "dismiss"]],
  ["lands", ["landRename", "landSym", "landNew", "landStatus", "placeMove"]],
  ["laws", ["lawRepeal", "lawRedo", "decreeRevoke"]],
  ["cal", ["holidayAdd", "holidayDel"]],
  ["emer", ["emerOn", "emerOff"]],
];
export const FX_TYPES = FX_GROUPS.flatMap(g => g[1]);
export const LAND_STATUSES = ["normal", "autonomy", "occupied", "lost"];

// ---------- Конституція: статті ----------
const ART = /^\s*(?:Стаття|Article|Статья|Artículo|Artykuł)\s+(\d+[\w-]*)/i;
const lines = text => String(text || "").split(/\r?\n/);
// межі статті: від рядка «Стаття N» до наступної статті чи заголовка розділу
function artRange(L, num) {
  const s = L.findIndex(l => { const m = l.match(ART); return m && m[1] === String(num); });
  if (s < 0) return null;
  let e = s + 1;
  while (e < L.length && !ART.test(L[e]) && !/^\s*#/.test(L[e])) e++;
  return [s, e];
}
export function articles(text) {
  const L = lines(text), out = [];
  L.forEach((l, i) => { const m = l.match(ART); if (m) { const r = artRange(L, m[1]); out.push({ num: m[1], head: l.trim(), body: L.slice(r[0], r[1]).join("\n").trim() }); } });
  return out;
}
export const nextArtNum = text => Math.max(0, ...articles(text).map(a => parseInt(a.num, 10) || 0)) + 1;
export function constApply(text, fx, billText) {
  const L = lines(text);
  if (fx.type === "constFull") return String(billText || "").trim();
  if (fx.type === "constAdd") {
    const add = String(fx.text || "").trim().split(/\r?\n/);
    const r = fx.after ? artRange(L, fx.after) : null;
    if (r) { L.splice(r[1], 0, ...add, ""); return L.join("\n").replace(/\n{3,}/g, "\n\n").trim(); }
    return (L.join("\n").trim() + "\n\n" + add.join("\n")).trim();
  }
  const r = artRange(L, fx.art);
  if (!r) throw new Error("article " + fx.art + " not found");
  if (fx.type === "constDel") L.splice(r[0], r[1] - r[0]);
  else L.splice(r[0], r[1] - r[0], ...String(fx.text || "").trim().split(/\r?\n/), "");
  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------- обчислення змін ----------
// D: { positions, lands, places, laws, holidays, constitution, law (запис закону, що виник із законопроєкту) }
// now: мітка часу сервера (на сайті B.now(), у бота FieldValue.serverTimestamp())
// Повертає список операцій { op: set|update|del, c, id, v, merge }.
export function fxOps(b, D, now) {
  const fx = b.fx || {}, ops = [];
  const lawId = D.law ? D.law.id : "";
  const landsList = () => (D.lands || []).map(l => ({ ...l }));
  const setLands = list => ops.push({ op: "set", c: "ud_config", id: "lands", v: { list }, merge: true });
  const need = (v, what) => { if (v == null || v === "") throw new Error("missing " + what); return v; };
  switch (fx.type) {
    case "constRep": case "constAdd": case "constDel": case "constFull": {
      const c = D.constitution || {}, ver = (c.ver || 0) + 1;
      const text = constApply(c.text || "", fx, b.text);
      if (!text.trim()) throw new Error("empty constitution");
      const v = { text: text.slice(0, 200000), basis: lawId, ver, by: b.signedBy || "", at: now };
      ops.push({ op: "set", c: "ud_law", id: "constitution", v }, { op: "set", c: "ud_law/constitution/hist", id: "v" + ver, v });
      break;
    }
    case "appoint":
      ops.push({ op: "update", c: "ud_positions", id: need(fx.pos, "pos"), v: { holder: need(fx.pid, "pid"), since: now } }); break;
    case "dismiss":
      ops.push({ op: "update", c: "ud_positions", id: need(fx.pos, "pos"), v: { holder: "", since: now } }); break;
    case "landRename": {
      const list = landsList(), l = list.find(x => x.id === fx.land); if (!l) throw new Error("land");
      l.name = need(String(fx.name || "").trim(), "name").slice(0, 80); if (fx.short) l.short = String(fx.short).trim().slice(0, 40);
      setLands(list); break;
    }
    case "landSym": {
      const key = need(fx.key, "key"), v = { land: fx.land || "" };
      if (fx.coat) v.coat = fx.coat; if (fx.flag) v.flag = fx.flag;
      ops.push({ op: "set", c: "ud_symbols", id: key, v, merge: true }); break;
    }
    case "landNew": {
      const list = landsList(), name = need(String(fx.name || "").trim(), "name").slice(0, 80);
      let id = String(fx.id || "").replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "land" + Date.now().toString(36);
      while (list.some(x => x.id === id)) id += "2";
      list.push({ id, name, short: String(fx.short || name).trim().slice(0, 40), color: fx.color || "#9aa7b8", order: list.length, regions: [] });
      setLands(list); break;
    }
    case "landStatus": {
      const list = landsList(), l = list.find(x => x.id === fx.land); if (!l) throw new Error("land");
      l.status = LAND_STATUSES.includes(fx.status) ? fx.status : "normal"; l.statusNote = String(fx.note || "").slice(0, 200);
      l.statusAt = new Date().toISOString().slice(0, 10);
      setLands(list); break;
    }
    case "placeMove":
      ops.push({ op: "update", c: "ud_places", id: need(fx.place, "place"), v: { land: need(fx.land, "land") } }); break;
    case "lawRepeal": case "decreeRevoke":
      ops.push({ op: "update", c: "ud_laws", id: need(fx.law, "law"), v: { status: "repealed", note: (lawId ? "law:" + lawId : "").slice(0, 300) } }); break;
    case "lawRedo":
      ops.push({ op: "update", c: "ud_laws", id: need(fx.law, "law"), v: { text: String(b.text || "").slice(0, 30000), status: "active", note: (lawId ? "redo:" + lawId : "").slice(0, 300) } }); break;
    case "holidayAdd": {
      const d = String(fx.date || ""); if (!/^\d{2}-\d{2}$/.test(d)) throw new Error("date");
      ops.push({ op: "set", c: "ud_holidays", id: "law_" + b.id, v: { name: need(String(fx.name || "").trim(), "name").slice(0, 80), date: d, yearly: true, kind: "state", desc: String(fx.desc || "").slice(0, 200), law: lawId } });
      break;
    }
    case "holidayDel":
      ops.push({ op: "del", c: "ud_holidays", id: need(fx.holiday, "holiday") }); break;
    case "emerOn": {
      const days = Math.max(1, Math.min(30, parseInt(fx.days, 10) || 7));
      ops.push({ op: "set", c: "ud_config", id: "site", v: { emergency: { on: true, reason: String(fx.reason || "").slice(0, 300), from: Date.now(), until: Date.now() + days * 864e5, law: lawId, by: b.signedBy || "" } }, merge: true });
      break;
    }
    case "emerOff":
      ops.push({ op: "set", c: "ud_config", id: "site", v: { emergency: { on: false, until: Date.now(), law: lawId } }, merge: true }); break;
    default: break;
  }
  return ops;
}

// законопроєкт, чия дія ще не виконана: підписаний або вето подолано
export const fxPending = b => !!(b.fx && b.fx.type && FX_TYPES.includes(b.fx.type) && ["signed", "overridden"].includes(b.status) && !b.fxDone);
