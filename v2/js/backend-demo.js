// Демо-режим (?demo=1): усе зберігається лише в цьому браузері, база не потрібна.
// Потрібен, щоб подивитися сайт без входу і щоб перевіряти його під час розробки.
const KEY = "ud2-demo-v1";
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
    P("p9", "Bastian", "602", "tour", "", "02.11.2026"),
    P("p10", "Ярема", "990", "exiled", "podillia", "14.09.2026"),
  ]);
  const links = {
    [OWNER]: { pid: "p1" }, "hetman@demo.ua": { pid: "p2" }, "interior@demo.ua": { pid: "p3" }, "marko@demo.ua": { pid: "p4" },
  };
  const pos = (id, title, order, appointBy, holder = "") => [id, { title, order, appointBy, holder }];
  const positions = Object.fromEntries([
    pos("hetman", "Гетьман", 0, "election", "p2"),
    pos("pysar", "Генеральний писар", 1, "hetman", "p6"),
    pos("finance", "Секретар фінансів", 2, "hetman", "p5"),
    pos("interior", "Секретар внутрішніх справ", 3, "hetman", "p3"),
    pos("foreign", "Секретар закордонних справ", 4, "hetman"),
    pos("defense", "Секретар оборони (головнокомандувач)", 5, "hetman", "p7"),
    pos("press", "Прес-секретар", 6, "hetman"),
    pos("prosecutor", "Прокурор", 7, "hetman"),
  ]);
  const oldPlayers = { kind: "players", list: [
    { name: "Віктор", email: OWNER, profile: "255", since: "12.09.2026" },
    { name: "Старий Гравець", email: "old1@demo.ua", profile: "1200", since: "20.09.2026" },
    { name: "Турист Зі Старого", email: "old2@demo.ua", profile: "1300", tourist: true },
    { name: "Конфедерат", profile: "1400", tourist: true, confed: true },
  ] };
  return {
    ud_players: players, ud_links: links, ud_positions: positions,
    ud_config: { admins: { emails: [] } },
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
    else s.cb(rows(c));
  }
}
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
    if (o[k] && o[k].__del) delete o[k];
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
export function watchDoc(c, id, cb) { const s = { c, id, cb }; subs.push(s); setTimeout(() => cb(col(c)[id] ? { id, ...clone(col(c)[id]) } : null), 0); return () => subs.splice(subs.indexOf(s), 1); }

export function onAuth(cb) { authSubs.push(cb); setTimeout(() => cb(USER), 0); }
export async function signIn() { demoSwitch("new"); }
export async function signOut() { demoSwitch("guest"); }
