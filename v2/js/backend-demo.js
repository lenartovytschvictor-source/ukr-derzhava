// Демо-режим (?demo=1): усе зберігається лише в цьому браузері, база не потрібна.
// Потрібен, щоб подивитися сайт без входу і щоб перевіряти його під час розробки.
const KEY = "ud2-demo-v5";
const OWNER = "lenartovytsch.victor@gmail.com";
export const isDemo = true;

let D = {};           // { колекція: { id: дані } }
let USER = null;
const subs = [];      // { c, id?, cb }
const authSubs = [];

export const USERS = [
  { key: "guest", label: "Гість (не ввійшов)", user: null },
  { key: "owner", label: "Віктор — адмін", user: { uid: "u1", email: OWNER, name: "Віктор" } },
  { key: "hetman", label: "Олександр — Гетьман", user: { uid: "u2", email: "hetman@demo.ua", name: "Олександр" } },
  { key: "interior", label: "Остап — Секретар внутрішніх справ", user: { uid: "u3", email: "interior@demo.ua", name: "Остап" } },
  { key: "judge", label: "Kivi — суддя", user: { uid: "u6", email: "kivi@demo.ua", name: "Kivi" } },
  { key: "cit", label: "Марко — громадянин", user: { uid: "u4", email: "marko@demo.ua", name: "Марко" } },
  { key: "new", label: "Новенький — ще не зареєстрований", user: { uid: "u5", email: "new@demo.ua", name: "Новенький" } },
];

function seed() {
  const P = (id, name, profile, status, land, since) => [id, { name, profile, status, land, since, at: Date.now() }];
  const players = Object.fromEntries([
    P("p1", "Віктор", "255", "cit", "kyiv", "12.09.2026"),
    P("p2", "Олександр", "7", "cit", "kyivska", "12.09.2026"),
    P("p3", "Остап", "302", "cit", "halych", "15.09.2026"),
    P("p4", "Марко", "411", "cit", "sloboda", "20.09.2026"),
    P("p5", "Kivi", "182", "cit", "naddnipro", "01.10.2026"),
    P("p6", "Зоряна", "530", "cit", "volyn", "03.10.2026"),
    P("p7", "Тарас", "618", "cit", "prychornomor", "10.10.2026"),
    P("p8", "Al-Ain", "2026", "tour", "", "18.11.2026"),
    P("p9", "Bastian", "602", "cit", "kyiv", "02.11.2026"),
    P("p10", "Ярема", "990", "exiled", "podillia", "14.09.2026"),
  ]);
  const links = {
    [OWNER]: { pid: "p1" }, "hetman@demo.ua": { pid: "p2" }, "interior@demo.ua": { pid: "p3" }, "marko@demo.ua": { pid: "p4" }, "kivi@demo.ua": { pid: "p5" },
  };
  const pos = (id, title, order, appointBy, holder = "", extra = {}) => [id, { title, order, appointBy, holder, ...extra }];
  const LANDS = [["volyn", "Волинська", "p6"], ["halych", "Галицька", "p3"], ["zakarpattia", "Закарпатська"], ["podillia", "Подільсько-Буковинська"], ["kyivska", "Київська", "p1"],
    ["naddnipro", "Наддніпрянська", "p5"], ["sicheslav", "Січеславська"], ["sloboda", "Слобідська", "p4"], ["prychornomor", "Причорноморська", "p7"], ["kyiv", "Київ"]];
  const positions = Object.fromEntries([
    pos("hetman", "Гетьман", 0, "election", "p2"),
    pos("pysar", "Генеральний писар", 1, "hetman", "p6"),
    pos("finance", "Секретар фінансів", 2, "hetman", "p5"),
    pos("interior", "Секретар внутрішніх справ", 3, "hetman", "p3"),
    pos("foreign", "Секретар закордонних справ", 4, "hetman"),
    pos("defense", "Секретар оборони (головнокомандувач)", 5, "hetman", "p7"),
    pos("press", "Прес-секретар", 6, "hetman"),
    pos("prosecutor", "Прокурор", 7, "hetman"),
    pos("chair", "Голова Палати Земель", 100, "election", "p6", { chamber: "chair" }),
    ...LANDS.map(([id, n, h], i) => pos("seat_" + id, "Представник: " + n, 101 + i, "election", h || "", { chamber: "zemska", land: id })),
    ...LANDS.map(([id, n], i) => pos("osavul_" + id, "Крайовий Осавул: " + n, 50 + i, "election", id === "sloboda" ? "p4" : id === "halych" ? "p3" : "", { land: id })),
    pos("patriarch", "Патріарх", 90, "admin", "p9", { church: true }),
    pos("judge_1", "Суддя 1", 30, "election", "p5", { court: true, since: Date.now() - 10 * 864e5 }),
    pos("judge_2", "Суддя 2", 31, "election", "p7", { court: true, since: Date.now() - 70 * 864e5 }),
    pos("judge_3", "Суддя 3", 32, "election", "", { court: true }),
    pos("pl_x1", "Війт міста Харків", 301, "osavul", "p4", { chamber: "sotenna", land: "sloboda", place: "x1" }),
    pos("pl_x2", "Джура уділу Сумський", 302, "osavul", "", { chamber: "sotenna", land: "sloboda", place: "x2" }),
  ]);
  const H = 3600e3, T0 = Date.now();
  const day = n => new Date(T0 + n * 864e5).toISOString().slice(0, 10);
  const bills = {
    b1: { title: "Про державні свята", text: "Стаття 1. Державними святами є День Незалежності, День Державного прапора і День Гетьманату.\nСтаття 2. У дні свят у загальному чаті проводяться урочистості.", kind: "law", author: "p6", seat: "seat_volyn", status: "voting", at: T0 - 30 * H, voteStart: T0 - 2 * H, voteEnd: T0 + 22 * H },
    b2: { title: "Про охорону кордонів", text: "Стаття 1. Секретар оборони щотижня звітує Палаті про стан кордонів.", kind: "law", author: "p4", seat: "seat_sloboda", status: "discussion", at: T0 - 5 * H },
    b3: { title: "Про відкриття школи для новачків", text: "Просимо створити наставництво для нових громадян.", kind: "petition", author: "p4", status: "signatures", at: T0 - 50 * H },
  };
  const elections = {
    e1: { pos: "seat_zakarpattia", title: "Представник: Закарпатська", scope: "zakarpattia", stage: "nomination", nomEnd: T0 + 40 * H, voteHours: 48, by: "p1", at: T0 - 8 * H },
  };
  const oldPlayers = { kind: "players", list: [
    { name: "Віктор", email: OWNER, profile: "255", since: "12.09.2026" },
    { name: "Старий Гравець", email: "old1@demo.ua", profile: "1200", since: "20.09.2026" },
    { name: "Турист Зі Старого", email: "old2@demo.ua", profile: "1300", tourist: true },
    { name: "Конфедерат", profile: "1400", tourist: true, confed: true },
  ] };
  return {
    ud_players: players, ud_links: links, ud_positions: positions,
    ud_config: { admins: { emails: [] } },
    ud_bills: bills, "ud_bills/b1/votes": { p6: { v: "for", seat: "seat_volyn", at: T0 - H }, p3: { v: "against", seat: "seat_halych", at: T0 - H }, p7: { v: "for", seat: "seat_prychornomor", at: T0 - H } },
    "ud_bills/b3/signs": { p4: { at: T0 - 40 * H }, p7: { at: T0 - 20 * H } },
    "ud_bills/b2/cmts": { c1: { by: "p3", text: "Підтримую, але звіт раз на два тижні.", at: T0 - 3 * H } },
    ud_elections: elections,
    ud_codes: { admin: { name: "Адміністративний кодекс", desc: "", order: 0 }, criminal: { name: "Кримінальний кодекс", desc: "Злочини проти держави та громадян.", order: 1 }, military: { name: "Військовий кодекс", desc: "", order: 2 } },
    ud_laws: {
      l1: { kind: "law", no: 1, title: "Про Палату Земель", text: "Стаття 1. Палата Земель складається із Земської і Сотенної лав.", code: "admin", status: "active", date: "2026-11-20", by: "p2", at: T0 - 80 * H },
      l2: { kind: "law", no: 2, title: "Про державну зраду", text: "Стаття 1. Державна зрада карається позбавленням права обіймати посади до 3 місяців.", code: "criminal", status: "active", date: "2026-11-21", by: "p2", at: T0 - 60 * H },
      l3: { kind: "law", no: 3, title: "Про тимчасовий порядок", text: "Втратив чинність.", code: "admin", status: "repealed", date: "2026-11-10", by: "p2", at: T0 - 300 * H },
      d1: { kind: "decree", no: 1, title: "Про призначення уряду", text: "Призначити членів уряду згідно з додатком.", code: "", status: "active", date: "2026-11-22", by: "p2", at: T0 - 30 * H },
    },
    ud_law: { constitution: { text: "# Розділ I. Загальні засади\nСтаття 1. Українська Держава є суверенною державою гравців DragPolit.\nСтаття 2. Державна мова — українська.\n\n# Розділ II. Гетьман\nСтаття 3. Гетьман є главою держави.\nСтаття 4. Нові вибори Гетьмана ініціює Палата Земель.", basis: "", ver: 1, by: "p1", at: T0 - 90 * H } },
    "ud_law/constitution/hist": { v1: { text: "# Розділ I. Загальні засади\nСтаття 1. Українська Держава є суверенною державою гравців DragPolit.", basis: "", ver: 1, by: "p1", at: T0 - 90 * H } },
    ud_counters: { cases: { n: 2 } },
    ud_units: {
      polk: { name: "1-й Слобідський полк", color: "#2e5aac", emblem: "", commander: "p6", parent: "", desc: "Основна частина війська на сході.", order: 0 },
      sotnia1: { name: "Харківська сотня", color: "#c0392b", emblem: "", commander: "p4", parent: "polk", desc: "", order: 1 },
      des1: { name: "Перший десяток", color: "#27ae60", emblem: "", commander: "", parent: "sotnia1", desc: "", order: 2 },
    },
    ud_army: {
      p6: { unit: "polk", since: day(-300), stars: 130, appointed: "polkovnyk" },
      p5: { unit: "sotnia1", since: day(-120), stars: 60, appointed: "" },
      p4: { unit: "sotnia1", since: day(-40), stars: 12, appointed: "" },
      p7: { unit: "des1", since: day(-5), stars: 0, appointed: "" },
    },
    ud_stars: { s1: { pid: "p4", n: 5, reason: "Оборона Харкова", by: "p6", unit: "sotnia1", at: T0 - 10 * H }, s2: { pid: "p5", n: 10, reason: "Розвідка", by: "p4", unit: "sotnia1", at: T0 - 5 * H } },
    ud_awards: { a1: { name: "Хрест Захисника", emoji: "✠", img: "", desc: "За оборону державних кордонів.", issuers: ["defense"], order: 0 }, a2: { name: "Орден Гетьмана", emoji: "🎖", img: "", desc: "Найвища нагорода держави.", issuers: [], order: 1 } },
    ud_grants: { g1: { award: "a1", pid: "p4", reason: "Оборона Харкова", by: "p2", at: T0 - 9 * H } },
    ud_church: { main: { about: "Українська Церква — духовна опора держави.", statute: "Стаття 1. Церква відокремлена від держави.\nСтаття 2. Очолює Церкву Патріарх." } },
    ud_clergy: { c1: { pid: "p9", title: "Митрополит", parish: "pr1", order: 0 } },
    ud_parishes: { pr1: { name: "Собор Святої Софії", land: "kyiv", priest: "p9", desc: "" } },
    ud_holidays: {
      h1: { name: "Різдво Христове", date: "12-25", yearly: true, kind: "church", desc: "" },
      h2: { name: "День Незалежності", date: "08-24", yearly: true, kind: "state", desc: "" },
      h3: { name: "Хрещення Русі", date: "07-28", yearly: true, kind: "church", desc: "" },
      h4: { name: "День Гетьманату", date: "12-01", yearly: true, kind: "state", desc: "" },
    },
    ud_cases: {
      k1: { no: 1, title: "Невиплата внеску до казни", text: "Відповідач тричі не сплатив внесок.", plaintiff: "p4", defendant: "p7", forState: false, closed: false, status: "filed", judge: "", parties: ["p4", "p7"], at: T0 - 20 * H },
      k2: { no: 2, title: "Державна зрада", text: "Відповідач передав плани оборони іншій державі.", plaintiff: "p3", defendant: "p10", forState: true, closed: true, status: "verdict", judge: "p5", parties: ["p3", "p10", "p5"], at: T0 - 100 * H,
        verdict: "Вину доведено.", sentence: "позбавлення звання", laws: ["l2"], banUntil: "2027-02-20", decidedAt: T0 - 50 * H },
    },
    ud_places: { x1: { land: "sloboda", kind: "city", name: "Харків", note: "", order: 1 }, x2: { land: "sloboda", kind: "udil", name: "Сумський", note: "", order: 2 } },
    ud_apps: { "new@demo.ua": { name: "Новенький", profile: "3001", kind: "cit", note: "Хочу долучитися", status: "new", at: Date.now() - 3600e3 } },
    site: { players: { json: JSON.stringify(oldPlayers) } },
  };
}

function load() { try { D = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (_) { D = seed(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (_) {} }
const clone = x => JSON.parse(JSON.stringify(x));
const col = c => (D[c] = D[c] || {});
const rows = c => Object.entries(col(c)).map(([id, v]) => ({ id, ...clone(v) }));

function emit(c, id) {
  for (const s of subs) {
    if (s.c !== c) continue;
    if (s.id) { if (s.id === id) s.cb(col(c)[id] ? { id, ...clone(col(c)[id]) } : null); }
    else s.cb(s.f ? rows(c).filter(s.f) : rows(c));
  }
}
// вибірка за умовою (як where у Firestore): op — "==" або "array-contains"
const cond = (field, op, value) => r => op === "array-contains" ? (r[field] || []).includes(value) : r[field] === value;
// перевірка прав у демо не потрібна: її робить інтерфейс, а справжні правила — Firebase

const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} } };
export async function init() {
  load();
  const k = ss.get(KEY + "-user") || "owner";
  USER = (USERS.find(u => u.key === k) || USERS[1]).user;
}
export function demoSwitch(k) { ss.set(KEY + "-user", k); location.reload(); }
export function demoUserKey() { return ss.get(KEY + "-user") || "owner"; }
export function demoReset() { try { localStorage.removeItem(KEY); } catch (_) {} location.reload(); }

const tick = () => new Promise(r => setTimeout(r, 30));
const resolve = v => {
  const o = clone(v);
  for (const k in o) {
    if (o[k] && o[k].__now) o[k] = Date.now();
    else if (o[k] && o[k].__del) delete o[k];
    else if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) for (const j in o[k]) if (o[k][j] && o[k][j].__now) o[k][j] = Date.now();   // вкладені мітки часу
  }
  return o;
};
export const now = () => ({ __now: 1 });
export const delField = () => ({ __del: 1 });

export const get = async (c, id) => { await tick(); return col(c)[id] ? { id, ...clone(col(c)[id]) } : null; };
export const list = async c => { await tick(); return rows(c); };
export async function set(c, id, v, merge) {
  await tick();
  col(c)[id] = merge ? resolve({ ...(col(c)[id] || {}), ...v }) : resolve(v);
  save(); emit(c, id);
}
export async function update(c, id, v) {
  await tick();
  if (!col(c)[id]) throw new Error("Документ не знайдено");
  col(c)[id] = resolve({ ...col(c)[id], ...v });
  save(); emit(c, id);
}
export async function del(c, id) { await tick(); delete col(c)[id]; save(); emit(c, id); }
export const newId = () => "d" + Math.random().toString(36).slice(2, 10);
export async function add(c, v) { const id = newId(); await set(c, id, v); return id; }
export async function batch(ops) {
  for (const o of ops) {
    if (o.op === "set") col(o.c)[o.id] = o.merge ? resolve({ ...(col(o.c)[o.id] || {}), ...o.v }) : resolve(o.v);
    else if (o.op === "update") col(o.c)[o.id] = resolve({ ...(col(o.c)[o.id] || {}), ...o.v });
    else if (o.op === "del") delete col(o.c)[o.id];
  }
  save();
  for (const o of ops) emit(o.c, o.id);
}
export function watch(c, cb) { const s = { c, cb }; subs.push(s); setTimeout(() => cb(rows(c)), 0); return () => subs.splice(subs.indexOf(s), 1); }
export function watchWhere(c, field, op, value, cb) { const s = { c, cb, f: cond(field, op, value) }; subs.push(s); setTimeout(() => cb(rows(c).filter(s.f)), 0); return () => subs.splice(subs.indexOf(s), 1); }
export function watchDoc(c, id, cb) { const s = { c, id, cb }; subs.push(s); setTimeout(() => cb(col(c)[id] ? { id, ...clone(col(c)[id]) } : null), 0); return () => subs.splice(subs.indexOf(s), 1); }

export function onAuth(cb) { authSubs.push(cb); setTimeout(() => cb(USER), 0); }
export async function signIn() { demoSwitch("new"); }
export async function signOut() { demoSwitch("guest"); }
